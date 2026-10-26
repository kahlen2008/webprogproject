// Home page (search/categories) and recipe detail page.
// Matches the design and interactions shown in RecipePlan mockup.

import { searchRecipes, getRecipeById, filterByCategory } from "./api.js";
import { createRecipeCard, escapeHtml, showToast, toTitleCase, cleanInstructionText } from "./utils.js";
import {
  getPreferences,
  savePreferences,
  checkRecipes,
  checkRecipe,
  decorateCard,
  describeResult,
  confirmIfFlagged,
} from "./preferences.js";

// ---------- Home page: Search & Category Filter ----------
const searchForm = document.getElementById("search-form");
const results = document.getElementById("results");
const message = document.getElementById("results-message");
const sectionTitle = document.getElementById("recipes-section-title");
const categoryChips = document.querySelectorAll(".category-chip");
const hideToggle = document.getElementById("hide-flagged-toggle");
const hideToggleWrap = document.getElementById("hide-flagged-wrap");

// Authentic fallback recipes with full ingredients & instructions (used only if offline / API is unreachable)
const FALLBACK_RECIPES_BY_ID = {
  "52772": {
    id: "52772",
    name: "Teriyaki Chicken Casserole",
    image: "https://www.themealdb.com/images/media/meals/wvpsxx1468256321.jpg",
    category: "Chicken",
    area: "Japanese",
    description: "Tender chicken breasts baked in a sweet and savoury teriyaki glaze with fresh stir-fry vegetables and steamed rice.",
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
  "greek-salad": {
    id: "greek-salad",
    name: "Classic Greek Salad",
    image: "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=600&q=80",
    category: "Vegetarian",
    area: "Greek",
    description: "A crisp, colourful Mediterranean salad packed with ripe vine tomatoes, crisp cucumbers, red onions, Kalamata olives and creamy feta cheese dressed with extra virgin olive oil and oregano.",
    instructions: "Wash and chop the ripe vine tomatoes and crisp cucumbers into bite-sized chunks.\r\nThinly slice the red onion and place into a large salad bowl with the chopped tomatoes and cucumbers.\r\nAdd the pitted Kalamata olives and gently toss together.\r\nCut the block of Greek feta cheese into cubes (or crumble gently over the salad bowl).\r\nDrizzle generously with high-quality extra virgin olive oil and a splash of red wine vinegar.\r\nSeason with dried Greek oregano, sea salt and freshly cracked black pepper. Toss gently and serve fresh.",
    ingredients: [
      { name: "Ripe Vine Tomatoes", measure: "4 large" },
      { name: "English Cucumber", measure: "1 medium" },
      { name: "Red Onion", measure: "1/2 sliced" },
      { name: "Kalamata Olives", measure: "1/2 cup pitted" },
      { name: "Greek Feta Cheese", measure: "200g" },
      { name: "Extra Virgin Olive Oil", measure: "3 tbsp" },
      { name: "Red Wine Vinegar", measure: "1 tbsp" },
      { name: "Dried Greek Oregano", measure: "1 tsp" },
      { name: "Sea Salt & Black Pepper", measure: "To taste" }
    ]
  },
  "53194": {
    id: "53194",
    name: "Tom Yum Soup with Prawns",
    image: "https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?auto=format&fit=crop&w=600&q=80",
    category: "Seafood",
    area: "Thai",
    description: "A world-famous Thai hot and sour soup infused with fragrant lemongrass, galangal, kaffir lime leaves, juicy prawns, and fiery bird's eye chilies.",
    instructions: "Bring chicken or shrimp stock to a gentle boil in a medium soup pot.\r\nBruise lemongrass stalks, slice fresh galangal, and tear kaffir lime leaves. Add them along with crushed garlic and bird's eye chilies to the boiling stock. Simmer for 5 minutes until intensely fragrant.\r\nAdd sliced mushrooms and Thai roasted chili paste (Nam Prik Pao), stirring until thoroughly dissolved into the broth.\r\nAdd cleaned prawns and simmer gently for 2-3 minutes until they turn pink and opaque. Do not overcook.\r\nTurn off the heat. Stir in fish sauce and freshly squeezed lime juice to achieve the perfect balance of hot, sour, and savoury.\r\nGarnish with fresh cilantro leaves and serve piping hot.",
    ingredients: [
      { name: "Prawns (Shrimp)", measure: "300g peeled & deveined" },
      { name: "Lemongrass Stalks", measure: "2 bruised" },
      { name: "Fresh Galangal", measure: "4-5 slices" },
      { name: "Kaffir Lime Leaves", measure: "4 torn" },
      { name: "Thai Bird's Eye Chilies", measure: "3-4 crushed" },
      { name: "Straw or Button Mushrooms", measure: "150g sliced" },
      { name: "Thai Roasted Chili Paste", measure: "1-2 tbsp" },
      { name: "Fish Sauce", measure: "2 tbsp" },
      { name: "Fresh Lime Juice", measure: "3 tbsp" },
      { name: "Chicken or Vegetable Stock", measure: "4 cups" },
      { name: "Fresh Cilantro", measure: "Handful chopped" }
    ]
  },
  "52844": {
    id: "52844",
    name: "Lasagne",
    image: "https://www.themealdb.com/images/media/meals/wtsvxx1511296896.jpg",
    category: "Pasta",
    area: "Italian",
    description: "Layers of pasta sheets baked with a rich beef ragù sauce, creamy white sauce, and bubbling melted mozzarella and parmesan cheese.",
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
    description: "Tender beef braised with red wine, beef stock, and wholegrain mustard under a golden, flaky puff pastry crust.",
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
    description: "Golden, fluffy skillet pancakes served warm with maple syrup, melted butter, and fresh seasonal berries.",
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

function syncHideToggle() {
  const prefs = getPreferences();
  if (hideToggleWrap) {
    if (prefs.allergies && prefs.allergies.length > 0) {
      hideToggleWrap.classList.remove("hidden");
      hideToggleWrap.classList.add("inline-flex");
    } else {
      hideToggleWrap.classList.add("hidden");
      hideToggleWrap.classList.remove("inline-flex");
    }
  }
  if (hideToggle) {
    hideToggle.checked = prefs.hideFlagged === true;
  }
}

async function renderRecipeCards(recipesList) {
  if (!results) return;
  results.innerHTML = "";
  const prefs = getPreferences();
  const checked = await checkRecipes(recipesList, prefs);
  const visible = prefs.hideFlagged
    ? checked.filter((item) => !item.result.hasAllergen)
    : checked;

  if (visible.length === 0) {
    if (message) {
      message.className = "text-sm text-stone-500 py-6 text-center";
      message.textContent = prefs.hideFlagged && checked.length > 0
        ? "All matching recipes contain ingredients you're allergic to. Uncheck 'Hide allergen recipes' to view them."
        : "No recipes found matching your criteria.";
    }
    return;
  }

  if (message) {
    message.innerHTML = "";
    message.className = "hidden";
  }

  visible.forEach(({ recipe, result }) => {
    const card = createRecipeCard(recipe);
    decorateCard(card, result);
    results.appendChild(card);
  });
}

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
        message.className = "text-sm text-stone-500 py-4 text-center";
        message.textContent = `No recipes found for "${query}". Try another keyword or browse popular categories.`;
      }
      return;
    }
    await renderRecipeCards(recipes.slice(0, 12));
  } catch (error) {
    console.warn("Recipe fetch failed, displaying curated recipes:", error);
    await renderRecipeCards(DEFAULT_FALLBACK_RECIPES);
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
      if (message) {
        message.className = "text-sm text-stone-500 py-4 text-center";
        message.textContent = `No recipes found in ${category}.`;
      }
      return;
    }
    await renderRecipeCards(recipes.slice(0, 12));
  } catch (error) {
    if (message) {
      message.className = "text-sm text-stone-500 py-4 text-center";
      message.textContent = "Could not load recipes right now.";
    }
  }
}

