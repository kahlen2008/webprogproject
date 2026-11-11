// Weekly Meal planner and shopping list logic matching RecipePlan mockup.
// Owner: Person 4.

import { showToast, toTitleCase, showAuthPromptModal, escapeHtml } from "./utils.js";
import { getFavourites } from "./favourites.js";
import { confirmIfFlagged } from "./preferences.js";
import { searchRecipes, getRecipeById } from "./api.js";
import { estimateNutrition } from "./nutrition.js";
import { getCurrentUser } from "./auth.js";

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const MEALS = ["Breakfast", "Lunch", "Dinner"];

// Default weekly plan using authentic TheMealDB recipes
const DEMO_PLAN = {
  Mon: {
    Breakfast: { id: "52855", name: "Banana Pancakes", image: "https://www.themealdb.com/images/media/meals/sywswr1511383814.jpg" },
    Lunch: { id: "53011", name: "Chicken Quinoa Greek Salad", image: "https://www.themealdb.com/images/media/meals/k29viq1585565980.jpg" },
    Dinner: { id: "52982", name: "Spaghetti alla Carbonara", image: "https://www.themealdb.com/images/media/meals/llcbn01574260722.jpg" }
  },
  Tue: {
    Breakfast: { id: "52957", name: "Fruit and Cream Cheese Breakfast Pastries", image: "https://www.themealdb.com/images/media/meals/1543774956.jpg" },
    Lunch: { id: "52830", name: "Crock Pot Chicken Baked Tacos", image: "https://www.themealdb.com/images/media/meals/ypxvwv1505333929.jpg" },
    Dinner: { id: "53194", name: "Tom Yum Soup with Prawns", image: "https://www.themealdb.com/images/media/meals/l50vz41763422681.jpg" }
  },
  Wed: {
    Breakfast: { id: "52854", name: "Pancakes", image: "https://www.themealdb.com/images/media/meals/rwuyqx1511383174.jpg" },
    Lunch: { id: "52772", name: "Teriyaki Chicken Casserole", image: "https://www.themealdb.com/images/media/meals/wvpsxx1468256321.jpg" },
    Dinner: { id: "52844", name: "Lasagne", image: "https://www.themealdb.com/images/media/meals/wtsvxx1511296896.jpg" }
  },
  Thu: {
    Breakfast: null,
    Lunch: { id: "52874", name: "Beef and Mustard Pie", image: "https://www.themealdb.com/images/media/meals/sytuqu1511553755.jpg" },
    Dinner: null
  },
  Fri: { Breakfast: null, Lunch: null, Dinner: null },
  Sat: { Breakfast: null, Lunch: null, Dinner: null },
  Sun: { Breakfast: null, Lunch: null, Dinner: null }
};

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

export async function getPlan() {
  try {
    const raw = localStorage.getItem("recipeplan_weekly_plan");
    if (!raw) {
      localStorage.setItem("recipeplan_weekly_plan", JSON.stringify(DEMO_PLAN));
      return JSON.parse(JSON.stringify(DEMO_PLAN));
    }
    const plan = JSON.parse(raw);
    let changed = false;

    // Migrate any legacy mock recipes or un-ID'd entries from previous demo data
    DAYS.forEach((day) => {
      if (!plan[day]) return;
      MEALS.forEach((meal) => {
        const item = plan[day][meal];
        if (!item) return;

        if (item.id === "greek-salad" || item.name === "Greek Salad") {
          item.id = "53011";
          item.name = "Chicken Quinoa Greek Salad";
          item.image = "https://www.themealdb.com/images/media/meals/k29viq1585565980.jpg";
          changed = true;
        } else if (item.name === "Banana Pancakes") {
          if (item.id !== "52855") {
            item.id = "52855";
            item.image = "https://www.themealdb.com/images/media/meals/sywswr1511383814.jpg";
            changed = true;
          }
        } else if (item.name === "Chicken Salad" && (!item.id || item.id === "0")) {
          item.id = "53011";
          item.name = "Chicken Quinoa Greek Salad";
          item.image = "https://www.themealdb.com/images/media/meals/k29viq1585565980.jpg";
          changed = true;
        } else if (item.name === "Spaghetti Carbonara" && (!item.id || item.id === "0")) {
          item.id = "52982";
          item.name = "Spaghetti alla Carbonara";
          item.image = "https://www.themealdb.com/images/media/meals/llcbn01574260722.jpg";
          changed = true;
        } else if (item.name === "Tom Yum Soup" && (!item.id || item.id === "0")) {
          item.id = "53194";
          item.name = "Tom Yum Soup with Prawns";
          item.image = "https://www.themealdb.com/images/media/meals/l50vz41763422681.jpg";
          changed = true;
        } else if (item.name === "Beef Tacos" && (!item.id || item.id === "0")) {
          item.id = "52830";
          item.name = "Crock Pot Chicken Baked Tacos";
          item.image = "https://www.themealdb.com/images/media/meals/ypxvwv1505333929.jpg";
          changed = true;
        } else if (item.name === "Greek Yogurt Parfait" && (!item.id || item.id === "0")) {
          item.id = "52957";
          item.name = "Fruit and Cream Cheese Breakfast Pastries";
          item.image = "https://www.themealdb.com/images/media/meals/1543774956.jpg";
          changed = true;
        } else if (item.name === "Avocado Toast" && (!item.id || item.id === "0")) {
          item.id = "52854";
          item.name = "Pancakes";
          item.image = "https://www.themealdb.com/images/media/meals/rwuyqx1511383174.jpg";
          changed = true;
        } else if (item.name === "Teriyaki Chicken Casserole" && (!item.id || item.id === "0")) {
          item.id = "52772";
          item.image = "https://www.themealdb.com/images/media/meals/wvpsxx1468256321.jpg";
          changed = true;
        }
      });
    });

    if (changed) {
      localStorage.setItem("recipeplan_weekly_plan", JSON.stringify(plan));
    }
    return plan;
  } catch (e) {
    return JSON.parse(JSON.stringify(DEMO_PLAN));
  }
}

