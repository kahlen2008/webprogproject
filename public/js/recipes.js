// Home page (search/categories) and recipe detail page.
// Matches the design and interactions shown in RecipePlan mockup.

import { searchRecipes, searchRecipesWide, listAllRecipes, getRecipeById, filterByCategory, listAreas, filterByArea } from "./api.js";
import { translateQueryToEnglish } from "./i18n.js";
import { estimateNutrition } from "./nutrition.js";
import { createRecipeCard, escapeHtml, showToast, toTitleCase, cleanInstructionText, combineIngredients, capitalizeIngredient, showAuthPromptModal, showConfirmModal, playHeartEffect, scaleMeasure } from "./utils.js";
import { openCookingMode } from "./cooking-mode.js";
import {
  getPreferences,
  savePreferences,
  checkRecipes,
  checkRecipe,
  decorateCard,
  describeResult,
  confirmIfFlagged,
  getSwapSuggestions,
} from "./preferences.js";

function getCurrentUser() {
  try {
    const raw = localStorage.getItem("recipeplan_user");
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

// ---------- Home page: Search & Category Filter ----------
const searchForm = document.getElementById("search-form");
const results = document.getElementById("results");
const message = document.getElementById("results-message");
const sectionTitle = document.getElementById("recipes-section-title");
const categoryChips = document.querySelectorAll(".category-chip");
const hideToggle = document.getElementById("hide-flagged-toggle");
const hideToggleWrap = document.getElementById("hide-flagged-wrap");

// Authentic fallback recipes with full ingredients & instructions (used only if offline / API is unreachable)
const FALLBACK_RECIPES_BY_ID = {
  "52772": {
    id: "52772",
    name: "Teriyaki Chicken Casserole",
    image: "https://www.themealdb.com/images/media/meals/wvpsxx1468256321.jpg",
    category: "Chicken",
    area: "Japanese",
    description: "Tender chicken breasts baked in a sweet and savoury teriyaki glaze with fresh stir-fry vegetables and steamed rice.",
    instructions: "Preheat oven to 350° F. Spray a 9x13-inch baking pan with non-stick spray.\r\nCombine soy sauce, 1/2 cup water, brown sugar, ginger and garlic in a small saucepan and cover. Bring to a boil over medium heat. Remove lid and cook for one minute once boiling.\r\nMeanwhile, stir together cornstarch and 2 tablespoons of water in a separate dish until smooth. Once sauce is boiling, add mixture to saucepan and stir to combine. Cook until sauce thickens then remove from heat.\r\nPlace chicken breasts in prepared pan. Pour 1 cup of sauce over chicken. Bake in oven for 35 minutes or until cooked through. Shred chicken in dish using two forks.\r\nAdd cooked vegetables and rice to the casserole dish with chicken. Add remaining sauce, gently tossing everything together. Return to oven and cook 15 minutes. Let stand 5 minutes before serving.",
    ingredients: [
      { name: "soy sauce", measure: "3/4 cup" },
      { name: "water", measure: "1/2 cup" },
      { name: "brown sugar", measure: "1/4 cup" },
      { name: "ground ginger", measure: "1/2 tsp" },
      { name: "minced garlic", measure: "1/2 tsp" },
      { name: "cornstarch", measure: "4 tbsp" },
      { name: "chicken breasts", measure: "2 large" },
      { name: "stir-fry vegetables", measure: "1 pack (12 oz)" },
      { name: "brown rice", measure: "3 cups cooked" }
    ]
  },
  "52855": {
    id: "52855",
    name: "Banana Pancakes",
    image: "https://www.themealdb.com/images/media/meals/sywswr1511383814.jpg",
    category: "Dessert",
    area: "American",
    description: "Fluffy, naturally sweet banana pancakes made with ripe bananas, eggs, and a touch of vanilla, topped with fresh raspberries and pecans.",
    instructions: "In a bowl, mash the banana with a fork until it resembles a thick purée. Stir in the eggs, baking powder and vanilla.\r\nHeat a large non-stick frying pan or pancake pan over a medium heat and brush with half the oil. Using half the batter, spoon two pancakes into the pan, cook for 1-2 mins each side, then tip onto a plate. Repeat the process with the remaining oil and batter. Top the pancakes with the pecans and raspberries.",
    ingredients: [
      { name: "Banana", measure: "1 large" },
      { name: "Eggs", measure: "2 medium" },
      { name: "Baking Powder", measure: "pinch" },
      { name: "Vanilla Extract", measure: "sprinkling" },
      { name: "Oil", measure: "1 tsp" },
      { name: "Pecan Nuts", measure: "25g" },
      { name: "Raspberries", measure: "125g" }
    ]
  },
  "53011": {
    id: "53011",
    name: "Chicken Quinoa Greek Salad",
    image: "https://www.themealdb.com/images/media/meals/k29viq1585565980.jpg",
    category: "Chicken",
    area: "Greek",
    description: "A fresh Mediterranean salad bowl packed with fluffy quinoa, tender griddled spiced chicken fillets, Kalamata olives, juicy tomatoes, and feta cheese.",
    instructions: "Cook the quinoa following pack instructions, then rinse in cold water and drain thoroughly.\r\nMeanwhile, mix butter, chilli and garlic into a paste. Toss chicken fillets in 2 tsp olive oil with seasoning. Lay in a hot griddle pan and cook for 3-4 mins each side until cooked through. Transfer to a plate, dot with spicy butter and set aside.\r\nNext, tip tomatoes, olives, onion, feta and mint into a bowl. Toss in cooked quinoa. Stir through remaining olive oil, lemon juice and zest, and season well. Top with chicken fillets and drizzle with juices.",
    ingredients: [
      { name: "Quinoa", measure: "225g" },
      { name: "Chicken Breast", measure: "400g" },
      { name: "Black Olives", measure: "Handful" },
      { name: "Red Onions", measure: "1 chopped" },
      { name: "Feta", measure: "100g" },
      { name: "Olive Oil", measure: "2 tbsp" },
      { name: "Lemon", measure: "Juice of 1/2" }
    ]
  },
  "53194": {
    id: "53194",
    name: "Tom Yum Soup with Prawns",
    image: "https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?auto=format&fit=crop&w=600&q=80",
    category: "Seafood",
    area: "Thai",
    description: "A world-famous Thai hot and sour soup infused with fragrant lemongrass, galangal, kaffir lime leaves, juicy prawns, and fiery bird's eye chilies.",
    instructions: "Bring chicken or shrimp stock to a gentle boil in a medium soup pot.\r\nBruise lemongrass stalks, slice fresh galangal, and tear kaffir lime leaves. Add them along with crushed garlic and bird's eye chilies to the boiling stock. Simmer for 5 minutes until intensely fragrant.\r\nAdd sliced mushrooms and Thai roasted chili paste (Nam Prik Pao), stirring until thoroughly dissolved into the broth.\r\nAdd cleaned prawns and simmer gently for 2-3 minutes until they turn pink and opaque. Do not overcook.\r\nTurn off the heat. Stir in fish sauce and freshly squeezed lime juice to achieve the perfect balance of hot, sour, and savoury.\r\nGarnish with fresh cilantro leaves and serve piping hot.",
    ingredients: [
      { name: "Prawns (Shrimp)", measure: "300g peeled & deveined" },
      { name: "Lemongrass Stalks", measure: "2 bruised" },
      { name: "Fresh Galangal", measure: "4-5 slices" },
      { name: "Kaffir Lime Leaves", measure: "4 torn" },
      { name: "Thai Bird's Eye Chilies", measure: "3-4 crushed" },
      { name: "Straw or Button Mushrooms", measure: "150g sliced" },
      { name: "Thai Roasted Chili Paste", measure: "1-2 tbsp" },
      { name: "Fish Sauce", measure: "2 tbsp" },
      { name: "Fresh Lime Juice", measure: "3 tbsp" },
      { name: "Chicken or Vegetable Stock", measure: "4 cups" },
      { name: "Fresh Cilantro", measure: "Handful chopped" }
    ]
  },
  "52844": {
    id: "52844",
    name: "Lasagne",
    image: "https://www.themealdb.com/images/media/meals/wtsvxx1511296896.jpg",
    category: "Pasta",
    area: "Italian",
    description: "Layers of pasta sheets baked with a rich beef ragù sauce, creamy white sauce, and bubbling melted mozzarella and parmesan cheese.",
    instructions: "Heat oil in a large saucepan. Add bacon and cook for a few minutes until golden. Add onion, celery and carrot, cooking over medium heat for 5 mins until softened.\r\nAdd garlic and cook for 1 min, then add minced beef and cook, stirring and breaking it up for 6 mins until browned.\r\nStir in tomato purée, chopped tomatoes, honey and season to taste. Simmer for 20 mins.\r\nHeat oven to 200°C / 180°C fan. Ladle ragù sauce into base of casserole dish, then layer lasagne sheets and sauce, repeating for 3 layers.\r\nMix crème fraîche with 2 tbsp water, pour over top, and sprinkle mozzarella and parmesan. Bake for 25-30 mins until golden and bubbling.",
    ingredients: [
      { name: "Olive Oil", measure: "1 tbsp" },
      { name: "Bacon", measure: "2 strips" },
      { name: "Onion", measure: "1 finely chopped" },
      { name: "Celery", measure: "1 stick" },
      { name: "Carrots", measure: "1 medium" },
      { name: "Garlic", measure: "2 cloves" },
      { name: "Minced Beef", measure: "500g" },
      { name: "Tomato Puree", measure: "1 tbsp" },
      { name: "Chopped Tomatoes", measure: "800g" },
      { name: "Lasagne Sheets", measure: "500g" },
      { name: "Creme Fraiche", measure: "400ml" },
      { name: "Mozzarella Balls", measure: "125g" },
      { name: "Parmesan Cheese", measure: "50g" }
    ]
  },
  "52874": {
    id: "52874",
    name: "Beef and Mustard Pie",
    image: "https://www.themealdb.com/images/media/meals/sytuqu1511553755.jpg",
    category: "Beef",
    area: "British",
    description: "Tender beef braised with red wine, beef stock, and wholegrain mustard under a golden, flaky puff pastry crust.",
    instructions: "Preheat oven to 150°C. Toss beef with flour, salt and pepper in a bowl.\r\nHeat oil in a large casserole dish, brown beef on all sides, then remove.\r\nAdd red wine, reduce by half, then return beef and add stock, onion, carrots, thyme and mustard. Cover and bake for 2 hours until tender.\r\nTransfer filling to a pie dish. Brush rim with beaten egg and top with puff pastry.\r\nBake at 200°C for 30 minutes until pastry is golden and puffed. Serve with buttered green beans.",
    ingredients: [
      { name: "Beef", measure: "1kg" },
      { name: "Plain Flour", measure: "2 tbsp" },
      { name: "Rapeseed Oil", measure: "2 tbsp" },
      { name: "Red Wine", measure: "200ml" },
      { name: "Beef Stock", measure: "400ml" },
      { name: "Onion", measure: "1 sliced" },
      { name: "Carrots", measure: "2 chopped" },
      { name: "Mustard", measure: "2 tbsp" },
      { name: "Puff Pastry", measure: "400g" },
      { name: "Green Beans", measure: "300g" }
    ]
  },
  "52854": {
    id: "52854",
    name: "Pancakes",
    image: "https://www.themealdb.com/images/media/meals/rwuyqx1511383174.jpg",
    category: "Dessert",
    area: "United States",
    description: "Golden, fluffy skillet pancakes served warm with maple syrup, melted butter, and fresh seasonal berries.",
    instructions: "Whisk flour, eggs, milk, 1 tbsp sunflower oil and a pinch of salt into a smooth batter.\r\nHeat a frying pan over medium heat with a light wipe of oil. Pour in batter and cook each pancake for 1 minute on each side until golden.\r\nServe warm with fresh raspberries, blueberries, maple syrup or sugar.",
    ingredients: [
      { name: "Flour", measure: "100g" },
      { name: "Eggs", measure: "2 large" },
      { name: "Milk", measure: "300ml" },
      { name: "Sunflower Oil", measure: "1 tbsp" },
      { name: "Sugar / Berries", measure: "To serve" }
    ]
  }
};

const DEFAULT_FALLBACK_RECIPES = Object.values(FALLBACK_RECIPES_BY_ID);

function syncHideToggle() {
  const prefs = getPreferences();
  // Logged-out visitors see every recipe unfiltered, with a note that logging in personalises them.
  const note = document.getElementById("personalise-note");
  if (note) {
    const loggedOut = !getCurrentUser();
    note.classList.toggle("hidden", !loggedOut);
    note.classList.toggle("inline-flex", loggedOut);
  }
  if (hideToggleWrap) {
    if (prefs.allergies && prefs.allergies.length > 0) {
      hideToggleWrap.classList.remove("hidden");
      hideToggleWrap.classList.add("inline-flex");
    } else {
      hideToggleWrap.classList.add("hidden");
      hideToggleWrap.classList.remove("inline-flex");
    }
  }
  if (hideToggle) {
    hideToggle.checked = prefs.hideFlagged === true;
  }
}

// Cards rendered for the current view, kept so the allergen filter can animate in place.
let currentChecked = [];
const cardCache = new Map();
let finishFilterAnimation = null;

function getOrCreateCard({ recipe, result }) {
  const id = String(recipe.id);
  let card = cardCache.get(id);
  if (!card) {
    card = createRecipeCard(recipe, { priority: false });
    decorateCard(card, result);
    card.dataset.cardId = id;
    cardCache.set(id, card);
  }
  return card;
}

// Shows/hides allergen recipes with a smooth FLIP transition (same feel as removing a favourite).
// Returns false when it can't animate, so the caller falls back to a normal re-render.
function applyHideFilterAnimated(hide) {
  if (!results) return false;
  if (finishFilterAnimation) finishFilterAnimation();

  const visible = hide ? currentChecked.filter((item) => !item.result.hasAllergen) : currentChecked;
  const attached = Array.from(results.querySelectorAll(".recipe-card"));
  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!currentChecked.length || !attached.length || !visible.length || reduceMotion) return false;

  const keepIds = new Set(visible.map((item) => String(item.recipe.id)));
  const listRect = results.getBoundingClientRect();
  const firstRects = new Map(attached.map((c) => [c, c.getBoundingClientRect()]));
  const previousPosition = results.style.position;
  results.style.position = "relative";

  // Leaving cards: replace with absolute ghosts that fade out at their exact spot
  const ghosts = [];
  attached.forEach((card) => {
    if (keepIds.has(card.dataset.cardId)) return;
    const rect = firstRects.get(card);
    const ghost = card.cloneNode(true);
    ghost.style.position = "absolute";
    ghost.style.left = `${rect.left - listRect.left}px`;
    ghost.style.top = `${rect.top - listRect.top}px`;
    ghost.style.width = `${rect.width}px`;
    ghost.style.height = `${rect.height}px`;
    ghost.style.margin = "0";
    ghost.style.zIndex = "30";
    ghost.style.pointerEvents = "none";
    ghost.style.transition = "opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1), transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)";
    results.appendChild(ghost);
    ghosts.push(ghost);
    card.remove();
  });

  // Put the visible cards in their original order (new ones are created on demand)
  const entering = [];
  visible.forEach((item) => {
    const card = getOrCreateCard(item);
    if (!card.isConnected) entering.push(card);
    results.appendChild(card);
  });

  // Invert: shift staying cards back to where they were; hide entering cards
  const shifting = [];
  visible.forEach((item) => {
    const card = cardCache.get(String(item.recipe.id));
    if (entering.includes(card)) return;
    const first = firstRects.get(card);
    if (!first) return;
    const last = card.getBoundingClientRect();
    const dx = first.left - last.left;
    const dy = first.top - last.top;
    if (dx !== 0 || dy !== 0) {
      card.style.transition = "none";
      card.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
      shifting.push(card);
    }
  });
  entering.forEach((card) => {
    card.style.transition = "none";
    card.style.opacity = "0";
    card.style.transform = "scale(0.85)";
  });

  void results.offsetHeight; // commit the inverted positions

  const cleanup = () => {
    clearTimeout(timer);
    ghosts.forEach((g) => g.remove());
    [...shifting, ...entering].forEach((c) => {
      c.style.transition = "";
      c.style.transform = "";
      c.style.opacity = "";
    });
    results.style.position = previousPosition;
    finishFilterAnimation = null;
  };
  const timer = setTimeout(cleanup, 380);
  finishFilterAnimation = cleanup;

  // Play: ghosts fade out, staying cards glide, returning cards fade in
  requestAnimationFrame(() => {
    ghosts.forEach((g) => {
      g.style.opacity = "0";
      g.style.transform = "scale(0.85)";
    });
    shifting.forEach((c) => {
      c.style.transition = "transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1)";
      c.style.transform = "translate3d(0, 0, 0)";
    });
    entering.forEach((c) => {
      c.style.transition = "opacity 0.3s ease-out, transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1)";
      c.style.opacity = "1";
      c.style.transform = "scale(1)";
    });
  });

  return true;
}

let cardRenderId = 0;

async function renderRecipeCards(recipesList, { isSuggested = false, paged = false } = {}) {
  if (!results) return;
  if (finishFilterAnimation) finishFilterAnimation();
  const renderId = ++cardRenderId;
  // The allergen check below fetches each recipe's details, which can take a moment, so
  // the loading cards stay up until the real cards are ready (no blank grid in between).
  if (!results.querySelector(".rp-skeleton")) showGridSkeleton();
  const prefs = getPreferences();
  const checked = await checkRecipes(recipesList, prefs);
  if (renderId !== cardRenderId) return; // a newer render (page or filter change) took over
  results.innerHTML = "";
  currentChecked = checked;
  cardCache.clear();
  const visible = prefs.hideFlagged
    ? checked.filter((item) => !item.result.hasAllergen)
    : checked;

  if (visible.length === 0) {
    if (message) {
      message.className = "text-sm text-stone-500 py-6 text-center";
      message.textContent = prefs.hideFlagged && checked.length > 0
        ? paged
          ? "Every recipe on this page contains ingredients you're allergic to. Try another page, or uncheck 'Hide allergen recipes' to view them."
          : "All matching recipes contain ingredients you're allergic to. Uncheck 'Hide allergen recipes' to view them."
        : "No recipes found matching your criteria.";
    }
    return;
  }

  if (message && !isSuggested) {
    message.innerHTML = "";
    message.className = "hidden";
  }

  visible.forEach(({ recipe, result }, index) => {
    const card = createRecipeCard(recipe, { priority: index < 2 });
    decorateCard(card, result);
    card.dataset.cardId = String(recipe.id);
    cardCache.set(String(recipe.id), card);
    results.appendChild(card);
  });
}

// ---------- Pagination ----------
// Searches and categories return the full list from the API, which is kept here and
// shown 12 at a time with ‹ 1 … 4 [5] 6 … 67 › under the grid. The page number is kept
// in the URL (?page=5), so coming Back from a recipe returns to the same page.
const PAGE_SIZE = 12;
let allResults = [];
let currentPage = 1;
let resultsSuggested = false;
let pendingPage = 0; // page to open on the next showResults (from the URL, or the allergen toggle)

function totalPages() {
  return Math.max(1, Math.ceil(allResults.length / PAGE_SIZE));
}

function syncPageToUrl() {
  try {
    const url = new URL(window.location.href);
    if (currentPage > 1) url.searchParams.set("page", String(currentPage));
    else url.searchParams.delete("page");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  } catch (e) { }
}

// Page numbers to show: first, last, and the pages around the current one, with gaps.
function pageList(page, total) {
  const pages = new Set([1, total, page - 1, page, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push(p - sorted[i - 1] === 2 ? p - 1 : "…");
    out.push(p);
  });
  return out;
}

// The page controls bring their own styles: this page uses a pre-built tailwind.css that
// only has the classes in use when it was generated, so these controls don't rely on it.
const PAGINATION_CSS = `
.rp-pagination{display:flex;flex-direction:column;align-items:center;gap:12px}
.rp-pages{display:none;align-items:center;gap:6px;margin:0;padding:0;list-style:none}
.rp-pages-phone{display:flex;align-items:center;gap:16px}
@media (min-width:640px){.rp-pages{display:flex}.rp-pages-phone{display:none}}
.rp-page-btn{display:inline-flex;align-items:center;justify-content:center;gap:4px;box-sizing:border-box;height:40px;min-width:40px;padding:0 12px;border:1px solid #ede4da;border-radius:9999px;background:#fff;color:#44403c;font:600 14px/1 Inter,system-ui,sans-serif;font-variant-numeric:tabular-nums;box-shadow:0 1px 2px rgba(0,0,0,.04);cursor:pointer;transition:background-color .15s,border-color .15s,color .15s}
.rp-page-btn:hover{border-color:rgba(202,92,46,.5);background:#fbf2ec;color:#ca5c2e}
.rp-page-btn:focus-visible{outline:none;box-shadow:0 0 0 2px #fff,0 0 0 4px rgba(202,92,46,.45)}
.rp-page-btn[aria-current="page"]{border-color:#ca5c2e;background:#ca5c2e;color:#fff;box-shadow:0 1px 3px rgba(202,92,46,.35);cursor:default}
.rp-page-btn:disabled{opacity:.35;pointer-events:none}
.rp-page-btn.rp-prev{padding:0 16px 0 12px}
.rp-page-btn.rp-next{padding:0 12px 0 16px}
.rp-page-btn.rp-arrow{width:44px;height:44px;padding:0}
.rp-page-gap{display:inline-flex;justify-content:center;width:28px;color:#a8a29e;font-size:14px}
.rp-page-label{color:#44403c;font:600 14px/1 Inter,system-ui,sans-serif;font-variant-numeric:tabular-nums}
.rp-page-range{margin:0;color:#a8a29e;font-size:12px;font-variant-numeric:tabular-nums}
`;

function ensurePaginationStyles() {
  if (document.getElementById("rp-pagination-styles")) return;
  const style = document.createElement("style");
  style.id = "rp-pagination-styles";
  style.textContent = PAGINATION_CSS;
  document.head.appendChild(style);
}

const ARROW_LEFT = `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" aria-hidden="true"><polyline points="15 18 9 12 15 6"></polyline></svg>`;
const ARROW_RIGHT = `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" aria-hidden="true"><polyline points="9 18 15 12 9 6"></polyline></svg>`;

function renderPagination() {
  const nav = document.getElementById("results-pagination");
  if (!nav) return;
  const total = totalPages();
  if (allResults.length <= PAGE_SIZE) {
    nav.innerHTML = "";
    nav.classList.add("hidden");
    return;
  }
  ensurePaginationStyles();
  nav.classList.remove("hidden");

  const prev = currentPage > 1 ? currentPage - 1 : 0;
  const next = currentPage < total ? currentPage + 1 : 0;
  const first = (currentPage - 1) * PAGE_SIZE + 1;
  const last = Math.min(currentPage * PAGE_SIZE, allResults.length);

  const numbers = pageList(currentPage, total).map((p) => {
    if (p === "…") return `<li><span class="rp-page-gap" aria-hidden="true">…</span></li>`;
    const current = p === currentPage;
    return `<li><button type="button" class="rp-page-btn" data-page="${p}" ${current ? 'aria-current="page"' : ""} aria-label="Page ${p}">${p}</button></li>`;
  }).join("");

  nav.innerHTML = `
    <div class="rp-pagination">
      <ul class="rp-pages">
        <li><button type="button" class="rp-page-btn rp-prev" data-page="${prev}" ${prev ? "" : "disabled"} aria-label="Previous page">${ARROW_LEFT}Prev</button></li>
        ${numbers}
        <li><button type="button" class="rp-page-btn rp-next" data-page="${next}" ${next ? "" : "disabled"} aria-label="Next page">Next${ARROW_RIGHT}</button></li>
      </ul>
      <div class="rp-pages-phone">
        <button type="button" class="rp-page-btn rp-arrow" data-page="${prev}" ${prev ? "" : "disabled"} aria-label="Previous page">${ARROW_LEFT}</button>
        <span class="rp-page-label">Page ${currentPage} of ${total}</span>
        <button type="button" class="rp-page-btn rp-arrow" data-page="${next}" ${next ? "" : "disabled"} aria-label="Next page">${ARROW_RIGHT}</button>
      </div>
      <p class="rp-page-range">Recipes ${first}–${last} of ${allResults.length}</p>
    </div>`;
}

async function renderCurrentPage() {
  const start = (currentPage - 1) * PAGE_SIZE;
  await renderRecipeCards(allResults.slice(start, start + PAGE_SIZE), {
    isSuggested: resultsSuggested,
    paged: allResults.length > PAGE_SIZE
  });
  renderPagination();
}

async function showResults(recipes, { isSuggested = false } = {}) {
  allResults = Array.isArray(recipes) ? recipes : [];
  resultsSuggested = isSuggested;
  currentPage = Math.min(Math.max(1, pendingPage || 1), totalPages());
  pendingPage = 0;
  syncPageToUrl();
  await renderCurrentPage();
}

function clearResultsPaging() {
  allResults = [];
  currentPage = 1;
  renderPagination();
}

// Goes to a page, then brings the top of the grid into view so reading starts at card 1.
async function goToPage(page) {
  const target = Math.min(Math.max(1, page), totalPages());
  if (target === currentPage) return;
  currentPage = target;
  syncPageToUrl();
  await renderCurrentPage();
  const section = document.getElementById("recipes-section");
  section?.scrollIntoView({ behavior: "smooth", block: "start" });
  // Move focus to the section title (without a second jump) so keyboard and screen
  // reader users continue from the top of the new page.
  const title = document.getElementById("recipes-section-title");
  if (title) {
    title.setAttribute("tabindex", "-1");
    title.focus({ preventScroll: true });
  }
}

// Remembers the last search so toggling "Hide allergen recipes" re-runs the same search.
let lastSearchQuery = "";
let lastSearchTitle = "Latest Recipes";

const COMMON_RECIPE_KEYWORDS = [
  "macaroni", "pancake", "pancakes", "spaghetti", "chicken", "pasta", "pizza",
  "burger", "salmon", "beef", "pork", "curry", "rice", "soup", "salad",
  "chocolate", "dessert", "steak", "tacos", "taco", "noodle", "noodles",
  "sandwich", "bread", "lasagna", "lasagne", "stew", "pie", "tart", "cookie",
  "cookies", "cake", "muffin", "muffins", "strawberry", "strawberries",
  "potato", "potatoes", "cheese", "mushroom", "mushrooms", "egg", "eggs",
  "fish", "tuna", "prawn", "prawns", "shrimp", "duck", "lamb"
];

function levenshteinDistance(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

/**
 * Netflix-style suggestion finder when a direct search query yields 0 meals.
 * Handles typos, stems plurals, collapses repeated characters (e.g. "macaronnni" -> "macaroni"),
 * and queries relevant keywords in parallel to rank dishes by relevance.
 */
async function findSimilarRecipes(query) {
  if (!query || typeof query !== "string") return [];
  const translated = await translateQueryToEnglish(query);
  const cleanQ = (translated || query).toLowerCase().trim();
  const stopWords = new Set([
    "and", "with", "in", "the", "of", "for", "a", "an", "to", "or",
    "recipe", "recipes", "dish", "food", "style", "easy", "best"
  ]);

  const words = cleanQ
    .split(/[\s,._-]+/)
    .filter((w) => w.length >= 3 && !stopWords.has(w));

  if (words.length === 0) return [];

  const CULINARY_EXPANSIONS = {
    porridge: ["congee", "rice"],
    congee: ["porridge"],
    wonton: ["dumpling"],
    dumpling: ["wonton", "dumplings"],
    noodle: ["noodles", "pasta"],
    noodles: ["noodle", "pasta"],
  };

  const searchTerms = new Set();
  words.forEach((w) => {
    searchTerms.add(w);

    if (CULINARY_EXPANSIONS[w]) {
      CULINARY_EXPANSIONS[w].forEach((syn) => searchTerms.add(syn));
    }

    // 1. Collapse repeated letters from typos (e.g. "macaronnni" -> "macaroni")
    const collapsed = w.replace(/(.)\1{2,}/g, "$1");
    if (collapsed !== w) searchTerms.add(collapsed);

    // 2. Common plural/singular stems
    if (w.endsWith("ies") && w.length > 4) {
      searchTerms.add(w.slice(0, -3) + "y");
    } else if (w.endsWith("es") && w.length > 3) {
      searchTerms.add(w.slice(0, -2));
    } else if (w.endsWith("s") && w.length > 3) {
      searchTerms.add(w.slice(0, -1));
    }

    // 3. Typo-tolerance check against common culinary terms
    COMMON_RECIPE_KEYWORDS.forEach((kw) => {
      if (Math.abs(w.length - kw.length) <= 2) {
        if (levenshteinDistance(w, kw) <= 2) searchTerms.add(kw);
      }
      if (collapsed !== w && Math.abs(collapsed.length - kw.length) <= 2) {
        if (levenshteinDistance(collapsed, kw) <= 2) searchTerms.add(kw);
      }
    });
  });

  const termList = Array.from(searchTerms);
  const resultsMap = new Map();

  await Promise.all(
    termList.map(async (term) => {
      try {
        const matches = await searchRecipes(term);
        (matches || []).forEach((recipe) => {
          const id = String(recipe.id);
          const nameLower = (recipe.name || "").toLowerCase();
          if (!resultsMap.has(id)) {
            resultsMap.set(id, { recipe, score: 0 });
          }
          const entry = resultsMap.get(id);
          if (nameLower.includes(term)) {
            entry.score += 5;
          } else {
            entry.score += 2;
          }
        });
      } catch (e) { }
    })
  );

  const sorted = Array.from(resultsMap.values())
    .sort((a, b) => b.score - a.score || a.recipe.name.localeCompare(b.recipe.name))
    .map((item) => item.recipe);

  return sorted.slice(0, 12);
}

// Placeholder cards shaped like the real ones, with a shimmer, while recipes load.
// The text is for screen readers (role="status" announces it).
function showGridSkeleton(text = "Loading recipes...") {
  if (!results) return;
  const count = window.matchMedia?.("(min-width: 1024px)").matches ? 8 : 4;
  const card = `
    <li class="rp-skeleton" aria-hidden="true">
      <div class="rp-skeleton-img"></div>
      <div class="rp-skeleton-body">
        <div class="rp-skeleton-line" style="width:78%"></div>
        <div class="rp-skeleton-row">
          <div class="rp-skeleton-chip"></div>
          <div class="rp-skeleton-dot"></div>
        </div>
      </div>
    </li>`;
  results.innerHTML =
    `<li class="visually-hidden" role="status">${escapeHtml(text)}</li>` + card.repeat(count);
}

function renderRecipesLoading(text = "Loading delicious recipes...") {
  if (!results) return;
  showGridSkeleton(text);
  // Hide the previous results' page numbers until the new results arrive.
  document.getElementById("results-pagination")?.classList.add("hidden");
  if (message) {
    message.innerHTML = "";
    message.className = "hidden";
  }
}

// Every search/filter run takes a new token. A run whose token is no longer the latest
// drops its results, so a slow older request can't overwrite a newer filter.
let renderToken = 0;

async function runSearch(query, title = "Search Results") {
  if (!results) return;
  const token = ++renderToken;
  lastSearchQuery = query;
  lastSearchTitle = title;
  if (sectionTitle) {
    if (query && /[^\u0000-\u007f]/.test(query)) {
      sectionTitle.innerHTML = `<span>Search results: </span><span translate="no" class="notranslate">"${escapeHtml(query)}"</span>`;
    } else {
      sectionTitle.innerHTML = `<span>${escapeHtml(title)}</span>`;
    }
  }
  renderRecipesLoading("Loading delicious recipes...");

  try {
    // The name search stops at 25 results, so browsing uses every category and
    // searches add ingredient and category matches (see api.js).
    const browseAll = !query || !query.trim() || query.trim().toLowerCase() === "a";
    let recipes = browseAll ? await listAllRecipes() : await searchRecipesWide(query);
    let isSuggested = false;

    if (!recipes || recipes.length === 0) {
      recipes = await findSimilarRecipes(query);
      if (recipes && recipes.length > 0) {
        isSuggested = true;
      }
    }
    if (token !== renderToken) return;

    if (!recipes || recipes.length === 0) {
      results.innerHTML = "";
      clearResultsPaging();
      if (message) {
        message.className = "py-12 sm:py-16 text-center max-w-xl mx-auto";
        const safeQ = /[^\u0000-\u007f]/.test(query)
          ? `<span translate="no" class="notranslate">"${escapeHtml(query)}"</span>`
          : `"${escapeHtml(query)}"`;
        message.innerHTML = `
          <div class="w-16 h-16 mx-auto rounded-full bg-[#fbf2ec] text-[#ca5c2e] flex items-center justify-center border border-[#ca5c2e]/15 shadow-2xs mb-4">
            <svg class="w-8 h-8" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/>
            </svg>
          </div>
          <h3 class="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">
            No recipes found for ${safeQ}
          </h3>
          <p class="text-sm sm:text-base text-stone-500 mt-2 max-w-lg mx-auto leading-relaxed">
            We couldn't find any direct matches. Check for typos or try one of these popular categories:
          </p>
          <div class="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3 pt-6">
            <button type="button" class="empty-cat-btn inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-[#ede4da] hover:border-[#ca5c2e] hover:bg-[#ca5c2e]/5 text-sm sm:text-base font-semibold text-stone-700 hover:text-[#ca5c2e] transition shadow-2xs cursor-pointer active:scale-95" data-category="Chicken">
              <span class="text-base sm:text-lg">🍗</span>
              <span>Chicken</span>
            </button>
            <button type="button" class="empty-cat-btn inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-[#ede4da] hover:border-[#ca5c2e] hover:bg-[#ca5c2e]/5 text-sm sm:text-base font-semibold text-stone-700 hover:text-[#ca5c2e] transition shadow-2xs cursor-pointer active:scale-95" data-category="Beef">
              <span class="text-base sm:text-lg">🥩</span>
              <span>Beef</span>
            </button>
            <button type="button" class="empty-cat-btn inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-[#ede4da] hover:border-[#ca5c2e] hover:bg-[#ca5c2e]/5 text-sm sm:text-base font-semibold text-stone-700 hover:text-[#ca5c2e] transition shadow-2xs cursor-pointer active:scale-95" data-category="Pasta">
              <span class="text-base sm:text-lg">🍝</span>
              <span>Pasta</span>
            </button>
            <button type="button" class="empty-cat-btn inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-[#ede4da] hover:border-[#ca5c2e] hover:bg-[#ca5c2e]/5 text-sm sm:text-base font-semibold text-stone-700 hover:text-[#ca5c2e] transition shadow-2xs cursor-pointer active:scale-95" data-category="Vegetarian">
              <span class="text-base sm:text-lg">🥦</span>
              <span>Vegetarian</span>
            </button>
            <button type="button" class="empty-cat-btn inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-[#ede4da] hover:border-[#ca5c2e] hover:bg-[#ca5c2e]/5 text-sm sm:text-base font-semibold text-stone-700 hover:text-[#ca5c2e] transition shadow-2xs cursor-pointer active:scale-95" data-category="Dessert">
              <span class="text-base sm:text-lg">🍰</span>
              <span>Dessert</span>
            </button>
            <button type="button" class="empty-cat-btn inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-[#ede4da] hover:border-[#ca5c2e] hover:bg-[#ca5c2e]/5 text-sm sm:text-base font-semibold text-stone-700 hover:text-[#ca5c2e] transition shadow-2xs cursor-pointer active:scale-95" data-category="Seafood">
              <span class="text-base sm:text-lg">🐟</span>
              <span>Seafood</span>
            </button>
          </div>
        `;
        message.querySelectorAll(".empty-cat-btn").forEach((btn) => {
          btn.addEventListener("click", () => {
            const cat = btn.dataset.category;
            if (!cat) return;
            // Swap the failed search for the category (the cuisine stays selected).
            activeCategory = cat;
            categoryChips.forEach((c) => {
              c.classList.toggle("active", c.dataset.category === cat);
            });
            if (searchForm?.query) {
              searchForm.query.value = "";
              searchForm.query.dispatchEvent(new Event("input"));
            }
            updateUrlParams();
            runActiveFilter();
          });
        });
      }
      return;
    }

    if (isSuggested) {
      if (message) {
        message.className = "rounded-2xl bg-[#fcf9f5] border border-[#efe6dc] p-4 sm:p-5 flex items-start gap-3.5 mb-6 shadow-2xs";
        const safeQ = /[^\u0000-\u007f]/.test(query)
          ? `<span translate="no" class="notranslate">"${escapeHtml(query)}"</span>`
          : `"${escapeHtml(query)}"`;
        message.innerHTML = `
          <div class="w-9 h-9 rounded-xl bg-[#ca5c2e]/10 text-[#ca5c2e] flex items-center justify-center shrink-0 border border-[#ca5c2e]/20 mt-0.5">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/>
            </svg>
          </div>
          <div class="space-y-0.5">
            <p class="text-sm font-semibold text-stone-900">
              No exact recipes found for ${safeQ}
            </p>
            <p class="text-xs sm:text-sm text-stone-500">
              You may be looking for these related recipes:
            </p>
          </div>
        `;
      }
    } else {
      if (message) {
        message.innerHTML = "";
        message.className = "hidden";
      }
    }

    await showResults(recipes, { isSuggested });
  } catch (error) {
    if (token !== renderToken) return;
    console.warn("Recipe fetch failed, displaying curated recipes:", error);
    await showResults(DEFAULT_FALLBACK_RECIPES);
  }
}

async function runCategoryFilter(category) {
  if (!results) return;
  const token = ++renderToken;
  if (sectionTitle) sectionTitle.innerHTML = `<span>${escapeHtml(category)} Recipes</span>`;
  renderRecipesLoading(`Loading ${category} recipes...`);

  try {
    const recipes = await filterByCategory(category);
    if (token !== renderToken) return;
    if (!recipes || recipes.length === 0) {
      results.innerHTML = "";
      clearResultsPaging();
      if (message) {
        message.className = "text-sm text-stone-500 py-12 text-center";
        message.textContent = `No recipes found in ${category}.`;
      }
      return;
    }
    await showResults(recipes);
  } catch (error) {
    if (token !== renderToken) return;
    showLoadError();
  }
}

function showLoadError() {
  if (!results) return;
  results.innerHTML = "";
  clearResultsPaging();
  if (message) {
    message.className = "text-sm text-stone-500 py-12 text-center";
    message.textContent = "Could not load recipes right now.";
  }
}

let activeCategory = null;
let activeCuisine = "";

const clearFiltersBtn = document.getElementById("clear-filters-btn");

function syncFilterUI() {
  const query = searchForm?.query?.value?.trim() || "";
  const hasFilter = Boolean(activeCategory || activeCuisine || query);
  if (clearFiltersBtn) {
    clearFiltersBtn.classList.toggle("hidden", !hasFilter);
  }
  syncCuisineTrigger();
}

function updateUrlParams() {
  const params = new URLSearchParams();
  const query = searchForm?.query?.value?.trim();
  if (query) params.set("search", query);
  if (activeCategory) params.set("category", activeCategory);
  if (activeCuisine) params.set("cuisine", activeCuisine);
  const qs = params.toString();
  window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
}

function clearAllFilters() {
  activeCategory = null;
  activeCuisine = "";
  if (searchForm?.query) {
    searchForm.query.value = "";
    const clearBtn = document.getElementById("search-clear");
    if (clearBtn) {
      clearBtn.classList.add("hidden");
      clearBtn.classList.remove("inline-flex");
    }
  }
  categoryChips.forEach((c) => c.classList.remove("active"));
  window.history.replaceState(null, "", window.location.pathname);
  syncFilterUI();
  runActiveFilter();
}

// ---------- Cuisine dropdown (Person 4) ----------
// A custom listbox (search box, check on the picked cuisine) instead of a
// native <select>, whose open list is drawn by the browser and can't be styled.
const cuisinePicker = document.getElementById("cuisine-picker");
const cuisineTrigger = document.getElementById("cuisine-trigger");
const cuisineTriggerLabel = document.getElementById("cuisine-trigger-label");
const cuisinePanel = document.getElementById("cuisine-panel");
const cuisineSearch = document.getElementById("cuisine-search");
const cuisineList = document.getElementById("cuisine-list");

let cuisineAreas = null; // cuisine names once loaded
let cuisineLoading = null;
let cuisineLoadFailed = false;
let cuisineFocusIndex = -1;

const CUISINE_CHECK_SVG = `<svg class="rp-cuisine-check" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

function syncCuisineTrigger() {
  if (!cuisineTrigger) return;
  if (cuisineTriggerLabel) cuisineTriggerLabel.textContent = activeCuisine || "All cuisines";
  cuisineTrigger.classList.toggle("is-active", Boolean(activeCuisine));
  const clearBtn = document.getElementById("cuisine-clear");
  if (clearBtn) clearBtn.hidden = !activeCuisine;
}

function loadCuisines() {
  if (cuisineLoading) return cuisineLoading;
  cuisineLoadFailed = false;
  cuisineLoading = listAreas()
    .then((areas) => {
      cuisineAreas = areas.slice();
      if (activeCuisine) {
        // Links may use any case (?cuisine=italian), so match it to the API's spelling.
        const match = areas.find((a) => a.toLowerCase() === activeCuisine.toLowerCase());
        if (match) activeCuisine = match;
        else cuisineAreas.push(activeCuisine); // keep an unknown one selectable
      }
      syncCuisineTrigger();
    })
    .catch((err) => {
      console.warn("Could not load cuisines:", err);
      cuisineLoadFailed = true;
      cuisineLoading = null; // try again next time the menu opens
    })
    .finally(() => {
      if (cuisinePanel && !cuisinePanel.hidden) {
        renderCuisineOptions();
        placeCuisinePanel({ makeRoom: true }); // "Loading cuisines…" was shorter than the list
        renderCuisineOptions();
      }
    });
  return cuisineLoading;
}

function cuisineOptions() {
  return cuisineList ? [...cuisineList.querySelectorAll(".rp-cuisine-option")] : [];
}

function setCuisineFocus(index, { scroll = true } = {}) {
  const options = cuisineOptions();
  if (!options.length) {
    cuisineFocusIndex = -1;
    cuisineSearch?.removeAttribute("aria-activedescendant");
    return;
  }
  cuisineFocusIndex = Math.min(Math.max(0, index), options.length - 1);
  options.forEach((el, i) => el.classList.toggle("is-focused", i === cuisineFocusIndex));
  const focused = options[cuisineFocusIndex];
  cuisineSearch?.setAttribute("aria-activedescendant", focused.id);
  // Scroll only the list (scrollIntoView would also scroll the page).
  if (scroll) {
    const top = focused.offsetTop;
    const bottom = top + focused.offsetHeight;
    if (top < cuisineList.scrollTop) cuisineList.scrollTop = top - 6;
    else if (bottom > cuisineList.scrollTop + cuisineList.clientHeight) {
      cuisineList.scrollTop = bottom - cuisineList.clientHeight + 6;
    }
  }
}

function renderCuisineOptions() {
  if (!cuisineList) return;
  const status = (text) => {
    cuisineList.innerHTML = `<li class="rp-cuisine-status" role="presentation">${text}</li>`;
    setCuisineFocus(-1);
  };
  if (!cuisineAreas) {
    status(cuisineLoadFailed ? "Couldn't load cuisines. Close and try again." : "Loading cuisines…");
    return;
  }

  const query = (cuisineSearch?.value || "").trim().toLowerCase();
  const items = query ? [] : [{ value: "", label: "All cuisines" }];
  cuisineAreas
    .filter((name) => name.toLowerCase().includes(query))
    .forEach((name) => items.push({ value: name, label: name }));

  if (!items.length) {
    status(`No cuisines match “${escapeHtml(cuisineSearch.value.trim())}”`);
    return;
  }

  cuisineList.innerHTML = items
    .map((item, i) => {
      return `<li id="cuisine-opt-${i}" class="rp-cuisine-option${item.value ? "" : " is-all"}" role="option" aria-selected="${item.value === activeCuisine}" data-value="${escapeHtml(item.value)}">${CUISINE_CHECK_SVG}<span class="rp-cuisine-name">${escapeHtml(item.label)}</span></li>`;
    })
    .join("");

  // While searching, the first match is ready for Enter; otherwise start on the current choice.
  const selected = items.findIndex((item) => item.value === activeCuisine);
  setCuisineFocus(query ? 0 : Math.max(0, selected));
}

// Keeps the open panel inside the screen (the pill can sit anywhere in a wrapping row).
// It always opens downwards, and the list gets shorter to fit the room below the button.
// Only when even the shortest list would not fit does the page scroll up (makeRoom, on open),
// and only by the difference, so in most cases the page does not move at all.
const CUISINE_LIST_MAX = 232; // about 6 rows (shorter than the 296px max-height in recipes.css)
const CUISINE_LIST_MIN = 114; // about 3 rows

function placeCuisinePanel({ makeRoom = false } = {}) {
  if (!cuisinePanel || !cuisineTrigger || !cuisineList || cuisinePanel.hidden) return;
  const gutter = 16;
  const gap = 8;

  // Sideways: keep a 16px gutter on both edges.
  cuisinePanel.style.left = "0px";
  const rect = cuisinePanel.getBoundingClientRect();
  let shift = 0;
  if (rect.right > window.innerWidth - gutter) shift = window.innerWidth - gutter - rect.right;
  if (rect.left + shift < gutter) shift = gutter - rect.left;
  cuisinePanel.style.left = `${shift}px`;

  // How tall the list can be below the button.
  const chrome = cuisinePanel.offsetHeight - cuisineList.offsetHeight; // search box, padding, border
  const wanted = chrome + Math.min(CUISINE_LIST_MIN, cuisineList.scrollHeight);
  let trigger = cuisineTrigger.getBoundingClientRect();
  let roomBelow = window.innerHeight - trigger.bottom - gap - gutter;

  if (makeRoom && roomBelow < wanted) {
    // Scroll up, but never so far that the button hides under the sticky navbar.
    const navBottom = document.getElementById("navbar")?.getBoundingClientRect().bottom || 0;
    const maxScroll = Math.max(0, trigger.top - navBottom - gap);
    window.scrollBy({ top: Math.min(wanted - roomBelow, maxScroll), behavior: "instant" });
    trigger = cuisineTrigger.getBoundingClientRect();
    roomBelow = window.innerHeight - trigger.bottom - gap - gutter;
  }

  cuisinePanel.classList.remove("open-up");
  cuisineList.style.maxHeight = `${Math.max(CUISINE_LIST_MIN, Math.min(CUISINE_LIST_MAX, roomBelow - chrome))}px`;
}

function openCuisinePanel() {
  if (!cuisinePanel || !cuisinePanel.hidden) return;
  cuisinePanel.hidden = false;
  cuisineTrigger?.setAttribute("aria-expanded", "true");
  if (cuisineSearch) cuisineSearch.value = "";
  renderCuisineOptions(); // fill first, so placement measures the real list height
  placeCuisinePanel({ makeRoom: true });
  renderCuisineOptions(); // again, so the current cuisine is scrolled into view at the new height
  if (!cuisineAreas) loadCuisines();
  // On touch screens, focusing the search box would pop the keyboard over the list.
  if (window.matchMedia?.("(pointer: fine)").matches) {
    cuisineSearch?.focus({ preventScroll: true });
  }
}

function closeCuisinePanel({ returnFocus = false } = {}) {
  if (!cuisinePanel || cuisinePanel.hidden) return;
  cuisinePanel.hidden = true;
  cuisineTrigger?.setAttribute("aria-expanded", "false");
  cuisineSearch?.removeAttribute("aria-activedescendant");
  if (returnFocus) cuisineTrigger?.focus();
}

function chooseCuisine(value, { returnFocus = true } = {}) {
  closeCuisinePanel({ returnFocus });
  if (!returnFocus && document.activeElement?.id === "cuisine-clear") document.activeElement.blur();
  if (value === activeCuisine) return;
  activeCuisine = value;
  syncCuisineTrigger();
  updateUrlParams();
  syncFilterUI();
  runActiveFilter();
  document.getElementById("recipes-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

if (cuisinePicker && cuisineTrigger && cuisinePanel && cuisineList) {
  cuisineTrigger.addEventListener("click", () => {
    if (cuisinePanel.hidden) openCuisinePanel();
    else closeCuisinePanel();
  });

  cuisineSearch?.addEventListener("input", renderCuisineOptions);

  // The × inside the pill removes just the cuisine (search and category stay).
  document.getElementById("cuisine-clear")?.addEventListener("click", (event) => {
    chooseCuisine("", { returnFocus: event.detail === 0 });
  });

  cuisineList.addEventListener("click", (event) => {
    const option = event.target.closest(".rp-cuisine-option");
    if (option) chooseCuisine(option.dataset.value || "");
  });
  cuisineList.addEventListener("mousemove", (event) => {
    const option = event.target.closest(".rp-cuisine-option");
    const index = cuisineOptions().indexOf(option);
    if (index >= 0 && index !== cuisineFocusIndex) setCuisineFocus(index, { scroll: false });
  });

  cuisinePicker.addEventListener("keydown", (event) => {
    const open = !cuisinePanel.hidden;
    if (!open) {
      if (event.target === cuisineTrigger && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
        event.preventDefault();
        openCuisinePanel();
      }
      return;
    }
    const options = cuisineOptions();
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setCuisineFocus(cuisineFocusIndex + 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        setCuisineFocus(cuisineFocusIndex - 1);
        break;
      case "PageDown":
        event.preventDefault();
        setCuisineFocus(cuisineFocusIndex + 7);
        break;
      case "PageUp":
        event.preventDefault();
        setCuisineFocus(cuisineFocusIndex - 7);
        break;
      case "Enter":
        if (options[cuisineFocusIndex]) {
          event.preventDefault();
          chooseCuisine(options[cuisineFocusIndex].dataset.value || "");
        }
        break;
      case "Escape":
        event.preventDefault();
        closeCuisinePanel({ returnFocus: true });
        break;
      case "Tab":
        closeCuisinePanel();
        break;
    }
  });

  // Close when clicking or tapping anywhere else.
  document.addEventListener("pointerdown", (event) => {
    if (!cuisinePanel.hidden && !cuisinePicker.contains(event.target)) closeCuisinePanel();
  });
  window.addEventListener("resize", () => {
    if (!cuisinePanel.hidden) placeCuisinePanel();
  });
  // The page can scroll while the panel is open, so keep it fitting the screen.
  window.addEventListener("scroll", () => {
    if (!cuisinePanel.hidden) placeCuisinePanel();
  }, { passive: true });
}

// Empty state for a filter combination that has no recipes, with a button to reset.
function showNoFilterMatches(heading, text) {
  if (!results) return;
  results.innerHTML = "";
  clearResultsPaging();
  if (!message) return;
  message.className = "py-12 sm:py-16 text-center max-w-xl mx-auto";
  message.innerHTML = `
    <div class="w-16 h-16 mx-auto rounded-full bg-[#fbf2ec] text-[#ca5c2e] flex items-center justify-center border border-[#ca5c2e]/15 shadow-2xs mb-4">
      <svg class="w-8 h-8" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/>
      </svg>
    </div>
    <h3 class="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">${escapeHtml(heading)}</h3>
    <p class="text-sm sm:text-base text-stone-500 mt-2 max-w-lg mx-auto leading-relaxed">${escapeHtml(text)}</p>
    <div class="pt-6">
      <button type="button" id="empty-clear-filter-btn" class="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#ca5c2e] hover:bg-[#b34d23] text-white text-sm font-semibold transition shadow-sm cursor-pointer">
        Clear all filters
      </button>
    </div>
  `;
  document.getElementById("empty-clear-filter-btn")?.addEventListener("click", clearAllFilters);
}

function hideResultsMessage() {
  if (message) {
    message.innerHTML = "";
    message.className = "hidden";
  }
}

// Runs whatever the search box, category chip and cuisine menu currently ask for.
async function runActiveFilter() {
  if (!results) return;
  syncFilterUI();
  const query = searchForm?.query?.value?.trim() || "";

  // Plain search, no filters: runSearch keeps the "did you mean" suggestions.
  if (query && !activeCategory && !activeCuisine) {
    await runSearch(query, `Recipes matching "${query}"`);
    return;
  }

  // Category only: unchanged behaviour.
  if (!query && activeCategory && !activeCuisine) {
    await runCategoryFilter(activeCategory);
    return;
  }

  // Nothing selected: latest recipes.
  if (!query && !activeCategory && !activeCuisine) {
    await runSearch("a", "Latest Recipes");
    return;
  }

  // Any combination with a cuisine, or a search plus a category.
  // Each part gives a list, and the results are the recipes in all of them.
  const token = ++renderToken;
  const where = [activeCuisine, activeCategory].filter(Boolean).join(" ");
  const title = query ? `"${query}" in ${where}` : `${where} Recipes`;
  lastSearchQuery = query;
  lastSearchTitle = title;
  if (sectionTitle) {
    sectionTitle.innerHTML = /[^\u0000-\u007f]/.test(query)
      ? `<span translate="no" class="notranslate">"${escapeHtml(query)}"</span><span> in ${escapeHtml(where)}</span>`
      : `<span>${escapeHtml(title)}</span>`;
  }
  renderRecipesLoading(query ? "Loading matching recipes..." : `Loading ${where.toLowerCase()} recipes...`);

  try {
    const [searchList, categoryList, cuisineList] = await Promise.all([
      query ? searchRecipesWide(query) : null,
      activeCategory ? filterByCategory(activeCategory) : null,
      activeCuisine ? filterByArea(activeCuisine) : null,
    ]);
    if (token !== renderToken) return;

    // Search keeps its own order (name matches first); otherwise use the category or cuisine order.
    const lists = [searchList, categoryList, cuisineList].filter(Boolean);
    const [base, ...others] = lists;
    const idSets = others.map((list) => new Set(list.map((r) => String(r.id))));
    const combined = base
      .filter((r) => idSets.every((ids) => ids.has(String(r.id))))
      .map((r) => ({
        ...r,
        // Cuisine results come without a category, and the card would then say "Main"
        // for everything (even desserts), so tag them with the cuisine instead.
        category: r.category || activeCategory || activeCuisine || "",
        area: r.area || activeCuisine || "",
      }));

    if (combined.length === 0) {
      const parts = [];
      if (activeCuisine) parts.push(`${activeCuisine} cuisine`);
      if (activeCategory) parts.push(`the ${activeCategory} category`);
      const text = query
        ? `No recipes matched "${query}" in ${parts.join(" and ")}.`
        : activeCategory
          ? `We couldn't find any ${activeCuisine} dishes in the ${activeCategory} category.`
          : `No recipes found for ${activeCuisine} cuisine.`;
      showNoFilterMatches(query ? "No recipes found" : "No matching recipes", text);
      return;
    }
    hideResultsMessage();
    await showResults(combined);
  } catch (err) {
    if (token !== renderToken) return;
    console.warn("Filter failed:", err);
    showLoadError();
  }
}