let activeCategory = null;

if (searchForm) {
  searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const query = searchForm.query.value.trim();
    if (query) {
      activeCategory = null;
      categoryChips.forEach((c) => c.classList.remove("active"));
      runSearch(query, `Recipes matching "${query}"`);
      const recipesSection = document.getElementById("recipes-section");
      if (recipesSection) {
        recipesSection.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  });

  // Category buttons: toggle active selection, unclick, and scroll to recipes
  categoryChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      const cat = chip.dataset.category;
      if (!cat) return;

      // If user clicks the already active category, unclick and reset to Latest Recipes
      if (activeCategory === cat) {
        activeCategory = null;
        chip.classList.remove("active");
        runSearch("", "Latest Recipes");
        return;
      }

      // Mark this category as active and unmark others
      activeCategory = cat;
      categoryChips.forEach((c) => {
        if (c === chip) {
          c.classList.add("active");
        } else {
          c.classList.remove("active");
        }
      });

      runCategoryFilter(cat);

      // Scroll smoothly down to the recipes section
      const recipesSection = document.getElementById("recipes-section");
      if (recipesSection) {
        recipesSection.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });

  const viewMoreBtn = document.getElementById("view-more-btn");
  if (viewMoreBtn) {
    viewMoreBtn.addEventListener("click", () => {
      activeCategory = null;
      categoryChips.forEach((c) => c.classList.remove("active"));
      runSearch("a", "All Recipes");
      const recipesSection = document.getElementById("recipes-section");
      if (recipesSection) {
        recipesSection.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }

  if (hideToggle) {
    hideToggle.addEventListener("change", async () => {
      await savePreferences({ hideFlagged: hideToggle.checked });
      if (activeCategory) {
        runCategoryFilter(activeCategory);
      } else {
        const title = sectionTitle ? sectionTitle.textContent : "Latest Recipes";
        runSearch("", title);
      }
    });
  }

  window.addEventListener("preferences-changed", () => {
    syncHideToggle();
  });
  syncHideToggle();

  // Initial load: inspect preferences and pre-select matching diet category chip if present
  const initialPrefs = getPreferences();
  let defaultCategory = null;
  if (initialPrefs.diets.includes("Vegetarian") || initialPrefs.diets.includes("Vegan")) {
    defaultCategory = "Vegetarian";
  } else if (initialPrefs.diets.includes("Pescatarian")) {
    defaultCategory = "Seafood";
  }

  if (defaultCategory) {
    const matchingChip = document.querySelector(`.category-chip[data-category="${defaultCategory}"]`);
    if (matchingChip) {
      activeCategory = defaultCategory;
      categoryChips.forEach((c) => c.classList.remove("active"));
      matchingChip.classList.add("active");
      runCategoryFilter(defaultCategory);
    } else {
      runSearch("", "Latest Recipes");
    }
  } else {
    runSearch("", "Latest Recipes");
  }
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
    // Aliases for legacy demo IDs that were erroneously mapped to unrelated TheMealDB items
    if (id === "52838") id = "53194"; // Tom Yum Soup (legacy id 52838 was Viennese Schnitzel)
    if (id === "52773") id = "52772"; // Teriyaki Chicken Casserole (legacy id 52773 was Honey Teriyaki Salmon)
    if (id === "52855") id = "greek-salad"; // Classic Greek Salad (legacy id 52855 was Banana Pancakes)
    if (id === "52891") id = "52860"; // Chocolate Brownies (legacy id 52891 was Blackberry Fool)

    let recipe = null;
    if (FALLBACK_RECIPES_BY_ID[String(id)]) {
      recipe = FALLBACK_RECIPES_BY_ID[String(id)];
    } else {
      recipe = await getRecipeById(id);
    }
    
    // Fallback if API lookup fails or offline
    if (!recipe) {
      recipe = FALLBACK_RECIPES_BY_ID[String(id)] || FALLBACK_RECIPES_BY_ID["52772"];
    }

    const prefs = getPreferences();
    const result = checkRecipe(recipe, prefs);

    const titleCasedName = toTitleCase(recipe.name);
    document.title = `${titleCasedName} | RecipePlan`;

    // Section headers configuration for tips, serving suggestions, notes, etc.
    const SECTION_HEADERS = [
      {
        regex: /^(?:\*{1,2})?(?:pro\s*tips?|cooking\s*tips?|chef'?s?\s*tips?|tips?)(?:\*{1,2})?\s*[:.-]?$/i,
        label: "Pro Tips",
        icon: "💡",
        badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
        dotClass: "bg-amber-500",
      },
      {
        regex: /^(?:\*{1,2})?(?:serving\s*suggestions?|to\s*serve|how\s*to\s*serve)(?:\*{1,2})?\s*[:.-]?$/i,
        label: "Serving Suggestions",
        icon: "🍽️",
        badgeClass: "bg-[#fbece4] text-[#ca5c2e] border-[#f3ddd0]",
        dotClass: "bg-[#ca5c2e]",
      },
      {
        regex: /^(?:\*{1,2})?(?:chef'?s?\s*notes?|recipe\s*notes?|notes?)(?:\*{1,2})?\s*[:.-]?$/i,
        label: "Chef's Notes",
        icon: "📝",
        badgeClass: "bg-stone-100 text-stone-700 border-stone-200",
        dotClass: "bg-stone-400",
      },
      {
        regex: /^(?:\*{1,2})?(?:storage|leftovers?|how\s*to\s*store)(?:\*{1,2})?\s*[:.-]?$/i,
        label: "Storage",
        icon: "📦",
        badgeClass: "bg-stone-100 text-stone-700 border-stone-200",
        dotClass: "bg-stone-400",
      },
      {
        regex: /^(?:\*{1,2})?(?:variations?|substitutions?)(?:\*{1,2})?\s*[:.-]?$/i,
        label: "Variations",
        icon: "✨",
        badgeClass: "bg-purple-50 text-purple-800 border-purple-200",
        dotClass: "bg-purple-500",
      },
      {
        regex: /^(?:\*{1,2})?(?:garnish|to\s*garnish)(?:\*{1,2})?\s*[:.-]?$/i,
        label: "Garnish",
        icon: "🌿",
        badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
        dotClass: "bg-emerald-500",
      },
    ];

    // Process instructions into clean numbered cooking steps, with tips and serving suggestions separated
    function parseRecipeInstructions(text) {
      if (!text) return [{ type: "step", text: "Follow cooking guidelines for standard preparation." }];

      const cleaned = cleanInstructionText(text);

      // Insert newlines before inline step markers like "...STEP 2..." if on the same line
      const normalized = cleaned
        .replace(/([^\r\n])\s*(STEP\s*\d+[:.-]?)/gi, "$1\n$2")
        .replace(/\r\n/g, "\n");

      const lines = normalized
        .split(/\n+/)
        .map((s) => s.trim())
        .filter(Boolean);

      const standaloneHeaderRegex = /^(?:step\s*\d+|part\s*\d+|\d+|method|instructions?|directions?)\s*[:.-]?$/i;
      const prefixRegex = /^(?:step\s*\d+[\s:.-]*|\d+[\.\)]\s*|[-*•–—:]\s*)+/i;

      const items = [];
      let currentSection = null;

      function ensureFullStop(str) {
        if (!str) return "";
        const trimmed = str.trim();
        // If it already ends with terminal punctuation like ., !, ? or …
        if (/[.!?…]$/.test(trimmed)) {
          return trimmed;
        }
        // If it ends with trailing colon, semicolon, or comma, replace with a full stop
        if (/[:,;]$/.test(trimmed)) {
          return trimmed.slice(0, -1) + ".";
        }
        return trimmed + ".";
      }

      lines.forEach((line) => {
        // Detect section headers like "Pro Tips:" or "Serving Suggestions:"
        const matchedHeader = SECTION_HEADERS.find((h) => h.regex.test(line));
        if (matchedHeader) {
          currentSection = matchedHeader;
          items.push({
            type: "header",
            header: matchedHeader,
          });
          return;
        }

        // Filter out generic step numbers/titles
        if (standaloneHeaderRegex.test(line)) return;

        let cleanText = line.replace(prefixRegex, "").trim();
        if (cleanText.length <= 3) return;

        // Apply drop-cap typo fixes at step start if needed (e.g. "emove" -> "Remove", "oak the" -> "Soak the")
        cleanText = cleanText
          .replace(/^emove\b/i, "Remove")
          .replace(/^oak the\b/i, "Soak the")
          .replace(/^dd the\b/i, "Add the")
          .replace(/^reheat\b/i, "Preheat");

        // Ensure sentence capitalization
        cleanText = cleanText.charAt(0).toUpperCase() + cleanText.slice(1);

        cleanText = ensureFullStop(cleanText);

        if (currentSection) {
          items.push({
            type: "bullet",
            text: cleanText,
            header: currentSection,
          });
        } else {
          items.push({
            type: "step",
            text: cleanText,
          });
        }
      });

      return items.length > 0 ? items : [{ type: "step", text: "Follow cooking guidelines for standard preparation." }];
    }

    const parsedItems = parseRecipeInstructions(recipe.instructions);
    let stepNumber = 0;

    const stepsHtml = parsedItems
      .map((item) => {
        if (item.type === "header") {
          return `
            <li class="pt-5 pb-1 list-none -ml-1">
              <div class="flex items-center gap-3">
                <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${item.header.badgeClass} shadow-2xs">
                  <span>${item.header.icon}</span> ${escapeHtml(item.header.label)}
                </span>
                <div class="h-px bg-stone-200/80 flex-1"></div>
              </div>
            </li>
          `;
        }
        if (item.type === "bullet") {
          return `
            <li class="flex items-start gap-3.5 pl-1">
              <span class="flex-shrink-0 w-2 h-2 rounded-full ${item.header.dotClass} mt-[10px] ml-2.5"></span>
              <p class="text-stone-700 text-base leading-7 flex-1 text-pretty">${escapeHtml(item.text)}</p>
            </li>
          `;
        }
        // Standard cooking step
        stepNumber++;
        return `
          <li class="flex items-start gap-4">
            <span class="flex-shrink-0 w-7 h-7 rounded-full bg-[#fbece4] text-[#ca5c2e] font-bold text-xs sm:text-sm flex items-center justify-center">
              ${stepNumber}
            </span>
            <p class="text-stone-700 text-base leading-7 flex-1 text-pretty">${escapeHtml(item.text)}</p>
          </li>
        `;
      })
      .join("");

    const ingredientsHtml = (recipe.ingredients || [])
      .map((ing) => {
        const flaggedLabels = result.byIngredient?.[ing.name.toLowerCase()] || [];
        if (flaggedLabels.length > 0) {
          return `
            <li class="flex items-center justify-between gap-3 bg-red-50/80 border border-red-200/90 rounded-xl px-3 py-2 text-sm sm:text-base">
              <div class="flex items-center gap-2.5">
                <span class="text-red-500 font-bold text-base select-none leading-none">!</span>
                <span class="font-semibold text-stone-900">${escapeHtml(ing.measure)}</span>
                <span class="text-stone-800 font-medium">${escapeHtml(ing.name)}</span>
              </div>
              <span class="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-600 text-white flex-shrink-0">
                ${escapeHtml(flaggedLabels.join(", "))}
              </span>
            </li>
          `;
        }
        return `
          <li class="flex items-center gap-3 text-stone-700 text-sm sm:text-base py-1">
            <span class="text-[#ca5c2e] font-bold text-lg select-none leading-none">+</span>
            <span class="font-medium text-stone-900">${escapeHtml(ing.measure)}</span>
            <span class="text-stone-700">${escapeHtml(ing.name)}</span>
          </li>
        `;
      })
      .join("");

    const safeImage = escapeHtml(recipe.image);
    const safeName = escapeHtml(titleCasedName);
    const safeCategory = escapeHtml(recipe.category || "Main");
    const safeArea = escapeHtml(recipe.area || "International");

    const warningBannerHtml = (result.hasAllergen || result.hasDietConflict) ? `
      <div class="rounded-2xl p-4 sm:p-5 ${result.hasAllergen ? 'bg-red-50 border border-red-200 text-red-900' : 'bg-amber-50 border border-amber-200 text-amber-900'} flex items-start gap-3.5 mb-8 shadow-xs">
        <div class="p-2 rounded-xl ${result.hasAllergen ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'} flex-shrink-0 mt-0.5">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
          </svg>
        </div>
        <div class="space-y-1">
          <h4 class="font-bold text-sm sm:text-base">${result.hasAllergen ? `Allergen Warning: Contains ${result.allergens.map(a => escapeHtml(a.name)).join(', ')}` : 'Diet Preference Conflict'}</h4>
          <p class="text-xs sm:text-sm ${result.hasAllergen ? 'text-red-700' : 'text-amber-800'} leading-relaxed">
            ${escapeHtml(describeResult(result))}. We've highlighted the relevant ingredients below so you can substitute or take caution.
          </p>
        </div>
      </div>
    ` : '';

    detail.innerHTML = `
      <div class="space-y-10">
        ${warningBannerHtml}
        <!-- Top Hero Section: Photo + Meta Details -->
        <div class="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          
          <!-- Image Column -->
          <div class="md:col-span-5">
            <div class="overflow-hidden rounded-2xl border border-[#efe6dc] shadow-sm bg-stone-100">
              <img id="main-recipe-image" class="w-full aspect-[4/3] object-cover" src="${safeImage}" alt="${safeName}">
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
                ${escapeHtml(recipe.description || `A delicious ${recipe.area ? recipe.area + ' ' : ''}${recipe.category ? recipe.category.toLowerCase() : 'dish'} prepared with fresh, wholesome ingredients and authentic seasoning. Simple to make and full of vibrant flavours.`)}
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
      addPlanBtn.addEventListener("click", async () => {
        if (!(await confirmIfFlagged(recipe))) return;
        // Save to meal plan in localStorage
        try {
          const raw = localStorage.getItem("recipeplan_weekly_plan");
          const plan = raw ? JSON.parse(raw) : {};
          if (!plan.Mon) plan.Mon = {};
          plan.Mon.Dinner = {
            id: recipe.id,
            name: recipe.name,
            image: recipe.image
          };
          localStorage.setItem("recipeplan_weekly_plan", JSON.stringify(plan));
          showToast(`Added "${toTitleCase(recipe.name)}" to Mon Dinner!`);
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
