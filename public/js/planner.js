// Weekly meal planner logic. Owner: Person 4.
// Each week has its own plan, saved to Firestore at users/{uid}/mealPlan/{weekId}
// (weekId like "2026-W46", see schema.js). A copy is kept in localStorage per user
// so the page paints instantly and still works offline.

import { showToast, toTitleCase, showAuthPromptModal, showConfirmModal, escapeHtml, combineIngredients, sumShoppingMeasures } from "./utils.js";
import { getFavourites } from "./favourites.js";
import { confirmIfFlagged, checkIngredients } from "./preferences.js";
import { searchRecipes, getRecipeById } from "./api.js";
import { estimateNutrition } from "./nutrition.js";
import { getCurrentUser, onAuthChange } from "./auth.js";
import { auth } from "./firebase-config.js";
import {
  getCurrentWeekId,
  saveUserMealPlan,
  fetchUserMealPlan,
  createMealPlanDoc,
  saveUserShoppingList,
  fetchUserShoppingList
} from "./schema.js";

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const MEALS = ["Breakfast", "Lunch", "Dinner"];

// Side drawer / modal state
let currentDrawerDay = "Mon";
let currentDrawerMeal = "Breakfast";
let currentDrawerTab = "favs"; // 'favs' | 'search'
let searchDebounceTimeout = null;
let cachedFavourites = [];

const POPULAR_SEARCH_TAGS = [
  "Chicken",
  "Pasta",
  "Salad",
  "Beef",
  "Curry",
  "Vegetarian",
  "Soup",
  "Fish",
  "Pancake",
  "Breakfast"
];

// ---------- Plan storage ----------

// Which week is shown: 0 = this week, -1 = last week, 1 = next week.
let weekOffset = 0;

// The old single-week plan from before plans were saved per week and per account.
const LEGACY_PLAN_KEY = "recipeplan_weekly_plan";
// The demo plan older versions seeded on first visit. If the legacy plan still
// matches it exactly, the user never edited it, so it is dropped instead of migrated.
const LEGACY_DEMO_SIGNATURE =
  "Mon.Breakfast:52855|Mon.Lunch:53011|Mon.Dinner:52982|Tue.Breakfast:52957|Tue.Lunch:52830|Tue.Dinner:53194|" +
  "Wed.Breakfast:52854|Wed.Lunch:52772|Wed.Dinner:52844|Thu.Lunch:52874";

const memoryPlans = new Map(); // `${uid}/${weekId}` -> plan, loaded this session

export function emptyPlan() {
  const plan = {};
  DAYS.forEach((day) => {
    plan[day] = {};
    MEALS.forEach((meal) => (plan[day][meal] = null));
  });
  return plan;
}

function clonePlan(plan) {
  return JSON.parse(JSON.stringify(plan || emptyPlan()));
}

// Always returns every day and meal, with entries reduced to { id, name, image }.
function normalisePlan(plan) {
  return createMealPlanDoc(plan || {});
}

function planSignature(plan) {
  const parts = [];
  DAYS.forEach((day) =>
    MEALS.forEach((meal) => {
      const item = plan?.[day]?.[meal];
      if (item) parts.push(`${day}.${meal}:${item.id}`);
    })
  );
  return parts.join("|");
}

function isPlanEmpty(plan) {
  return planSignature(plan) === "";
}

// Monday of the week being shown (or another offset).
function weekStart(offset = weekOffset) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) + offset * 7);
  return monday;
}

export function shownWeekId() {
  return getCurrentWeekId(weekStart());
}

function cacheKey(uid) {
  return `recipeplan_meal_plans_${uid}`;
}

function readLocalPlans(uid) {
  try {
    return JSON.parse(localStorage.getItem(cacheKey(uid)) || "{}") || {};
  } catch (e) {
    return {};
  }
}

function writeLocalPlan(uid, weekId, plan) {
  try {
    const all = readLocalPlans(uid);
    if (isPlanEmpty(plan)) delete all[weekId];
    else all[weekId] = plan;
    localStorage.setItem(cacheKey(uid), JSON.stringify(all));
  } catch (e) {}
}

// Firebase has restored the session, so Firestore reads and writes will pass the rules.
function cloudUid() {
  return auth?.currentUser?.uid || null;
}

// Moves a plan saved by an older version (browser only, one repeating week) into
// this week's plan on the account, once. The unedited demo plan is just dropped.
async function migrateLegacyPlan(uid, weekId, cloudPlan) {
  let legacy = null;
  try {
    legacy = JSON.parse(localStorage.getItem(LEGACY_PLAN_KEY) || "null");
  } catch (e) {}
  if (!legacy) return cloudPlan;
  try {
    localStorage.removeItem(LEGACY_PLAN_KEY);
  } catch (e) {}

  const legacyPlan = normalisePlan(legacy);
  const sig = planSignature(legacyPlan);
  if (!sig || sig === LEGACY_DEMO_SIGNATURE) return cloudPlan;
  if (cloudPlan && !isPlanEmpty(cloudPlan)) return cloudPlan; // never overwrite a saved week

  await saveUserMealPlan(uid, weekId, legacyPlan);
  return legacyPlan;
}

/**
 * Returns the plan for a week (the shown week by default).
 * Signed in: Firestore, cached in memory for the session. Before Firebase has
 * restored the session, or offline: the localStorage copy.
 */
export async function getPlan(weekId = shownWeekId()) {
  const user = getCurrentUser();
  if (!user) return emptyPlan();

  const uid = cloudUid();
  const localUid = uid || user.uid;
  const key = `${localUid}/${weekId}`;
  if (memoryPlans.has(key)) return clonePlan(memoryPlans.get(key));

  if (uid) {
    try {
      let plan = await fetchUserMealPlan(uid, weekId);
      if (weekId === getCurrentWeekId()) plan = await migrateLegacyPlan(uid, weekId, plan);
      const clean = normalisePlan(plan);
      memoryPlans.set(key, clean);
      writeLocalPlan(uid, weekId, clean);
      return clonePlan(clean);
    } catch (err) {
      console.warn("Could not load meal plan from Firestore, using local copy:", err);
    }
  }

  return normalisePlan(localUid ? readLocalPlans(localUid)[weekId] : null);
}

/** Saves a week's plan (the shown week by default) locally at once, then to Firestore. */
export async function savePlan(plan, weekId = shownWeekId()) {
  const user = getCurrentUser();
  if (!user) return;
  const clean = normalisePlan(plan);
  const uid = cloudUid() || user.uid;

  writeLocalPlan(uid, weekId, clean);

  if (cloudUid()) {
    memoryPlans.set(`${uid}/${weekId}`, clean);
    try {
      await saveUserMealPlan(cloudUid(), weekId, clean);
    } catch (err) {
      console.warn("Could not save meal plan to Firestore:", err);
      showToast("Couldn't save your plan to your account. It's kept on this device for now.");
    }
  }
}

/**
 * Puts a recipe in a slot of the shown week.
 * options.skipConfirm: skip the replace and allergen prompts (used by Undo and moves).
 * options.skipAllergenCheck: skip only the allergen prompt (the caller already asked).
 * options.skipReplaceConfirm: skip only the replace prompt (the day and meal dialog already showed it).
 * A boolean is still accepted in place of options, meaning skipConfirm.
 */
export async function addToPlan(day, meal, recipe, options = {}) {
  const opts = typeof options === "boolean" ? { skipConfirm: options } : options || {};
  const plan = await getPlan();
  const existingMeal = plan[day]?.[meal];

  if (!opts.skipConfirm && !opts.skipReplaceConfirm && existingMeal && existingMeal.name) {
    const existingName = toTitleCase(existingMeal.name);
    const newName = toTitleCase(recipe.name || "this recipe");
    const confirmed = await showConfirmModal({
      title: "Replace existing meal?",
      message: `"${existingName}" is already scheduled for ${day} ${meal}. Do you want to replace it with "${newName}"?`,
      confirmText: "Replace Meal",
      cancelText: "Keep Current",
      confirmColor: "primary"
    });
    if (!confirmed) return false;
  }

  if (!opts.skipConfirm && !opts.skipAllergenCheck && !(await confirmIfFlagged(recipe))) return false;
  plan[day][meal] = {
    id: recipe.id || "0",
    name: recipe.name,
    image: recipe.image,
    // Kept with the slot so the shopping list can be built without calling the API again.
    ingredients: Array.isArray(recipe.ingredients) ? recipe.ingredients : []
  };
  await savePlan(plan);
  renderPlannerTable();
  return true;
}

export async function removeFromPlan(day, meal, options = {}) {
  const plan = await getPlan();
  if (plan[day] && plan[day][meal]) {
    const previousItem = { ...plan[day][meal] };
    const weekId = shownWeekId();
    plan[day][meal] = null;
    await savePlan(plan, weekId);
    renderPlannerTable();

    if (!options.silent) {
      const recipeName = toTitleCase(previousItem.name || "Recipe");
      showToast(`Removed "${recipeName}" from ${day} ${meal}`, {
        duration: 5000,
        action: {
          label: "Undo",
          onClick: async () => {
            const current = await getPlan(weekId);
            current[day][meal] = previousItem;
            await savePlan(current, weekId);
            renderPlannerTable();
            showToast(`Restored "${recipeName}" to ${day} ${meal}!`);
          }
        }
      });
    }
  }
}

// Moves a meal to another slot in the shown week. If that slot is filled, the two swap.
export async function moveInPlan(fromDay, fromMeal, toDay, toMeal) {
  if (fromDay === toDay && fromMeal === toMeal) return;
  const plan = await getPlan();
  const moving = plan[fromDay]?.[fromMeal];
  if (!moving) return;
  const target = plan[toDay]?.[toMeal] || null;

  plan[toDay][toMeal] = moving;
  plan[fromDay][fromMeal] = target;
  await savePlan(plan);
  renderPlannerTable();

  const name = toTitleCase(moving.name || "Recipe");
  showToast(target ? `Swapped "${name}" with "${toTitleCase(target.name || "Recipe")}"` : `Moved "${name}" to ${toDay} ${toMeal}`);
}

// Empties every slot in the shown week, after asking. Undo puts it back.
export async function clearWeek() {
  const weekId = shownWeekId();
  const plan = await getPlan(weekId);
  if (isPlanEmpty(plan)) {
    showToast("This week is already empty.");
    return;
  }

  const count = planSignature(plan).split("|").length;
  const confirmed = await showConfirmModal({
    title: "Clear this week?",
    message: `This removes all ${count} planned meal${count === 1 ? "" : "s"} for ${document.getElementById("week-label")?.textContent || "this week"}.`,
    confirmText: "Clear Week",
    cancelText: "Keep Meals",
    confirmColor: "danger"
  });
  if (!confirmed) return;

  const previous = clonePlan(plan);
  await savePlan(emptyPlan(), weekId);
  renderPlannerTable();
  showToast("Week cleared", {
    duration: 6000,
    action: {
      label: "Undo",
      onClick: async () => {
        await savePlan(previous, weekId);
        renderPlannerTable();
        showToast("Meals restored!");
      }
    }
  });
}

export async function generateFromFavourites() {
  const favs = await getFavourites();
  if (favs.length === 0) {
    showToast("Please save some favourite recipes first!");
    return;
  }

  const plan = await getPlan();
  let favIndex = 0;

  DAYS.forEach((day) => {
    MEALS.forEach((meal) => {
      if (!plan[day][meal]) {
        const picked = favs[favIndex % favs.length];
        plan[day][meal] = {
          id: picked.id,
          name: picked.name,
          image: picked.image
        };
        favIndex++;
      }
    });
  });

  await savePlan(plan);
  renderPlannerTable();
  showToast("Meal plan populated from your favourites!");
}

