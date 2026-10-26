// Talks to TheMealDB (free recipe API, no key needed). Owner: Person 2.
import { toTitleCase, cleanInstructionText, combineIngredients } from "./utils.js";
// Everyone else gets recipes from here, so keep the recipe object shape stable:
//
// {
//   id: "52772",             // string
//   name: "Teriyaki Chicken Casserole",
//   image: "https://...",
//   category: "Chicken",
//   area: "Japanese",
//   instructions: "...",
//   youtube: "https://...",
//   ingredients: [{ name: "soy sauce", measure: "3/4 cup" }]
// }
//
// Recipes from filterByCategory only have id, name, image and category
// (the API does not send the rest). Use getRecipeById(id) for the full recipe.

const BASE_URL = "https://www.themealdb.com/api/json/v1/1";

// Fetches JSON and remembers the answer for this browser tab, so repeat searches are instant.
async function fetchJson(path) {
  const cacheKey = "mealdb:" + path;
  try {
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch (error) {
    // sessionStorage can be unavailable. Carry on without the cache.
  }

  const response = await fetch(`${BASE_URL}/${path}`);
  if (!response.ok) {
    throw new Error(`Recipe service error (${response.status})`);
  }
  const data = await response.json();

  try {
    sessionStorage.setItem(cacheKey, JSON.stringify(data));
  } catch (error) {
    // Ignore: the cache is only a bonus.
  }
  return data;
}

// Turns TheMealDB's raw meal (strIngredient1 ... strIngredient20) into our recipe object.
export function normalizeRecipe(meal) {
  const rawIngredients = [];
  for (let i = 1; i <= 20; i++) {
    const name = (meal[`strIngredient${i}`] || "").trim();
    const measure = (meal[`strMeasure${i}`] || "").trim();
    if (name) rawIngredients.push({ name, measure });
  }
  return {
    id: String(meal.idMeal),
    name: toTitleCase(meal.strMeal),
    image: meal.strMealThumb,
    category: meal.strCategory || "",
    area: meal.strArea || "",
    instructions: cleanInstructionText(meal.strInstructions || ""),
    youtube: meal.strYoutube || "",
    ingredients: combineIngredients(rawIngredients),
  };
}

export async function searchRecipes(query) {
  const data = await fetchJson(`search.php?s=${encodeURIComponent(query)}`);
  return (data.meals || []).map(normalizeRecipe);
}

export async function getRecipeById(id) {
  const data = await fetchJson(`lookup.php?i=${encodeURIComponent(id)}`);
  return data.meals ? normalizeRecipe(data.meals[0]) : null;
}

export async function listCategories() {
  const data = await fetchJson("categories.php");
  return (data.categories || []).map((category) => category.strCategory);
}

export async function filterByCategory(category) {
  const data = await fetchJson(`filter.php?c=${encodeURIComponent(category)}`);
  return (data.meals || []).map((meal) => ({
    id: String(meal.idMeal),
    name: toTitleCase(meal.strMeal),
    image: meal.strMealThumb,
    category: category,
  }));
}
