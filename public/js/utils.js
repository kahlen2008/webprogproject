// Shared helpers for RecipePlan with modern Tailwind aesthetics.

// Makes text safe to put inside HTML (stops a recipe name from breaking the page).
export function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text == null ? "" : String(text);
  return div.innerHTML;
}

// Shows an elegant toast message at the top right of the screen with smooth spring transitions.
export function showToast(message, milliseconds = 3000) {
  const existing = document.querySelector(".custom-toast");
  if (existing) {
    existing.style.opacity = "0";
    existing.style.transform = "translate3d(20px, -10px, 0) scale(0.95)";
    setTimeout(() => existing.remove(), 250);
  }

  const toast = document.createElement("div");
  toast.className = "custom-toast fixed top-20 right-4 sm:right-6 bg-stone-900/95 backdrop-blur-md text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-sm font-medium z-50 border border-stone-800/80 pointer-events-auto select-none";
  toast.setAttribute("role", "status");
  
  // Initial state for entrance transition
  toast.style.opacity = "0";
  toast.style.transform = "translate3d(30px, -10px, 0) scale(0.94)";
  toast.style.transition = "transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.35s cubic-bezier(0.16, 1, 0.3, 1)";
  toast.style.willChange = "transform, opacity";

  toast.innerHTML = `
    <span class="w-5 h-5 rounded-full bg-[#ca5c2e] flex items-center justify-center flex-shrink-0 shadow-sm">
      <svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    </span>
    <span class="leading-tight">${escapeHtml(message)}</span>
  `;

  document.body.appendChild(toast);

  // Trigger smooth entrance
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toast.style.opacity = "1";
      toast.style.transform = "translate3d(0, 0, 0) scale(1)";
    });
  });

  // Smooth exit
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translate3d(20px, -8px, 0) scale(0.96)";
    setTimeout(() => toast.remove(), 400);
  }, milliseconds);
}

const MINOR_WORDS = new Set([
  "a", "an", "and", "as", "at", "but", "by", "for", "from", "in", "into",
  "near", "nor", "of", "on", "onto", "or", "per", "the", "to", "with", "via"
]);

// Converts any text into proper Title Case (capitalizing words except minor words like and, with, of, etc.)
export function toTitleCase(str) {
  if (!str) return "";
  return String(str)
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((word, index, arr) => {
      if (word.includes("-")) {
        return word
          .split("-")
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join("-");
      }
      const cleanWord = word.replace(/^[^\w]+|[^\w]+$/g, "");
      const isFirst = index === 0;
      const isLast = index === arr.length - 1;

      if (!isFirst && !isLast && MINOR_WORDS.has(cleanWord)) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

// The shared recipe card used on the home page and the favourites page.
// Matches the RecipePlan mockup card layout.
export function createRecipeCard(recipe, options = {}) {
  const item = document.createElement("li");
  item.className = "recipe-card bg-white rounded-2xl border border-[#efe6dc] shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden group flex flex-col";
  
  const recipeId = escapeHtml(recipe.id);
  const formattedName = toTitleCase(recipe.name);
  const recipeName = escapeHtml(formattedName);
  const recipeImage = escapeHtml(recipe.image || "https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=600&q=80");
  const recipeCategory = escapeHtml(recipe.category || "Main");

  // Determine action button (favorite heart vs delete trash)
  const isFavouritePage = options.isFavouritePage || false;
  
  const heartButtonHtml = `
    <button type="button" class="favourite-btn p-1.5 rounded-full hover:bg-stone-100 text-stone-400 hover:text-[#ca5c2e] transition" data-id="${recipeId}" title="Save to favourites" aria-label="Save to favourites">
      <svg class="w-5 h-5 heart-icon" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path>
      </svg>
    </button>
  `;

  const deleteButtonHtml = `
    <button type="button" class="remove-favourite-btn p-1.5 rounded-full hover:bg-red-50 text-stone-400 hover:text-red-600 transition" data-id="${recipeId}" title="Remove from favourites" aria-label="Remove from favourites">
      <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
      </svg>
    </button>
  `;

  const actionHtml = isFavouritePage ? deleteButtonHtml : heartButtonHtml;

  item.innerHTML = `
    <div class="relative overflow-hidden bg-stone-100">
      <a href="recipe.html?id=${encodeURIComponent(recipe.id)}" class="block overflow-hidden">
        <img class="w-full aspect-[4/3] object-cover group-hover:scale-105 transition duration-500" src="${recipeImage}" alt="${recipeName}" loading="lazy">
      </a>
      <div class="card-heart-slot absolute top-3 right-3" data-recipe-id="${recipeId}"></div>
    </div>
    <div class="p-3.5 sm:p-4 flex flex-col gap-2.5">
      <h3 class="font-bold text-stone-900 text-base leading-snug line-clamp-1 hover:text-[#ca5c2e] transition">
        <a href="recipe.html?id=${encodeURIComponent(recipe.id)}">${recipeName}</a>
      </h3>
      <div class="flex items-center justify-between">
        <span class="inline-block bg-[#f5ebe4] text-[#a04e28] text-xs font-semibold px-2.5 py-0.5 rounded-full">
          ${recipeCategory}
        </span>
        <div class="card-action-slot">
          ${actionHtml}
        </div>
      </div>
    </div>
  `;

  // Attach quick favorite toggling if on home
  if (!isFavouritePage) {
    const favBtn = item.querySelector(".favourite-btn");
    if (favBtn) {
      favBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        let storedFavs = [];
        try {
          storedFavs = JSON.parse(localStorage.getItem("recipeplan_favourites") || "[]");
        } catch (err) {}

        const exists = storedFavs.some((f) => String(f.id) === String(recipe.id));
        const icon = favBtn.querySelector(".heart-icon");

        if (exists) {
          storedFavs = storedFavs.filter((f) => String(f.id) !== String(recipe.id));
          icon.setAttribute("fill", "none");
          icon.classList.remove("text-red-500");
          favBtn.classList.remove("text-red-500");
          showToast(`Removed "${recipe.name}" from favourites`);
        } else {
          storedFavs.push({
            id: recipe.id,
            name: recipe.name,
            image: recipe.image,
            category: recipe.category,
            addedAt: new Date().toISOString()
          });
          icon.setAttribute("fill", "#ca5c2e");
          icon.classList.add("text-[#ca5c2e]");
          favBtn.classList.add("text-[#ca5c2e]");
          showToast(`Saved "${recipe.name}" to favourites!`);
        }
        localStorage.setItem("recipeplan_favourites", JSON.stringify(storedFavs));
      });

      // Check initial favourite state
      try {
        const storedFavs = JSON.parse(localStorage.getItem("recipeplan_favourites") || "[]");
        if (storedFavs.some((f) => String(f.id) === String(recipe.id))) {
          const icon = favBtn.querySelector(".heart-icon");
          icon.setAttribute("fill", "#ca5c2e");
          icon.classList.add("text-[#ca5c2e]");
          favBtn.classList.add("text-[#ca5c2e]");
        }
      } catch (err) {}
    }
  }

  return item;
}
