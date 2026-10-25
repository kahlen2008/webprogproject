// Home page (search/categories) and recipe detail page.
// Matches the design and interactions shown in RecipePlan mockup.

import { searchRecipes, getRecipeById, filterByCategory } from "./api.js";
import { createRecipeCard, escapeHtml, showToast } from "./utils.js";

// ---------- Home page: Search & Category Filter ----------
const searchForm = document.getElementById("search-form");
const results = document.getElementById("results");
const message = document.getElementById("results-message");
const sectionTitle = document.getElementById("recipes-section-title");
const categoryChips = document.querySelectorAll(".category-chip");

// Authentic fallback recipes with full ingredients & instructions (used only if offline / API is unreachable)
const FALLBACK_RECIPES_BY_ID = {
  "52772": {
    id: "52772",
    name: "Teriyaki Chicken Casserole",
    image: "https://www.themealdb.com/images/media/meals/wvpsxx1468256321.jpg",
    category: "Chicken",
    area: "Japanese",
    instructions: "Preheat oven to 350° F. Spray a 9x13-inch baking pan with non-stick spray.\r\nCombine soy sauce, 1/2 cup water, brown sugar, ginger and garlic in a small saucepan and cover. Bring to a boil over medium heat. Remove lid and cook for one minute once boiling.\r\nMeanwhile, stir together cornstarch and 2 tablespoons of water in a separate dish until smooth. Once sauce is boiling, add mixture to saucepan and stir to combine. Cook until sauce thickens then remove from heat.\r\nPlace chicken breasts in prepared pan. Pour 1 cup of sauce over chicken. Bake in oven for 35 minutes or until cooked through. Shred chicken in dish using two forks.\r\nAdd cooked vegetables and rice to the casserole dish with chicken. Add remaining sauce, gently tossing everything together. Return to oven and cook 15 minutes. Let stand 5 minutes before serving.",
    ingredients: [
      { name: "soy sauce", measure: "3/4 cup" },
      { name: "water", measure: "1/2 cup" },
      { name: "brown sugar", measure: "1/4 cup" },
      { name: "ground ginger", measure: "1/2 tsp" },
      { name: "minced garlic", measure: "1/2 tsp" },
      { name: "cornstarch", measure: "4 tbsp" },
      { name: "chicken breasts", measure: "2 large" },
      { name: "stir-fry vegetables", measure: "1 pack (12 oz)" },
      { name: "brown rice", measure: "3 cups cooked" }
    ]
  },
  "52844": {
    id: "52844",
    name: "Lasagne",
    image: "https://www.themealdb.com/images/media/meals/wtsvxx1511296896.jpg",
    category: "Pasta",
    area: "Italian",
    instructions: "Heat oil in a large saucepan. Add bacon and cook for a few minutes until golden. Add onion, celery and carrot, cooking over medium heat for 5 mins until softened.\r\nAdd garlic and cook for 1 min, then add minced beef and cook, stirring and breaking it up for 6 mins until browned.\r\nStir in tomato purée, chopped tomatoes, honey and season to taste. Simmer for 20 mins.\r\nHeat oven to 200°C / 180°C fan. Ladle ragù sauce into base of casserole dish, then layer lasagne sheets and sauce, repeating for 3 layers.\r\nMix crème fraîche with 2 tbsp water, pour over top, and sprinkle mozzarella and parmesan. Bake for 25-30 mins until golden and bubbling.",
    ingredients: [
      { name: "Olive Oil", measure: "1 tbsp" },
      { name: "Bacon", measure: "2 strips" },
      { name: "Onion", measure: "1 finely chopped" },
      { name: "Celery", measure: "1 stick" },
      { name: "Carrots", measure: "1 medium" },
      { name: "Garlic", measure: "2 cloves" },
      { name: "Minced Beef", measure: "500g" },
      { name: "Tomato Puree", measure: "1 tbsp" },
      { name: "Chopped Tomatoes", measure: "800g" },
      { name: "Lasagne Sheets", measure: "500g" },
      { name: "Creme Fraiche", measure: "400ml" },
      { name: "Mozzarella Balls", measure: "125g" },
      { name: "Parmesan Cheese", measure: "50g" }
    ]
  },
  "52874": {
    id: "52874",
    name: "Beef and Mustard Pie",
    image: "https://www.themealdb.com/images/media/meals/sytuqu1511553755.jpg",
    category: "Beef",
    area: "British",
    instructions: "Preheat oven to 150°C. Toss beef with flour, salt and pepper in a bowl.\r\nHeat oil in a large casserole dish, brown beef on all sides, then remove.\r\nAdd red wine, reduce by half, then return beef and add stock, onion, carrots, thyme and mustard. Cover and bake for 2 hours until tender.\r\nTransfer filling to a pie dish. Brush rim with beaten egg and top with puff pastry.\r\nBake at 200°C for 30 minutes until pastry is golden and puffed. Serve with buttered green beans.",
    ingredients: [
      { name: "Beef", measure: "1kg" },
      { name: "Plain Flour", measure: "2 tbsp" },
      { name: "Rapeseed Oil", measure: "2 tbsp" },
      { name: "Red Wine", measure: "200ml" },
      { name: "Beef Stock", measure: "400ml" },
      { name: "Onion", measure: "1 sliced" },
      { name: "Carrots", measure: "2 chopped" },
      { name: "Mustard", measure: "2 tbsp" },
      { name: "Puff Pastry", measure: "400g" },
      { name: "Green Beans", measure: "300g" }
    ]
  },
  "52854": {
    id: "52854",
    name: "Pancakes",
    image: "https://www.themealdb.com/images/media/meals/rwuyqx1511383174.jpg",
    category: "Dessert",
    area: "United States",
    instructions: "Whisk flour, eggs, milk, 1 tbsp sunflower oil and a pinch of salt into a smooth batter.\r\nHeat a frying pan over medium heat with a light wipe of oil. Pour in batter and cook each pancake for 1 minute on each side until golden.\r\nServe warm with fresh raspberries, blueberries, maple syrup or sugar.",
    ingredients: [
      { name: "Flour", measure: "100g" },
      { name: "Eggs", measure: "2 large" },
      { name: "Milk", measure: "300ml" },
      { name: "Sunflower Oil", measure: "1 tbsp" },
      { name: "Sugar / Berries", measure: "To serve" }
    ]
  }
};

