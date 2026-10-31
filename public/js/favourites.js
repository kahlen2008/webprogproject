// Favourites page logic and Firestore/localStorage sync.
// Owner: Person 3.
// Firestore Schema: users/{uid}/favourites/{recipeId}
// Document fields: { id, name, image, category, area, savedAt }

import { createRecipeCard, showToast } from "./utils.js";
import { getCurrentUser } from "./auth.js";
import { db } from "./firebase-config.js";
import { getPreferences, checkRecipes, decorateCard } from "./preferences.js";
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

// LocalStorage key for caching saved favourites
const STORAGE_KEY = "recipeplan_favourites";

/**
 * Normalizes any timestamp representation (Firestore Timestamp, ISO string, milliseconds) to a number.
 */
function getTimestampMs(item) {
  if (!item) return 0;
  const s = item.savedAt || item.addedAt || item.createdAt;
  if (!s) return 0;
  if (typeof s.toMillis === "function") return s.toMillis();
  if (typeof s.toDate === "function") return s.toDate().getTime();
  if (typeof s.seconds === "number") return s.seconds * 1000 + (s.nanoseconds || 0) / 1000000;
  if (typeof s === "number") return s;
  if (typeof s === "string") {
    const parsed = Date.parse(s);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

/**
 * Consistently sorts favourites newest first.
 * If timestamps tie or are missing, uses ID descending for stable deterministic order.
 */
export function sortBySavedAtDesc(items) {
  if (!Array.isArray(items)) return [];
  return [...items].sort((a, b) => {
    const timeA = getTimestampMs(a);
    const timeB = getTimestampMs(b);
    if (timeA !== timeB) return timeB - timeA;
    return String(b.id || "").localeCompare(String(a.id || ""));
  });
}

function getLocalFavourites() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? sortBySavedAtDesc(parsed) : [];
  } catch (e) {
    return [];
  }
}

/**
 * Fetches the user's favourites.
 * In 1 single query from Firestore if signed in, stably sorted newest first,
 * falling back to localStorage if offline or logged out.
 */
export async function getFavourites() {
  // Purge legacy demo seed once so existing browser cache starts fresh with user's own favourites
  if (!localStorage.getItem("recipeplan_favourites_purged_demo")) {
    localStorage.setItem("recipeplan_favourites_purged_demo", "true");
    localStorage.removeItem(STORAGE_KEY);
  }

  const user = getCurrentUser();
  if (user && user.uid) {
    try {
      const colRef = collection(db, "users", user.uid, "favourites");
      const snap = await getDocs(colRef);
      const rawFavs = [];
      snap.forEach((d) => rawFavs.push(d.data()));

      // Stably sort newest first in JavaScript (guarantees identical order across Firestore & localCache)
      const favs = sortBySavedAtDesc(rawFavs);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(favs));
      return favs;
    } catch (err) {
      console.warn("Could not load favourites from Firestore, falling back to local cache:", err);
    }
  }

  return getLocalFavourites();
}

/**
 * Adds a recipe to favourites in Firestore users/{uid}/favourites/{recipeId}
 * Using the recipe ID as the document ID prevents duplicates.
 */
export async function addFavourite(recipe) {
  if (!recipe || !recipe.id) return;

  const nowIso = new Date().toISOString();
  const data = {
    id: String(recipe.id),
    name: String(recipe.name || recipe.title || ""),
    image: String(recipe.image || ""),
    category: String(recipe.category || "Main"),
    area: String(recipe.area || ""),
    savedAt: nowIso,
  };

  // Optimistically update local cache with consistent ordering
  const current = getLocalFavourites();
  const filtered = current.filter((f) => String(f.id) !== String(recipe.id));
  filtered.unshift(data);
  const sorted = sortBySavedAtDesc(filtered);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sorted));
  window.dispatchEvent(new CustomEvent("favourites-changed"));

  const user = getCurrentUser();
  if (user && user.uid) {
    try {
      const docRef = doc(db, "users", user.uid, "favourites", String(recipe.id));
      await setDoc(docRef, {
        ...data,
        savedAt: serverTimestamp(),
      });
    } catch (err) {
      console.warn("Could not save favourite to Firestore:", err);
    }
  }
}

