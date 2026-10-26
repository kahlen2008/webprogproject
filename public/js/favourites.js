// Favourites page logic and Firestore/localStorage sync.
// Owner: Person 3.

import { createRecipeCard, showToast } from "./utils.js";
import { getCurrentUser } from "./auth.js";
import { db } from "./firebase-config.js";
import { getPreferences, checkRecipes, decorateCard } from "./preferences.js";

// LocalStorage key for saved favourites
const STORAGE_KEY = "recipeplan_favourites";

export async function getFavourites() {
  try {
    // Purge legacy demo seed once so existing browser cache starts fresh with user's own favourites
    if (!localStorage.getItem("recipeplan_favourites_purged_demo")) {
      localStorage.setItem("recipeplan_favourites_purged_demo", "true");
      localStorage.removeItem(STORAGE_KEY);
      return [];
    }

    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

export async function addFavourite(recipe) {
  const current = await getFavourites();
  if (!current.some((f) => String(f.id) === String(recipe.id))) {
    current.push(recipe);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  }
}

export async function removeFavourite(recipeId) {
  const current = await getFavourites();
  const updated = current.filter((f) => String(f.id) !== String(recipeId));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export async function isFavourite(recipeId) {
  const current = await getFavourites();
  return current.some((f) => String(f.id) === String(recipeId));
}

export function watchFavourites(callback) {
  window.addEventListener("storage", async () => {
    callback(await getFavourites());
  });
  return () => {};
}

// ---------- Render Favourites Page ----------
const listEl = document.getElementById("favourites-list");
const messageEl = document.getElementById("favourites-message");

async function renderFavourites() {
  if (!listEl) return;
  listEl.innerHTML = "";
  
  const favs = await getFavourites();

  if (favs.length === 0) {
    if (messageEl) {
      messageEl.innerHTML = `
        <div class="text-center py-16 bg-white rounded-3xl border border-[#efe6dc] p-8 max-w-lg mx-auto space-y-5 shadow-sm">
          <div class="w-20 h-20 rounded-full bg-[#fbf2ec] text-[#ca5c2e] flex items-center justify-center mx-auto shadow-inner">
            <svg class="w-10 h-10" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path>
            </svg>
          </div>
          <div class="space-y-1.5">
            <h3 class="text-xl font-bold text-stone-900">No favourites yet</h3>
            <p class="text-sm text-stone-500 max-w-sm mx-auto leading-relaxed">
              You haven't saved any recipes to your favourites yet. Browse our delicious recipes and click the heart icon on any card to save it here!
            </p>
          </div>
          <a href="index.html#recipes-section" class="inline-flex items-center gap-2 bg-[#ca5c2e] hover:bg-[#b34d23] text-white text-sm font-semibold px-6 py-3 rounded-xl transition duration-200 shadow-sm hover:shadow">
            <span>Discover Recipes</span>
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <line x1="5" y1="12" x2="19" y2="12"></line>
              <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
          </a>
        </div>
      `;
    }
    return;
  }

  if (messageEl) messageEl.innerHTML = "";

  const prefs = getPreferences();
  const checked = await checkRecipes(favs, prefs);

  checked.forEach(({ recipe, result }) => {
    const card = createRecipeCard(recipe, { isFavouritePage: true });
    decorateCard(card, result);
    
    // Attach removal listener to trash button
    const removeBtn = card.querySelector(".remove-favourite-btn");
    if (removeBtn) {
      removeBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        card.style.opacity = "0";
        card.style.transform = "scale(0.95)";
        card.style.transition = "all 0.25s ease-out";
        
        setTimeout(async () => {
          await removeFavourite(recipe.id);
          showToast(`Removed "${recipe.name}" from favourites`);
          renderFavourites();
        }, 200);
      });
    }

    listEl.appendChild(card);
  });
}

if (listEl) {
  renderFavourites();
  window.addEventListener("preferences-changed", () => {
    renderFavourites();
  });
}
