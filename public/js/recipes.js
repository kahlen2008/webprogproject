// Home page (search) and recipe detail page. Owner: Person 2.
// This is a small working starting point. Build the rest of your happy path from here.

import { searchRecipes, getRecipeById } from "./api.js";
import { createRecipeCard, escapeHtml } from "./utils.js";

// ---------- Home page: search ----------
const searchForm = document.getElementById("search-form");
const results = document.getElementById("results");
const message = document.getElementById("results-message");

async function runSearch(query) {
  results.innerHTML = "";
  message.className = "";
  message.textContent = "Loading recipes...";
  try {
    const recipes = await searchRecipes(query);
    if (recipes.length === 0) {
      message.className = "empty-state";
      message.textContent = `No recipes found for "${query}". Try another word.`;
      return;
    }
    message.textContent = "";
    recipes.forEach((recipe) => results.appendChild(createRecipeCard(recipe)));
  } catch (error) {
    message.className = "error-state";
    message.textContent = "Could not load recipes. Check your internet connection and try again.";
  }
}

if (searchForm) {
  searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const query = searchForm.query.value.trim();
    if (query) runSearch(query);
  });
  runSearch("chicken"); // something to show on first visit
  // TODO (Person 2): category chips, cuisine filter, "Clear filters", featured recipes.
}

// ---------- Recipe page ----------
const detail = document.getElementById("recipe-detail");

async function showRecipe(id) {
  detail.textContent = "Loading recipe...";
  try {
    const recipe = await getRecipeById(id);
    if (!recipe) {
      detail.innerHTML = '<p class="empty-state">That recipe could not be found.</p>';
      return;
    }
    document.title = `${recipe.name} | Recipe Planner`;
    detail.innerHTML = `
      <h1>${escapeHtml(recipe.name)}</h1>
      <img src="${escapeHtml(recipe.image)}" alt="${escapeHtml(recipe.name)}">
      <h2>Ingredients</h2>
      <ul>${recipe.ingredients.map((i) => `<li>${escapeHtml(i.measure)} ${escapeHtml(i.name)}</li>`).join("")}</ul>
      <h2>Instructions</h2>
      <p>${escapeHtml(recipe.instructions)}</p>`;
    // TODO (Person 2): serving size scaler, numbered steps, video link, two-column layout.
    // TODO (Person 3): favourite button. TODO (Person 4): "Add to meal plan" button.
  } catch (error) {
    detail.innerHTML = '<p class="error-state">Could not load this recipe. Please try again.</p>';
  }
}

if (detail) {
  const id = new URLSearchParams(window.location.search).get("id");
  if (id) {
    showRecipe(id);
  } else {
    detail.innerHTML = '<p class="empty-state">No recipe selected. <a href="index.html">Browse recipes</a>.</p>';
  }
}
