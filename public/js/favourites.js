// Favourites page logic and Firestore/localStorage sync.
// Owner: Person 3.
// Firestore Schema: users/{uid}/favourites/{recipeId}
// Document fields: { id, name, image, category, area, ingredientNames, savedAt }
// ingredientNames lets the favourites page check allergens without calling TheMealDB again.

import { createRecipeCard, showToast } from "./utils.js";
import { getCurrentUser, onAuthChange } from "./auth.js";
import { db, auth } from "./firebase-config.js";
import { getPreferences, checkRecipes, decorateCard, getIngredientNames } from "./preferences.js";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  onSnapshot,
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
      snap.forEach((d) => rawFavs.push(d.data({ serverTimestamps: "estimate" })));

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
      // Cards from search and category results have no ingredients, so this may
      // look them up once (getIngredientNames caches the answer).
      const ingredientNames = await resolveIngredientNames(recipe);
      const docRef = doc(db, "users", user.uid, "favourites", String(recipe.id));
      await setDoc(docRef, {
        ...data,
        ingredientNames,
        savedAt: serverTimestamp(),
      });
    } catch (err) {
      console.warn("Could not save favourite to Firestore:", err);
    }
  }
}

// ---------- Ingredient names (for allergen checks without extra API calls) ----------

function cleanIngredientNames(names) {
  const seen = new Set();
  const out = [];
  (names || []).forEach((n) => {
    const name = String(typeof n === "string" ? n : n?.name || "").trim();
    const key = name.toLowerCase();
    if (name && !seen.has(key)) {
      seen.add(key);
      out.push(name);
    }
  });
  return out;
}

async function resolveIngredientNames(recipe) {
  if (Array.isArray(recipe.ingredientNames) && recipe.ingredientNames.length) {
    return cleanIngredientNames(recipe.ingredientNames);
  }
  try {
    return cleanIngredientNames(await getIngredientNames(recipe));
  } catch (e) {
    return [];
  }
}

// Gives the shared allergen checker the stored names, so it does not fetch the recipe.
function withStoredIngredients(fav) {
  if (Array.isArray(fav.ingredientNames) && fav.ingredientNames.length) {
    return { ...fav, ingredients: fav.ingredientNames };
  }
  return fav;
}