const DEFAULT_FALLBACK_RECIPES = Object.values(FALLBACK_RECIPES_BY_ID);

async function runSearch(query, title = "Search Results") {
  if (!results) return;
  results.innerHTML = "";
  if (sectionTitle) sectionTitle.textContent = title;
  if (message) {
    message.className = "text-sm text-stone-500 py-2 flex items-center gap-2";
    message.innerHTML = `
      <svg class="animate-spin w-4 h-4 text-[#ca5c2e]" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
      </svg>
      Loading delicious recipes...
    `;
  }

  try {
    const recipes = await searchRecipes(query);
    if (!recipes || recipes.length === 0) {
      if (message) {
        message.className = "text-sm text-stone-500 py-6 text-center";
        message.textContent = `No recipes found for "${query}". Try another keyword or browse popular categories.`;
      }
      return;
    }
    if (message) message.textContent = "";
    recipes.slice(0, 12).forEach((recipe) => {
      results.appendChild(createRecipeCard(recipe));
    });
  } catch (error) {
    console.warn("Recipe fetch failed, displaying curated recipes:", error);
    if (message) message.textContent = "";
    DEFAULT_FALLBACK_RECIPES.forEach((recipe) => {
      results.appendChild(createRecipeCard(recipe));
    });
  }
}

async function runCategoryFilter(category) {
  if (!results) return;
  results.innerHTML = "";
  if (sectionTitle) sectionTitle.textContent = `${category} Recipes`;
  if (message) {
    message.className = "text-sm text-stone-500 py-2 flex items-center gap-2";
    message.innerHTML = `Loading ${category} recipes...`;
  }

  try {
    const recipes = await filterByCategory(category);
    if (!recipes || recipes.length === 0) {
      if (message) message.textContent = `No recipes found in ${category}.`;
      return;
    }
    if (message) message.textContent = "";
    recipes.slice(0, 12).forEach((recipe) => {
      results.appendChild(createRecipeCard(recipe));
    });
  } catch (error) {
    if (message) message.textContent = "Could not load recipes right now.";
  }
}

