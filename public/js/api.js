// Talks to TheMealDB (free recipe API, no key needed). Owner: Person 2.
import { toTitleCase, cleanInstructionText, combineIngredients } from "./utils.js";
import { translateQueryToEnglish } from "./i18n.js";
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

const CULINARY_SYNONYMS = {
  porridge: "congee",
  congee: "porridge",
  wonton: "dumpling",
  dumpling: "wonton",
  dumplings: "wonton",
  potatoes: "potato",
  spaghetti: "pasta",
};

export async function searchRecipes(query) {
  const englishQuery = await translateQueryToEnglish(query);
  let data = await fetchJson(`search.php?s=${encodeURIComponent(englishQuery)}`);

  // If TheMealDB exact substring search returned 0 results, try culinary synonyms (e.g. "chicken porridge" -> "chicken congee")
  if ((!data || !data.meals || data.meals.length === 0) && englishQuery) {
    const words = englishQuery.split(/\s+/);
    let changed = false;
    const newWords = words.map((w) => {
      const lower = w.toLowerCase().replace(/[^a-z]/g, "");
      if (CULINARY_SYNONYMS[lower]) {
        changed = true;
        return CULINARY_SYNONYMS[lower];
      }
      return w;
    });

    if (changed) {
      const synonymQuery = newWords.join(" ");
      const fallbackData = await fetchJson(`search.php?s=${encodeURIComponent(synonymQuery)}`);
      if (fallbackData && fallbackData.meals && fallbackData.meals.length > 0) {
        data = fallbackData;
      }
    }
  }

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

// ---------- Beyond the 25-result cap ----------
// TheMealDB's free name search (search.php?s=) never returns more than 25 meals.
// The category and ingredient filters return every match, so these two helpers use
// them to reach the whole catalogue. Filter results only have id, name, image (and
// category), like filterByCategory; use getRecipeById(id) for the full recipe.

function filterMealToRecipe(meal, extra = {}) {
  return {
    id: String(meal.idMeal),
    name: toTitleCase(meal.strMeal),
    image: meal.strMealThumb,
    category: extra.category || "",
    area: meal.strArea || "",
  };
}

function uniqueById(lists) {
  const seen = new Set();
  const out = [];
  lists.flat().forEach((recipe) => {
    if (!recipe || seen.has(recipe.id)) return;
    seen.add(recipe.id);
    out.push(recipe);
  });
  return out;
}

// Every recipe, gathered category by category and interleaved (one from each category
// in turn) so the list is varied instead of starting with every beef dish.
export async function listAllRecipes() {
  const data = await fetchJson("list.php?c=list");
  const categories = (data.meals || []).map((m) => m.strCategory).filter(Boolean);
  const lists = await Promise.all(categories.map((c) => filterByCategory(c).catch(() => [])));
  const interleaved = [];
  const longest = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < longest; i++) {
    lists.forEach((list) => {
      if (list[i]) interleaved.push(list[i]);
    });
  }
  return uniqueById([interleaved]);
}

// Name search plus meals that use the word as an ingredient ("chicken" -> 20 more) or
// belong to a category of that name. Name matches come first. Same input as searchRecipes.
export async function searchRecipesWide(query) {
  const englishQuery = (await translateQueryToEnglish(query)).trim();
  const byName = await searchRecipes(query);
  if (!englishQuery) return byName;

  const ingredient = englishQuery.toLowerCase().replace(/\s+/g, "_");
  const singular = englishQuery.toLowerCase().replace(/s$/, "");
  const [byIngredient, byCategory] = await Promise.all([
    fetchJson(`filter.php?i=${encodeURIComponent(ingredient)}`)
      .then((d) => (Array.isArray(d.meals) ? d.meals.map((m) => filterMealToRecipe(m)) : []))
      .catch(() => []),
    fetchJson("list.php?c=list")
      .then((d) => (d.meals || []).map((m) => m.strCategory))
      .then((cats) => cats.find((c) => [englishQuery.toLowerCase(), singular].includes(c.toLowerCase())))
      .then((cat) => (cat ? filterByCategory(cat) : []))
      .catch(() => []),
  ]);
  return uniqueById([byName, byCategory, byIngredient]);
}