// Favourites saved before ingredientNames existed (or saved by the card heart
// buttons, which write to Firestore directly) get the field added once.
// updateDoc fails on a deleted document, so a favourite removed meanwhile is not recreated.
const backfillAttempted = new Set();
async function backfillIngredientNames(uid, favs) {
  const missing = favs.filter(
    (f) => f && f.id && !Array.isArray(f.ingredientNames) && !backfillAttempted.has(`${uid}/${f.id}`)
  );
  for (const fav of missing) {
    backfillAttempted.add(`${uid}/${fav.id}`);
    const ingredientNames = await resolveIngredientNames(fav);
    if (!ingredientNames.length) continue;
    try {
      await updateDoc(doc(db, "users", uid, "favourites", String(fav.id)), { ingredientNames });
    } catch (err) {
      // Removed in the meantime, or offline: nothing to do.
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

/**
 * Calls callback(favs) now and whenever the user's favourites change, on this
 * device or any other. Uses a Firestore onSnapshot listener while signed in,
 * and the localStorage cache when signed out or offline.
 * Returns a function that stops watching.
 */
export function watchFavourites(callback) {
  let unsubscribeCloud = null;
  let watchedUid = null;
  let stopped = false;
  let authResolved = false;

  // pending: a signed-in user is cached but Firebase has not restored the session yet,
  // so the cloud list is still on its way.
  const emitLocal = () => {
    if (stopped) return;
    const user = getCurrentUser();
    callback(user ? getLocalFavourites() : [], { pending: Boolean(user) && !authResolved });
  };

  const subscribe = () => {
    if (stopped) return;
    // Only listen once Firebase has restored the session; the cached user in
    // localStorage is not enough for the security rules.
    const uid = auth?.currentUser?.uid || null;
    if (uid && uid === watchedUid && unsubscribeCloud) return;

    if (unsubscribeCloud) unsubscribeCloud();
    unsubscribeCloud = null;
    watchedUid = uid;

    if (!uid) {
      emitLocal();
      return;
    }

    const colRef = collection(db, "users", uid, "favourites");
    unsubscribeCloud = onSnapshot(
      colRef,
      (snap) => {
        const raw = [];
        snap.forEach((d) => raw.push(d.data({ serverTimestamps: "estimate" })));
        const favs = sortBySavedAtDesc(raw);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(favs));
        } catch (e) {}
        if (!stopped) callback(favs, { pending: false });
        backfillIngredientNames(uid, favs);
      },
      (err) => {
        console.warn("Live favourites unavailable, using local cache:", err);
        unsubscribeCloud = null;
        watchedUid = null;
        emitLocal();
      }
    );
  };

  // Local changes still matter when there is no live listener (signed out, offline).
  const onLocalChange = () => {
    if (!unsubscribeCloud) emitLocal();
  };

  const stopAuth = onAuthChange(() => {
    authResolved = true;
    subscribe();
  });
  window.addEventListener("auth-changed", subscribe);
  window.addEventListener("favourites-changed", onLocalChange);
  window.addEventListener("storage", onLocalChange);
  subscribe();

  return () => {
    stopped = true;
    if (unsubscribeCloud) unsubscribeCloud();
    if (typeof stopAuth === "function") stopAuth();
    window.removeEventListener("auth-changed", subscribe);
    window.removeEventListener("favourites-changed", onLocalChange);
    window.removeEventListener("storage", onLocalChange);
  };
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
  setToolbarVisible(false);
  if (!user) {
    currentView = "logged-out";
    renderLoggedOutEmptyState();
    return;
  }

  if (!messageEl) return;
  currentView = "empty";
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

        const triggerRemovalToast = () => {
          showToast(`Removed "${recipe.name}" from favourites`, {
            duration: 5000,
            action: {
              label: "Undo",
              onClick: async () => {
                await addFavourite(recipe);
                await renderFavourites();
                showToast(`Restored "${recipe.name}" to favourites!`);
              },
            },
          });
        };

        // If this was the last card shown, animate it out, then show what is left
        // (the empty state, or the other categories when a filter was active)
        if (siblingCards.length === 0) {
          card.style.transition = "opacity 0.22s ease-out, transform 0.22s ease-out";
          card.style.opacity = "0";
          card.style.transform = "scale(0.85)";
          setTimeout(async () => {
            await removeFavourite(recipe.id);
            card.remove();
            renderPage(allFavourites.filter((f) => String(f.id) !== String(recipe.id)));
            triggerRemovalToast();
          }, 200);
          return;
        }

        // 2. Clone card as an absolute ghost overlay to fade out at its exact spot
        const ghost = card.cloneNode(true);
        ghost.removeAttribute("data-card-id"); // so live updates don't count it as a shown card
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
        triggerRemovalToast();
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

// ---------- Sort and filter ----------
const toolbarEl = document.getElementById("favourites-toolbar");
const sortBtn = document.getElementById("favourites-sort-btn");
const sortMenu = document.getElementById("favourites-sort-menu");
const sortLabel = document.getElementById("favourites-sort-label");
const sortChevron = document.getElementById("favourites-sort-chevron");
const countEl = document.getElementById("favourites-count");

const SORTERS = {
  newest: (items) => sortBySavedAtDesc(items),
  oldest: (items) => sortBySavedAtDesc(items).reverse(),
  "name-asc": (items) => [...items].sort((a, b) => String(a.name).localeCompare(String(b.name))),
  "name-desc": (items) => [...items].sort((a, b) => String(b.name).localeCompare(String(a.name))),
};
const SORT_KEY = "recipeplan_favourites_sort";

const CATEGORY_EMOJI = {
  Beef: "🥩", Breakfast: "🍳", Chicken: "🍗", Dessert: "🍰", Goat: "🐐", Lamb: "🍖",
  Miscellaneous: "🍽️", Pasta: "🍝", Pork: "🥓", Seafood: "🍤", Side: "🥔",
  Starter: "🥟", Vegan: "🌱", Vegetarian: "🥗",
};

let allFavourites = [];
let currentView = null; // "loading" | "logged-out" | "empty" | "cards"
let selectedCategory = "all";
let selectedSort = "newest";
let chipSignature = "";

try {
  const saved = localStorage.getItem(SORT_KEY);
  if (saved && SORTERS[saved]) selectedSort = saved;
} catch (e) {}

function setToolbarVisible(visible) {
  if (toolbarEl) toolbarEl.classList.toggle("hidden", !visible);
  if (countEl && !visible) countEl.textContent = "";
  if (!visible) closeAllMenus();
}

function categoryOf(fav) {
  return String(fav.category || "Main");
}

// ----- Popover menus (sort menu and "More" categories) -----
// A button that opens a listbox. Arrow keys, Home and End move, Enter or Space picks,
// Escape or Tab closes, and a click outside closes it.
const openMenus = new Set();

function createMenu({ button, menu, chevron, onChoose }) {
  if (!button || !menu) return { open() {}, close() {}, isOpen: () => false };

  const options = () => Array.from(menu.querySelectorAll('[role="option"]'));

  const api = {
    isOpen: () => button.getAttribute("aria-expanded") === "true",
    open() {
      openMenus.forEach((m) => m !== api && m.close(false));
      openMenus.add(api);
      menu.classList.remove("hidden");
      button.setAttribute("aria-expanded", "true");
      chevron?.classList.add("rotate-180");
      requestAnimationFrame(() => {
        menu.classList.remove("opacity-0", "scale-95");
        menu.classList.add("opacity-100", "scale-100");
      });
      const opts = options();
      (opts.find((o) => o.getAttribute("aria-selected") === "true") || opts[0])?.focus();
    },
    close(returnFocus = true) {
      openMenus.delete(api);
      if (!api.isOpen()) return;
      button.setAttribute("aria-expanded", "false");
      chevron?.classList.remove("rotate-180");
      menu.classList.add("opacity-0", "scale-95");
      menu.classList.remove("opacity-100", "scale-100");
      setTimeout(() => {
        if (!api.isOpen()) menu.classList.add("hidden");
      }, 150);
      if (returnFocus) button.focus();
    },
  };

  button.addEventListener("click", () => (api.isOpen() ? api.close() : api.open()));
  button.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      api.open();
    }
  });

  menu.addEventListener("click", (e) => {
    const opt = e.target.closest('[role="option"]');
    if (!opt) return;
    api.close();
    onChoose(opt.dataset.value);
  });

  menu.addEventListener("keydown", (e) => {
    const opts = options();
    const index = opts.indexOf(document.activeElement);
    const focusAt = (i) => opts[(i + opts.length) % opts.length]?.focus();
    switch (e.key) {
      case "ArrowDown": e.preventDefault(); focusAt(index + 1); break;
      case "ArrowUp": e.preventDefault(); focusAt(index - 1); break;
      case "Home": e.preventDefault(); focusAt(0); break;
      case "End": e.preventDefault(); focusAt(opts.length - 1); break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (index >= 0) {
          api.close();
          onChoose(opts[index].dataset.value);
        }
        break;
      case "Escape": e.preventDefault(); api.close(); break;
      case "Tab": api.close(false); break;
    }
  });

  document.addEventListener("click", (e) => {
    if (api.isOpen() && !menu.contains(e.target) && !button.contains(e.target)) api.close(false);
  });

  return api;
}