if (searchForm) {
  searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const query = searchForm.query.value.trim();
    if (query) {
      runSearch(query, `Recipes matching "${query}"`);
    }
  });

  // Category buttons
  categoryChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      const cat = chip.dataset.category;
      if (cat) {
        runCategoryFilter(cat);
      }
    });
  });

  const viewMoreBtn = document.getElementById("view-more-btn");
  if (viewMoreBtn) {
    viewMoreBtn.addEventListener("click", () => {
      runSearch("a", "All Recipes");
    });
  }

  // Initial load: dynamically fetch live recipes straight from TheMealDB API!
  runSearch("", "Latest Recipes");
}

// ---------- Recipe Detail Page ----------
const detail = document.getElementById("recipe-detail");

async function showRecipe(id) {
  if (!detail) return;
  detail.innerHTML = `
    <div class="py-16 text-center text-stone-500 flex flex-col items-center justify-center gap-3">
      <svg class="animate-spin w-8 h-8 text-[#ca5c2e]" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
      </svg>
      <span class="text-base font-medium">Preparing recipe details...</span>
    </div>
  `;

  try {
    let recipe = await getRecipeById(id);
    
    // Fallback if API lookup fails or offline
    if (!recipe) {
      recipe = FALLBACK_RECIPES_BY_ID[String(id)] || FALLBACK_RECIPES_BY_ID["52772"];
    }

    document.title = `${recipe.name} | RecipePlan`;

    // Process instructions into clean numbered steps, filtering out standalone "step 1" headers
    function cleanInstructions(text) {
      if (!text) return ["Follow cooking guidelines for standard preparation."];

      // Insert newlines before inline step markers like "...STEP 2..." if on the same line
      const normalized = text
        .replace(/([^\r\n])\s*(STEP\s*\d+[:.-]?)/gi, "$1\n$2")
        .replace(/\r\n/g, "\n");

      const lines = normalized
        .split(/\n+/)
        .map((s) => s.trim())
        .filter(Boolean);

      // Standalone headers or solitary step numbers like "2", "3", "step 1", "STEP 2:", "Instructions", "Method"
      const standaloneHeaderRegex = /^(?:step\s*\d+|part\s*\d+|\d+|method|instructions?|directions?)\s*[:.-]?$/i;
      let steps = lines.filter((line) => !standaloneHeaderRegex.test(line) && line.length > 3);

      if (steps.length === 0 && lines.length > 0) {
        steps = lines;
      }

      // Strip redundant leading "Step 1:", "1.", "1 -", "STEP 1 - " from the actual instruction text
      const prefixRegex = /^(?:step\s*\d+[\s:.-]*|\d+[\.\)]\s*|[-–—:]\s*)+/i;
      const result = steps
        .map((s) => s.replace(prefixRegex, "").trim())
        .filter((s) => s.length > 3);

      return result.length > 0 ? result : ["Follow cooking guidelines for standard preparation."];
    }

    const cleanSteps = cleanInstructions(recipe.instructions);

    const stepsHtml = cleanSteps
      .map(
        (step, idx) => `
        <li class="flex items-start gap-4">
          <span class="flex-shrink-0 w-8 h-8 rounded-full bg-[#fbece4] text-[#ca5c2e] font-bold text-sm flex items-center justify-center mt-0.5">
            ${idx + 1}
          </span>
          <p class="text-stone-700 text-base leading-relaxed flex-1">${escapeHtml(step)}</p>
        </li>
      `
      )
      .join("");

    const ingredientsHtml = (recipe.ingredients || [])
      .map(
        (ing) => `
        <li class="flex items-center gap-3 text-stone-700 text-sm sm:text-base py-1">
          <span class="text-[#ca5c2e] font-bold text-lg select-none leading-none">+</span>
          <span class="font-medium text-stone-900">${escapeHtml(ing.measure)}</span>
          <span class="text-stone-700">${escapeHtml(ing.name)}</span>
        </li>
      `
      )
      .join("");

    const safeImage = escapeHtml(recipe.image);
    const safeName = escapeHtml(recipe.name);
    const safeCategory = escapeHtml(recipe.category || "Main");
    const safeArea = escapeHtml(recipe.area || "International");

    detail.innerHTML = `
      <div class="space-y-10">
        <!-- Top Hero Section: Photo + Meta Details -->
        <div class="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          
          <!-- Image and Thumbnails Column -->
          <div class="md:col-span-5 space-y-3">
            <div class="overflow-hidden rounded-2xl border border-[#efe6dc] shadow-sm bg-stone-100">
              <img id="main-recipe-image" class="w-full aspect-[4/3] object-cover" src="${safeImage}" alt="${safeName}">
            </div>
            
            <!-- 3 Thumbnails Strip -->
            <div class="grid grid-cols-3 gap-3">
              <button type="button" class="thumb-btn rounded-xl overflow-hidden border-2 border-[#ca5c2e] shadow-sm focus:outline-none" data-src="${safeImage}">
                <img class="w-full aspect-[4/3] object-cover" src="${safeImage}" alt="Thumbnail 1">
              </button>
              <button type="button" class="thumb-btn rounded-xl overflow-hidden border border-[#efe6dc] hover:border-stone-400 shadow-sm focus:outline-none" data-src="https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=300&q=80">
                <img class="w-full aspect-[4/3] object-cover" src="https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=300&q=80" alt="Thumbnail 2">
              </button>
              <button type="button" class="thumb-btn rounded-xl overflow-hidden border border-[#efe6dc] hover:border-stone-400 shadow-sm focus:outline-none" data-src="https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=300&q=80">
                <img class="w-full aspect-[4/3] object-cover" src="https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=300&q=80" alt="Thumbnail 3">
              </button>
            </div>
          </div>

          <!-- Recipe Title, Ratings & Actions Column -->
          <div class="md:col-span-7 space-y-5">
            <div>
              <h1 class="text-3xl sm:text-4xl font-extrabold text-stone-900 tracking-tight leading-tight">
                ${safeName}
              </h1>

              <!-- Star Rating -->
              <div class="flex items-center gap-2 mt-2">
                <div class="flex items-center text-amber-500 text-sm">
                  <span>★</span><span>★</span><span>★</span><span>★</span><span class="text-amber-400">★</span>
                </div>
                <span class="text-sm font-semibold text-stone-800">4.8</span>
                <span class="text-sm text-stone-500">(120 ratings)</span>
              </div>
            </div>

            <!-- Chips / Badges Row -->
            <div class="flex flex-wrap items-center gap-2 pt-1">
              <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-[#f5ebe4] text-[#a04e28]">
                ${safeCategory}
              </span>
              <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-stone-100 text-stone-700">
                ${safeArea}
              </span>
              <span class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-stone-100 text-stone-700">
                <svg class="w-3.5 h-3.5 text-stone-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                30 mins
              </span>
              <span class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-stone-100 text-stone-700">
                <svg class="w-3.5 h-3.5 text-stone-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 2a9 9 0 0 1 9 9v11H3V11a9 9 0 0 1 9-9z"></path></svg>
                Easy
              </span>
            </div>

            <!-- Buttons Row: Save to Favourites & Add to Meal Plan -->
            <div class="flex flex-wrap items-center gap-3 pt-2">
              <button id="save-fav-btn" type="button" class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[#ca5c2e] text-[#ca5c2e] hover:bg-[#ca5c2e]/10 text-sm font-semibold transition focus:outline-none">
                <svg id="fav-icon" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path>
                </svg>
                <span id="fav-btn-label">Save to Favourites</span>
              </button>

              <button id="add-plan-btn" type="button" class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#ca5c2e] hover:bg-[#b34d23] text-white text-sm font-semibold shadow-sm transition focus:outline-none">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                Add to Meal Plan
              </button>
            </div>

            <!-- Description -->
            <div class="pt-2">
              <h3 class="text-base font-bold text-stone-900 mb-2">Description</h3>
              <p class="text-stone-600 text-sm sm:text-base leading-relaxed">
                A classic Italian pasta dish made with eggs, cheese, pancetta and black pepper. Creamy, rich and full of flavour.
              </p>
            </div>
          </div>
        </div>

        <!-- Divider -->
        <hr class="border-[#ede4da]">

        <!-- Bottom Section: Ingredients (Left) and Instructions (Right) -->
        <div class="grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-12">
          
          <!-- Ingredients Column -->
          <div class="md:col-span-5 space-y-4">
            <h2 class="text-xl font-bold text-stone-900">Ingredients (2 servings)</h2>
            <ul class="space-y-2 list-none p-0 m-0">
              ${ingredientsHtml}
            </ul>
          </div>

          <!-- Instructions Column -->
          <div class="md:col-span-7 space-y-4">
            <h2 class="text-xl font-bold text-stone-900">Instructions</h2>
            <ol class="space-y-5 list-none p-0 m-0">
              ${stepsHtml}
            </ol>
          </div>
        </div>
      </div>
    `;

    // Interactive thumbnail switching
    const mainImg = document.getElementById("main-recipe-image");
    document.querySelectorAll(".thumb-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".thumb-btn").forEach((b) => b.classList.replace("border-[#ca5c2e]", "border-[#efe6dc]"));
        btn.classList.replace("border-[#efe6dc]", "border-[#ca5c2e]");
        if (mainImg) mainImg.src = btn.dataset.src;
      });
    });

    // Save to favourites handling
    const favBtn = document.getElementById("save-fav-btn");
    const favIcon = document.getElementById("fav-icon");
    const favLabel = document.getElementById("fav-btn-label");

    let storedFavs = [];
    try {
      storedFavs = JSON.parse(localStorage.getItem("recipeplan_favourites") || "[]");
    } catch (e) {}

    const isFav = storedFavs.some((f) => String(f.id) === String(recipe.id));
    if (isFav) {
      favIcon.setAttribute("fill", "#ca5c2e");
      favLabel.textContent = "Saved to Favourites";
    }

    favBtn.addEventListener("click", () => {
      let currentFavs = [];
      try {
        currentFavs = JSON.parse(localStorage.getItem("recipeplan_favourites") || "[]");
      } catch (e) {}

      const exists = currentFavs.some((f) => String(f.id) === String(recipe.id));
      if (exists) {
        currentFavs = currentFavs.filter((f) => String(f.id) !== String(recipe.id));
        favIcon.setAttribute("fill", "none");
        favLabel.textContent = "Save to Favourites";
        showToast(`Removed "${recipe.name}" from favourites`);
      } else {
        currentFavs.push({
          id: recipe.id,
          name: recipe.name,
          image: recipe.image,
          category: recipe.category
        });
        favIcon.setAttribute("fill", "#ca5c2e");
        favLabel.textContent = "Saved to Favourites";
        showToast(`Saved "${recipe.name}" to favourites!`);
      }
      localStorage.setItem("recipeplan_favourites", JSON.stringify(currentFavs));
    });

    // Add to meal plan quick action
    const addPlanBtn = document.getElementById("add-plan-btn");
    if (addPlanBtn) {
      addPlanBtn.addEventListener("click", () => {
        // Save to meal plan in localStorage
        try {
          const plan = JSON.parse(localStorage.getItem("recipeplan_plan") || "{}");
          if (!plan.monday) plan.monday = {};
          plan.monday.dinner = {
            id: recipe.id,
            name: recipe.name,
            image: recipe.image,
            category: recipe.category
          };
          localStorage.setItem("recipeplan_plan", JSON.stringify(plan));
          showToast(`Added "${recipe.name}" to Monday Dinner!`);
        } catch (e) {
          showToast(`Added to your weekly meal plan!`);
        }
      });
    }

  } catch (err) {
    console.error("Recipe display error:", err);
    detail.innerHTML = `
      <div class="text-center py-12 text-stone-500">
        <p class="text-base font-semibold text-stone-800">Recipe could not be loaded.</p>
        <a href="index.html" class="inline-block mt-3 text-sm text-[#ca5c2e] hover:underline">&larr; Return to browse recipes</a>
      </div>
    `;
  }
}

if (detail) {
  const id = new URLSearchParams(window.location.search).get("id") || "52772";
  showRecipe(id);
}
