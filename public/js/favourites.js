// Favourites. Owner: Person 3.
// Data lives in Firestore at:  users/{uid}/favourites/{recipeId}
// Fields: recipeId (string), name, image, category, addedAt (serverTimestamp())
//
// Other people import these five functions, so keep the names exactly as they are.
// Useful imports when you build them:
//   import { auth, db } from "./firebase-config.js";
//   import { doc, setDoc, deleteDoc, getDoc, getDocs, collection, onSnapshot, serverTimestamp }
//     from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
//   import { getCurrentUser } from "./auth.js";

// Saves a recipe as a favourite for the current user.
export async function addFavourite(recipe) {
  // TODO: setDoc(doc(db, "users", uid, "favourites", recipe.id), { recipeId, name, image, category, addedAt })
}

// Removes a favourite.
export async function removeFavourite(recipeId) {
  // TODO: deleteDoc(...)
}

// Returns an array of favourite recipes, newest first.
export async function getFavourites() {
  // TODO: getDocs(collection(db, "users", uid, "favourites"))
  return [];
}

// Returns true if this recipe is already a favourite.
export async function isFavourite(recipeId) {
  // TODO: getDoc(...).exists()
  return false;
}

// Calls callback(favouritesArray) now and whenever favourites change. Returns an unsubscribe function.
export function watchFavourites(callback) {
  // TODO: onSnapshot(collection(...), (snapshot) => callback(...))
  return () => {};
}

// ---------- Favourites page ----------
// TODO (Person 3): render saved recipes with createRecipeCard from utils.js,
// sort and filter, empty state with a "Browse recipes" button, heart buttons on recipe cards.
