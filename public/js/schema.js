// Firestore Database Schema definitions, helpers, and validators.
// Matches the RecipePlan database schema specified in PROJECT_NOTES.md:
//
// users/{uid}
//   displayName, email, createdAt
//   diets: []                 e.g. ["Vegetarian", "Halal"]
//   allergies: []             e.g. ["Peanuts", "Shellfish"]
//   hideFlagged: boolean
//   onboardingComplete: boolean
//   onboardingStep: 1 | 2
//   favourites/{recipeId}     the recipe object + ingredientNames [] + savedAt
//   mealPlan/{weekId}         { Mon: { Breakfast, Lunch, Dinner }, ... }
//   shoppingList/{weekId}     { items: [{ name, measure, checked }] }
//
//   ratings/{recipeId}        { recipeId, ratedAt }  private list of the recipes this user rated,
//                             so deleting the account can find and remove their reviews
//
// recipes/{recipeId}/ratings/{uid}   (Person 3)
//   stars (1 to 5), comment (max 300), displayName (max 60), createdAt

import { db } from "./firebase-config.js";
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

// ==========================================
// 1. PATH RESOLVERS
// ==========================================

export const SchemaPaths = {
  user: (uid) => `users/${uid}`,
  favourites: (uid) => `users/${uid}/favourites`,
  favourite: (uid, recipeId) => `users/${uid}/favourites/${recipeId}`,
  mealPlans: (uid) => `users/${uid}/mealPlan`,
  mealPlan: (uid, weekId) => `users/${uid}/mealPlan/${weekId}`,
  shoppingLists: (uid) => `users/${uid}/shoppingList`,
  shoppingList: (uid, weekId) => `users/${uid}/shoppingList/${weekId}`,
  userRatings: (uid) => `users/${uid}/ratings`,
  userRating: (uid, recipeId) => `users/${uid}/ratings/${recipeId}`,
  ratings: (recipeId) => `recipes/${recipeId}/ratings`,
  rating: (recipeId, uid) => `recipes/${recipeId}/ratings/${uid}`,
};

