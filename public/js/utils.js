// Small helpers shared by every page. Anyone may add to this file, but tell the team when you do.

// Makes text safe to put inside HTML (stops a recipe name from breaking the page).
export function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text == null ? "" : String(text);
  return div.innerHTML;
}

// Shows a short message at the bottom of the screen, for example "Saved to favourites".
export function showToast(message, milliseconds = 3000) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.setAttribute("role", "status");
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), milliseconds);
}

// The shared recipe card used on the home page and the favourites page.
// Pass any object with { id, name, image, category }. Returns an <li> element.
// The empty .card-heart-slot is where Person 3 adds the favourite button.
export function createRecipeCard(recipe) {
  const item = document.createElement("li");
  item.className = "card";
  item.innerHTML = `
    <div class="card-heart-slot" data-recipe-id="${escapeHtml(recipe.id)}"></div>
    <a href="recipe.html?id=${encodeURIComponent(recipe.id)}">
      <img src="${escapeHtml(recipe.image)}" alt="${escapeHtml(recipe.name)}" loading="lazy">
    </a>
    <div class="card-body">
      <h3 class="card-title"><a href="recipe.html?id=${encodeURIComponent(recipe.id)}">${escapeHtml(recipe.name)}</a></h3>
      ${recipe.category ? `<span class="tag">${escapeHtml(recipe.category)}</span>` : ""}
    </div>`;
  return item;
}