/**
 * Removes a recipe from Firestore via deleteDoc on users/{uid}/favourites/{recipeId}.
 */
export async function removeFavourite(recipeId) {
  if (!recipeId) return [];

  // Optimistically update local cache
  const current = getLocalFavourites();
  const updated = current.filter((f) => String(f.id) !== String(recipeId));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  window.dispatchEvent(new CustomEvent("favourites-changed"));

  const user = getCurrentUser();
  if (user && user.uid) {
    try {
      const docRef = doc(db, "users", user.uid, "favourites", String(recipeId));
      await deleteDoc(docRef);
    } catch (err) {
      console.warn("Could not delete favourite from Firestore:", err);
    }
  }

  return updated;
}

/**
 * Checks if a recipe is saved as favourite (checks local cache first, single getDoc if needed).
 */
export async function isFavourite(recipeId) {
  if (!recipeId) return false;

  const local = getLocalFavourites();
  if (local.some((f) => String(f.id) === String(recipeId))) return true;

  const user = getCurrentUser();
  if (user && user.uid) {
    try {
      const docRef = doc(db, "users", user.uid, "favourites", String(recipeId));
      const snap = await getDoc(docRef);
      return snap.exists();
    } catch (e) {
      return false;
    }
  }

  return false;
}

export function watchFavourites(callback) {
  window.addEventListener("storage", async () => {
    callback(await getFavourites());
  });
  window.addEventListener("favourites-changed", async () => {
    callback(await getFavourites());
  });
  return () => {};
}

// ---------- Render Favourites Page ----------
const listEl = document.getElementById("favourites-list");
const messageEl = document.getElementById("favourites-message");

const STARTER_RECIPES = [
  {
    id: "52772",
    name: "Teriyaki Chicken Casserole",
    image: "https://www.themealdb.com/images/media/meals/wvpsxx1468256321.jpg",
    category: "Chicken",
    area: "Japanese",
  },
  {
    id: "52844",
    name: "Lasagne",
    image: "https://www.themealdb.com/images/media/meals/wtsvxx1511296896.jpg",
    category: "Pasta",
    area: "Italian",
  },
  {
    id: "52854",
    name: "Pancakes",
    image: "https://www.themealdb.com/images/media/meals/rwuyqx1511383174.jpg",
    category: "Dessert",
    area: "American",
  },
];

function renderLoggedOutEmptyState() {
  if (!messageEl) return;
  const destination = (window.location.pathname.split("/").pop() || "favourites.html") + window.location.search;
  const loginHref = `login.html?redirect=${encodeURIComponent(destination)}`;
  const signupHref = `signup.html?redirect=${encodeURIComponent(destination)}`;

  messageEl.innerHTML = `
    <div class="space-y-10 sm:space-y-12">
      <!-- Warm Culinary Hero Card -->
      <div class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-white via-[#fcf8f4] to-[#f8f0e5] border border-[#eee2d5] p-8 sm:p-12 text-center shadow-xs">
        <div class="absolute -top-20 -left-20 w-56 h-56 bg-[#ca5c2e]/5 rounded-full blur-3xl pointer-events-none"></div>
        <div class="absolute -bottom-20 -right-20 w-56 h-56 bg-[#f3c292]/10 rounded-full blur-3xl pointer-events-none"></div>

        <div class="relative z-10 max-w-xl mx-auto space-y-6">
          <div class="relative inline-block mx-auto">
            <div class="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-tr from-[#fbebe3] to-[#fae2d5] border border-[#f5cfb8] flex items-center justify-center mx-auto shadow-inner ring-8 ring-[#ca5c2e]/5">
              <svg class="w-10 h-10 sm:w-11 sm:h-11 text-[#ca5c2e] drop-shadow-sm transition-transform duration-300 hover:scale-110" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path>
              </svg>
            </div>
            <span class="absolute -top-1 -right-1 w-7 h-7 bg-white rounded-full border border-[#eee2d5] shadow-xs flex items-center justify-center text-xs select-none">✨</span>
            <span class="absolute -bottom-1 -left-1 w-7 h-7 bg-white rounded-full border border-[#eee2d5] shadow-xs flex items-center justify-center text-xs select-none">❤️</span>
          </div>

          <div class="space-y-2.5">
            <h2 class="text-2xl sm:text-3xl font-extrabold text-stone-900 tracking-tight font-heading">
              Log in to see your favourites
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

      <!-- Popular Starter Recipes Section -->
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-lg sm:text-xl font-bold text-stone-900 font-heading">Popular Recipes to Get You Started</h3>
            <p class="text-xs sm:text-sm text-stone-500">Tap the heart on any card to save it straight to your collection.</p>
          </div>
          <a href="recipes.html" class="inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-[#ca5c2e] hover:text-[#b34d23] transition group">
            <span>Browse all</span>
            <svg class="w-3.5 h-3.5 group-hover:translate-x-0.5 transition" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"></path>
            </svg>
          </a>
        </div>
        <ul id="logged-out-starter-recipes-list" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 list-none p-0 m-0"></ul>
      </div>
    </div>
  `;

  const starterGrid = messageEl.querySelector("#logged-out-starter-recipes-list");
  if (starterGrid) {
    STARTER_RECIPES.forEach((recipe) => {
      const card = createRecipeCard(recipe, { isFavouritePage: false });
      starterGrid.appendChild(card);
    });
  }
}