if (searchForm) {
  searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    updateUrlParams();
    syncFilterUI();
    runActiveFilter();
    const recipesSection = document.getElementById("recipes-section");
    if (recipesSection) {
      recipesSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });

  // Grey clear (×) button inside the search bar (the browser's own one is hidden in CSS).
  const queryInput = searchForm.querySelector('input[name="query"]');
  const clearBtn = document.getElementById("search-clear");
  const syncClearButton = () => {
    const show = Boolean(queryInput?.value);
    clearBtn?.classList.toggle("hidden", !show);
    clearBtn?.classList.toggle("inline-flex", show);
  };
  queryInput?.addEventListener("input", () => {
    syncClearButton();
    syncFilterUI();
  });
  clearBtn?.addEventListener("click", () => {
    if (!queryInput) return;
    queryInput.value = "";
    syncClearButton();
    updateUrlParams();
    syncFilterUI();
    runActiveFilter();
    queryInput.focus();
  });
  window.addEventListener("pageshow", syncClearButton);

  // Category buttons: toggle active selection, unclick, and scroll to recipes
  categoryChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      const cat = chip.dataset.category;
      if (!cat) return;

      if (activeCategory === cat) {
        activeCategory = null;
        chip.classList.remove("active");
      } else {
        activeCategory = cat;
        categoryChips.forEach((c) => {
          c.classList.toggle("active", c === chip);
        });
      }

      updateUrlParams();
      syncFilterUI();
      runActiveFilter();

      const recipesSection = document.getElementById("recipes-section");
      if (recipesSection) {
        recipesSection.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });

  // Clear filters button
  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener("click", clearAllFilters);
  }

  // Pagination buttons (‹ Prev, page numbers, Next ›)
  const pagination = document.getElementById("results-pagination");
  if (pagination) {
    pagination.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-page]");
      const page = Number(btn?.dataset.page);
      if (!btn || btn.disabled || !page) return;
      goToPage(page);
    });
  }

  if (hideToggle) {
    hideToggle.addEventListener("change", async () => {
      const saving = savePreferences({ hideFlagged: hideToggle.checked });
      if (applyHideFilterAnimated(hideToggle.checked)) {
        await saving;
        return;
      }
      await saving;
      pendingPage = currentPage; // stay on the same page after the re-run
      runActiveFilter();
    });
  }

  window.addEventListener("preferences-changed", () => {
    syncHideToggle();
  });
  syncHideToggle();

  // Handle URL query parameters (e.g. from index.html search bar or external links)
  const urlParams = new URLSearchParams(window.location.search);
  pendingPage = parseInt(urlParams.get("page"), 10) || 0;
  const searchParam = urlParams.get("search") || urlParams.get("query") || urlParams.get("q");
  const categoryParam = urlParams.get("category");
  const cuisineParam = urlParams.get("cuisine") || urlParams.get("area");

  if (searchParam) {
    const queryInput = searchForm?.querySelector('input[name="query"]');
    if (queryInput) queryInput.value = searchParam;
    syncClearButton();
  }

  if (categoryParam) {
    const matchingChip = document.querySelector(`.category-chip[data-category="${categoryParam}"]`);
    if (matchingChip) {
      activeCategory = categoryParam;
      categoryChips.forEach((c) => c.classList.remove("active"));
      matchingChip.classList.add("active");
    } else {
      activeCategory = categoryParam;
    }
  }

  if (cuisineParam) {
    activeCuisine = cuisineParam;
  }

  syncCuisineTrigger();
  loadCuisines();

  if (searchParam || categoryParam || cuisineParam) {
    runActiveFilter();
  } else {
    // Initial load without params: check diet preferences for pre-selection
    const initialPrefs = getPreferences();
    let defaultCategory = null;
    if (initialPrefs.diets.includes("Vegetarian") || initialPrefs.diets.includes("Vegan")) {
      defaultCategory = "Vegetarian";
    } else if (initialPrefs.diets.includes("Pescatarian")) {
      defaultCategory = "Seafood";
    }

    if (defaultCategory) {
      const matchingChip = document.querySelector(`.category-chip[data-category="${defaultCategory}"]`);
      if (matchingChip) {
        activeCategory = defaultCategory;
        categoryChips.forEach((c) => c.classList.remove("active"));
        matchingChip.classList.add("active");
        updateUrlParams();
      }
    }
    runActiveFilter();
  }
}