// Returns current ISO week identifier, e.g. "2026-W44"
export function getCurrentWeekId(d = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

// ==========================================
// 2. SCHEMA FACTORIES & VALIDATORS
// ==========================================

/**
 * Creates a User document data object.
 * Path: users/{uid}
 */
export function createUserDoc({
  displayName = "",
  email = "",
  diets = [],
  allergies = [],
  hideFlagged = false,
  onboardingComplete = false,
  onboardingStep = 1,
}) {
  return {
    displayName: String(displayName || "").trim(),
    email: String(email || "").trim(),
    diets: Array.isArray(diets) ? [...diets] : [],
    allergies: Array.isArray(allergies) ? [...allergies] : [],
    hideFlagged: Boolean(hideFlagged),
    onboardingComplete: Boolean(onboardingComplete),
    onboardingStep: onboardingStep === 2 ? 2 : 1,
    createdAt: serverTimestamp(),
  };
}

/**
 * Creates a Favourite document data object.
 * Path: users/{uid}/favourites/{recipeId}
 */
export function createFavouriteDoc(recipe) {
  if (!recipe || !recipe.id) {
    throw new Error("Recipe must have a valid id to be saved as favourite");
  }

  return {
    id: String(recipe.id),
    name: String(recipe.name || recipe.title || ""),
    image: String(recipe.image || ""),
    category: String(recipe.category || ""),
    area: String(recipe.area || ""),
    savedAt: serverTimestamp(),
  };
}

/**
 * Creates a Meal Plan document data object for a given week.
 * Path: users/{uid}/mealPlan/{weekId}
 */
export function createMealPlanDoc(plan = {}) {
  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const MEALS = ["Breakfast", "Lunch", "Dinner"];
  const docData = {};

  DAYS.forEach((day) => {
    docData[day] = {};
    MEALS.forEach((meal) => {
      const entry = plan[day]?.[meal];
      docData[day][meal] = entry
        ? {
            id: String(entry.id || "0"),
            name: String(entry.name || ""),
            image: String(entry.image || ""),
            ...(Array.isArray(entry.ingredients) ? { ingredients: entry.ingredients } : {}),
          }
        : null;
    });
  });

  return docData;
}

/**
 * Creates a Shopping List document data object for a given week.
 * Path: users/{uid}/shoppingList/{weekId}
 */
export function createShoppingListDoc(items = []) {
  const normalized = (Array.isArray(items) ? items : []).map((item) => ({
    name: String(item.name || "").trim(),
    measure: String(item.measure || "").trim(),
    checked: Boolean(item.checked),
  }));
  return {
    items: normalized,
    checked: normalized.filter((item) => item.checked).map((item) => item.name.toLowerCase()),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Creates a Recipe Rating document data object.
 * Path: recipes/{recipeId}/ratings/{uid}
 */
export function createRatingDoc({ stars, comment = "", displayName = "" }) {
  const numStars = Math.max(1, Math.min(5, Math.round(Number(stars) || 5)));
  // Same limits as firestore.rules, which rejects anything longer.
  return {
    stars: numStars,
    comment: String(comment || "").trim().slice(0, 300),
    displayName: String(displayName || "").trim().slice(0, 60) || "Anonymous",
    createdAt: serverTimestamp(),
  };
}

// ==========================================
// 3. FIRESTORE CRUD OPERATIONS
// ==========================================

// --- Favourites ---
export async function saveUserFavourite(uid, recipe) {
  if (!uid || !recipe?.id) return;
  const docRef = doc(db, SchemaPaths.favourite(uid, recipe.id));
  const data = createFavouriteDoc(recipe);
  await setDoc(docRef, data, { merge: true });
  return data;
}

export async function deleteUserFavourite(uid, recipeId) {
  if (!uid || !recipeId) return;
  const docRef = doc(db, SchemaPaths.favourite(uid, recipeId));
  await deleteDoc(docRef);
}

export async function fetchUserFavourites(uid) {
  if (!uid) return [];
  const colRef = collection(db, SchemaPaths.favourites(uid));
  try {
    const q = query(colRef, orderBy("savedAt", "desc"));
    const snap = await getDocs(q);
    const results = [];
    snap.forEach((d) => results.push(d.data()));
    return results;
  } catch (err) {
    const snap = await getDocs(colRef);
    const results = [];
    snap.forEach((d) => results.push(d.data()));
    return results;
  }
}

// --- Meal Plan ---
export async function saveUserMealPlan(uid, weekId, plan) {
  if (!uid) return;
  const resolvedWeekId = weekId || getCurrentWeekId();
  const docRef = doc(db, SchemaPaths.mealPlan(uid, resolvedWeekId));
  const data = createMealPlanDoc(plan);
  await setDoc(docRef, data);
  return data;
}

export async function fetchUserMealPlan(uid, weekId) {
  if (!uid) return null;
  const resolvedWeekId = weekId || getCurrentWeekId();
  const docRef = doc(db, SchemaPaths.mealPlan(uid, resolvedWeekId));
  const snap = await getDoc(docRef);
  return snap.exists() ? snap.data() : null;
}

// --- Shopping List ---
export async function saveUserShoppingList(uid, weekId, items) {
  if (!uid) return;
  const resolvedWeekId = weekId || getCurrentWeekId();
  const docRef = doc(db, SchemaPaths.shoppingList(uid, resolvedWeekId));
  const data = createShoppingListDoc(items);
  await setDoc(docRef, data);
  return data;
}

export async function fetchUserShoppingList(uid, weekId) {
  if (!uid) return null;
  const resolvedWeekId = weekId || getCurrentWeekId();
  const docRef = doc(db, SchemaPaths.shoppingList(uid, resolvedWeekId));
  const snap = await getDoc(docRef);
  return snap.exists() ? snap.data() : null;
}

// --- Recipe Ratings ---
export async function saveRecipeRating(recipeId, uid, { stars, comment, displayName }) {
  if (!recipeId || !uid) throw new Error("recipeId and uid are required to rate");
  const docRef = doc(db, SchemaPaths.rating(recipeId, uid));
  const data = createRatingDoc({ stars, comment, displayName });
  await setDoc(docRef, data);
  // Remember the recipe on the user's own (private) list, so deleteUserData can find this review.
  await setDoc(doc(db, SchemaPaths.userRating(uid, recipeId)), {
    recipeId: String(recipeId),
    ratedAt: serverTimestamp(),
  }).catch((e) => console.warn("Could not record rated recipe:", e));
  return data;
}

export async function fetchRecipeRatings(recipeId) {
  if (!recipeId) return [];
  const colRef = collection(db, SchemaPaths.ratings(recipeId));
  const q = query(colRef, orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  const list = [];
  snap.forEach((d) => {
    list.push({ uid: d.id, ...d.data() });
  });
  return list;
}

export async function fetchUserRating(recipeId, uid) {
  if (!recipeId || !uid) return null;
  const docRef = doc(db, SchemaPaths.rating(recipeId, uid));
  const snap = await getDoc(docRef);
  return snap.exists() ? { uid: snap.id, ...snap.data() } : null;
}

export async function deleteRecipeRating(recipeId, uid) {
  if (!recipeId || !uid) throw new Error("recipeId and uid are required to delete rating");
  const docRef = doc(db, SchemaPaths.rating(recipeId, uid));
  await deleteDoc(docRef);
  await deleteDoc(doc(db, SchemaPaths.userRating(uid, recipeId))).catch(() => {});
  return true;
}

// --- Account deletion ---
// Firestore does not delete subcollections with their parent, so remove every
// document the user owns: their reviews, favourites, meal plans, shopping lists
// and finally users/{uid}.
export async function deleteUserData(uid) {
  if (!uid) return;
  const listIds = async (path) => {
    const snap = await getDocs(collection(db, path));
    return snap.docs.map((d) => d.id);
  };
  const [ratedIds, favouriteIds, planIds, listIdsShopping] = await Promise.all([
    listIds(SchemaPaths.userRatings(uid)),
    listIds(SchemaPaths.favourites(uid)),
    listIds(SchemaPaths.mealPlans(uid)),
    listIds(SchemaPaths.shoppingLists(uid)),
  ]);

  // Reviews written before the rated list existed are not on it, so also try
  // every favourite (a missing review is simply a no-op delete).
  const reviewRecipeIds = [...new Set([...ratedIds, ...favouriteIds])];
  await Promise.all(
    reviewRecipeIds.map((recipeId) => deleteDoc(doc(db, SchemaPaths.rating(recipeId, uid))).catch(() => {}))
  );

  const userDocs = [
    ...ratedIds.map((id) => SchemaPaths.userRating(uid, id)),
    ...favouriteIds.map((id) => SchemaPaths.favourite(uid, id)),
    ...planIds.map((id) => SchemaPaths.mealPlan(uid, id)),
    ...listIdsShopping.map((id) => SchemaPaths.shoppingList(uid, id)),
  ];
  await Promise.all(userDocs.map((path) => deleteDoc(doc(db, path))));
  await deleteDoc(doc(db, SchemaPaths.user(uid)));
}