function renderEmptyState() {
  const user = getCurrentUser();
  if (!user) {
    renderLoggedOutEmptyState();
    return;
  }

  if (!messageEl) return;
  messageEl.innerHTML = `
    <div class="space-y-10 sm:space-y-12">
      <!-- Warm Culinary Hero Card -->
      <div class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-white via-[#fcf8f4] to-[#f8f0e5] border border-[#eee2d5] p-8 sm:p-12 text-center shadow-xs">
        <!-- Ambient decorative blurs -->
        <div class="absolute -top-20 -left-20 w-56 h-56 bg-[#ca5c2e]/5 rounded-full blur-3xl pointer-events-none"></div>
        <div class="absolute -bottom-20 -right-20 w-56 h-56 bg-[#f3c292]/10 rounded-full blur-3xl pointer-events-none"></div>

        <div class="relative z-10 max-w-xl mx-auto space-y-6">
          <!-- Heart Icon with Warm Multi-layered Glow & Floating Badges -->
          <div class="relative inline-block mx-auto">
            <div class="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-tr from-[#fbebe3] to-[#fae2d5] border border-[#f5cfb8] flex items-center justify-center mx-auto shadow-inner ring-8 ring-[#ca5c2e]/5">
              <svg class="w-10 h-10 sm:w-11 sm:h-11 text-[#ca5c2e] drop-shadow-sm transition-transform duration-300 hover:scale-110" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path>
              </svg>
            </div>
            <span class="absolute -top-1 -right-1 w-7 h-7 bg-white rounded-full border border-[#eee2d5] shadow-xs flex items-center justify-center text-xs select-none">✨</span>
            <span class="absolute -bottom-1 -left-1 w-7 h-7 bg-white rounded-full border border-[#eee2d5] shadow-xs flex items-center justify-center text-xs select-none">🍳</span>
          </div>

          <!-- Friendly Headline & Description -->
          <div class="space-y-2.5">
            <h2 class="text-2xl sm:text-3xl font-extrabold text-stone-900 tracking-tight font-heading">
              Your recipe box is waiting
            </h2>
            <p class="text-sm sm:text-base text-stone-600 leading-relaxed max-w-md mx-auto">
              Save dishes you'd love to cook. They'll be organized here so you can easily plan weekly meals, generate smart grocery lists, and cook your favourites anytime.
            </p>
          </div>

          <!-- Primary Action Button -->
          <div class="pt-1">
            <a 
              href="recipes.html" 
              class="inline-flex items-center gap-2.5 bg-[#ca5c2e] hover:bg-[#b34d23] text-white text-sm sm:text-base font-semibold px-8 py-3.5 rounded-full transition-all duration-200 shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>Explore All Recipes</span>
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"></path>
              </svg>
            </a>
          </div>

          <!-- Quick Category Shortcuts -->
          <div class="pt-4 border-t border-[#ede4da]/80">
            <span class="block text-xs font-semibold text-stone-400 mb-3 uppercase tracking-wider">Quick browse by category</span>
            <div class="flex flex-wrap justify-center gap-2">
              <a href="recipes.html?category=Chicken" class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white hover:bg-[#fbf2ec] text-stone-700 hover:text-[#ca5c2e] border border-[#ede4da] hover:border-[#ca5c2e]/40 text-xs font-medium transition shadow-2xs">
                <span>🍗 Chicken</span>
              </a>
              <a href="recipes.html?category=Pasta" class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white hover:bg-[#fbf2ec] text-stone-700 hover:text-[#ca5c2e] border border-[#ede4da] hover:border-[#ca5c2e]/40 text-xs font-medium transition shadow-2xs">
                <span>🍝 Pasta</span>
              </a>
              <a href="recipes.html?category=Vegetarian" class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white hover:bg-[#fbf2ec] text-stone-700 hover:text-[#ca5c2e] border border-[#ede4da] hover:border-[#ca5c2e]/40 text-xs font-medium transition shadow-2xs">
                <span>🥗 Vegetarian</span>
              </a>
              <a href="recipes.html?category=Dessert" class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white hover:bg-[#fbf2ec] text-stone-700 hover:text-[#ca5c2e] border border-[#ede4da] hover:border-[#ca5c2e]/40 text-xs font-medium transition shadow-2xs">
                <span>🍰 Dessert</span>
              </a>
              <a href="recipes.html?category=Seafood" class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white hover:bg-[#fbf2ec] text-stone-700 hover:text-[#ca5c2e] border border-[#ede4da] hover:border-[#ca5c2e]/40 text-xs font-medium transition shadow-2xs">
                <span>🍤 Seafood</span>
              </a>
            </div>
          </div>
        </div>
      </div>

      <!-- Popular Starter Recipes Section -->
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-lg sm:text-xl font-bold text-stone-900 font-heading">Popular Recipes to Get You Started</h3>
            <p class="text-xs sm:text-sm text-stone-500">Tap the heart on any card to save it straight to your collection.</p>
          </div>
          <a href="recipes.html" class="inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-[#ca5c2e] hover:text-[#b34d23] transition group">
            <span>Browse all</span>
            <span class="group-hover:translate-x-0.5 transition-transform">&rarr;</span>
          </a>
        </div>

        <ul id="starter-recipes-list" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 list-none p-0 m-0"></ul>
      </div>
    </div>
  `;

  const starterGrid = messageEl.querySelector("#starter-recipes-list");
  if (starterGrid) {
    STARTER_RECIPES.forEach((recipe) => {
      const card = createRecipeCard(recipe, { isFavouritePage: false });
      starterGrid.appendChild(card);
    });
  }
}