// ---------- Recipe Detail Page ----------
const detail = document.getElementById("recipe-detail");

async function showRecipe(id) {
  if (!detail) return;
  detail.innerHTML = `
    <div class="py-16 text-center text-stone-500 flex flex-col items-center justify-center gap-3">
      <svg class="animate-spin w-8 h-8 text-[#ca5c2e]" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
      </svg>
      <span class="text-base font-medium">Preparing recipe details...</span>
    </div>
  `;

  try {
    // Graceful alias for any legacy mock id bookmark
    if (id === "greek-salad") id = "53011"; // Chicken Quinoa Greek Salad

    let recipe = null;
    try {
      recipe = await getRecipeById(id);
    } catch (e) {
      console.warn("Live API lookup failed, falling back:", e);
    }

    if (!recipe && FALLBACK_RECIPES_BY_ID[String(id)]) {
      recipe = FALLBACK_RECIPES_BY_ID[String(id)];
    }

    // Fallback if API lookup fails or offline
    if (!recipe) {
      recipe = FALLBACK_RECIPES_BY_ID[String(id)] || FALLBACK_RECIPES_BY_ID["52772"];
    }

    if (recipe && recipe.ingredients) {
      recipe.ingredients = combineIngredients(recipe.ingredients);
    }

    const prefs = getPreferences();
    const result = checkRecipe(recipe, prefs);

    const titleCasedName = toTitleCase(recipe.name);
    document.title = `${titleCasedName} | RecipePlan`;

    // Section headers configuration for tips, serving suggestions, notes, etc.
    const SECTION_HEADERS = [
      {
        regex: /^(?:\*{1,2})?(?:pro\s*tips?|cooking\s*tips?|chef'?s?\s*tips?|tips?)(?:\*{1,2})?\s*[:.-]?$/i,
        label: "Pro Tips",
        icon: "💡",
        badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
        dotClass: "bg-amber-500",
      },
      {
        regex: /^(?:\*{1,2})?(?:serving\s*suggestions?|to\s*serve|how\s*to\s*serve)(?:\*{1,2})?\s*[:.-]?$/i,
        label: "Serving Suggestions",
        icon: "🍽️",
        badgeClass: "bg-[#fbece4] text-[#ca5c2e] border-[#f3ddd0]",
        dotClass: "bg-[#ca5c2e]",
      },
      {
        regex: /^(?:\*{1,2})?(?:chef'?s?\s*notes?|recipe\s*notes?|notes?)(?:\*{1,2})?\s*[:.-]?$/i,
        label: "Chef's Notes",
        icon: "📝",
        badgeClass: "bg-stone-100 text-stone-700 border-stone-200",
        dotClass: "bg-stone-400",
      },
      {
        regex: /^(?:\*{1,2})?(?:storage|leftovers?|how\s*to\s*store)(?:\*{1,2})?\s*[:.-]?$/i,
        label: "Storage",
        icon: "📦",
        badgeClass: "bg-stone-100 text-stone-700 border-stone-200",
        dotClass: "bg-stone-400",
      },
      {
        regex: /^(?:\*{1,2})?(?:variations?|substitutions?)(?:\*{1,2})?\s*[:.-]?$/i,
        label: "Variations",
        icon: "✨",
        badgeClass: "bg-purple-50 text-purple-800 border-purple-200",
        dotClass: "bg-purple-500",
      },
      {
        regex: /^(?:\*{1,2})?(?:garnish|to\s*garnish)(?:\*{1,2})?\s*[:.-]?$/i,
        label: "Garnish",
        icon: "🌿",
        badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
        dotClass: "bg-emerald-500",
      },
    ];

    // Process instructions into clean numbered cooking steps, with tips and serving suggestions separated
    function parseRecipeInstructions(text) {
      if (!text) return [{ type: "step", text: "Follow cooking guidelines for standard preparation." }];

      const cleaned = cleanInstructionText(text);

      // Insert newlines before inline step markers like "...STEP 2..." if on the same line
      const normalized = cleaned
        .replace(/([^\r\n])\s*(STEP\s*\d+[:.-]?)/gi, "$1\n$2")
        .replace(/\r\n/g, "\n");

      const lines = normalized
        .split(/\n+/)
        .map((s) => s.trim())
        .filter(Boolean);

      const standaloneHeaderRegex = /^(?:step\s*\d+|part\s*\d+|\d+|method|instructions?|directions?)\s*[:.-]?$/i;
      const prefixRegex = /^(?:step\s*\d+[\s:.-]*|\d+[\.\)]\s*|[-*•–—:]\s*)+/i;

      const items = [];
      let currentSection = null;

      // Short ALL-CAPS lines like "MARINATING THE CHICKEN." or "BOILING THE WHITE RICE" are
      // section titles, not steps. Skipped when the recipe itself is written in capitals (a
      // long all-caps line, or most lines in caps), since then capitals don't mark anything out.
      // "STEP 1"-style marker lines are left out of the count, as they're dropped anyway.
      const isAllCapsLine = (str) => {
        const letters = str.replace(/[^\p{L}]/gu, "");
        return letters.length >= 3 && letters === letters.toUpperCase() && letters !== letters.toLowerCase();
      };
      const contentLines = lines.filter((l) => !standaloneHeaderRegex.test(l));
      const capsLines = contentLines.filter(isAllCapsLine);
      const capsHeadersEnabled =
        !capsLines.some((l) => l.length > 60) && capsLines.length <= contentLines.length * 0.6;

      function isAllCapsHeader(str) {
        if (!capsHeadersEnabled) return false;
        const body = str.replace(prefixRegex, "").trim();
        if (!body || standaloneHeaderRegex.test(body)) return false; // "STEP 3" etc. are dropped later
        if (body.length > 50 || body.split(/\s+/).length > 7) return false;
        if (/[!?]$/.test(body)) return false;
        // Timed or measured lines are real instructions, e.g. "BAKE FOR 20 MINUTES"
        if (/\d+\s*(?:minutes?|mins?|hours?|hrs?|seconds?|secs?|cups?|tbsp|tsp|g|kg|ml|l|oz|lbs?|degrees?|°)/i.test(body)) return false;
        return isAllCapsLine(body);
      }

      function ensureFullStop(str) {
        if (!str) return "";
        const trimmed = str.trim();
        // If it already ends with terminal punctuation like ., !, ? or …
        if (/[.!?…]$/.test(trimmed)) {
          return trimmed;
        }
        // If it ends with trailing colon, semicolon, or comma, replace with a full stop
        if (/[:,;]$/.test(trimmed)) {
          return trimmed.slice(0, -1) + ".";
        }
        return trimmed + ".";
      }

      lines.forEach((line) => {
        // Detect section headers like "Pro Tips:" or "Serving Suggestions:"
        const matchedHeader = SECTION_HEADERS.find((h) => h.regex.test(line));
        if (matchedHeader) {
          currentSection = matchedHeader;
          items.push({
            type: "header",
            header: matchedHeader,
          });
          return;
        }

        // Helper to detect recipe component subheaders like "Make the mac and cheese", "Make the grilled cheese", "For the sauce:"
        function isComponentHeader(str) {
          const trimmed = str.trim();
          if (/^(?:assembly|preparation|method|directions)[:.-]?$/i.test(trimmed)) return true;
          if (/^([A-Za-z0-9\s,&'-]{3,40}):$/.test(trimmed)) return true;

          const pattern = /^(?:(?:make|prepare|cook)\s+(?:the\s+)?|to\s+(?:make|prepare|assemble|cook|bake)\s+(?:the\s+)?|for\s+(?:the\s+)?)([a-z0-9\s,&'-]+)[.:]?$/i;
          const match = trimmed.match(pattern);
          if (!match) return false;

          if (trimmed.length > 45) return false;
          if (/\b(?:\d+\s*(?:minutes?|mins?|hours?|cups?|tbsp|tsp|g|oz|degrees?|°)|until|whisk|boil|stir|fry|bake|heat)\b/i.test(match[1])) return false;

          return true;
        }

        if (isComponentHeader(line) || isAllCapsHeader(line)) {
          currentSection = null; // Reset bullet section so subsequent items are numbered cooking steps
          const cleanHeader = line.replace(prefixRegex, "").replace(/[:.\s-]+$/, "").trim();
          items.push({
            type: "header",
            header: {
              label: toTitleCase(cleanHeader),
              icon: "🍳",
              badgeClass: "bg-stone-100 text-stone-800 border-stone-200 font-semibold",
            },
          });
          return;
        }

        // Filter out conversational fluff / blog preamble lines
        if (/^(?:this recipe is|here is how to|learn how to|an easy recipe for|in this recipe|a classic recipe for|today we are making|enjoy!*|bon app[eé]tit!*|serve and enjoy!*)$/i.test(line.trim())) {
          return;
        }

        // Filter out generic step numbers/titles
        if (standaloneHeaderRegex.test(line)) return;

        let cleanText = line.replace(prefixRegex, "").trim();
        if (cleanText.length <= 3) return;

        // Apply drop-cap typo fixes at step start if needed (e.g. "emove" -> "Remove", "oak the" -> "Soak the")
        cleanText = cleanText
          .replace(/^emove\b/i, "Remove")
          .replace(/^oak the\b/i, "Soak the")
          .replace(/^dd the\b/i, "Add the")
          .replace(/^reheat\b/i, "Preheat");

        // Ensure sentence capitalization
        cleanText = cleanText.charAt(0).toUpperCase() + cleanText.slice(1);

        cleanText = ensureFullStop(cleanText);

        if (currentSection) {
          items.push({
            type: "bullet",
            text: cleanText,
            header: currentSection,
          });
        } else {
          items.push({
            type: "step",
            text: cleanText,
          });
        }
      });

      return items.length > 0 ? items : [{ type: "step", text: "Follow cooking guidelines for standard preparation." }];
    }

    const parsedItems = parseRecipeInstructions(recipe.instructions);
    let stepNumber = 0;
    const stepsHtml = parsedItems
      .map((item, index) => {
        if (item.type === "header") {
          // First header matches an ingredient row box (py-2.5 + 1px borders + 24px line = 46px)
          // and is vertically centred, so it sits level with the first ingredient.
          const topPadding = index === 0 ? "h-[46px] flex items-center" : "pt-6 pb-1";
          return `
            <li class="${topPadding} list-none -ml-1">
              <div class="flex items-center gap-3 w-full">
                <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${item.header.badgeClass} shadow-2xs">
                  <span>${item.header.icon}</span> ${escapeHtml(item.header.label)}
                </span>
                <div class="h-px bg-stone-200/80 flex-1"></div>
              </div>
            </li>
          `;
        }
        if (item.type === "bullet") {
          return `
            <li class="flex items-start gap-3.5 pl-1">
              <span class="flex-shrink-0 w-2 h-2 rounded-full ${item.header.dotClass} mt-[10px] ml-2.5"></span>
              <p class="text-stone-700 text-base leading-7 flex-1 text-pretty">${escapeHtml(item.text)}</p>
            </li>
          `;
        }
        // Standard cooking step
        stepNumber++;
        return `
          <li class="flex items-start gap-4">
            <span class="flex-shrink-0 w-7 h-7 rounded-full bg-[#fbece4] text-[#ca5c2e] font-bold text-xs sm:text-sm flex items-center justify-center">
              ${stepNumber}
            </span>
            <p class="text-stone-700 text-base leading-7 flex-1 text-pretty">${escapeHtml(item.text)}</p>
          </li>
        `;
      })
      .join("");

    // Factual fallback when TheMealDB gives no description (it never does).
    // Category is treated as a label, not a noun, so "Vegetarian" doesn't read as a person.
    function buildFallbackDescription(r) {
      const area = r.area && r.area !== "Unknown" ? r.area : "";
      const cat = (r.category || "").trim();
      const catPhrase = {
        vegetarian: "vegetarian dish",
        vegan: "vegan dish",
        dessert: "dessert",
        side: "side dish",
        starter: "starter",
        breakfast: "breakfast dish",
        miscellaneous: "dish",
      }[cat.toLowerCase()] || (cat ? `${cat.toLowerCase()} dish` : "dish");
      const article = /^[aeiou]/i.test(area || catPhrase) ? "An" : "A";
      const lead = `${article} ${area ? area + " " : ""}${catPhrase}`;

      // Name the first few distinctive ingredients, skipping pantry staples.
      const staples = /^(salt|pepper|black pepper|water|oil|olive oil|vegetable oil|sugar|butter|flour|plain flour)$/i;
      const names = (r.ingredients || [])
        .map((i) => (i.name || "").trim().toLowerCase())
        .filter((n) => n && !staples.test(n));
      const join = (arr) => (arr.length > 1 ? `${arr.slice(0, -1).join(", ")} and ${arr[arr.length - 1]}` : arr[0]);
      const keys = names.slice(0, 3);
      const extras = names.slice(3, 5);
      if (!keys.length) return `${lead}, made from simple pantry staples.`;
      const first = `${lead} with ${join(keys)}.`;
      return extras.length
        ? `${first} Finished with ${join(extras)} for extra depth of flavour.`
        : `${first} A short ingredient list that keeps things simple.`;
    }

    // Rough nutrition estimate (TheMealDB has no nutrition data; checks author-stated servings first, then estimates from ingredients).
    const nutrition = estimateNutrition(recipe.ingredients || [], null, recipe.instructions);
    const baseServings = Math.max(1, Math.round(Number(nutrition.servings) || 4));
    let currentServings = baseServings;

    // Subtitle under "Ingredients": what the recipe makes, or what it was scaled from + Reset.
    function servingsNoteHtml(servings) {
      if (servings === baseServings) {
        return `Amounts for ${baseServings} serving${baseServings === 1 ? "" : "s"}`;
      }
      return `Scaled from ${baseServings} serving${baseServings === 1 ? "" : "s"}<span aria-hidden="true"> · </span><button id="serving-reset-btn" type="button" class="rp-servings-reset">Reset</button>`;
    }

    function renderIngredientsListHtml(servings) {
      const scale = servings / baseServings;
      return (recipe.ingredients || [])
        .map((ing) => {
          const flaggedLabels = result.byIngredient?.[ing.name.toLowerCase()] || [];
          const isFlagged = flaggedLabels.length > 0;
          // Allergen tags sit on the same line as the ingredient name.
          const chipsHtml = flaggedLabels
            .map((label) => `<span class="inline-flex items-center text-[11px] font-semibold leading-none px-2 py-1 rounded-full bg-white text-red-700 border border-red-200">${escapeHtml(label)}</span>`)
            .join("");
          const swapOptions = swapsByIngredient.get(ing.name.toLowerCase()) || [];
          const swapHtml = swapOptions.length
            ? `<p class="mt-1.5 text-xs text-stone-600 leading-snug">
                <span class="font-semibold text-emerald-700">Try instead:</span> ${escapeHtml(swapOptions.join(", or "))}
              </p>`
            : "";

          const scaledMeasure = scaleMeasure(ing.measure || "", scale);

          return `
            <li class="flex items-start gap-3 rounded-xl px-3.5 py-2.5 ${isFlagged ? "bg-red-50/70 border border-red-200/80" : "border border-transparent hover:bg-white/70 transition"}">
              <span class="mt-[6px] sm:mt-[8px] w-2 h-2 rounded-full flex-shrink-0 ${isFlagged ? "bg-red-500" : "bg-[#ca5c2e]/50"}" aria-hidden="true"></span>
              <div class="flex-1 min-w-0">
                <div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <div class="flex flex-wrap items-center gap-1.5 min-w-0">
                    <span class="font-semibold text-stone-900 text-sm sm:text-base">${escapeHtml(capitalizeIngredient(ing.name))}</span>
                    ${chipsHtml}
                  </div>
                  <span class="text-sm font-medium text-stone-600 ingredient-measure">${escapeHtml(scaledMeasure)}</span>
                </div>
                ${swapHtml}
              </div>
            </li>
          `;
        })
        .join("");
    }
    const per = nutrition.perServing;
    const macroBox = (label, value) => `
      <div style="flex:1;min-width:0;text-align:center" class="rounded-xl bg-white border border-[#efe6dc] px-2 py-2.5">
        <div class="text-base font-bold text-stone-900">${value}</div>
        <div class="text-xs text-stone-500">${label}</div>
      </div>`;
    const skippedNote = nutrition.skipped.length
      ? ` Not counted: ${escapeHtml(nutrition.skipped.map(capitalizeIngredient).join(", "))}.`
      : "";
    const nutritionHtml = `
      <div class="rounded-2xl border border-[#efe6dc] bg-[#faf7f2] p-4 sm:p-5 space-y-3">
        <div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <h3 class="text-base font-bold text-stone-900">Nutrition (estimate)</h3>
          <span class="text-sm text-stone-500">per serving</span>
        </div>
        <div style="display:flex;gap:8px">
          ${macroBox("kcal", `≈ ${per.kcal}`)}
          ${macroBox("protein", `${per.protein}g`)}
          ${macroBox("carbs", `${per.carbs}g`)}
          ${macroBox("fat", `${per.fat}g`)}
        </div>
        <p class="text-xs text-stone-500 leading-relaxed">
          Worked out from the ingredient amounts for about ${nutrition.servings} serving${nutrition.servings === 1 ? "" : "s"} (≈ ${nutrition.total.kcal} kcal in total). This is a rough guide, not exact.${skippedNote}
        </p>
      </div>`;

    const safeImage = escapeHtml(recipe.image);
    const safeName = escapeHtml(titleCasedName);
    const safeCategory = escapeHtml(recipe.category || "Main");
    const safeArea = escapeHtml(recipe.area || "International");

    const ingredientCount = (recipe.ingredients || []).length;
    const stepCount = parsedItems.filter((i) => i.type !== "header").length || 1;
    const ingredientText = `${ingredientCount} ingredient${ingredientCount === 1 ? "" : "s"}`;
    const stepText = `${stepCount} step${stepCount === 1 ? "" : "s"}`;

    // "Try instead" ideas for the flagged ingredients (from preferences.js).
    const swaps = getSwapSuggestions(result, prefs);
    // Shown under each flagged ingredient in the ingredients list (lowercase name -> options).
    const swapsByIngredient = new Map(swaps.map((s) => [s.ingredient.toLowerCase(), s.options]));

    const warningBannerHtml = (result.hasAllergen || result.hasDietConflict) ? `
      <div class="rounded-2xl p-4 sm:p-5 ${result.hasAllergen ? 'bg-red-50 border border-red-200 text-red-900' : 'bg-amber-50 border border-amber-200 text-amber-900'} flex items-start gap-3.5 mb-8 shadow-xs">
        <div class="p-2 rounded-xl ${result.hasAllergen ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'} flex-shrink-0 mt-0.5">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
          </svg>
        </div>
        <div class="space-y-1">
          <h4 class="font-bold text-sm sm:text-base">${result.hasAllergen ? `Allergen Warning: Contains ${result.allergens.map(a => escapeHtml(a.name)).join(', ')}` : 'Diet Preference Conflict'}</h4>
          <p class="text-xs sm:text-sm ${result.hasAllergen ? 'text-red-700' : 'text-amber-800'} leading-relaxed">
            ${escapeHtml(describeResult(result))}. ${swaps.length
              ? "We've highlighted the relevant ingredients below, with swap ideas. Swaps can change the taste and texture, so always check the labels."
              : "We've highlighted the relevant ingredients below so you can substitute or take caution."}
          </p>
        </div>
      </div>
    ` : '';

    detail.innerHTML = `
      <div class="space-y-10">
        ${warningBannerHtml}
        <!-- Top Hero Section: Photo + Meta Details -->
        <div class="grid grid-cols-1 md:grid-cols-12 gap-8 items-start md:items-stretch">

          <!-- Image Column: 4:3 on phones; on wider screens it takes exactly the height of the
               details column, so the photo lines up with the title at the top and the description
               at the bottom whether the title is one line or two. The image is absolutely
               positioned so it never makes the row taller than the details. -->
          <div class="md:col-span-5 flex">
            <div class="relative w-full overflow-hidden rounded-2xl border border-[#efe6dc] shadow-sm bg-stone-100 aspect-[4/3] md:aspect-auto">
              <img id="main-recipe-image" class="absolute inset-0 w-full h-full object-cover" src="${safeImage}" width="480" height="360" fetchpriority="high" decoding="async" alt="${safeName}">
            </div>
          </div>

          <!-- Recipe Title, Ratings & Actions Column -->
          <div class="md:col-span-7 space-y-5">
            <div>
              <h1 class="text-3xl sm:text-4xl font-extrabold text-stone-900 tracking-tight leading-tight">
                ${safeName}
              </h1>

              <!-- Star Rating -->
              <div id="header-star-rating" class="flex items-center gap-2 mt-2">
                <div class="flex items-center text-stone-300 text-sm">
                  <span>★</span><span>★</span><span>★</span><span>★</span><span>★</span>
                </div>
                <span class="text-sm font-semibold text-stone-400">Loading ratings...</span>
              </div>
            </div>

            <!-- Chips / Badges Row -->
            <div class="flex flex-wrap items-center gap-2 pt-1">
              <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-[#f5ebe4] text-[#a04e28]">
                ${safeCategory}
              </span>
              <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-stone-100 text-stone-700">
                ${safeArea}
              </span>
              <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-stone-100 text-stone-700">
                <svg class="w-3.5 h-3.5 text-stone-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>
                ${ingredientText}
              </span>
              <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-stone-100 text-stone-700">
                <svg class="w-3.5 h-3.5 text-stone-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h7"></path></svg>
                ${stepText}
              </span>
            </div>

            <!-- Buttons Row: Save to Favourites, Add to Meal Plan & Cooking Mode -->
            <div class="flex flex-wrap items-center gap-3 pt-2">
              <button id="save-fav-btn" type="button" class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[#ca5c2e] text-[#ca5c2e] hover:bg-[#ca5c2e]/10 text-sm font-semibold transition focus:outline-none">
                <svg id="fav-icon" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path>
                </svg>
                <span id="fav-btn-label">Save to Favourites</span>
              </button>

              <button id="add-plan-btn" type="button" class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#ca5c2e] hover:bg-[#b34d23] text-white text-sm font-semibold shadow-sm transition focus:outline-none">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                Add to Meal Plan
              </button>

              <button id="start-cooking-mode-btn" type="button" class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold shadow-sm transition focus:outline-none">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <span>Cooking Mode</span>
              </button>
            </div>

            <!-- Description -->
            <div class="pt-2">
              <h3 class="text-base font-bold text-stone-900 mb-2">Description</h3>
              <p class="text-stone-600 text-sm sm:text-base leading-relaxed line-clamp-2 min-h-[3.25em]">
                ${escapeHtml(recipe.description || buildFallbackDescription(recipe))}
              </p>
            </div>
          </div>
        </div>

        <!-- Tabs: Recipe | Reviews -->
        <div class="border-b border-[#ede4da] flex items-center gap-6" role="tablist">
          <button type="button" role="tab" data-tab="recipe" aria-selected="true" style="margin-bottom:-1px;border-bottom-width:2px;border-bottom-style:solid" class="recipe-tab-btn pb-3 border-[#ca5c2e] text-[#ca5c2e] text-sm sm:text-base font-bold transition focus:outline-none">
            Ingredients &amp; Instructions
          </button>
          <button type="button" role="tab" data-tab="reviews" aria-selected="false" style="margin-bottom:-1px;border-bottom-width:2px;border-bottom-style:solid" class="recipe-tab-btn pb-3 border-transparent text-stone-500 hover:text-stone-800 text-sm sm:text-base font-bold transition focus:outline-none inline-flex items-center">
            <span>Reviews</span>
            <span id="reviews-tab-count" class="ml-1.5 text-xs font-semibold px-2 py-0.5 rounded-full bg-stone-100 text-stone-500 inline-flex items-center justify-center leading-none">0</span>
          </button>
        </div>

        <!-- Recipe tab: Ingredients (Left) and Instructions (Right) -->
        <div id="tab-panel-recipe" role="tabpanel" class="grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-12">
          
          <!-- Ingredients Column -->
          <div class="md:col-span-5 space-y-4">
            <div class="rp-ing-head">
              <div class="rp-ing-title">
                <h2 class="text-xl font-bold text-stone-900">Ingredients</h2>
                <p id="servings-note" class="rp-servings-note">${servingsNoteHtml(currentServings)}</p>
              </div>

              <!-- Serving size scaler -->
              <div id="servings-stepper" class="rp-servings" role="group" aria-label="Servings">
                <button id="serving-decrease-btn" type="button" class="rp-servings-btn" aria-label="Fewer servings" ${currentServings <= 1 ? "disabled" : ""}>
                  <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" viewBox="0 0 24 24" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                </button>
                <span class="rp-servings-value" aria-live="polite">
                  <span id="current-servings-display" class="rp-servings-num">${currentServings}</span>
                  <span id="current-servings-unit" class="rp-servings-unit">${currentServings === 1 ? "serving" : "servings"}</span>
                </span>
                <button id="serving-increase-btn" type="button" class="rp-servings-btn" aria-label="More servings" ${currentServings >= 30 ? "disabled" : ""}>
                  <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" viewBox="0 0 24 24" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                </button>
              </div>
            </div>

            <ul id="ingredients-list" class="space-y-2 list-none p-0 m-0">
              ${renderIngredientsListHtml(currentServings)}
            </ul>
            ${nutritionHtml}
          </div>

          <!-- Instructions Column -->
          <div class="md:col-span-7 space-y-4">
            <div class="flex items-center justify-between gap-3">
              <h2 class="text-xl font-bold text-stone-900">Instructions</h2>
              <button id="instructions-cooking-mode-btn" type="button" class="inline-flex items-center gap-1.5 text-xs font-semibold text-[#ca5c2e] hover:text-[#b34d23] px-3 py-1.5 rounded-lg bg-[#fbece4] hover:bg-[#f6decb] transition focus:outline-none">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Cooking Mode</span>
              </button>
            </div>
            <ol class="space-y-5 list-none p-0 m-0">
              ${stepsHtml}
            </ol>
          </div>
        </div>

        <!-- Reviews tab: Community Ratings & Reviews (Person 3) -->
        <div id="tab-panel-reviews" role="tabpanel" class="hidden">
          <div id="recipe-ratings-section"></div>
        </div>
      </div>
    `;

    // Tab switching (also used by the rating link under the title)
    const tabBtns = detail.querySelectorAll(".recipe-tab-btn");
    const switchRecipeTab = (tab) => {
      tabBtns.forEach((b) => {
        const active = b.dataset.tab === tab;
        b.setAttribute("aria-selected", String(active));
        b.classList.toggle("border-[#ca5c2e]", active);
        b.classList.toggle("text-[#ca5c2e]", active);
        b.classList.toggle("border-transparent", !active);
        b.classList.toggle("text-stone-500", !active);
      });
      document.getElementById("tab-panel-recipe")?.classList.toggle("hidden", tab !== "recipe");
      document.getElementById("tab-panel-reviews")?.classList.toggle("hidden", tab !== "reviews");
      window.dispatchEvent(new CustomEvent("recipe:tab-switched", { detail: { tab } }));
    };
    tabBtns.forEach((b) => b.addEventListener("click", () => switchRecipeTab(b.dataset.tab)));
    if (window._showReviewsHandler) {
      window.removeEventListener("recipe:show-reviews", window._showReviewsHandler);
    }
    window._showReviewsHandler = () => {
      switchRecipeTab("reviews");
      tabBtns[0]?.parentElement?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    window.addEventListener("recipe:show-reviews", window._showReviewsHandler);
    if (location.hash === "#reviews") switchRecipeTab("reviews");

    // Save to favourites handling
    const favBtn = document.getElementById("save-fav-btn");
    const favIcon = document.getElementById("fav-icon");
    const favLabel = document.getElementById("fav-btn-label");

    // Initialize favourite state (optimistic instant load from cache only if logged in)
    let isFaved = false;
    const currentUser = getCurrentUser();
    if (currentUser) {
      try {
        const stored = JSON.parse(localStorage.getItem("recipeplan_favourites") || "[]");
        isFaved = stored.some((f) => String(f.id) === String(recipe.id));
      } catch (e) { }
    }

    const updateFavDisplay = (faved) => {
      isFaved = Boolean(faved);
      if (isFaved) {
        favIcon.setAttribute("fill", "#ca5c2e");
        favLabel.textContent = "Saved to Favourites";
      } else {
        favIcon.setAttribute("fill", "none");
        favLabel.textContent = "Save to Favourites";
      }
    };
    updateFavDisplay(isFaved);

    // Verify against isFavourite in background if logged in
    if (currentUser) {
      import("./favourites.js")
        .then(({ isFavourite }) => isFavourite(recipe.id))
        .then((serverFaved) => {
          if (serverFaved !== isFaved) updateFavDisplay(serverFaved);
        })
        .catch(() => { });
    }

    // Instant optimistic toggle on click (0ms delay)
    favBtn.addEventListener("click", () => {
      const user = getCurrentUser();
      if (!user) {
        showAuthPromptModal({
          title: "Log in to save favourites",
          description: "Your saved recipes will be waiting for you on any device.",
          redirectUrl: `recipe.html?id=${encodeURIComponent(recipe.id)}`,
          icon: "heart"
        });
        return;
      }

      const nextState = !isFaved;
      updateFavDisplay(nextState);
      playHeartEffect(favBtn, nextState);

      if (nextState) {
        showToast(`Saved "${recipe.name}" to favourites!`);
        import("./favourites.js").then(({ addFavourite }) => addFavourite(recipe)).catch(console.warn);
      } else {
        showToast(`Removed "${recipe.name}" from favourites`, {
          duration: 5000,
          action: {
            label: "Undo",
            onClick: () => {
              updateFavDisplay(true);
              playHeartEffect(favBtn, true);
              import("./favourites.js").then(({ addFavourite }) => addFavourite(recipe)).catch(console.warn);
              showToast(`Restored "${recipe.name}" to favourites!`);
            },
          },
        });
        import("./favourites.js").then(({ removeFavourite }) => removeFavourite(recipe.id)).catch(console.warn);
      }
    });

    // Serving Size Scaler handling
    const servingDecreaseBtn = document.getElementById("serving-decrease-btn");
    const servingIncreaseBtn = document.getElementById("serving-increase-btn");
    const servingsDisplay = document.getElementById("current-servings-display");
    const servingsUnit = document.getElementById("current-servings-unit");
    const servingsNote = document.getElementById("servings-note");
    const servingsStepper = document.getElementById("servings-stepper");
    const ingredientsListEl = document.getElementById("ingredients-list");

    const updateServings = (newServings) => {
      currentServings = Math.max(1, Math.min(30, Math.round(newServings)));
      if (servingsDisplay) servingsDisplay.textContent = currentServings;
      if (servingsUnit) servingsUnit.textContent = currentServings === 1 ? "serving" : "servings";
      if (servingDecreaseBtn) servingDecreaseBtn.disabled = currentServings <= 1;
      if (servingIncreaseBtn) servingIncreaseBtn.disabled = currentServings >= 30;
      servingsStepper?.classList.toggle("is-scaled", currentServings !== baseServings);
      if (servingsNote) servingsNote.innerHTML = servingsNoteHtml(currentServings);
      if (ingredientsListEl) {
        ingredientsListEl.innerHTML = renderIngredientsListHtml(currentServings);
      }
    };

    servingDecreaseBtn?.addEventListener("click", () => updateServings(currentServings - 1));
    servingIncreaseBtn?.addEventListener("click", () => updateServings(currentServings + 1));
    // Reset lives in the subtitle, which is re-rendered, so listen on the subtitle itself.
    servingsNote?.addEventListener("click", (event) => {
      if (!event.target.closest("#serving-reset-btn")) return;
      updateServings(baseServings);
      servingIncreaseBtn?.focus();
    });

    // Helper to get recipe ingredients scaled to currentServings
    const getScaledRecipe = () => {
      const scale = currentServings / baseServings;
      const scaledIngredients = (recipe.ingredients || []).map((ing) => ({
        ...ing,
        measure: scaleMeasure(ing.measure || "", scale),
      }));
      return {
        ...recipe,
        ingredients: scaledIngredients,
        servings: currentServings,
      };
    };

    // Add to meal plan quick action
    const addPlanBtn = document.getElementById("add-plan-btn");
    if (addPlanBtn) {
      addPlanBtn.addEventListener("click", async () => {
        const user = getCurrentUser();
        if (!user) {
          showAuthPromptModal({
            title: "Log in to plan your meals",
            description: "Create a free account to add recipes to your weekly planner and build your shopping list.",
            redirectUrl: `recipe.html?id=${encodeURIComponent(recipe.id)}`,
            icon: "planner"
          });
          return;
        }

        if (!(await confirmIfFlagged(recipe))) return;
        // The planner's day and meal dialog (Person 4) picks the slot, shows what is
        // already there, and saves to this week's plan on the account (Firestore).
        try {
          const { openAddToPlanDialog } = await import("./planner.js");
          const recipeToAdd = getScaledRecipe();
          const slot = await openAddToPlanDialog(recipeToAdd, { skipAllergenCheck: true });
          if (slot && !slot.unchanged) {
            showToast(`Added "${toTitleCase(recipe.name)}" to ${slot.day} ${slot.meal}!`, {
              action: { label: "View plan", onClick: () => (window.location.href = "planner.html") }
            });
          }
        } catch (e) {
          console.warn("Could not add to meal plan:", e);
          showToast("Couldn't add this recipe to your plan. Please try again.");
        }
      });
    }

    // Launch Cooking Mode (Dedicated step-by-step view with progress, timers, and checklist)
    const launchCookingMode = () => {
      openCookingMode({
        recipe: getScaledRecipe(),
        parsedItems,
        allergenResult: result,
        onSwitchTab: switchRecipeTab,
      });
    };

    document.getElementById("start-cooking-mode-btn")?.addEventListener("click", launchCookingMode);
    document.getElementById("instructions-cooking-mode-btn")?.addEventListener("click", launchCookingMode);

    // Auto-launch if URL has ?cook=1 or #cook
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("cook") === "1" || window.location.hash === "#cook") {
      launchCookingMode();
    }

    // Mount Ratings & Reviews system (Person 3)
    import("./ratings.js")
      .then(({ initRatings }) => {
        initRatings(recipe.id, "recipe-ratings-section");
      })
      .catch((err) => console.error("Could not load ratings module:", err));

  } catch (err) {
    console.error("Recipe display error:", err);
    detail.innerHTML = `
      <div class="text-center py-12 text-stone-500">
        <p class="text-base font-semibold text-stone-800">Recipe could not be loaded.</p>
        <a href="index.html" class="inline-block mt-3 text-sm text-[#ca5c2e] hover:underline">&larr; Return to browse recipes</a>
      </div>
    `;
  }
}

if (detail) {
  const id = new URLSearchParams(window.location.search).get("id") || "52772";
  showRecipe(id);
}
