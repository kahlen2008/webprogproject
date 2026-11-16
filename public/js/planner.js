// Weekly meal planner logic. Owner: Person 4.
// Each week has its own plan, saved to Firestore at users/{uid}/mealPlan/{weekId}
// (weekId like "2026-W46", see schema.js). A copy is kept in localStorage per user
// so the page paints instantly and still works offline.

import { showToast, toTitleCase, showAuthPromptModal, showConfirmModal, escapeHtml, combineIngredients } from "./utils.js";
import { getFavourites } from "./favourites.js";
import { confirmIfFlagged } from "./preferences.js";
import { searchRecipes, getRecipeById } from "./api.js";
import { estimateNutrition } from "./nutrition.js";
import { getCurrentUser, onAuthChange } from "./auth.js";
import { auth } from "./firebase-config.js";
import {
  getCurrentWeekId,
  saveUserMealPlan,
  fetchUserMealPlan,
  createMealPlanDoc,
  createShoppingListDoc,
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
 * A boolean is still accepted in place of options, meaning skipConfirm.
 */
export async function addToPlan(day, meal, recipe, options = {}) {
  const opts = typeof options === "boolean" ? { skipConfirm: options } : options || {};
  const plan = await getPlan();
  const existingMeal = plan[day]?.[meal];

  if (!opts.skipConfirm && existingMeal && existingMeal.name) {
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

async function getRecipeKcal(id) {
  if (!id || id === "0") return null;
  if (kcalCache.has(id)) return kcalCache.get(id);
  const promise = getRecipeById(id)
    .then((recipe) => (recipe ? estimateNutrition(recipe.ingredients).perServing.kcal : null))
    .catch(() => null);
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

function updateWeekLabel() {
  const label = document.getElementById("week-label");
  if (!label) return;
  const dates = getWeekDates();
  const first = dates[0];
  const last = dates[6];
  // "9 – 15 Nov 2026", or "30 Nov – 6 Dec 2026" when the week crosses a month
  // (and "29 Dec 2026 – 4 Jan 2027" across a year).
  if (first.getFullYear() !== last.getFullYear()) {
    label.textContent = `${formatShortDate(first)} ${first.getFullYear()} – ${formatShortDate(last)} ${last.getFullYear()}`;
  } else if (first.getMonth() !== last.getMonth()) {
    label.textContent = `${formatShortDate(first)} – ${formatShortDate(last)} ${last.getFullYear()}`;
  } else {
    label.textContent = `${first.getDate()} – ${formatShortDate(last)} ${last.getFullYear()}`;
  }
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
  renderShoppingList(plan, shownWeekId());

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
        openMealDrawer(day, meal);
      });
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

export async function openMealDrawer(day = "Mon", meal = "Breakfast") {
  currentDrawerDay = day;
  currentDrawerMeal = meal;

  const drawer = document.getElementById("meal-picker-drawer");
  const backdrop = document.getElementById("drawer-backdrop");
  const panel = document.getElementById("drawer-panel");
  const daySelect = document.getElementById("drawer-day-select");
  const mealSelect = document.getElementById("drawer-meal-select");
  const searchInput = document.getElementById("drawer-search-input");
  const clearSearchBtn = document.getElementById("drawer-search-clear");

  if (!drawer || !backdrop || !panel) return;

  if (daySelect) daySelect.value = day;
  if (mealSelect) mealSelect.value = meal;
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
        <p class="font-medium text-stone-700">${/[^\u0000-\u007f]/.test(filterText) ? `<span>No favourites match </span><span translate="no" class="notranslate">"${filterText}"</span>` : `No favourites match "${filterText}"`}</p>
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
      <span>${/[^\u0000-\u007f]/.test(query) ? `<span>Searching: </span><span translate="no" class="notranslate">"${query}"</span>...` : `Searching for "${query}"...`}</span>
    </div>
  `;

  try {
    const results = await searchRecipes(query);
    if (!results || results.length === 0) {
      container.innerHTML = `
        <div class="py-10 text-center space-y-1.5">
          <p class="text-xs font-bold text-stone-700">${/[^\u0000-\u007f]/.test(query) ? `<span>No recipes found: </span><span translate="no" class="notranslate">"${query}"</span>` : `No recipes found for "${query}"`}</p>
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
    <img src="${imgSrc}" alt="${recipe.name}" class="w-12 h-12 rounded-xl object-cover flex-shrink-0 bg-stone-100 border border-stone-200/50">
    <div class="flex-1 min-w-0">
      <h4 class="text-xs sm:text-sm font-bold text-stone-800 truncate">${toTitleCase(recipe.name)}</h4>
      <p class="text-[11px] text-stone-400 truncate">${categoryText}</p>
    </div>
    <button type="button" class="drawer-add-recipe-btn px-3 py-1.5 rounded-xl bg-[#ca5c2e]/10 hover:bg-[#ca5c2e] text-[#ca5c2e] hover:text-white text-xs font-bold transition flex items-center gap-1 flex-shrink-0 focus:outline-none">
      <span class="text-sm leading-none">+</span> Add
    </button>
  `;

  const addBtn = item.querySelector(".drawer-add-recipe-btn");
  addBtn.addEventListener("click", async () => {
    const daySelect = document.getElementById("drawer-day-select");
    const mealSelect = document.getElementById("drawer-meal-select");
    const targetDay = daySelect ? daySelect.value : currentDrawerDay;
    const targetMeal = mealSelect ? mealSelect.value : currentDrawerMeal;

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

// ---------- Shopping List Storage & Helpers ----------

const memoryShoppingLists = new Map(); // `${uid}/${weekId}` -> doc
const fullRecipeCache = new Map(); // id -> Promise<recipe | null>
let currentShoppingList = []; // [{ name, measure, checked }]
let currentShoppingWeekId = null;
let shoppingRenderToken = 0;

function fetchRecipeWithCache(id) {
  if (!id || id === "0") return Promise.resolve(null);
  if (fullRecipeCache.has(id)) return fullRecipeCache.get(id);
  const promise = getRecipeById(id).catch((e) => {
    console.warn("Could not fetch recipe for shopping list:", id, e);
    return null;
  });
  fullRecipeCache.set(id, promise);
  return promise;
}

function shoppingCacheKey(uid) {
  return `recipeplan_shopping_lists_${uid}`;
}

function readLocalShoppingLists(uid) {
  try {
    return JSON.parse(localStorage.getItem(shoppingCacheKey(uid)) || "{}") || {};
  } catch (e) {
    return {};
  }
}

function writeLocalShoppingList(uid, weekId, doc) {
  try {
    const all = readLocalShoppingLists(uid);
    all[weekId] = doc;
    localStorage.setItem(shoppingCacheKey(uid), JSON.stringify(all));
  } catch (e) {}
}

async function loadSavedShoppingDoc(weekId) {
  const user = getCurrentUser();
  const uid = user?.uid;
  if (!uid) {
    try {
      return JSON.parse(localStorage.getItem(`recipeplan_shopping_guest_${weekId}`) || "null");
    } catch (e) {
      return null;
    }
  }

  const memKey = `${uid}/${weekId}`;
  if (memoryShoppingLists.has(memKey)) {
    return memoryShoppingLists.get(memKey);
  }

  const local = readLocalShoppingLists(uid)[weekId] || null;
  if (local) {
    memoryShoppingLists.set(memKey, local);
  }

  if (cloudUid()) {
    try {
      const cloud = await fetchUserShoppingList(uid, weekId);
      if (cloud) {
        memoryShoppingLists.set(memKey, cloud);
        writeLocalShoppingList(uid, weekId, cloud);
        return cloud;
      }
    } catch (e) {
      console.warn("Could not fetch shopping list from Firestore:", e);
    }
  }

  return local;
}

async function persistShoppingList(weekId, items) {
  const user = getCurrentUser();
  const uid = user?.uid;
  const docData = createShoppingListDoc(items);

  if (!uid) {
    try {
      localStorage.setItem(`recipeplan_shopping_guest_${weekId}`, JSON.stringify(docData));
    } catch (e) {}
    return docData;
  }

  const memKey = `${uid}/${weekId}`;
  memoryShoppingLists.set(memKey, docData);
  writeLocalShoppingList(uid, weekId, docData);

  if (cloudUid()) {
    try {
      await saveUserShoppingList(uid, weekId, items);
    } catch (e) {
      console.warn("Could not save shopping list to Firestore:", e);
    }
  }

  return docData;
}

export function renderShoppingItemsDOM(weekId = shownWeekId()) {
  const grid = document.getElementById("shopping-list-grid");
  const progressBadge = document.getElementById("shopping-progress-badge");
  const progressBar = document.getElementById("shopping-progress-bar");
  const selectAllLabel = document.getElementById("select-all-label");

  if (!grid) return;

  // Split into unchecked and checked so checked items move to the bottom
  const uncheckedItems = currentShoppingList.filter((item) => !item.checked);
  const checkedItems = currentShoppingList.filter((item) => item.checked);
  const sortedItems = [...uncheckedItems, ...checkedItems];

  const total = currentShoppingList.length;
  const checkedCount = checkedItems.length;

  if (progressBadge) {
    progressBadge.textContent = `${checkedCount} of ${total} items checked`;
  }
  if (progressBar) {
    const pct = total > 0 ? Math.round((checkedCount / total) * 100) : 0;
    progressBar.style.width = `${pct}%`;
  }
  if (selectAllLabel) {
    selectAllLabel.textContent = total > 0 && checkedCount === total ? "Deselect All" : "Select All";
  }

  grid.innerHTML = sortedItems.map((item) => {
    const isChecked = Boolean(item.checked);
    const cardClass = isChecked
      ? "shopping-item-card is-checked group flex items-center justify-between gap-3 p-3 rounded-2xl border transition-all duration-200 cursor-pointer select-none bg-stone-50/70 border-stone-200/80 hover:bg-white hover:border-[#ca5c2e]/40 shadow-2xs"
      : "shopping-item-card group flex items-center justify-between gap-3 p-3 rounded-2xl border transition-all duration-200 cursor-pointer select-none bg-white border-[#efe6dc] hover:border-[#ca5c2e]/50 hover:shadow-xs";

    const nameClass = isChecked
      ? "shopping-item-name text-xs sm:text-sm font-semibold truncate transition line-through text-stone-400"
      : "shopping-item-name text-xs sm:text-sm font-semibold truncate transition text-stone-800";

    const measureClass = isChecked
      ? "shopping-item-measure text-[11px] font-medium px-2 py-0.5 rounded-lg bg-white border border-[#efe6dc] text-stone-400 transition shrink-0 shadow-2xs"
      : "shopping-item-measure text-[11px] font-medium px-2 py-0.5 rounded-lg bg-[#faf7f2] border border-[#efe6dc] text-stone-600 transition shrink-0 shadow-2xs";

    const measureHtml = item.measure && item.measure.trim()
      ? `<span class="${measureClass}">${escapeHtml(item.measure.trim())}</span>`
      : "";

    return `
      <label class="${cardClass}" data-name="${escapeHtml(item.name)}">
        <div class="flex items-center gap-2.5 min-w-0">
          <input type="checkbox" ${isChecked ? "checked" : ""} class="shopping-item-check w-4 h-4 rounded text-[#ca5c2e] accent-[#ca5c2e] focus:ring-0 focus:ring-offset-0 cursor-pointer">
          <span class="${nameClass}">${escapeHtml(item.name)}</span>
        </div>
        ${measureHtml}
      </label>
    `;
  }).join("");
}

export async function renderShoppingList(plan, weekId = shownWeekId()) {
  const grid = document.getElementById("shopping-list-grid");
  const progressBadge = document.getElementById("shopping-progress-badge");
  const progressBar = document.getElementById("shopping-progress-bar");
  const selectAllBtn = document.getElementById("clear-shopping-btn");
  const selectAllLabel = document.getElementById("select-all-label");

  if (!grid) return;

  const currentToken = ++shoppingRenderToken;

  if (!plan) {
    plan = await getPlan(weekId);
    if (currentToken !== shoppingRenderToken) return;
  }

  // Gather planned meals
  const mealItems = [];
  const recipeFetchPromises = [];

  DAYS.forEach((day) => {
    MEALS.forEach((meal) => {
      const slot = plan?.[day]?.[meal];
      if (slot && slot.id && slot.id !== "0") {
        mealItems.push(slot);
        if (!Array.isArray(slot.ingredients) || slot.ingredients.length === 0) {
          recipeFetchPromises.push(
            fetchRecipeWithCache(slot.id).then((fullRecipe) => {
              if (fullRecipe && Array.isArray(fullRecipe.ingredients)) {
                slot.ingredients = fullRecipe.ingredients;
              }
            })
          );
        }
      }
    });
  });

  if (recipeFetchPromises.length > 0) {
    await Promise.all(recipeFetchPromises);
    if (currentToken !== shoppingRenderToken) return;
  }

  // Collect raw ingredients from all meals
  const rawIngredients = [];
  mealItems.forEach((slot) => {
    if (Array.isArray(slot.ingredients)) {
      rawIngredients.push(...slot.ingredients);
    }
  });

  // Combine ingredients across recipes
  const combined = combineIngredients(rawIngredients);

  if (combined.length === 0) {
    currentShoppingList = [];
    currentShoppingWeekId = weekId;
    grid.innerHTML = `
      <div class="col-span-full py-10 px-4 text-center">
        <div class="w-12 h-12 mx-auto mb-3 rounded-2xl bg-[#faf7f2] border border-[#efe6dc] flex items-center justify-center text-stone-400">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path>
          </svg>
        </div>
        <p class="text-sm font-semibold text-stone-700">No ingredients yet</p>
        <p class="text-xs text-stone-400 mt-1 max-w-sm mx-auto">Add meals to your weekly plan above to automatically generate your shopping list.</p>
      </div>
    `;
    if (progressBadge) progressBadge.textContent = "0 items";
    if (progressBar) progressBar.style.width = "0%";
    if (selectAllBtn) {
      selectAllBtn.disabled = true;
      selectAllBtn.classList.add("opacity-50", "pointer-events-none");
    }
    const copyBtn = document.getElementById("copy-shopping-btn");
    if (copyBtn) {
      copyBtn.disabled = true;
      copyBtn.classList.add("opacity-50", "pointer-events-none");
    }
    if (selectAllLabel) selectAllLabel.textContent = "Select All";
    return;
  }

  if (selectAllBtn) {
    selectAllBtn.disabled = false;
    selectAllBtn.classList.remove("opacity-50", "pointer-events-none");
  }
  const copyBtn = document.getElementById("copy-shopping-btn");
  if (copyBtn) {
    copyBtn.disabled = false;
    copyBtn.classList.remove("opacity-50", "pointer-events-none");
  }

  // Load saved checked status for this weekId
  const savedDoc = await loadSavedShoppingDoc(weekId);
  if (currentToken !== shoppingRenderToken) return;

  const checkedSet = new Set();
  if (currentShoppingWeekId === weekId && currentShoppingList.length > 0) {
    currentShoppingList.forEach((item) => {
      if (item.checked && item.name) {
        checkedSet.add(item.name.trim().toLowerCase());
      }
    });
  }
  if (savedDoc?.items && Array.isArray(savedDoc.items)) {
    savedDoc.items.forEach((item) => {
      if (item.checked && item.name) {
        checkedSet.add(item.name.trim().toLowerCase());
      }
    });
  } else if (savedDoc?.checked && Array.isArray(savedDoc.checked)) {
    savedDoc.checked.forEach((name) => {
      if (name) checkedSet.add(String(name).trim().toLowerCase());
    });
  }

  currentShoppingWeekId = weekId;
  currentShoppingList = combined.map((item) => ({
    name: item.name,
    measure: item.measure || "",
    checked: checkedSet.has(item.name.trim().toLowerCase())
  }));

  renderShoppingItemsDOM(weekId);
}

document.addEventListener("DOMContentLoaded", () => {
  renderPlannerTable();
  initDragAndDrop();
  initDayTabs();

  // Re-render once Firebase has restored the session, so the plan comes from the account.
  let authSeen = false;
  onAuthChange(() => {
    if (authSeen) memoryPlans.clear();
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

  // Drawer day/meal selects
  const daySelect = document.getElementById("drawer-day-select");
  if (daySelect) {
    daySelect.addEventListener("change", (e) => {
      currentDrawerDay = e.target.value;
    });
  }

  const mealSelect = document.getElementById("drawer-meal-select");
  if (mealSelect) {
    mealSelect.addEventListener("change", (e) => {
      currentDrawerMeal = e.target.value;
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

  // Shopping list interactive event listeners
  const shoppingGrid = document.getElementById("shopping-list-grid");
  const selectAllBtn = document.getElementById("clear-shopping-btn");

  if (shoppingGrid) {
    shoppingGrid.addEventListener("change", async (e) => {
      const checkbox = e.target.closest(".shopping-item-check");
      if (!checkbox) return;
      const card = checkbox.closest(".shopping-item-card");
      if (!card) return;
      const name = card.dataset.name;
      if (!name) return;

      const item = currentShoppingList.find((i) => i.name === name);
      if (item) {
        item.checked = checkbox.checked;
        const weekId = shownWeekId();
        renderShoppingItemsDOM(weekId);
        // Retain focus on toggled item's checkbox
        const escaped = CSS.escape(name);
        const newCard = shoppingGrid.querySelector(`.shopping-item-card[data-name="${escaped}"]`);
        newCard?.querySelector(".shopping-item-check")?.focus();
        await persistShoppingList(weekId, currentShoppingList);
      }
    });
  }

  if (selectAllBtn) {
    selectAllBtn.addEventListener("click", async () => {
      if (!currentShoppingList || currentShoppingList.length === 0) return;
      const allChecked = currentShoppingList.every((i) => i.checked);
      currentShoppingList.forEach((i) => {
        i.checked = !allChecked;
      });
      const weekId = shownWeekId();
      renderShoppingItemsDOM(weekId);
      await persistShoppingList(weekId, currentShoppingList);
    });
  }

  const copyShoppingBtn = document.getElementById("copy-shopping-btn");
  const copyShoppingLabel = document.getElementById("copy-shopping-label");

  if (copyShoppingBtn) {
    copyShoppingBtn.addEventListener("click", async () => {
      if (!currentShoppingList || currentShoppingList.length === 0) {
        showToast("Shopping list is empty.");
        return;
      }

      const text = currentShoppingList
        .map((item) => `${item.checked ? "✓ " : "• "}${item.name}${item.measure ? ` (${item.measure})` : ""}`)
        .join("\n");

      let copied = false;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
          copied = true;
        }
      } catch (err) {}

      if (!copied) {
        try {
          const textarea = document.createElement("textarea");
          textarea.value = text;
          textarea.style.position = "fixed";
          textarea.style.opacity = "0";
          document.body.appendChild(textarea);
          textarea.select();
          copied = document.execCommand("copy");
          document.body.removeChild(textarea);
        } catch (err) {}
      }

      if (copied) {
        showToast("Shopping list copied to clipboard!");
        if (copyShoppingLabel) copyShoppingLabel.textContent = "Copied!";
        copyShoppingBtn.classList.add("text-emerald-700", "border-emerald-300", "bg-emerald-50");
        setTimeout(() => {
          if (copyShoppingLabel) copyShoppingLabel.textContent = "Copy list";
          copyShoppingBtn.classList.remove("text-emerald-700", "border-emerald-300", "bg-emerald-50");
        }, 2000);
      } else {
        showToast("Couldn't copy to clipboard.");
      }
    });
  }

  window.addEventListener("auth-changed", () => {
    memoryPlans.clear();
    memoryShoppingLists.clear();
    renderPlannerTable();
  });
  window.addEventListener("storage", (e) => {
    if (e.key === "recipeplan_user") renderPlannerTable();
  });
});