function renderCardsFast(favs) {
  if (!listEl) return;
  listEl.innerHTML = "";

  favs.forEach((recipe) => {
    const card = createRecipeCard(recipe, { isFavouritePage: true });
    card.setAttribute("data-card-id", String(recipe.id));

    // Attach removal listener with instant, simultaneous FLIP layout animation (Zero pause)
    const removeBtn = card.querySelector(".remove-favourite-btn");
    if (removeBtn) {
      removeBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (card.dataset.deleting === "true") return;
        card.dataset.deleting = "true";
        removeBtn.disabled = true;

        // 1. Capture initial positions of all cards before layout changes
        const allCards = Array.from(listEl.querySelectorAll(".recipe-card"));
        const siblingCards = allCards.filter((c) => c !== card);
        const firstPositions = siblingCards.map((c) => c.getBoundingClientRect());
        const cardRect = card.getBoundingClientRect();
        const listRect = listEl.getBoundingClientRect();

        // If this was the last card, animate it out and show empty state
        if (siblingCards.length === 0) {
          card.style.transition = "opacity 0.22s ease-out, transform 0.22s ease-out";
          card.style.opacity = "0";
          card.style.transform = "scale(0.85)";
          setTimeout(async () => {
            await removeFavourite(recipe.id);
            card.remove();
            renderEmptyState();
            showToast(`Removed "${recipe.name}" from favourites`);
          }, 200);
          return;
        }

        // 2. Clone card as an absolute ghost overlay to fade out at its exact spot
        const ghost = card.cloneNode(true);
        ghost.style.position = "absolute";
        ghost.style.left = `${cardRect.left - listRect.left}px`;
        ghost.style.top = `${cardRect.top - listRect.top}px`;
        ghost.style.width = `${cardRect.width}px`;
        ghost.style.height = `${cardRect.height}px`;
        ghost.style.margin = "0";
        ghost.style.zIndex = "30";
        ghost.style.pointerEvents = "none";
        ghost.style.transformOrigin = "center center";
        ghost.style.transition = "opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1), transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)";
        listEl.appendChild(ghost);

        // 3. IMMEDIATELY remove original card from document flow (Zero pause!)
        card.remove();

        // 4. Measure new positions of siblings and calculate inverse delta (Invert)
        const shiftingCards = [];
        siblingCards.forEach((c, idx) => {
          const lastPos = c.getBoundingClientRect();
          const firstPos = firstPositions[idx];
          const dx = firstPos.left - lastPos.left;
          const dy = firstPos.top - lastPos.top;

          if (dx !== 0 || dy !== 0) {
            c.style.transition = "none";
            c.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
            shiftingCards.push(c);
          }
        });

        // Force synchronous layout reflow so the browser registers the inverted positions
        void listEl.offsetHeight;

        // 5. SIMULTANEOUSLY animate ghost card fading out AND siblings gliding into place!
        requestAnimationFrame(() => {
          ghost.style.opacity = "0";
          ghost.style.transform = "scale(0.85)";

          shiftingCards.forEach((c) => {
            c.style.transition = "transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1)";
            c.style.transform = "translate3d(0, 0, 0)";
          });

          // Clean up after animation finishes
          setTimeout(() => {
            ghost.remove();
            shiftingCards.forEach((c) => {
              c.style.transition = "";
              c.style.transform = "";
            });
          }, 360);
        });

        // 6. Delete in background and notify
        await removeFavourite(recipe.id);
        showToast(`Removed "${recipe.name}" from favourites`);
      });
    }

    listEl.appendChild(card);
  });
}