function closeAllMenus() {
  openMenus.forEach((m) => m.close(false));
}

// ----- Category menu -----
// One dropdown listing "All categories" and every category the user has saved,
// most-used first, each with its count. The chosen one gets a tick.
const categoryBtn = document.getElementById("favourites-category-btn");
const categoryMenu = document.getElementById("favourites-category-menu");
const categoryLabel = document.getElementById("favourites-category-label");
const categoryCount = document.getElementById("favourites-category-count");
const COUNT_BADGE = "shrink-0 min-w-[1.25rem] px-1.5 py-px rounded-full text-[11px] font-bold leading-4 text-center bg-[#f5ebe4] text-[#a04e28]";

function escapeAttr(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function categoryOptionHtml({ value, label, count, emoji }) {
  const on = value === selectedCategory;
  return `
    <li role="option" tabindex="-1" aria-selected="${on}" data-value="${escapeAttr(value)}" class="sort-option">
      <span class="flex items-center gap-2 min-w-0 flex-1">
        <span class="w-5 text-center shrink-0" aria-hidden="true">${emoji}</span>
        <span class="truncate">${escapeAttr(label)}</span>
      </span>
      <span class="${COUNT_BADGE}">${count}</span>
    </li>`;
}

// Rebuilds the menu from the current favourites, keeping the selection if that category still exists.
function updateCategoryMenu(favs) {
  const counts = new Map();
  favs.forEach((f) => counts.set(categoryOf(f), (counts.get(categoryOf(f)) || 0) + 1));
  if (selectedCategory !== "all" && !counts.has(selectedCategory)) selectedCategory = "all";

  const categories = [...counts.keys()].sort((a, b) => counts.get(b) - counts.get(a) || a.localeCompare(b));
  const options = [
    { value: "all", label: "All categories", count: favs.length, emoji: "❤️" },
    ...categories.map((c) => ({ value: c, label: c, count: counts.get(c), emoji: CATEGORY_EMOJI[c] || "🍽️" })),
  ];

  // Button shows the current choice.
  const current = options.find((o) => o.value === selectedCategory) || options[0];
  if (categoryLabel) categoryLabel.textContent = current.label;
  if (categoryCount) categoryCount.textContent = String(current.count);
  categoryBtn?.setAttribute("data-active", String(selectedCategory !== "all"));

  // Only redraw the list when something changed, so keyboard focus inside an open menu is kept.
  const signature = `${selectedCategory}|${options.map((o) => `${o.value}:${o.count}`).join(",")}`;
  if (signature === chipSignature || !categoryMenu) return;
  chipSignature = signature;

  categoryMenu.innerHTML =
    `<li class="px-3 pt-1.5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-stone-400" role="presentation">Category</li>` +
    categoryOptionHtml(options[0]) +
    (options.length > 1 ? `<li class="my-1 border-t border-[#f1e8de]" role="presentation"></li>` : "") +
    options.slice(1).map(categoryOptionHtml).join("");
}

createMenu({
  button: categoryBtn,
  menu: categoryMenu,
  chevron: document.getElementById("favourites-category-chevron"),
  onChoose: (value) => {
    if (value == null || value === selectedCategory) return;
    selectedCategory = value;
    renderPage(allFavourites);
  },
});

// ----- Sort menu -----
function syncSortUi() {
  sortMenu?.querySelectorAll(".sort-option").forEach((opt) => {
    const on = opt.dataset.value === selectedSort;
    opt.setAttribute("aria-selected", String(on));
    if (on && sortLabel) sortLabel.textContent = opt.textContent.trim();
  });
}

createMenu({
  button: sortBtn,
  menu: sortMenu,
  chevron: sortChevron,
  onChoose: (value) => {
    if (!SORTERS[value] || value === selectedSort) return;
    selectedSort = value;
    try {
      localStorage.setItem(SORT_KEY, value);
    } catch (e) {}
    syncSortUi();
    renderPage(allFavourites);
  },
});

syncSortUi();

// ----- FLIP animation for sorting, filtering and live updates -----
// First: remember where each card is. Last: render. Invert: move each card back
// to its old spot. Play: let it glide to the new one. New cards fade in, and
// cards that left fade out where they were.
const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)");