export function updatePlannerAuthUI() {
  const user = getCurrentUser();
  const emptyStateEl = document.getElementById("planner-logged-out-empty-state");
  const mainContentEl = document.getElementById("planner-main-content");

  if (!user) {
    if (mainContentEl) mainContentEl.classList.add("hidden");
    if (emptyStateEl) {
      emptyStateEl.classList.remove("hidden");
      const destination = (window.location.pathname.split("/").pop() || "planner.html") + window.location.search;
      const loginHref = `login.html?redirect=${encodeURIComponent(destination)}`;
      const signupHref = `signup.html?redirect=${encodeURIComponent(destination)}`;

      emptyStateEl.innerHTML = `
        <div class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-white via-[#fcf8f4] to-[#f8f0e5] border border-[#eee2d5] p-8 sm:p-14 text-center shadow-xs">
          <div class="absolute -top-20 -left-20 w-56 h-56 bg-[#ca5c2e]/5 rounded-full blur-3xl pointer-events-none"></div>
          <div class="absolute -bottom-20 -right-20 w-56 h-56 bg-[#f3c292]/10 rounded-full blur-3xl pointer-events-none"></div>

          <div class="relative z-10 max-w-xl mx-auto space-y-6">
            <div class="relative inline-block mx-auto">
              <div class="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-tr from-[#fbebe3] to-[#fae2d5] border border-[#f5cfb8] flex items-center justify-center mx-auto shadow-inner ring-8 ring-[#ca5c2e]/5">
                <svg class="w-10 h-10 sm:w-11 sm:h-11 text-[#ca5c2e] drop-shadow-sm transition-transform duration-300 hover:scale-110" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <rect x="3" y="4" width="18" height="18" rx="3" ry="3"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
              </div>
              <span class="absolute -top-1 -right-1 w-7 h-7 bg-white rounded-full border border-[#eee2d5] shadow-xs flex items-center justify-center text-xs select-none">🗓️</span>
              <span class="absolute -bottom-1 -left-1 w-7 h-7 bg-white rounded-full border border-[#eee2d5] shadow-xs flex items-center justify-center text-xs select-none">✨</span>
            </div>

            <div class="space-y-2.5">
              <h2 class="text-2xl sm:text-3xl font-extrabold text-stone-900 tracking-tight font-heading">
                Log in to plan your week
              </h2>
              <p class="text-sm sm:text-base text-stone-600 leading-relaxed max-w-md mx-auto">
                Save recipes you love, plan your meals and get a shopping list, all in one place.
              </p>
            </div>

            <div class="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <a 
                href="${loginHref}" 
                class="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#ca5c2e] hover:bg-[#b34d23] text-white text-sm sm:text-base font-semibold px-8 py-3.5 rounded-full transition-all duration-200 shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
              >
                <span>Log In</span>
              </a>
              <a 
                href="${signupHref}" 
                class="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white hover:bg-[#fbf2ec] text-stone-800 hover:text-[#ca5c2e] border border-[#ede4da] text-sm sm:text-base font-semibold px-8 py-3.5 rounded-full transition-all duration-200 shadow-2xs hover:shadow-xs active:scale-[0.98]"
              >
                <span>Sign up free</span>
              </a>
            </div>
          </div>
        </div>
      `;
    }
    return false;
  } else {
    if (emptyStateEl) emptyStateEl.classList.add("hidden");
    if (mainContentEl) mainContentEl.classList.remove("hidden");
    return true;
  }
}

// Per-serving calorie estimate for one planned recipe, cached by recipe id.
// TheMealDB has no nutrition data, so this comes from nutrition.js.
const kcalCache = new Map();
const recipeCache = new Map(); // id -> Promise<recipe | null>, shared by calories and the shopping list

function getPlannedRecipe(id) {
  if (!id || id === "0") return Promise.resolve(null);
  if (!recipeCache.has(id)) {
    const promise = getRecipeById(id).catch((err) => {
      recipeCache.delete(id); // let a later render try again
      throw err;
    });
    recipeCache.set(id, promise);
  }
  return recipeCache.get(id);
}

async function getRecipeKcal(id) {
  if (!id || id === "0") return null;
  if (kcalCache.has(id)) return kcalCache.get(id);
  const promise = getPlannedRecipe(id)
    .then((recipe) => (recipe ? estimateNutrition(recipe.ingredients).perServing.kcal : null))
    .catch(() => {
      kcalCache.delete(id);
      return null;
    });
  kcalCache.set(id, promise);
  return promise;
}