function renderLoadingSpinner() {
  if (!listEl) return;
  listEl.innerHTML = `
    <li class="col-span-full py-20 text-center text-stone-500 flex flex-col items-center justify-center gap-3">
      <svg class="animate-spin w-8 h-8 text-[#ca5c2e]" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
      </svg>
      <span class="text-sm font-medium text-stone-600">Loading your favourites...</span>
    </li>
  `;
  if (messageEl) messageEl.innerHTML = "";
}

let isInitialLoad = true;

async function renderFavourites() {
  if (!listEl) return;

  const user = getCurrentUser();
  if (!user) {
    isInitialLoad = false;
    listEl.innerHTML = "";
    renderEmptyState();
    return;
  }

  // 1. Show animated brand spinner on initial page load
  if (isInitialLoad) {
    renderLoadingSpinner();
  }

  // 2. Fetch from Firestore (stably sorted newest first)
  const favs = await getFavourites();
  isInitialLoad = false;

  // 3. If empty, show empty state
  if (!favs || favs.length === 0) {
    listEl.innerHTML = "";
    renderEmptyState();
    return;
  }

  if (messageEl) messageEl.innerHTML = "";

  // 4. Render cards
  renderCardsFast(favs);

  // 5. Asynchronously decorate warning badges without rearranging or jumping
  const prefs = getPreferences();
  checkRecipes(favs, prefs)
    .then((checked) => {
      checked.forEach(({ recipe, result }) => {
        const card = listEl.querySelector(`[data-card-id="${recipe.id}"]`);
        if (card) {
          decorateCard(card, result);
        }
      });
    })
    .catch((err) => {
      console.warn("Allergen badges background check:", err);
    });
}

if (listEl) {
  renderFavourites();
  window.addEventListener("auth-changed", () => {
    renderFavourites();
  });
  window.addEventListener("storage", (e) => {
    if (e.key === "recipeplan_user") renderFavourites();
  });
  window.addEventListener("preferences-changed", () => {
    renderFavourites();
  });
  window.addEventListener("favourites-changed", () => {
    // If currently displaying the empty state, re-render to transition into the favourites cards
    if (messageEl && messageEl.innerHTML.trim() !== "") {
      renderFavourites();
    }
  });
}