function captureCardPositions() {
  const map = new Map();
  if (!listEl) return map;
  listEl.querySelectorAll(".recipe-card[data-card-id]").forEach((el) => {
    map.set(el.getAttribute("data-card-id"), { el, rect: el.getBoundingClientRect() });
  });
  return map;
}

function playCardFlip(before) {
  if (!listEl || !before.size || reduceMotion?.matches) return;

  const listRect = listEl.getBoundingClientRect();
  const moved = [];
  const entering = [];
  const ghosts = [];
  const present = new Set();

  listEl.querySelectorAll(".recipe-card[data-card-id]").forEach((el) => {
    const id = el.getAttribute("data-card-id");
    present.add(id);
    const old = before.get(id);
    el.style.transition = "none";
    if (old) {
      const now = el.getBoundingClientRect();
      const dx = old.rect.left - now.left;
      const dy = old.rect.top - now.top;
      if (dx || dy) {
        el.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
        moved.push(el);
      }
    } else {
      el.style.opacity = "0";
      el.style.transform = "scale(0.94)";
      entering.push(el);
    }
  });

  // Cards that are no longer shown fade out from where they were.
  before.forEach(({ el, rect }, id) => {
    if (present.has(id)) return;
    const ghost = el;
    ghost.removeAttribute("data-card-id");
    Object.assign(ghost.style, {
      position: "absolute",
      left: `${rect.left - listRect.left}px`,
      top: `${rect.top - listRect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      margin: "0",
      zIndex: "0",
      pointerEvents: "none",
      transition: "none",
      transform: "",
      opacity: "1",
    });
    ghost.setAttribute("aria-hidden", "true");
    listEl.appendChild(ghost);
    ghosts.push(ghost);
  });

  void listEl.offsetHeight; // apply the inverted positions before animating

  requestAnimationFrame(() => {
    const ease = "cubic-bezier(0.2, 0.8, 0.2, 1)";
    moved.forEach((el) => {
      el.style.transition = `transform 0.4s ${ease}`;
      el.style.transform = "";
    });
    entering.forEach((el, i) => {
      const delay = Math.min(i, 8) * 30;
      el.style.transition = `opacity 0.3s ease-out ${delay}ms, transform 0.4s ${ease} ${delay}ms`;
      el.style.opacity = "";
      el.style.transform = "";
    });
    ghosts.forEach((g) => {
      g.style.transition = "opacity 0.2s ease-out, transform 0.25s ease-out";
      g.style.opacity = "0";
      g.style.transform = "scale(0.9)";
    });

    setTimeout(() => {
      ghosts.forEach((g) => g.remove());
      [...moved, ...entering].forEach((el) => {
        el.style.transition = "";
        el.style.transform = "";
        el.style.opacity = "";
      });
    }, 680);
  });
}
function getVisibleFavourites(favs) {
  const sorter = SORTERS[selectedSort] || SORTERS.newest;
  const filtered = selectedCategory === "all" ? favs : favs.filter((f) => categoryOf(f) === selectedCategory);
  return sorter(filtered);
}

function updateCount(visibleCount, totalCount) {
  if (!countEl) return;
  const noun = (n) => (n === 1 ? "recipe" : "recipes");
  countEl.textContent =
    visibleCount === totalCount
      ? `${totalCount} saved ${noun(totalCount)}`
      : `Showing ${visibleCount} of ${totalCount} saved ${noun(totalCount)}`;
}

// Ids of the cards currently on screen, in order (ghost cards from the remove animation have no id).
function shownCardKey() {
  if (!listEl) return "";
  return Array.from(listEl.querySelectorAll(".recipe-card[data-card-id]"))
    .map((c) => c.getAttribute("data-card-id"))
    .join(",");
}

// Adds allergen / diet badges using the stored ingredientNames, so no extra API calls.
function decorateBadges(favs) {
  const prefs = getPreferences();
  checkRecipes(favs.map(withStoredIngredients), prefs)
    .then((checked) => {
      checked.forEach(({ recipe, result }) => {
        const card = listEl.querySelector(`[data-card-id="${recipe.id}"]`);
        if (card) decorateCard(card, result);
      });
    })
    .catch((err) => {
      console.warn("Allergen badges background check:", err);
    });
}

function renderPage(favs, { pending = false } = {}) {
  if (!listEl) return;
  allFavourites = Array.isArray(favs) ? favs : [];

  if (!getCurrentUser()) {
    listEl.innerHTML = "";
    renderEmptyState();
    return;
  }

  if (!allFavourites.length) {
    if (pending) {
      // Signed in, waiting for the cloud list: show the spinner, not "no favourites yet".
      if (currentView !== "loading") {
        setToolbarVisible(false);
        renderLoadingSpinner();
        currentView = "loading";
      }
      return;
    }
    if (currentView === "empty" && !listEl.querySelector(".recipe-card")) return;
    listEl.innerHTML = "";
    renderEmptyState();
    return;
  }

  setToolbarVisible(true);
  updateCategoryMenu(allFavourites);
  const visible = getVisibleFavourites(allFavourites);
  updateCount(visible.length, allFavourites.length);

  // Skip the redraw when the same cards are already shown in the same order
  // (for example right after a remove animation), but refresh the badges.
  const key = visible.map((f) => String(f.id)).join(",");
  if (currentView === "cards" && key === shownCardKey()) {
    decorateBadges(visible);
    return;
  }

  if (messageEl) messageEl.innerHTML = "";
  const before = currentView === "cards" ? captureCardPositions() : new Map();
  renderCardsFast(visible);
  playCardFlip(before);
  currentView = "cards";
  decorateBadges(visible);
}

// Used by Undo: re-reads favourites once (the live listener also catches the change).
async function renderFavourites() {
  renderPage(await getFavourites());
}

if (listEl) {
  if (getCurrentUser()) {
    renderLoadingSpinner();
    currentView = "loading";
  }

  watchFavourites((favs, info) => renderPage(favs, info));

  window.addEventListener("preferences-changed", () => {
    if (currentView === "cards") decorateBadges(getVisibleFavourites(allFavourites));
  });
}
