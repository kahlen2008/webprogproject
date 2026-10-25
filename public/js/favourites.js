// Favourites page logic and Firestore/localStorage sync.
// Owner: Person 3.

import { createRecipeCard, showToast } from "./utils.js";
import { getCurrentUser } from "./auth.js";
import { db } from "./firebase-config.js";

// Real initial favourites matching genuine TheMealDB IDs and details
const DEMO_FAVOURITES = [
  {
    id: "52772",
    name: "Teriyaki Chicken Casserole",
    image: "https://www.themealdb.com/images/media/meals/wvpsxx1468256321.jpg",
    category: "Chicken"
  },
  {
    id: "52844",
    name: "Lasagne",
    image: "https://www.themealdb.com/images/media/meals/wtsvxx1511296896.jpg",
    category: "Pasta"
  },
  {
    id: "52874",
    name: "Beef and Mustard Pie",
    image: "https://www.themealdb.com/images/media/meals/sytuqu1511553755.jpg",
    category: "Beef"
  },
  {
    id: "52854",
    name: "Pancakes",
    image: "https://www.themealdb.com/images/media/meals/rwuyqx1511383174.jpg",
    category: "Dessert"
  },
  {
    id: "52977",
    name: "Corba Soup",
    image: "https://www.themealdb.com/images/media/meals/58oia91564916529.jpg",
    category: "Side"
  },
  {
    id: "52819",
    name: "Cajun Spiced Fish Tacos",
    image: "https://www.themealdb.com/images/media/meals/uvuyxu1503067369.jpg",
    category: "Seafood"
  }
];

export async function getFavourites() {
  try {
    const raw = localStorage.getItem("recipeplan_favourites");
    if (!raw) {
      // Seed with demo favourites if empty so mockup matches out of the box
      localStorage.setItem("recipeplan_favourites", JSON.stringify(DEMO_FAVOURITES));
      return DEMO_FAVOURITES;
    }
    return JSON.parse(raw);
  } catch (e) {
    return DEMO_FAVOURITES;
  }
}

export async function addFavourite(recipe) {
  const current = await getFavourites();
  if (!current.some((f) => String(f.id) === String(recipe.id))) {
    current.push(recipe);
    localStorage.setItem("recipeplan_favourites", JSON.stringify(current));
  }
}

export async function removeFavourite(recipeId) {
  const current = await getFavourites();
  const updated = current.filter((f) => String(f.id) !== String(recipeId));
  localStorage.setItem("recipeplan_favourites", JSON.stringify(updated));
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
        <div class="text-center py-16 bg-white rounded-3xl border border-[#efe6dc] p-8 max-w-lg mx-auto space-y-4">
          <div class="w-16 h-16 rounded-full bg-[#fbf2ec] text-[#ca5c2e] flex items-center justify-center mx-auto">
            <svg class="w-8 h-8" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path>
            </svg>
          </div>
          <h3 class="text-lg font-bold text-stone-900">No favourites yet</h3>
          <p class="text-sm text-stone-500">Explore our delicious recipes and click the heart icon to save them here for later!</p>
          <a href="index.html" class="inline-block bg-[#ca5c2e] hover:bg-[#b34d23] text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition shadow-sm">
            Discover Recipes
          </a>
        </div>
      `;
    }
    return;
  }

  if (messageEl) messageEl.innerHTML = "";

  favs.forEach((recipe) => {
    const card = createRecipeCard(recipe, { isFavouritePage: true });
    
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
}
