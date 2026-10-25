// Weekly Meal planner and shopping list logic matching RecipePlan mockup.
// Owner: Person 4.

import { showToast } from "./utils.js";
import { getFavourites } from "./favourites.js";

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const MEALS = ["Breakfast", "Lunch", "Dinner"];

// Default weekly plan matching mockup image
const DEMO_PLAN = {
  Mon: {
    Breakfast: { name: "Greek Yogurt Parfait", image: "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=150&h=150&q=80" },
    Lunch: { name: "Chicken Salad", image: "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=150&h=150&q=80" },
    Dinner: { name: "Spaghetti Carbonara", image: "https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=150&h=150&q=80" }
  },
  Tue: {
    Breakfast: { name: "Banana Pancakes", image: "https://images.unsplash.com/photo-1528207776546-365bb710ee93?auto=format&fit=crop&w=150&h=150&q=80" },
    Lunch: { name: "Beef Tacos", image: "https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?auto=format&fit=crop&w=150&h=150&q=80" },
    Dinner: { name: "Tom Yum Soup", image: "https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?auto=format&fit=crop&w=150&h=150&q=80" }
  },
  Wed: {
    Breakfast: { name: "Avocado Toast", image: "https://images.unsplash.com/photo-1588137378633-dea1336ce1e2?auto=format&fit=crop&w=150&h=150&q=80" },
    Lunch: { name: "Teriyaki Chicken Casserole", image: "https://www.themealdb.com/images/media/meals/wvpsxx1468256321.jpg" },
    Dinner: null
  },
  Thu: {
    Breakfast: null,
    Lunch: { name: "Greek Salad", image: "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=150&h=150&q=80" },
    Dinner: null
  },
  Fri: { Breakfast: null, Lunch: null, Dinner: null },
  Sat: { Breakfast: null, Lunch: null, Dinner: null },
  Sun: { Breakfast: null, Lunch: null, Dinner: null }
};

export async function getPlan() {
  try {
    const raw = localStorage.getItem("recipeplan_weekly_plan");
    if (!raw) {
      localStorage.setItem("recipeplan_weekly_plan", JSON.stringify(DEMO_PLAN));
      return DEMO_PLAN;
    }
    return JSON.parse(raw);
  } catch (e) {
    return DEMO_PLAN;
  }
}

export async function savePlan(plan) {
  try {
    localStorage.setItem("recipeplan_weekly_plan", JSON.stringify(plan));
  } catch (e) {}
}

export async function addToPlan(day, meal, recipe) {
  const plan = await getPlan();
  if (!plan[day]) plan[day] = {};
  plan[day][meal] = {
    id: recipe.id || "0",
    name: recipe.name,
    image: recipe.image
  };
  await savePlan(plan);
  renderPlannerTable();
}

export async function removeFromPlan(day, meal) {
  const plan = await getPlan();
  if (plan[day]) {
    plan[day][meal] = null;
    await savePlan(plan);
    renderPlannerTable();
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

export async function renderPlannerTable() {
  const host = document.getElementById("planner-table-body");
  if (!host) return;

  const plan = await getPlan();
  host.innerHTML = "";

  DAYS.forEach((day) => {
    const row = document.createElement("tr");
    row.className = "border-b border-stone-100 hover:bg-[#faf7f2]/50 transition";

    let cellsHtml = `
      <td class="py-3 px-4 font-bold text-stone-800 text-sm align-middle whitespace-nowrap bg-stone-50/50">
        ${day}
      </td>
    `;

    MEALS.forEach((meal) => {
      const item = plan[day]?.[meal];
      if (item) {
        cellsHtml += `
          <td class="py-2.5 px-3 align-middle">
            <div class="inline-flex items-center gap-2.5 bg-white border border-[#efe6dc] rounded-xl p-1.5 pr-3 shadow-xs group max-w-[210px]">
              <img src="${item.image || "https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=80&q=80"}" alt="${item.name}" class="w-9 h-9 rounded-lg object-cover flex-shrink-0">
              <span class="text-xs font-semibold text-stone-800 truncate leading-tight">${item.name}</span>
              <button type="button" class="remove-plan-item text-stone-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition ml-auto flex-shrink-0 text-base leading-none" data-day="${day}" data-meal="${meal}" title="Remove meal">&times;</button>
            </div>
          </td>
        `;
      } else {
        cellsHtml += `
          <td class="py-2.5 px-3 align-middle">
            <button type="button" class="add-slot-btn text-xs text-stone-400 hover:text-[#ca5c2e] hover:bg-[#fbf2ec] px-3 py-2 rounded-xl transition flex items-center gap-1 font-medium border border-transparent hover:border-[#f3ddd0]" data-day="${day}" data-meal="${meal}">
              <span class="text-sm font-bold text-stone-400 hover:text-[#ca5c2e]">+</span> Add
            </button>
          </td>
        `;
      }
    });

    row.innerHTML = cellsHtml;
    host.appendChild(row);
  });

  // Attach delete handlers
  host.querySelectorAll(".remove-plan-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      const { day, meal } = btn.dataset;
      removeFromPlan(day, meal);
    });
  });

  // Attach add handlers
  host.querySelectorAll(".add-slot-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const { day, meal } = btn.dataset;
      const favs = await getFavourites();
      const sample = favs[Math.floor(Math.random() * favs.length)] || {
        name: "Chef's Special Salad",
        image: "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=150&q=80"
      };
      await addToPlan(day, meal, sample);
      showToast(`Added "${sample.name}" to ${day} ${meal}`);
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  renderPlannerTable();

  const generateBtn = document.getElementById("generate-plan-btn");
  if (generateBtn) {
    generateBtn.addEventListener("click", () => {
      generateFromFavourites();
    });
  }

  // Week navigator buttons
  const prevWeekBtn = document.getElementById("prev-week-btn");
  const nextWeekBtn = document.getElementById("next-week-btn");
  const weekLabel = document.getElementById("week-label");
  if (prevWeekBtn && nextWeekBtn && weekLabel) {
    prevWeekBtn.addEventListener("click", () => {
      weekLabel.textContent = "16 Nov – 22 Nov 2026";
      showToast("Viewing week: 16 Nov – 22 Nov 2026");
    });
    nextWeekBtn.addEventListener("click", () => {
      weekLabel.textContent = "30 Nov – 6 Dec 2026";
      showToast("Viewing week: 30 Nov – 6 Dec 2026");
    });
  }
});