// Fills the "Total (est.)" column with each day's estimated calories.
async function fillDayCalorieTotals(plan) {
  await Promise.all(
    DAYS.map(async (day) => {
      const cells = document.querySelectorAll(`.day-kcal-total[data-day="${day}"]`);
      if (cells.length === 0) return;
      const items = MEALS.map((meal) => plan[day]?.[meal]).filter(Boolean);
      if (items.length === 0) return;

      const values = await Promise.all(items.map((item) => getRecipeKcal(item.id)));
      const known = values.filter((v) => typeof v === "number");
      if (known.length === 0) return;

      const total = known.reduce((a, b) => a + b, 0);
      const missing = items.length - known.length;
      const title = missing
        ? `Estimate for ${known.length} of ${items.length} meals (per serving)`
        : "Estimated per serving from ingredient amounts";
      cells.forEach((cell) => {
        cell.textContent = `≈ ${total.toLocaleString()} kcal`;
        cell.className = "day-kcal-total inline-flex items-center rounded-full bg-[#fbf2ec] text-[#ca5c2e] text-xs font-semibold px-2.5 py-1";
        cell.title = title;
      });
    })
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const FALLBACK_MEAL_IMG = "https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=160&q=80";

// Dates (Mon to Sun) for the week being shown.
function getWeekDates(offset = weekOffset) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) + offset * 7);
  return DAYS.map((_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function formatShortDate(d) {
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

// "9 – 15 Nov 2026", or "30 Nov – 6 Dec 2026" when the week crosses a month
// (and "29 Dec 2026 – 4 Jan 2027" across a year).
function weekRangeText(offset = weekOffset) {
  const dates = getWeekDates(offset);
  const first = dates[0];
  const last = dates[6];
  if (first.getFullYear() !== last.getFullYear()) {
    return `${formatShortDate(first)} ${first.getFullYear()} – ${formatShortDate(last)} ${last.getFullYear()}`;
  }
  if (first.getMonth() !== last.getMonth()) {
    return `${formatShortDate(first)} – ${formatShortDate(last)} ${last.getFullYear()}`;
  }
  return `${first.getDate()} – ${formatShortDate(last)} ${last.getFullYear()}`;
}

function updateWeekLabel() {
  const label = document.getElementById("week-label");
  if (!label) return;
  label.textContent = weekRangeText();
  const backBtn = document.getElementById("this-week-btn");
  backBtn?.classList.toggle("hidden", weekOffset === 0);
  backBtn?.classList.toggle("inline-flex", weekOffset !== 0);

  // Says which week this is compared to today.
  const relative = document.getElementById("week-relative");
  if (relative) {
    const n = Math.abs(weekOffset);
    let text = "This week";
    if (weekOffset === 1) text = "Next week";
    else if (weekOffset === -1) text = "Last week";
    else if (weekOffset > 1) text = `In ${n} weeks`;
    else if (weekOffset < -1) text = `${n} weeks ago`;
    relative.textContent = `· ${text}`;
  }
}

function isToday(d) {
  const t = new Date();
  return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
}

// One filled meal: photo, name on up to two lines, remove button in the corner.
// On larger screens the tile can be dragged to another slot.
function mealTileHtml(item, day, meal, compact = false) {
  const hasLink = item.id && item.id !== "0";
  const link = hasLink ? `recipe.html?id=${encodeURIComponent(item.id)}` : "#";
  const name = escapeHtml(toTitleCase(item.name || ""));
  const img = escapeHtml(item.image || FALLBACK_MEAL_IMG);
  const size = compact ? "w-12 h-12" : "w-16 h-16";
  const dragAttrs = compact
    ? ""
    : `draggable="true" data-drag-day="${day}" data-drag-meal="${meal}" title="Drag to move, or click to view the recipe"`;
  return `
    <div class="plan-tile relative group h-full ${compact ? "" : "cursor-grab active:cursor-grabbing"}" ${dragAttrs}>
      <a href="${link}" draggable="false" class="flex items-center gap-3 h-full bg-white border border-[#efe6dc] rounded-2xl p-2 pr-7 shadow-xs hover:border-[#ca5c2e]/50 hover:shadow-sm transition">
        <img src="${img}" alt="${name}" loading="lazy" draggable="false" class="${size} rounded-xl object-cover flex-shrink-0 bg-stone-100">
        <span class="text-sm font-semibold text-stone-800 group-hover:text-[#ca5c2e] leading-snug line-clamp-2">${name}</span>
      </a>
      <button type="button" class="remove-plan-item absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-white/90 border border-stone-200 text-stone-400 hover:text-red-500 hover:border-red-200 flex items-center justify-center text-sm leading-none shadow-xs opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 transition" data-day="${day}" data-meal="${meal}" title="Remove meal" aria-label="Remove ${name} from ${day} ${meal}">&times;</button>
    </div>
  `;
}

// Empty slot: same size as a filled tile, dashed, clearly clickable.
function emptySlotHtml(day, meal, compact = false) {
  const height = compact ? "min-h-[64px]" : "min-h-[82px]";
  return `
    <button type="button" class="add-slot-btn w-full h-full ${height} flex items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-stone-200 text-stone-400 text-sm font-medium hover:border-[#ca5c2e]/50 hover:text-[#ca5c2e] hover:bg-[#fbf2ec] transition" data-day="${day}" data-meal="${meal}">
      <span class="text-lg leading-none">+</span> Add ${meal.toLowerCase()}
    </button>
  `;
}

// Phones show one day at a time. Defaults to today when the shown week is this week.
let mobileDay = null;

function defaultMobileDay(dates) {
  const todayIndex = dates.findIndex(isToday);
  return DAYS[todayIndex >= 0 ? todayIndex : 0];
}

function dayTabsHtml(plan, dates) {
  return `
    <div role="tablist" aria-label="Day of the week" class="grid grid-cols-7 gap-1 bg-white rounded-2xl border border-[#efe6dc] p-1 shadow-2xs">
      ${DAYS.map((day, i) => {
        const selected = day === mobileDay;
        const today = isToday(dates[i]);
        const planned = MEALS.filter((meal) => plan[day]?.[meal]).length;
        const dots = MEALS.map((_, m) =>
          `<span class="w-1 h-1 rounded-full ${m < planned ? (selected ? "bg-white" : "bg-[#ca5c2e]") : selected ? "bg-white/35" : "bg-stone-200"}"></span>`
        ).join("");
        const stateClass = selected
          ? "bg-[#ca5c2e] text-white shadow-sm"
          : today
            ? "text-[#ca5c2e] bg-[#fbf2ec]"
            : "text-stone-600 hover:bg-stone-50";
        return `
          <button type="button" role="tab" id="day-tab-${day}" data-day="${day}"
            aria-selected="${selected}" aria-controls="day-panel" tabindex="${selected ? "0" : "-1"}"
            aria-label="${day}${today ? ", today" : ""}, ${planned} of 3 meals planned"
            class="day-tab flex flex-col items-center gap-0.5 py-1.5 rounded-xl transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ca5c2e]/40 ${stateClass}">
            <span class="text-[11px] font-semibold uppercase tracking-wide">${day}</span>
            <span class="text-base font-bold leading-none">${dates[i].getDate()}</span>
            <span class="flex gap-0.5 mt-0.5" aria-hidden="true">${dots}</span>
          </button>`;
      }).join("")}
    </div>
  `;
}

function dayPanelHtml(plan, dates) {
  const i = DAYS.indexOf(mobileDay);
  const today = isToday(dates[i]);
  const mealsHtml = MEALS.map((meal) => {
    const item = plan[mobileDay]?.[meal];
    return `
      <div>
        <div class="text-[11px] font-bold uppercase tracking-wider text-stone-400 mb-1">${meal}</div>
        ${item ? mealTileHtml(item, mobileDay, meal, true) : emptySlotHtml(mobileDay, meal, true)}
      </div>
    `;
  }).join("");
  return `
    <section id="day-panel" role="tabpanel" aria-labelledby="day-tab-${mobileDay}" class="bg-white rounded-2xl border ${today ? "border-[#ca5c2e] ring-2 ring-[#ca5c2e]/15" : "border-[#efe6dc]"} shadow-xs p-4 space-y-3">
      <div class="flex items-baseline justify-between gap-2">
        <h3 class="font-bold ${today ? "text-[#ca5c2e]" : "text-stone-900"}">
          ${mobileDay} <span class="text-sm font-medium ${today ? "text-[#ca5c2e]/80" : "text-stone-400"}">· ${today ? "Today" : formatShortDate(dates[i])}</span>
        </h3>
        <span class="day-kcal-total text-xs font-semibold text-stone-400" data-day="${mobileDay}">–</span>
      </div>
      ${mealsHtml}
    </section>
  `;
}

let renderToken = 0;

export async function renderPlannerTable() {
  updatePlannerAuthUI();
  updateWeekLabel();
  const host = document.getElementById("planner-table-body");
  const cardsHost = document.getElementById("planner-cards");
  if (!host && !cardsHost) return;
  if (!getCurrentUser()) return;

  // Ignore results from an older render (for example after clicking through weeks quickly).
  const token = ++renderToken;
  const plan = await getPlan();
  if (token !== renderToken) return;
  const dates = getWeekDates();

  const clearBtn = document.getElementById("clear-week-btn");
  if (clearBtn) clearBtn.disabled = isPlanEmpty(plan);

  // Desktop / tablet: table
  if (host) {
    host.innerHTML = "";
    DAYS.forEach((day, i) => {
      const today = isToday(dates[i]);
      const row = document.createElement("tr");
      row.className = today ? "bg-[#fbf2ec]/60" : "hover:bg-[#faf7f2]/50 transition";

      let cellsHtml = `
        <td class="py-3 px-4 align-middle whitespace-nowrap ${today ? "border-l-4 border-[#ca5c2e]" : "border-l-4 border-transparent"}">
          <div class="font-bold text-sm ${today ? "text-[#ca5c2e]" : "text-stone-800"}">${day}</div>
          <div class="text-xs ${today ? "text-[#ca5c2e]/80 font-semibold" : "text-stone-400"}">${today ? "Today" : formatShortDate(dates[i])}</div>
        </td>
      `;

      MEALS.forEach((meal) => {
        const item = plan[day]?.[meal];
        cellsHtml += `<td class="plan-slot py-2.5 px-2 align-middle" data-day="${day}" data-meal="${meal}"><div class="plan-slot-inner rounded-2xl transition">${item ? mealTileHtml(item, day, meal) : emptySlotHtml(day, meal)}</div></td>`;
      });

      cellsHtml += `
        <td class="py-2.5 px-4 align-middle whitespace-nowrap">
          <span class="day-kcal-total text-xs font-semibold text-stone-400" data-day="${day}">–</span>
        </td>
      `;

      row.innerHTML = cellsHtml;
      host.appendChild(row);
    });
  }

  // Phones: day tabs, one day at a time
  if (cardsHost) {
    if (!mobileDay || !DAYS.includes(mobileDay)) mobileDay = defaultMobileDay(dates);
    cardsHost.innerHTML = dayTabsHtml(plan, dates) + dayPanelHtml(plan, dates);
  }

  fillDayCalorieTotals(plan);
  renderShoppingList(plan);

  [host, cardsHost].filter(Boolean).forEach((root) => {
    root.querySelectorAll(".remove-plan-item").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const { day, meal } = btn.dataset;
        removeFromPlan(day, meal);
      });
    });
    root.querySelectorAll(".add-slot-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const { day, meal } = btn.dataset;
        openMealDrawer(day, meal, { fromSlot: true });
      });
    });
  });
}

// ---------- Shopping list ----------
// Built from the shown week's plan: every planned meal's ingredients go through
// combineIngredients, so each ingredient appears once with its amounts added up.
// Ticks are saved to users/{uid}/shoppingList/{weekId}, with a localStorage copy.

let shoppingItems = []; // [{ key, name, measure, checked, recipes: [], flags: [] }]
let shoppingWeekId = null;
let shoppingMeta = { mealCount: 0, failed: 0 };
let shoppingToken = 0;
const savedChecks = new Map(); // `${uid}/${weekId}` -> Map(ingredient key -> true)
const shoppingSaveTimers = new Map(); // weekId -> timeout

function shoppingCacheKey(uid) {
  return `recipeplan_shopping_${uid}`;
}

function readAllLocalChecks(uid) {
  try {
    return JSON.parse(localStorage.getItem(shoppingCacheKey(uid)) || "{}") || {};
  } catch (e) {
    return {};
  }
}

function readLocalChecks(uid, weekId) {
  return new Map(Object.keys(readAllLocalChecks(uid)[weekId] || {}).map((key) => [key, true]));
}

function writeLocalChecks(uid, weekId, checks) {
  try {
    const all = readAllLocalChecks(uid);
    if (checks.size) all[weekId] = Object.fromEntries([...checks.keys()].map((key) => [key, true]));
    else delete all[weekId];
    localStorage.setItem(shoppingCacheKey(uid), JSON.stringify(all));
  } catch (e) {}
}

// Which ingredients are ticked for a week. Firestore when signed in, else the local copy.
async function loadShoppingChecks(weekId) {
  const user = getCurrentUser();
  if (!user) return new Map();
  const uid = cloudUid();
  const localUid = uid || user.uid;
  const key = `${localUid}/${weekId}`;
  if (savedChecks.has(key)) return savedChecks.get(key);

  if (uid) {
    try {
      const saved = await fetchUserShoppingList(uid, weekId);
      const checks = saved
        ? new Map((saved.items || []).filter((i) => i.checked && i.name).map((i) => [i.name.trim().toLowerCase(), true]))
        : readLocalChecks(uid, weekId);
      savedChecks.set(key, checks);
      return checks;
    } catch (err) {
      console.warn("Could not load shopping list from Firestore, using local copy:", err);
    }
  }
  return readLocalChecks(localUid, weekId);
}

// Saves the shown list's ticks locally at once, then to Firestore (debounced per week).
function saveShoppingChecks() {
  const user = getCurrentUser();
  if (!user || !shoppingWeekId) return;
  const weekId = shoppingWeekId;
  const uid = cloudUid() || user.uid;
  const checks = new Map(shoppingItems.filter((i) => i.checked).map((i) => [i.key, true]));
  const items = shoppingItems.map(({ name, measure, checked }) => ({ name, measure, checked }));

  savedChecks.set(`${uid}/${weekId}`, checks);
  writeLocalChecks(uid, weekId, checks);

  clearTimeout(shoppingSaveTimers.get(weekId));
  shoppingSaveTimers.set(
    weekId,
    setTimeout(async () => {
      shoppingSaveTimers.delete(weekId);
      if (!cloudUid()) return;
      try {
        await saveUserShoppingList(cloudUid(), weekId, items);
      } catch (err) {
        console.warn("Could not save shopping list to Firestore:", err);
        showToast("Couldn't save your ticks to your account. They're kept on this device for now.");
      }
    }, 500)
  );
}

function plannedMeals(plan) {
  const meals = [];
  DAYS.forEach((day) =>
    MEALS.forEach((meal) => {
      const item = plan?.[day]?.[meal];
      if (item && item.id && item.id !== "0") meals.push(item);
    })
  );
  return meals;
}

// Merges every planned meal's ingredients into one list. Slots saved with their
// ingredients are used as they are; older slots fetch the recipe from the API.
// A recipe planned twice counts twice, so its amounts are doubled.
async function buildShoppingItems(plan) {
  const meals = plannedMeals(plan);
  const recipes = await Promise.all(
    meals.map((m) =>
      Array.isArray(m.ingredients) && m.ingredients.length
        ? { name: m.name, ingredients: m.ingredients }
        : getPlannedRecipe(m.id).catch(() => undefined)
    )
  );
  const failed = recipes.filter((r) => r === undefined).length;

  const all = [];
  const sources = new Map(); // ingredient key -> Set of recipe names
  const measures = new Map(); // ingredient key -> every measure, for sumShoppingMeasures
  recipes.forEach((recipe, i) => {
    if (!recipe) return;
    const label = toTitleCase(recipe.name || meals[i].name || "Recipe");
    (recipe.ingredients || []).forEach((ing) => {
      if (!ing?.name || !ing.name.trim()) return;
      all.push(ing);
      const key = ing.name.trim().toLowerCase();
      if (!sources.has(key)) sources.set(key, new Set());
      sources.get(key).add(label);
      if (!measures.has(key)) measures.set(key, []);
      if (ing.measure) measures.get(key).push(ing.measure);
    });
  });

  const combined = combineIngredients(all);
  const check = checkIngredients(combined.map((i) => i.name));
  const items = combined.map((i) => {
    const key = i.name.trim().toLowerCase();
    return {
      key,
      name: i.name,
      // combineIngredients merges the names; amounts are added up per unit here, because
      // combineMeasures joins everything with "+" as soon as one unit differs.
      measure: sumShoppingMeasures(measures.get(key) || []) || i.measure || "",
      checked: false,
      recipes: [...(sources.get(key) || [])],
      aisle: aisleFor(i.name),
      staple: isStaple(i.name),
      flags: check.byIngredient[key] || []
    };
  });
  return { items, mealCount: meals.length, failed };
}

const SPINNER_SVG = `<svg class="w-5 h-5 animate-spin text-[#ca5c2e]" fill="none" viewBox="0 0 24 24" aria-hidden="true"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>`;

function setShoppingControls({ enabled, showProgress }) {
  ["copy-shopping-btn", "print-shopping-btn", "check-all-shopping-btn"].forEach((id) => {
    const btn = document.getElementById(id);
    if (btn) btn.disabled = !enabled;
  });
  document.getElementById("shopping-progress-badge")?.classList.toggle("hidden", !showProgress);
  document.getElementById("shopping-progress-track")?.classList.toggle("hidden", !showProgress);
  document.getElementById("shopping-note")?.classList.toggle("hidden", !showProgress);
}

// Loading, empty and error states. Clears the item lists.
function paintShoppingState(state) {
  const status = document.getElementById("shopping-status");
  const groupsEl = document.getElementById("shopping-groups");
  const subtitle = document.getElementById("shopping-subtitle");
  const tabCount = document.getElementById("view-tab-shopping-count");
  if (!status) return;

  if (groupsEl) groupsEl.innerHTML = "";
  document.getElementById("shopping-staples")?.classList.add("hidden");
  document.getElementById("shopping-done-wrap")?.classList.add("hidden");
  setShoppingControls({ enabled: false, showProgress: false });
  if (tabCount) tabCount.textContent = "";
  const week = escapeHtml(weekRangeText());

  if (state === "loading") {
    if (subtitle) subtitle.textContent = `Ingredients for ${weekRangeText()}`;
    status.innerHTML = `
      <div class="py-8 flex flex-col items-center justify-center gap-2 text-xs text-stone-400">
        ${SPINNER_SVG}
        <span>Building your shopping list…</span>
      </div>`;
  } else if (state === "empty" || state === "no-ingredients") {
    if (subtitle) subtitle.textContent = `Ingredients for ${weekRangeText()}`;
    const message = state === "empty"
      ? "Plan some meals and their ingredients will show up here, added together."
      : "The planned recipes don't list any ingredients.";
    status.innerHTML = `
      <div class="py-8 px-4 text-center space-y-3 rounded-2xl border-2 border-dashed border-stone-200">
        <p class="text-sm font-semibold text-stone-700">${state === "empty" ? `No meals planned for ${week}` : "Nothing to buy yet"}</p>
        <p class="text-xs text-stone-500 max-w-xs mx-auto">${message}</p>
        ${state === "empty" ? `<button type="button" id="shopping-add-meal-btn" class="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-[#ca5c2e] text-white hover:bg-[#b34d23] transition shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#ca5c2e]/50">+ Add a meal</button>` : ""}
      </div>`;
  } else if (state === "error") {
    if (subtitle) subtitle.textContent = `Ingredients for ${weekRangeText()}`;
    status.innerHTML = `
      <div class="py-8 px-4 text-center space-y-3 rounded-2xl bg-red-50/60 border border-red-100" role="alert">
        <p class="text-sm font-semibold text-red-700">Couldn't load the recipes for your shopping list.</p>
        <p class="text-xs text-stone-500">Check your connection and try again.</p>
        <button type="button" id="shopping-retry-btn" class="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-white border border-[#efe6dc] text-stone-700 hover:text-[#ca5c2e] hover:border-[#ca5c2e]/50 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ca5c2e]/40">Try again</button>
      </div>`;
  }
}

// ---------- Aisles ----------
// TheMealDB has no shop categories, so ingredients are sorted into aisles by keyword.
// Rules are checked in order: the specific ones first ("chicken stock" is Pantry, not
// Meat; "garlic powder" is Spices, not Produce). Anything unmatched goes to "Other".
const AISLES = ["Produce", "Meat & fish", "Dairy & eggs", "Bakery", "Pantry", "Herbs & spices", "Frozen", "Other"];

const AISLE_RULES = [
  ["Frozen", /\bfrozen\b|\bice cream\b/],
  ["Pantry", /\bbaking\b|\bstock\b|\bbroth\b|\bbouillon\b|\bcoconut (milk|cream)\b|\bpeanut butter\b|\bsauce\b|\bketchup\b|\bvinegar\b|\boil\b|\bpaste\b|\bpur[eé]e\b|\btinned\b|\bcanned\b|\bchopped tomatoes\b|\bflour\b|\bcorn ?starch\b|\bcornflour\b|\bnoodles?\b|\b(kidney|black|butter|cannellini|baked|haricot|pinto|borlotti) beans\b|\bchickpeas?\b|\blentils?\b/],
  ["Herbs & spices", /\bpowder\b|\bdried\b|\bsalt\b|\b(black|white|cayenne) pepper\b|^pepper$|\bpeppercorns?\b|\bcumin\b|\bpaprika\b|\bturmeric\b|\bcinnamon\b|\bnutmeg\b|\bgaram masala\b|\bcardamom\b|\bsaffron\b|\bfive spice\b|\ballspice\b|\bbay lea(f|ves)\b|\bcloves\b|\bstar anise\b|\bfennel seeds?\b|\bcoriander seeds?\b|\bmustard seeds?\b|\bchill?i flakes\b|\bseasoning\b|\bvanilla\b|\boregano\b/],
  ["Meat & fish", /\bchicken\b|\bbeef\b|\bpork\b|\blamb\b|\bbacon\b|\bsausages?\b|\bmince\b|\bham\b|\bturkey\b|\bduck\b|\bchorizo\b|\bpancetta\b|\bprosciutto\b|\bsalami\b|\bprawns?\b|\bshrimps?\b|\bsalmon\b|\btuna\b|\bcod\b|\bfish\b|\bhaddock\b|\bmackerel\b|\bsardines?\b|\bcrab\b|\bmussels\b|\bclams\b|\bsquid\b|\boctopus\b|\banchov|\bsteak\b|\bveal\b|\bgoat\b|\bvenison\b|\bliver\b|\bkidneys?\b|\bscallops?\b|\blobster\b|\btilapia\b|\btrout\b|\bthighs?\b|\bdrumsticks?\b|\bbreasts?\b/],
  ["Dairy & eggs", /\bmilk\b|\bcream\b|\bbutter\b|\bcheese\b|\byogh?urt\b|\beggs?\b|\byolks?\b|\bparmesan\b|\bparmigiano\b|\bmozzarella\b|\bcheddar\b|\bfeta\b|\bricotta\b|\bmascarpone\b|\bcr[eè]me fra[iî]che\b|\bghee\b|\bbuttermilk\b|\bcustard\b|\bgruy[eè]re\b|\bhalloumi\b|\bpaneer\b|\bgorgonzola\b|\bbrie\b/],
  ["Bakery", /\bbread\b|\btortillas?\b|\bwraps?\b|\bpitt?a\b|\bbuns?\b|\bbaguette\b|\bnaan\b|\bpastry\b|\bcroissants?\b|\bbagels?\b|\bciabatta\b|\bbrioche\b|\bmuffins?\b|\bbreadcrumbs\b|\bpanko\b/],
  ["Produce", /\bonions?\b|\bshallots?\b|\bgarlic\b|\btomato(es)?\b|\bpotato(es)?\b|\bcarrots?\b|\blemons?\b|\blimes?\b|\bapples?\b|\bbananas?\b|\bginger\b|\bchill?(i|ies)\b|\bpeppers?\b|\bspinach\b|\blettuce\b|\bcabbage\b|\bbroccoli\b|\bmushrooms?\b|\bcourgettes?\b|\bzucchini\b|\baubergines?\b|\beggplants?\b|\bcelery\b|\bleeks?\b|\bcucumbers?\b|\bavocados?\b|\bscallions?\b|\bpeas\b|\bsweetcorn\b|\bcorn\b|\bgreen beans\b|\bkale\b|\bparsley\b|\bcoriander\b|\bcilantro\b|\bbasil\b|\bmint\b|\bdill\b|\bthyme\b|\brosemary\b|\bsage\b|\bchives\b|\btarragon\b|\w*berr(y|ies)\b|\boranges?\b|\bmangoe?s?\b|\bpumpkin\b|\bsquash\b|\bbeetroot\b|\bradish(es)?\b|\basparagus\b|\bcauliflower\b|\bfennel\b|\bpears?\b|\bgrapes?\b|\bpineapple\b|\bpeach(es)?\b|\bplums?\b|\bcherr(y|ies)\b|\byams?\b|\bokra\b|\blemongrass\b|\bbean sprouts\b|\bpak choi\b|\bbok choy\b|\brocket\b|\barugula\b|\bwatercress\b|\bsalad\b|\bherbs?\b|\bkiwi\b|\bmelon\b|\bfigs?\b|\bdates\b|\bplantain\b|\bcassava\b/],
  ["Pantry", /\brice\b|\bpasta\b|\bspaghetti\b|\bpenne\b|\bfusilli\b|\btagliatelle\b|\blinguine\b|\bmacaroni\b|\blasagne\b|\bcouscous\b|\bquinoa\b|\bbulgur\b|\boats\b|\bsugar\b|\bhoney\b|\bsyrup\b|\bmustard\b|\bmayonnaise\b|\bjam\b|\bchocolate\b|\bcocoa\b|\byeast\b|\bnuts?\b|\balmonds?\b|\bwalnuts?\b|\bcashews?\b|\bpeanuts?\b|\bsesame\b|\braisins?\b|\bsultanas?\b|\bcoconut\b|\btofu\b|\bwine\b|\bbeer\b|\bgelatine?\b|\bbeans\b|\bolives?\b|\bcapers\b|\bwater chestnuts\b|\bdesiccated\b/],
];

// Cupboard staples: still listed, but folded away under "Probably in your cupboard".
const STAPLES = new Set([
  "water", "cold water", "hot water", "boiling water", "warm water", "ice", "salt", "sea salt", "table salt",
  "pepper", "black pepper", "ground black pepper", "salt and pepper", "olive oil", "extra virgin olive oil",
  "vegetable oil", "sunflower oil", "oil", "cooking oil", "sugar", "caster sugar", "granulated sugar",
]);

function aisleFor(name) {
  const n = String(name || "").toLowerCase().trim();
  for (const [aisle, rule] of AISLE_RULES) {
    if (rule.test(n)) return aisle;
  }
  return "Other";
}

function isStaple(name) {
  return STAPLES.has(String(name || "").toLowerCase().trim());
}

function sortedShoppingItems() {
  return [...shoppingItems].sort((a, b) => a.name.localeCompare(b.name));
}

// Splits the list the way it is shown: aisles of things to buy, staples, then ticked items.
function shoppingSections() {
  const sorted = sortedShoppingItems();
  const done = sorted.filter((i) => i.checked);
  const staples = sorted.filter((i) => !i.checked && i.staple);
  const aisles = AISLES.map((aisle) => ({
    aisle,
    items: sorted.filter((i) => !i.checked && !i.staple && i.aisle === aisle)
  })).filter((g) => g.items.length);
  return { sorted, aisles, staples, done, todoCount: sorted.length - done.length };
}

const expandedShoppingSources = new Set(); // item keys whose recipe names are shown

function shoppingItemHtml(item, index) {
  const id = `shop-item-${index}`;
  const name = escapeHtml(item.name);
  const measure = item.measure ? escapeHtml(item.measure) : "";
  const flagText = item.flags.join(", ");
  const expanded = expandedShoppingSources.has(item.key);
  const recipes = item.recipes;

  // One recipe: just name it. Several: a small "3 recipes" toggle that reveals them.
  let sourceHtml = "";
  if (recipes.length === 1) {
    sourceHtml = `<span class="shopping-source block text-[11px] text-stone-400 truncate">${escapeHtml(recipes[0])}</span>`;
  } else if (recipes.length > 1) {
    sourceHtml = `
      <button type="button" class="shopping-sources-btn text-[11px] text-stone-400 hover:text-[#ca5c2e] focus:outline-none focus-visible:underline" aria-expanded="${expanded}" aria-controls="${id}-sources">${recipes.length} recipes ${expanded ? "▴" : "▾"}</button>
      <span id="${id}-sources" class="shopping-source ${expanded ? "block" : "hidden"} text-[11px] text-stone-500 leading-snug">${escapeHtml(recipes.join(", "))}</span>`;
  }

  return `
    <li class="shopping-item${item.checked ? " is-checked" : ""} break-inside-avoid border-b border-stone-100" data-key="${escapeHtml(item.key)}">
      <div class="flex items-start gap-3 py-2">
        <input id="${id}" type="checkbox" class="shopping-item-check mt-0.5 w-4 h-4 rounded accent-[#ca5c2e] cursor-pointer shrink-0" ${item.checked ? "checked" : ""}>
        <div class="flex-1 min-w-0">
          <div class="flex items-baseline gap-2">
            <label for="${id}" class="shopping-item-name text-sm font-medium text-stone-800 cursor-pointer select-none">${name}</label>
            ${flagText ? `<span class="shrink-0 text-[10px] font-semibold px-1.5 py-px rounded-md bg-amber-50 text-amber-700 border border-amber-200" title="Matches your diet or allergy settings (keyword match, not a guarantee)">⚠ ${escapeHtml(flagText)}</span>` : ""}
            <span class="shopping-leader flex-1 min-w-[1rem] border-b border-dotted border-stone-200" aria-hidden="true"></span>
            ${measure ? `<span class="shopping-item-measure text-sm tabular-nums text-stone-600 text-right max-w-[55%]">${measure}</span>` : ""}
          </div>
          ${sourceHtml}
        </div>
      </div>
    </li>`;
}

// Draws the list: aisles to buy, folded staples, folded basket of ticked (struck-through) items.
function paintShoppingList(focusKey = null) {
  const status = document.getElementById("shopping-status");
  const groupsEl = document.getElementById("shopping-groups");
  const staplesWrap = document.getElementById("shopping-staples");
  const staplesEl = document.getElementById("shopping-list-staples");
  const doneWrap = document.getElementById("shopping-done-wrap");
  const doneEl = document.getElementById("shopping-list-done");
  if (!status || !groupsEl || !doneEl || !staplesEl) return;

  const { sorted, aisles, staples, done, todoCount } = shoppingSections();
  const total = sorted.length;
  const { mealCount, failed } = shoppingMeta;
  let index = 0;
  const rows = (items) => items.map((item) => shoppingItemHtml(item, index++)).join("");

  status.innerHTML = failed
    ? `<p class="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2" role="alert">
        ${failed} recipe${failed === 1 ? "" : "s"} couldn't be loaded, so some items may be missing.
        <button type="button" id="shopping-retry-btn" class="ml-1 font-semibold underline hover:text-amber-900">Try again</button>
      </p>`
    : "";

  if (aisles.length) {
    groupsEl.innerHTML = aisles.map(({ aisle, items }) => {
      const headingId = `shop-aisle-${aisle.toLowerCase().replace(/[^a-z]+/g, "-")}`;
      return `
        <div class="shopping-aisle">
          <h3 id="${headingId}" class="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#ca5c2e] mb-1">
            ${escapeHtml(aisle)} <span class="text-stone-400 font-semibold">${items.length}</span>
          </h3>
          <ul class="shopping-list sm:columns-2 gap-x-10" aria-labelledby="${headingId}">${rows(items)}</ul>
        </div>`;
    }).join("");
  } else {
    groupsEl.innerHTML = `
      <p class="py-4 text-center text-sm font-semibold text-emerald-700 bg-emerald-50/70 border border-emerald-100 rounded-2xl">
        ${staples.length ? "Just the cupboard staples left" : "Everything is in the basket 🎉"}
      </p>`;
  }

  staplesEl.innerHTML = rows(staples);
  staplesWrap?.classList.toggle("hidden", staples.length === 0);
  const staplesTitle = document.getElementById("shopping-staples-title");
  if (staplesTitle) staplesTitle.textContent = `Probably in your cupboard (${staples.length})`;

  doneEl.innerHTML = rows(done);
  doneWrap?.classList.toggle("hidden", done.length === 0);
  const doneTitle = document.getElementById("shopping-done-title");
  if (doneTitle) doneTitle.textContent = `In the basket (${done.length})`;

  const pct = total ? Math.round((done.length / total) * 100) : 0;
  const badge = document.getElementById("shopping-progress-badge");
  if (badge) badge.textContent = `${done.length} of ${total} checked`;
  const bar = document.getElementById("shopping-progress-bar");
  if (bar) bar.style.width = `${pct}%`;
  document.getElementById("shopping-progress-track")?.setAttribute("aria-valuenow", String(pct));

  const checkAllLabel = document.getElementById("check-all-label");
  if (checkAllLabel) checkAllLabel.textContent = todoCount === 0 ? "Uncheck all" : "Check all";
  setShoppingControls({ enabled: true, showProgress: true });

  const subtitle = document.getElementById("shopping-subtitle");
  if (subtitle) {
    subtitle.textContent = `${total} item${total === 1 ? "" : "s"} from ${mealCount} planned meal${mealCount === 1 ? "" : "s"} · ${weekRangeText()}`;
  }
  const tabCount = document.getElementById("view-tab-shopping-count");
  if (tabCount) tabCount.textContent = todoCount ? `(${todoCount})` : "✓";

  // The ticked item moved, so put focus back on its checkbox (or on the fold it went into).
  if (focusKey) {
    const li = document.querySelector(`#shopping-section .shopping-item[data-key="${CSS.escape(focusKey)}"]`);
    const fold = li?.closest("details");
    if (fold && !fold.open) fold.querySelector("summary")?.focus();
    else li?.querySelector(".shopping-item-check")?.focus();
  }
}

export async function renderShoppingList(plan) {
  if (!document.getElementById("shopping-section")) return;
  const weekId = shownWeekId();
  const token = ++shoppingToken;

  if (plannedMeals(plan).length === 0) {
    shoppingItems = [];
    shoppingWeekId = weekId;
    paintShoppingState("empty");
    return;
  }

  // Keep the old list on screen while a change to the same week rebuilds it.
  if (shoppingWeekId !== weekId || shoppingItems.length === 0) paintShoppingState("loading");

  try {
    const [built, checks] = await Promise.all([buildShoppingItems(plan), loadShoppingChecks(weekId)]);
    if (token !== shoppingToken) return;
    if (built.items.length === 0 && built.failed) throw new Error("No planned recipes could be loaded");

    built.items.forEach((item) => (item.checked = checks.get(item.key) === true));
    shoppingItems = built.items;
    shoppingWeekId = weekId;
    shoppingMeta = { mealCount: built.mealCount, failed: built.failed };

    if (shoppingItems.length === 0) paintShoppingState("no-ingredients");
    else paintShoppingList();
  } catch (err) {
    if (token !== shoppingToken) return;
    console.warn("Could not build the shopping list:", err);
    shoppingItems = [];
    shoppingWeekId = weekId;
    paintShoppingState("error");
  }
}

// Plain-text list for the clipboard, grouped by aisle: what is still to buy
// (or everything, if all is ticked).
function shoppingListText() {
  const { sorted, aisles, staples, todoCount } = shoppingSections();
  const line = (i) => `- ${i.name}${i.measure ? `: ${i.measure}` : ""}`;
  const blocks = [];
  if (todoCount === 0) {
    blocks.push(sorted.map(line).join("\n"));
  } else {
    aisles.forEach(({ aisle, items }) => blocks.push(`${aisle}\n${items.map(line).join("\n")}`));
    if (staples.length) blocks.push(`Probably in your cupboard\n${staples.map(line).join("\n")}`);
  }
  return {
    text: [`Shopping list (${weekRangeText()})`, ...blocks].join("\n\n"),
    count: todoCount || sorted.length,
    onlyTodo: todoCount > 0 && todoCount < sorted.length
  };
}

async function copyTextToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    // Fall back for older browsers and pages without clipboard permission.
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch (e) {
    return false;
  }
}

// Shows "Copied" with a tick on the Copy list button for a moment.
let copiedTimer = null;
function flashCopied() {
  const btn = document.getElementById("copy-shopping-btn");
  const label = document.getElementById("copy-shopping-label");
  if (!btn || !label) return;
  btn.classList.add("is-copied");
  label.textContent = "Copied";
  clearTimeout(copiedTimer);
  copiedTimer = setTimeout(() => {
    btn.classList.remove("is-copied");
    label.textContent = "Copy list";
  }, 1800);
}

function initShoppingList() {
  const section = document.getElementById("shopping-section");
  if (!section) return;

  section.addEventListener("change", (e) => {
    const cb = e.target.closest(".shopping-item-check");
    if (!cb) return;
    const key = cb.closest(".shopping-item")?.dataset.key;
    const item = shoppingItems.find((i) => i.key === key);
    if (!item) return;
    item.checked = cb.checked;
    saveShoppingChecks();
    paintShoppingList(key);
  });

  section.addEventListener("click", async (e) => {
    if (e.target.closest("#shopping-retry-btn")) {
      renderPlannerTable();
    } else if (e.target.closest("#shopping-add-meal-btn")) {
      openMealDrawer("Mon", "Dinner");
    } else if (e.target.closest("#check-all-shopping-btn")) {
      if (!shoppingItems.length) return;
      const checkAll = shoppingItems.some((i) => !i.checked);
      shoppingItems.forEach((i) => (i.checked = checkAll));
      saveShoppingChecks();
      paintShoppingList();
    } else if (e.target.closest("#copy-shopping-btn")) {
      if (!shoppingItems.length) return;
      const { text, count, onlyTodo } = shoppingListText();
      const ok = await copyTextToClipboard(text);
      showToast(ok
        ? `Copied ${count} item${count === 1 ? "" : "s"}${onlyTodo ? " still to buy" : ""}`
        : "Couldn't copy the list. Your browser blocked the clipboard.");
      if (ok) flashCopied();
    } else if (e.target.closest("#print-shopping-btn")) {
      window.print();
    } else if (e.target.closest(".shopping-sources-btn")) {
      const key = e.target.closest(".shopping-item")?.dataset.key;
      if (!key) return;
      if (expandedShoppingSources.has(key)) expandedShoppingSources.delete(key);
      else expandedShoppingSources.add(key);
      paintShoppingList();
      document.querySelector(`#shopping-section .shopping-item[data-key="${CSS.escape(key)}"] .shopping-sources-btn`)?.focus();
    }
  });

  // Closed <details> don't print, so open the staples while printing (the basket stays hidden).
  const staples = document.getElementById("shopping-staples");
  let staplesWereOpen = false;
  window.addEventListener("beforeprint", () => {
    staplesWereOpen = Boolean(staples?.open);
    if (staples) staples.open = true;
  });
  window.addEventListener("afterprint", () => {
    if (staples) staples.open = staplesWereOpen;
  });
}

// ---------- Phones: Meals / Shopping list tabs ----------
function setMobileView(view, focus = false) {
  const main = document.getElementById("planner-main-content");
  if (!main) return;
  main.dataset.mobileView = view;
  document.querySelectorAll("#planner-view-tabs .view-tab").forEach((tab) => {
    const selected = tab.dataset.view === view;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
    if (selected && focus) tab.focus();
  });
}

function initViewTabs() {
  const tabs = document.getElementById("planner-view-tabs");
  if (!tabs) return;
  tabs.addEventListener("click", (e) => {
    const tab = e.target.closest(".view-tab");
    if (tab) setMobileView(tab.dataset.view);
  });
  tabs.addEventListener("keydown", (e) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const current = document.getElementById("planner-main-content")?.dataset.mobileView;
    let next = current === "meals" ? "shopping" : "meals";
    if (e.key === "Home") next = "meals";
    if (e.key === "End") next = "shopping";
    setMobileView(next, true);
  });
}

// ---------- Day and meal dialog (shared with the recipe page) ----------
// Lets the user pick which day and meal of this week a recipe goes in, shows what is
// already in that slot, then saves through addToPlan. Resolves { day, meal } or null.
// options.skipAllergenCheck: the caller already ran confirmIfFlagged.
// options.day / options.meal: preselect a slot.

function suggestedMeal() {
  const hour = new Date().getHours();
  if (hour < 10) return "Breakfast";
  if (hour < 15) return "Lunch";
  return "Dinner";
}

// The dialog brings its own styles: recipe.html uses a pre-built tailwind.css that does
// not contain every utility class, so the dialog must not depend on Tailwind.
const PLAN_SLOT_DIALOG_CSS = `
.psd-backdrop{position:fixed;inset:0;z-index:50;display:flex;align-items:flex-end;justify-content:center;background:rgba(28,25,23,.6);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);opacity:0;transition:opacity .2s ease}
.psd-backdrop.is-open{opacity:1}
.psd-panel{position:relative;width:100%;max-height:100vh;overflow-y:auto;box-sizing:border-box;background:#fff;color:#292524;font-family:Inter,system-ui,sans-serif;border:1px solid #f5f5f4;border-radius:24px 24px 0 0;box-shadow:0 25px 50px -12px rgba(0,0,0,.25);padding:20px;transform:translateY(24px);transition:transform .2s ease}
.psd-backdrop.is-open .psd-panel{transform:none}
@media (min-width:640px){
  .psd-backdrop{align-items:center;padding:16px}
  .psd-panel{max-width:28rem;border-radius:24px;padding:24px;transform:scale(.95)}
}
.psd-close{position:absolute;top:16px;right:16px;display:inline-flex;padding:8px;border:0;border-radius:9999px;background:none;color:#a8a29e;cursor:pointer;transition:color .15s,background-color .15s,transform .2s}
.psd-close:hover{color:#ca5c2e;background:#fbf2ec;transform:rotate(90deg)}
.psd-head{display:flex;align-items:center;gap:12px;padding-right:40px}
.psd-head-text{min-width:0}
.psd-thumb{width:48px;height:48px;flex-shrink:0;border-radius:12px;object-fit:cover;background:#f5f5f4}
.psd-title{margin:0;font-size:18px;line-height:1.4;font-weight:700;letter-spacing:-.01em;color:#1c1917}
.psd-sub{margin:0;font-size:12px;color:#78716c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.psd-form{display:flex;flex-direction:column;gap:16px;margin-top:20px}
.psd-fieldset{min-width:0;margin:0;padding:0;border:0}
.psd-legend{padding:0;margin-bottom:8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#a8a29e}
.psd-days{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px}
.psd-meals{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.psd-option{position:relative;display:block}
.psd-option input{position:absolute;width:1px;height:1px;margin:0;opacity:0;pointer-events:none}
.psd-chip{display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 0;border:1px solid #efe6dc;border-radius:12px;background:#fff;color:#57534e;cursor:pointer;user-select:none;transition:background-color .15s,border-color .15s,color .15s,box-shadow .15s,transform .15s}
.psd-chip:hover{border-color:rgba(202,92,46,.55);background:#fdf8f4;color:#ca5c2e;transform:translateY(-1px);box-shadow:0 4px 10px -4px rgba(202,92,46,.3)}
.psd-chip:active{transform:scale(.96);box-shadow:none}
.psd-option input:checked+.psd-chip{background:#ca5c2e;border-color:#ca5c2e;color:#fff;box-shadow:0 4px 12px -4px rgba(202,92,46,.55)}
.psd-option input:checked+.psd-chip:hover{background:#b34d23;border-color:#b34d23;color:#fff}
.psd-option input:focus-visible+.psd-chip{box-shadow:0 0 0 2px rgba(202,92,46,.45)}
.psd-chip-day{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.03em}
.psd-chip-date{font-size:14px;font-weight:700;line-height:1}
.psd-chip.is-today .psd-chip-day{color:#ca5c2e}
.psd-option input:checked+.psd-chip.is-today .psd-chip-day{color:#fff}
.psd-dot{width:4px;height:4px;border-radius:9999px;background:transparent}
.psd-dot.is-filled{background:#ca5c2e}
.psd-option input:checked+.psd-chip .psd-dot.is-filled{background:#fff}
.psd-meal-chip{padding:8px 0;font-size:14px;font-weight:600}
.psd-status{display:flex;align-items:center;gap:12px;min-height:58px;box-sizing:border-box;margin:0;padding:8px 14px 8px 8px;border:1px solid #f1e8de;border-radius:16px;background:#fdf8f4}
.psd-status-thumb{width:40px;height:40px;flex-shrink:0;border-radius:10px;object-fit:cover;background:#f5f5f4}
.psd-status-icon{display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;flex-shrink:0;border-radius:10px}
.psd-status-text{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
.psd-status-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em}
.psd-status-name{font-size:14px;font-weight:600;color:#1c1917;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.psd-status-swap{flex-shrink:0;color:#ca5c2e;opacity:.8}
.psd-status.is-replace .psd-status-label{color:#b45309}
.psd-status.is-free{border-color:#d1fae5;background:#f0fdf4}
.psd-status.is-free .psd-status-icon{background:#dcfce7;color:#047857}
.psd-status.is-free .psd-status-label{color:#047857}
.psd-status.is-same .psd-status-label{color:#78716c}
.psd-status.is-changing{animation:psd-status-in .18s ease}
@keyframes psd-status-in{from{opacity:.4;transform:translateY(2px)}to{opacity:1;transform:none}}
.psd-actions{display:flex;gap:12px;padding-top:4px}
.psd-btn{flex:1;padding:10px 16px;border-radius:12px;font:600 14px/1.25 Inter,system-ui,sans-serif;cursor:pointer;transition:background-color .15s,border-color .15s,color .15s,box-shadow .15s,transform .15s}
.psd-btn:active{transform:scale(.98)}
.psd-btn-secondary{border:1px solid #e7e5e4;background:#fff;color:#44403c}
.psd-btn-secondary:hover{border-color:rgba(202,92,46,.45);background:#fdf8f4;color:#ca5c2e;transform:translateY(-1px);box-shadow:0 6px 14px -6px rgba(202,92,46,.35)}
.psd-btn-secondary:active{transform:scale(.98);box-shadow:none}
.psd-btn-primary{border:1px solid #ca5c2e;background:#ca5c2e;color:#fff;box-shadow:0 1px 2px rgba(0,0,0,.08)}
.psd-btn-primary:hover{background:#b34d23;border-color:#b34d23;transform:translateY(-1px);box-shadow:0 6px 14px -4px rgba(202,92,46,.5)}
.psd-btn-primary:active{transform:scale(.98);box-shadow:0 1px 2px rgba(0,0,0,.08)}
.psd-btn:disabled{opacity:.6;cursor:default;transform:none;box-shadow:none}
.psd-btn:focus-visible,.psd-close:focus-visible{outline:none;box-shadow:0 0 0 2px #fff,0 0 0 4px rgba(202,92,46,.5)}
@media (prefers-reduced-motion:reduce){
  .psd-backdrop,.psd-panel,.psd-chip,.psd-btn,.psd-close{transition:none}
  .psd-chip:hover,.psd-chip:active,.psd-btn:hover,.psd-btn:active,.psd-close:hover{transform:none}
  .psd-status.is-changing{animation:none}
}
`;

function ensurePlanSlotDialogStyles() {
  if (document.getElementById("plan-slot-dialog-styles")) return;
  const style = document.createElement("style");
  style.id = "plan-slot-dialog-styles";
  style.textContent = PLAN_SLOT_DIALOG_CSS;
  document.head.appendChild(style);
}

export async function openAddToPlanDialog(recipe, options = {}) {
  if (!recipe || !getCurrentUser()) return null;
  document.getElementById("plan-slot-dialog")?.remove();

  const weekId = shownWeekId();
  const plan = await getPlan(weekId);
  const dates = getWeekDates();
  const todayIndex = dates.findIndex(isToday);
  let day = DAYS.includes(options.day) ? options.day : DAYS[todayIndex >= 0 ? todayIndex : 0];
  let meal = MEALS.includes(options.meal) ? options.meal : suggestedMeal();
  const recipeName = toTitleCase(recipe.name || "this recipe");
  const relative = weekOffset === 0 ? "This week" : "Shown week";
  const previousFocus = document.activeElement;

  ensurePlanSlotDialogStyles();

  const dayChips = DAYS.map((d, i) => `
    <label class="psd-option">
      <input type="radio" name="plan-slot-day" value="${d}" ${d === day ? "checked" : ""}>
      <span class="psd-chip${isToday(dates[i]) ? " is-today" : ""}">
        <span class="psd-chip-day">${d}</span>
        <span class="psd-chip-date">${dates[i].getDate()}</span>
        <span class="psd-dot" data-day="${d}" aria-hidden="true"></span>
      </span>
    </label>`).join("");

  const mealChips = MEALS.map((m) => `
    <label class="psd-option">
      <input type="radio" name="plan-slot-meal" value="${m}" ${m === meal ? "checked" : ""}>
      <span class="psd-chip psd-meal-chip">${m}</span>
    </label>`).join("");

  const backdrop = document.createElement("div");
  backdrop.id = "plan-slot-dialog";
  backdrop.className = "psd-backdrop";
  backdrop.innerHTML = `
    <div role="dialog" aria-modal="true" aria-labelledby="plan-slot-title" class="psd-panel">
      <button type="button" class="psd-close plan-slot-cancel" aria-label="Close dialog">
        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>

      <div class="psd-head">
        <img src="${escapeHtml(recipe.image || FALLBACK_MEAL_IMG)}" alt="" class="psd-thumb">
        <div class="psd-head-text">
          <h2 id="plan-slot-title" class="psd-title">Add to Meal Plan</h2>
          <p class="psd-sub">${escapeHtml(recipeName)}</p>
        </div>
      </div>

      <form class="psd-form">
        <fieldset class="psd-fieldset">
          <legend class="psd-legend">Day · ${escapeHtml(relative)}, ${escapeHtml(weekRangeText())}</legend>
          <div class="psd-days">${dayChips}</div>
        </fieldset>
        <fieldset class="psd-fieldset">
          <legend class="psd-legend">Meal</legend>
          <div class="psd-meals">${mealChips}</div>
        </fieldset>

        <div class="psd-status" aria-live="polite"></div>

        <div class="psd-actions">
          <button type="button" class="psd-btn psd-btn-secondary plan-slot-cancel">Cancel</button>
          <button type="submit" class="psd-btn psd-btn-primary plan-slot-submit">Add</button>
        </div>
      </form>
    </div>`;

  document.body.appendChild(backdrop);
  const form = backdrop.querySelector("form");
  const panel = backdrop.querySelector(".psd-panel");
  const statusEl = backdrop.querySelector(".psd-status");
  const submitBtn = backdrop.querySelector(".plan-slot-submit");

  // Shows what is in the chosen slot and marks the days that already have this meal.
  function refresh() {
    const existing = plan[day]?.[meal];
    const slot = `${day} ${meal}`;
    let state;
    if (existing && existing.name) {
      const sameRecipe = String(existing.id) === String(recipe.id);
      state = sameRecipe ? "is-same" : "is-replace";
      const thumb = `<img src="${escapeHtml(existing.image || FALLBACK_MEAL_IMG)}" alt="" class="psd-status-thumb">`;
      statusEl.innerHTML = sameRecipe
        ? `${thumb}
           <span class="psd-status-text">
             <span class="psd-status-label">Already planned · ${escapeHtml(slot)}</span>
             <span class="psd-status-name">${escapeHtml(recipeName)}</span>
           </span>`
        : `${thumb}
           <span class="psd-status-text">
             <span class="psd-status-label">Will be replaced · ${escapeHtml(slot)}</span>
             <span class="psd-status-name">${escapeHtml(toTitleCase(existing.name))}</span>
           </span>
           <svg class="psd-status-swap" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4"></path></svg>`;
      submitBtn.textContent = sameRecipe ? "Keep it" : `Replace ${slot}`;
    } else {
      state = "is-free";
      statusEl.innerHTML = `
        <span class="psd-status-icon" aria-hidden="true">
          <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </span>
        <span class="psd-status-text">
          <span class="psd-status-label">Free slot</span>
          <span class="psd-status-name">Nothing planned for ${escapeHtml(slot)} yet</span>
        </span>`;
      submitBtn.textContent = `Add to ${slot}`;
    }
    statusEl.classList.remove("is-free", "is-replace", "is-same", "is-changing");
    void statusEl.offsetWidth; // restart the small fade when the slot changes
    statusEl.classList.add(state, "is-changing");
    backdrop.querySelectorAll(".psd-dot").forEach((dot) => {
      dot.classList.toggle("is-filled", Boolean(plan[dot.dataset.day]?.[meal]));
    });
  }
  refresh();

  requestAnimationFrame(() => {
    backdrop.classList.add("is-open");
    backdrop.querySelector(`input[name="plan-slot-day"][value="${day}"]`)?.focus();
  });

  return new Promise((resolve) => {
    let closed = false;
    function close(result) {
      if (closed) return;
      closed = true;
      document.removeEventListener("keydown", onKeyDown, true);
      backdrop.classList.remove("is-open");
      setTimeout(() => backdrop.remove(), 200);
      if (previousFocus && typeof previousFocus.focus === "function") previousFocus.focus();
      resolve(result);
    }

    function onKeyDown(e) {
      // Leave keys alone while another dialog (e.g. the allergen warning) is on top.
      if (document.getElementById("custom-confirm-modal")) return;
      if (e.key === "Escape") {
        e.preventDefault();
        close(null);
      } else if (e.key === "Tab") {
        // Keep focus inside the dialog.
        const focusable = Array.from(panel.querySelectorAll("button, input:checked")).filter((el) => !el.disabled);
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKeyDown, true);

    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) close(null);
    });
    backdrop.querySelectorAll(".plan-slot-cancel").forEach((btn) => btn.addEventListener("click", () => close(null)));

    form.addEventListener("change", (e) => {
      if (e.target.name === "plan-slot-day") day = e.target.value;
      if (e.target.name === "plan-slot-meal") meal = e.target.value;
      refresh();
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const existing = plan[day]?.[meal];
      if (existing && String(existing.id) === String(recipe.id)) {
        close({ day, meal, unchanged: true });
        return;
      }
      submitBtn.disabled = true;
      try {
        const added = await addToPlan(day, meal, recipe, {
          skipAllergenCheck: Boolean(options.skipAllergenCheck),
          skipReplaceConfirm: true
        });
        close(added ? { day, meal } : null);
      } catch (err) {
        console.warn("Could not add to meal plan:", err);
        submitBtn.disabled = false;
        showToast("Couldn't add this recipe to your plan. Please try again.");
      }
    });
  });
}

// ---------- Phone day tabs ----------
function selectMobileDay(day, focus = false) {
  if (!DAYS.includes(day)) return;
  mobileDay = day;
  renderPlannerTable().then(() => {
    if (focus) document.getElementById(`day-tab-${day}`)?.focus();
  });
}

function initDayTabs() {
  const cardsHost = document.getElementById("planner-cards");
  if (!cardsHost) return;
  cardsHost.addEventListener("click", (e) => {
    const tab = e.target.closest(".day-tab");
    if (tab) selectMobileDay(tab.dataset.day);
  });
  // Arrow keys move between tabs, as in a standard tab list.
  cardsHost.addEventListener("keydown", (e) => {
    const tab = e.target.closest(".day-tab");
    if (!tab) return;
    const i = DAYS.indexOf(tab.dataset.day);
    let next = null;
    if (e.key === "ArrowRight") next = DAYS[(i + 1) % DAYS.length];
    else if (e.key === "ArrowLeft") next = DAYS[(i - 1 + DAYS.length) % DAYS.length];
    else if (e.key === "Home") next = DAYS[0];
    else if (e.key === "End") next = DAYS[DAYS.length - 1];
    if (next) {
      e.preventDefault();
      selectMobileDay(next, true);
    }
  });
}

// ---------- Drag and drop (table on tablet and desktop) ----------
// Drag a meal onto another slot to move it there; dropping on a filled slot swaps them.
const DROP_HIGHLIGHT = ["ring-2", "ring-[#ca5c2e]/50", "bg-[#fbf2ec]"];
let dragSource = null; // { day, meal }

function clearDropHighlights(root) {
  root.querySelectorAll(".plan-slot-inner").forEach((el) => el.classList.remove(...DROP_HIGHLIGHT));
}

function initDragAndDrop() {
  const host = document.getElementById("planner-table-body");
  if (!host) return;

  host.addEventListener("dragstart", (e) => {
    const tile = e.target.closest?.(".plan-tile[draggable='true']");
    if (!tile) return;
    dragSource = { day: tile.dataset.dragDay, meal: tile.dataset.dragMeal };
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", `${dragSource.day}|${dragSource.meal}`);
    requestAnimationFrame(() => tile.classList.add("opacity-40"));
  });

  host.addEventListener("dragend", (e) => {
    e.target.closest?.(".plan-tile")?.classList.remove("opacity-40");
    clearDropHighlights(host);
    dragSource = null;
  });

  host.addEventListener("dragover", (e) => {
    if (!dragSource) return;
    const slot = e.target.closest(".plan-slot");
    if (!slot) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const inner = slot.querySelector(".plan-slot-inner");
    if (inner && !inner.classList.contains(DROP_HIGHLIGHT[0])) {
      clearDropHighlights(host);
      const isSource = slot.dataset.day === dragSource.day && slot.dataset.meal === dragSource.meal;
      if (!isSource) inner.classList.add(...DROP_HIGHLIGHT);
    }
  });

  host.addEventListener("dragleave", (e) => {
    const slot = e.target.closest(".plan-slot");
    if (slot && !slot.contains(e.relatedTarget)) {
      slot.querySelector(".plan-slot-inner")?.classList.remove(...DROP_HIGHLIGHT);
    }
  });

  host.addEventListener("drop", (e) => {
    if (!dragSource) return;
    const slot = e.target.closest(".plan-slot");
    if (!slot) return;
    e.preventDefault();
    clearDropHighlights(host);
    const from = dragSource;
    dragSource = null;
    moveInPlan(from.day, from.meal, slot.dataset.day, slot.dataset.meal);
  });
}

// -------------------------------------------------------------
// Slide-over Side Panel / Drawer Logic
// -------------------------------------------------------------

const DRAWER_DAY_NAMES = { Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday", Sun: "Sunday" };

// Ticks the day and meal pills and updates the "Adding to Monday · Breakfast" line.
function setDrawerTarget(day, meal) {
  currentDrawerDay = day;
  currentDrawerMeal = meal;
  document.querySelectorAll('input[name="drawer-day"]').forEach((input) => { input.checked = input.value === day; });
  document.querySelectorAll('input[name="drawer-meal"]').forEach((input) => { input.checked = input.value === meal; });
  const label = document.getElementById("drawer-target-label");
  if (label) label.textContent = `${DRAWER_DAY_NAMES[day] || day} · ${meal}`;
}

// Shows or hides the day and meal pills under the summary line.
function setDrawerPickerOpen(open) {
  const picker = document.getElementById("drawer-target-picker");
  const toggle = document.getElementById("drawer-target-toggle");
  if (picker) picker.classList.toggle("hidden", !open);
  if (toggle) {
    toggle.textContent = open ? "Done" : "Change";
    toggle.setAttribute("aria-expanded", String(open));
  }
}

// fromSlot: opened from an empty slot's "+ Add" button, so the day and meal are already
// chosen and only the summary line shows. From the toolbar, the pills show straight away.
export async function openMealDrawer(day = "Mon", meal = "Breakfast", { fromSlot = false } = {}) {
  const drawer = document.getElementById("meal-picker-drawer");
  const backdrop = document.getElementById("drawer-backdrop");
  const panel = document.getElementById("drawer-panel");
  const searchInput = document.getElementById("drawer-search-input");
  const clearSearchBtn = document.getElementById("drawer-search-clear");

  if (!drawer || !backdrop || !panel) return;

  setDrawerTarget(day, meal);
  setDrawerPickerOpen(!fromSlot);
  if (searchInput) searchInput.value = "";
  if (clearSearchBtn) clearSearchBtn.classList.add("hidden");

  // Show drawer container
  drawer.classList.remove("invisible");
  requestAnimationFrame(() => {
    backdrop.classList.remove("opacity-0");
    backdrop.classList.add("opacity-100");
    panel.classList.remove("translate-x-full");
    panel.classList.add("translate-x-0");
  });

  // Default to favourites view
  switchDrawerTab("favs");
}

export function closeMealDrawer() {
  const drawer = document.getElementById("meal-picker-drawer");
  const backdrop = document.getElementById("drawer-backdrop");
  const panel = document.getElementById("drawer-panel");

  if (!drawer || !backdrop || !panel) return;

  backdrop.classList.remove("opacity-100");
  backdrop.classList.add("opacity-0");
  panel.classList.remove("translate-x-0");
  panel.classList.add("translate-x-full");

  setTimeout(() => {
    drawer.classList.add("invisible");
  }, 300);
}

function switchDrawerTab(tab) {
  currentDrawerTab = tab;
  const tabFavs = document.getElementById("drawer-tab-favs");
  const tabSearch = document.getElementById("drawer-tab-search");
  const searchInput = document.getElementById("drawer-search-input");

  if (tab === "favs") {
    if (tabFavs) {
      tabFavs.className = "flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold bg-[#ca5c2e] text-white transition flex items-center justify-center gap-1.5 shadow-xs";
    }
    if (tabSearch) {
      tabSearch.className = "flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold bg-stone-100 text-stone-600 hover:bg-stone-200 transition flex items-center justify-center gap-1.5";
    }
    if (searchInput) searchInput.placeholder = "Filter your saved favourites...";
    renderFavouritesList(searchInput ? searchInput.value : "");
  } else {
    if (tabSearch) {
      tabSearch.className = "flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold bg-[#ca5c2e] text-white transition flex items-center justify-center gap-1.5 shadow-xs";
    }
    if (tabFavs) {
      tabFavs.className = "flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold bg-stone-100 text-stone-600 hover:bg-stone-200 transition flex items-center justify-center gap-1.5";
    }
    if (searchInput) searchInput.placeholder = "Search recipes (e.g. Pasta, Curry, Salad)...";
    const q = searchInput ? searchInput.value.trim() : "";
    if (q) {
      performSearch(q);
    } else {
      renderSearchSuggestions();
    }
  }
}

async function renderFavouritesList(filterText = "") {
  const container = document.getElementById("drawer-recipe-list");
  const countBadge = document.getElementById("drawer-favs-count");
  if (!container) return;

  container.innerHTML = `
    <div class="py-12 text-center text-xs text-stone-400 flex flex-col items-center justify-center gap-2">
      <svg class="w-6 h-6 animate-spin text-[#ca5c2e]" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
      <span>Loading saved favourites...</span>
    </div>
  `;

  cachedFavourites = await getFavourites();
  if (countBadge) countBadge.textContent = cachedFavourites.length;

  let list = cachedFavourites;
  if (filterText.trim()) {
    const q = filterText.toLowerCase();
    list = list.filter((r) => 
      (r.name && r.name.toLowerCase().includes(q)) || 
      (r.category && r.category.toLowerCase().includes(q)) ||
      (r.area && r.area.toLowerCase().includes(q))
    );
  }

  if (list.length === 0) {
    if (cachedFavourites.length === 0) {
      container.innerHTML = `
        <div class="py-12 px-4 text-center space-y-3">
          <div class="w-12 h-12 mx-auto rounded-2xl bg-[#ca5c2e]/10 text-[#ca5c2e] flex items-center justify-center">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>
          </div>
          <div>
            <h4 class="text-xs sm:text-sm font-bold text-stone-800">No saved favourites yet</h4>
            <p class="text-xs text-stone-500 mt-1 max-w-xs mx-auto">Explore recipes to find dishes and save them to your favourites, or search any dish directly.</p>
          </div>
          <button type="button" id="drawer-explore-btn" class="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-[#ca5c2e] text-white hover:bg-[#b34d23] transition shadow-xs">
            Explore All Recipes
          </button>
        </div>
      `;
      const exploreBtn = document.getElementById("drawer-explore-btn");
      if (exploreBtn) {
        exploreBtn.addEventListener("click", () => switchDrawerTab("search"));
      }
      return;
    }

    container.innerHTML = `
      <div class="py-10 text-center text-xs text-stone-500 space-y-1">
        <p class="font-medium text-stone-700">${/[^\u0000-\u007f]/.test(filterText) ? `<span>No favourites match </span><span translate="no" class="notranslate">"${escapeHtml(filterText)}"</span>` : `No favourites match "${escapeHtml(filterText)}"`}</p>
        <p class="text-stone-400">Try a different search term or browse all recipes.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = "";
  list.forEach((recipe) => {
    container.appendChild(createDrawerRecipeRow(recipe));
  });
}

function renderSearchSuggestions() {
  const container = document.getElementById("drawer-recipe-list");
  if (!container) return;

  container.innerHTML = `
    <div class="space-y-4 py-2">
      <div class="bg-stone-50/75 rounded-2xl p-4 border border-stone-100">
        <h4 class="text-[11px] font-bold text-stone-500 uppercase tracking-wider mb-2.5">Popular Recipe Categories</h4>
        <div class="flex flex-wrap gap-1.5">
          ${POPULAR_SEARCH_TAGS.map((tag) => `
            <button type="button" class="drawer-suggest-tag text-xs font-semibold bg-white hover:bg-[#ca5c2e] hover:text-white text-stone-700 px-3 py-1.5 rounded-xl border border-stone-200 transition shadow-2xs" data-tag="${tag}">
              ${tag}
            </button>
          `).join("")}
        </div>
      </div>
      <p class="text-xs text-center text-stone-400">Type above to search through thousands of recipes from TheMealDB</p>
    </div>
  `;

  container.querySelectorAll(".drawer-suggest-tag").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tag = btn.dataset.tag;
      const searchInput = document.getElementById("drawer-search-input");
      const clearSearchBtn = document.getElementById("drawer-search-clear");
      if (searchInput) searchInput.value = tag;
      if (clearSearchBtn) clearSearchBtn.classList.remove("hidden");
      performSearch(tag);
    });
  });
}

async function performSearch(query) {
  const container = document.getElementById("drawer-recipe-list");
  if (!container) return;

  if (!query || !query.trim()) {
    renderSearchSuggestions();
    return;
  }

  container.innerHTML = `
    <div class="py-12 text-center text-xs text-stone-400 flex flex-col items-center justify-center gap-2">
      <svg class="w-6 h-6 animate-spin text-[#ca5c2e]" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
      <span>${/[^\u0000-\u007f]/.test(query) ? `<span>Searching: </span><span translate="no" class="notranslate">"${escapeHtml(query)}"</span>...` : `Searching for "${escapeHtml(query)}"...`}</span>
    </div>
  `;

  try {
    const results = await searchRecipes(query);
    if (!results || results.length === 0) {
      container.innerHTML = `
        <div class="py-10 text-center space-y-1.5">
          <p class="text-xs font-bold text-stone-700">${/[^\u0000-\u007f]/.test(query) ? `<span>No recipes found: </span><span translate="no" class="notranslate">"${escapeHtml(query)}"</span>` : `No recipes found for "${escapeHtml(query)}"`}</p>
          <p class="text-xs text-stone-400">Try searching for keywords like "Pasta", "Chicken", or "Curry".</p>
        </div>
      `;
      return;
    }

    container.innerHTML = "";
    results.slice(0, 25).forEach((recipe) => {
      container.appendChild(createDrawerRecipeRow(recipe));
    });
  } catch (err) {
    container.innerHTML = `
      <div class="py-10 text-center text-xs text-red-500">
        Could not load recipes right now. Please check your connection.
      </div>
    `;
  }
}

function createDrawerRecipeRow(recipe) {
  const item = document.createElement("div");
  item.className = "flex items-center gap-3 p-2.5 rounded-2xl border border-stone-100 hover:border-[#ca5c2e]/30 hover:bg-[#faf7f2] transition group";

  const fallbackImg = "https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=150&q=80";
  const imgSrc = recipe.image || fallbackImg;
  const categoryText = [recipe.category, recipe.area].filter(Boolean).join(" • ") || "Recipe";

  item.innerHTML = `
    <img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(toTitleCase(recipe.name))}" class="w-12 h-12 rounded-xl object-cover flex-shrink-0 bg-stone-100 border border-stone-200/50">
    <div class="flex-1 min-w-0">
      <h4 class="text-xs sm:text-sm font-bold text-stone-800 truncate">${escapeHtml(toTitleCase(recipe.name))}</h4>
      <p class="text-[11px] text-stone-400 truncate">${escapeHtml(categoryText)}</p>
    </div>
    <button type="button" class="drawer-add-recipe-btn px-3 py-1.5 rounded-xl bg-[#ca5c2e]/10 hover:bg-[#ca5c2e] text-[#ca5c2e] hover:text-white text-xs font-bold transition flex items-center gap-1 flex-shrink-0 focus:outline-none">
      <span class="text-sm leading-none">+</span> Add
    </button>
  `;

  const addBtn = item.querySelector(".drawer-add-recipe-btn");
  addBtn.addEventListener("click", async () => {
    const targetDay = currentDrawerDay;
    const targetMeal = currentDrawerMeal;

    addBtn.disabled = true;
    addBtn.innerHTML = `
      <svg class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
      Adding...
    `;

    const added = await addToPlan(targetDay, targetMeal, recipe);
    if (added) {
      addBtn.className = "px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold transition flex items-center gap-1 flex-shrink-0";
      addBtn.innerHTML = `✓ Added!`;
      showToast(`Added "${toTitleCase(recipe.name)}" to ${targetDay} ${targetMeal}`);
      setTimeout(() => {
        closeMealDrawer();
      }, 350);
    } else {
      addBtn.disabled = false;
      addBtn.className = "drawer-add-recipe-btn px-3 py-1.5 rounded-xl bg-[#ca5c2e]/10 hover:bg-[#ca5c2e] text-[#ca5c2e] hover:text-white text-xs font-bold transition flex items-center gap-1 flex-shrink-0 focus:outline-none";
      addBtn.innerHTML = `<span class="text-sm leading-none">+</span> Add`;
    }
  });

  return item;
}

// -------------------------------------------------------------
// Page Initialization
// -------------------------------------------------------------

// ---------- Actions menu ("⋯" next to Add meal) ----------
function planMenuItems() {
  return Array.from(document.querySelectorAll("#plan-menu [role=\"menuitem\"]:not([disabled])"));
}

function openPlanMenu(focusLast = false, fromKeyboard = true) {
  const btn = document.getElementById("plan-menu-btn");
  const menu = document.getElementById("plan-menu");
  if (!btn || !menu) return;
  menu.classList.remove("hidden");
  btn.setAttribute("aria-expanded", "true");
  requestAnimationFrame(() => {
    menu.classList.remove("opacity-0", "scale-95");
    menu.classList.add("opacity-100", "scale-100");
  });
  if (!fromKeyboard) {
    menu.focus(); // arrow keys still work from here
    return;
  }
  const items = planMenuItems();
  (focusLast ? items[items.length - 1] : items[0])?.focus();
}

function closePlanMenu(returnFocus = true) {
  const btn = document.getElementById("plan-menu-btn");
  const menu = document.getElementById("plan-menu");
  if (!btn || !menu || btn.getAttribute("aria-expanded") !== "true") return;
  btn.setAttribute("aria-expanded", "false");
  menu.classList.add("opacity-0", "scale-95");
  menu.classList.remove("opacity-100", "scale-100");
  setTimeout(() => {
    if (btn.getAttribute("aria-expanded") === "false") menu.classList.add("hidden");
  }, 150);
  if (returnFocus) btn.focus();
}

function initPlanMenu() {
  const btn = document.getElementById("plan-menu-btn");
  const menu = document.getElementById("plan-menu");
  if (!btn || !menu) return;

  btn.addEventListener("click", (e) => {
    if (btn.getAttribute("aria-expanded") === "true") closePlanMenu();
    else openPlanMenu(false, e.detail === 0); // detail is 0 for Enter/Space, so only then focus an item
  });
  btn.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); openPlanMenu(); }
    if (e.key === "ArrowUp") { e.preventDefault(); openPlanMenu(true); }
  });
  menu.addEventListener("keydown", (e) => {
    const items = planMenuItems();
    const i = items.indexOf(document.activeElement);
    const focusAt = (n) => items[(n + items.length) % items.length]?.focus();
    if (e.key === "ArrowDown") { e.preventDefault(); focusAt(i + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); focusAt(i < 0 ? items.length - 1 : i - 1); }
    else if (e.key === "Home") { e.preventDefault(); focusAt(0); }
    else if (e.key === "End") { e.preventDefault(); focusAt(items.length - 1); }
    else if (e.key === "Escape") { e.preventDefault(); closePlanMenu(); }
    else if (e.key === "Tab") closePlanMenu(false);
  });
  document.addEventListener("click", (e) => {
    if (!menu.contains(e.target) && !btn.contains(e.target)) closePlanMenu(false);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  renderPlannerTable();
  initDragAndDrop();
  initDayTabs();
  initViewTabs();
  initShoppingList();

  // Re-render once Firebase has restored the session, so the plan comes from the account.
  let authSeen = false;
  onAuthChange(() => {
    if (authSeen) {
      memoryPlans.clear();
      savedChecks.clear();
    }
    authSeen = true;
    renderPlannerTable();
  });

  // "Clear week" (in the actions menu)
  document.getElementById("clear-week-btn")?.addEventListener("click", () => {
    closePlanMenu(false);
    clearWeek();
  });
  initPlanMenu();

  // "Add to Calendar" toolbar button
  const openDrawerBtn = document.getElementById("open-add-drawer-btn");
  if (openDrawerBtn) {
    openDrawerBtn.addEventListener("click", () => {
      const user = getCurrentUser();
      if (!user) {
        showAuthPromptModal({
          title: "Log in to plan your meals",
          description: "Create a free account to add recipes to your weekly planner and build your shopping list.",
          redirectUrl: "planner.html",
          icon: "planner"
        });
        return;
      }
      openMealDrawer("Mon", "Breakfast");
    });
  }

  // "Generate from Favourites" toolbar button
  const generateBtn = document.getElementById("generate-plan-btn");
  if (generateBtn) {
    generateBtn.addEventListener("click", () => {
      closePlanMenu(false);
      const user = getCurrentUser();
      if (!user) {
        showAuthPromptModal({
          title: "Log in to plan your meals",
          description: "Create a free account to add recipes to your weekly planner and build your shopping list.",
          redirectUrl: "planner.html",
          icon: "planner"
        });
        return;
      }
      generateFromFavourites();
    });
  }

  // Drawer close button & backdrop
  const closeDrawerBtn = document.getElementById("close-drawer-btn");
  if (closeDrawerBtn) {
    closeDrawerBtn.addEventListener("click", closeMealDrawer);
  }

  const drawerBackdrop = document.getElementById("drawer-backdrop");
  if (drawerBackdrop) {
    drawerBackdrop.addEventListener("click", closeMealDrawer);
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMealDrawer();
  });

  // Drawer tabs
  const tabFavs = document.getElementById("drawer-tab-favs");
  const tabSearch = document.getElementById("drawer-tab-search");
  if (tabFavs) tabFavs.addEventListener("click", () => switchDrawerTab("favs"));
  if (tabSearch) tabSearch.addEventListener("click", () => switchDrawerTab("search"));

  // Drawer search input
  const searchInput = document.getElementById("drawer-search-input");
  const clearSearchBtn = document.getElementById("drawer-search-clear");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      const val = e.target.value;
      if (clearSearchBtn) {
        if (val) clearSearchBtn.classList.remove("hidden");
        else clearSearchBtn.classList.add("hidden");
      }

      clearTimeout(searchDebounceTimeout);
      searchDebounceTimeout = setTimeout(() => {
        if (currentDrawerTab === "favs") {
          renderFavouritesList(val);
        } else {
          performSearch(val);
        }
      }, 300);
    });
  }

  if (clearSearchBtn && searchInput) {
    clearSearchBtn.addEventListener("click", () => {
      searchInput.value = "";
      clearSearchBtn.classList.add("hidden");
      if (currentDrawerTab === "favs") {
        renderFavouritesList("");
      } else {
        renderSearchSuggestions();
      }
    });
  }

  // Drawer day and meal pills, and the Change / Done button
  const targetPicker = document.getElementById("drawer-target-picker");
  if (targetPicker) {
    targetPicker.addEventListener("change", (e) => {
      if (e.target.name === "drawer-day") setDrawerTarget(e.target.value, currentDrawerMeal);
      if (e.target.name === "drawer-meal") setDrawerTarget(currentDrawerDay, e.target.value);
    });
  }

  const targetToggle = document.getElementById("drawer-target-toggle");
  if (targetToggle) {
    targetToggle.addEventListener("click", () => {
      setDrawerPickerOpen(targetToggle.getAttribute("aria-expanded") !== "true");
    });
  }

  // Week navigator buttons
  const prevWeekBtn = document.getElementById("prev-week-btn");
  const nextWeekBtn = document.getElementById("next-week-btn");
  const weekLabel = document.getElementById("week-label");
  if (prevWeekBtn && nextWeekBtn && weekLabel) {
    prevWeekBtn.addEventListener("click", () => {
      weekOffset--;
      renderPlannerTable();
    });
    nextWeekBtn.addEventListener("click", () => {
      weekOffset++;
      renderPlannerTable();
    });
  }
  document.getElementById("this-week-btn")?.addEventListener("click", () => {
    weekOffset = 0;
    mobileDay = null; // back to today on phones
    renderPlannerTable();
  });

  window.addEventListener("auth-changed", () => {
    memoryPlans.clear();
    savedChecks.clear();
    renderPlannerTable();
  });
  window.addEventListener("storage", (e) => {
    if (e.key === "recipeplan_user") renderPlannerTable();
  });
});