export async function savePlan(plan) {
  try {
    localStorage.setItem("recipeplan_weekly_plan", JSON.stringify(plan));
  } catch (e) {}
}

export async function addToPlan(day, meal, recipe, skipConfirm = false) {
  if (!skipConfirm && !(await confirmIfFlagged(recipe))) return false;
  const plan = await getPlan();
  if (!plan[day]) plan[day] = {};
  plan[day][meal] = {
    id: recipe.id || "0",
    name: recipe.name,
    image: recipe.image
  };
  await savePlan(plan);
  renderPlannerTable();
  return true;
}

export async function removeFromPlan(day, meal, options = {}) {
  const plan = await getPlan();
  if (plan[day] && plan[day][meal]) {
    const previousItem = { ...plan[day][meal] };
    plan[day][meal] = null;
    await savePlan(plan);
    renderPlannerTable();

    if (!options.silent) {
      const recipeName = toTitleCase(previousItem.name || "Recipe");
      showToast(`Removed "${recipeName}" from ${day} ${meal}`, {
        duration: 5000,
        action: {
          label: "Undo",
          onClick: async () => {
            await addToPlan(day, meal, previousItem, true);
            showToast(`Restored "${recipeName}" to ${day} ${meal}!`);
          }
        }
      });
    }
  }
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
    if (!plan[day]) plan[day] = {};
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

// Which week is shown: 0 = this week, -1 = last week, 1 = next week.
// The saved plan is a single repeating week, so this only changes the dates shown.
let weekOffset = 0;

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
  const last = dates[6];
  label.textContent = `${formatShortDate(dates[0])} – ${formatShortDate(last)} ${last.getFullYear()}`;
}

function isToday(d) {
  const t = new Date();
  return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
}

// One filled meal: photo, name on up to two lines, remove button in the corner.
function mealTileHtml(item, day, meal, compact = false) {
  const hasLink = item.id && item.id !== "0";
  const link = hasLink ? `recipe.html?id=${encodeURIComponent(item.id)}` : "#";
  const name = escapeHtml(toTitleCase(item.name || ""));
  const img = escapeHtml(item.image || FALLBACK_MEAL_IMG);
  const size = compact ? "w-12 h-12" : "w-16 h-16";
  return `
    <div class="relative group h-full">
      <a href="${link}" class="flex items-center gap-3 h-full bg-white border border-[#efe6dc] rounded-2xl p-2 pr-7 shadow-xs hover:border-[#ca5c2e]/50 hover:shadow-sm transition" title="View recipe">
        <img src="${img}" alt="${name}" loading="lazy" class="${size} rounded-xl object-cover flex-shrink-0 bg-stone-100">
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

export async function renderPlannerTable() {
  updatePlannerAuthUI();
  updateWeekLabel();
  const host = document.getElementById("planner-table-body");
  const cardsHost = document.getElementById("planner-cards");
  if (!host && !cardsHost) return;

  const plan = await getPlan();
  const dates = getWeekDates();

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
        cellsHtml += `<td class="py-2.5 px-2 align-middle">${item ? mealTileHtml(item, day, meal) : emptySlotHtml(day, meal)}</td>`;
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

  // Phones: one card per day, meals stacked
  if (cardsHost) {
    cardsHost.innerHTML = DAYS.map((day, i) => {
      const today = isToday(dates[i]);
      const mealsHtml = MEALS.map((meal) => {
        const item = plan[day]?.[meal];
        return `
          <div>
            <div class="text-[11px] font-bold uppercase tracking-wider text-stone-400 mb-1">${meal}</div>
            ${item ? mealTileHtml(item, day, meal, true) : emptySlotHtml(day, meal, true)}
          </div>
        `;
      }).join("");
      return `
        <section class="bg-white rounded-2xl border ${today ? "border-[#ca5c2e] ring-2 ring-[#ca5c2e]/15" : "border-[#efe6dc]"} shadow-xs p-4 space-y-3">
          <div class="flex items-baseline justify-between gap-2">
            <h3 class="font-bold ${today ? "text-[#ca5c2e]" : "text-stone-900"}">
              ${day} <span class="text-sm font-medium ${today ? "text-[#ca5c2e]/80" : "text-stone-400"}">· ${today ? "Today" : formatShortDate(dates[i])}</span>
            </h3>
            <span class="day-kcal-total text-xs font-semibold text-stone-400" data-day="${day}">–</span>
          </div>
          ${mealsHtml}
        </section>
      `;
    }).join("");
  }

  fillDayCalorieTotals(plan);

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

document.addEventListener("DOMContentLoaded", () => {
  renderPlannerTable();

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

  window.addEventListener("auth-changed", () => {
    renderPlannerTable();
  });
  window.addEventListener("storage", (e) => {
    if (e.key === "recipeplan_user") renderPlannerTable();
  });
});
