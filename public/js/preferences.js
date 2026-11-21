// Diet & allergy preferences: storage, ingredient checking and shared UI helpers.
// Owner: Person 1. Every page calls this file, so the rules live in one place.
//
// IMPORTANT: TheMealDB has no allergen data. Everything here is keyword matching
// on ingredient names, so it is a best-effort warning, not a guarantee.

import { getRecipeById } from "./api.js";
import { escapeHtml } from "./utils.js";

const PROFILE_KEY = "recipeplan_profile";
const USER_KEY = "recipeplan_user";
const INGREDIENT_CACHE_KEY = "recipeplan_ingredient_cache";
const INGREDIENT_CACHE_LIMIT = 400;

// ---------- Options shown in onboarding and profile ----------
export const DIET_OPTIONS = [
  { value: "Vegetarian", label: "Vegetarian", description: "No meat or seafood", icon: "🥦" },
  { value: "Vegan", label: "Vegan", description: "No animal products", icon: "🌱" },
  { value: "Pescatarian", label: "Pescatarian", description: "Seafood, but no meat", icon: "🐟" },
  { value: "Gluten Free", label: "Gluten-free", description: "No wheat, barley or rye", icon: "🌾" },
  { value: "Dairy Free", label: "Dairy-free", description: "No milk, butter or cheese", icon: "🥛" },
  { value: "Halal", label: "Halal", description: "Flags pork and alcohol", icon: "🌙" },
  { value: "Kosher", label: "Kosher", description: "Flags pork and shellfish", icon: "✡️" },
  { value: "Low Carb", label: "Low-carb", description: "Reduced sugars & carbs", icon: "🥑" },
  { value: "Keto", label: "Keto", description: "High healthy fat, minimal carbs", icon: "🥩" },
];

export const ALLERGEN_OPTIONS = [
  { value: "Peanuts", label: "Peanuts" },
  { value: "Tree Nuts", label: "Tree nuts" },
  { value: "Dairy", label: "Dairy" },
  { value: "Eggs", label: "Eggs" },
  { value: "Gluten", label: "Gluten / wheat" },
  { value: "Soy", label: "Soy" },
  { value: "Fish", label: "Fish" },
  { value: "Shellfish", label: "Shellfish" },
  { value: "Sesame", label: "Sesame" },
];

// ---------- Keyword groups ----------
// `exclude` phrases are removed from the ingredient name before matching,
// so "coconut milk" never counts as dairy and "butter beans" never counts as butter.
const GROUPS = {
  meat: {
    keywords: [
      "chicken", "beef", "pork", "lamb", "mutton", "veal", "bacon", "ham", "gammon", "sausage",
      "chorizo", "pancetta", "prosciutto", "salami", "pepperoni", "duck", "turkey", "goose",
      "venison", "rabbit", "goat", "steak", "mince", "brisket", "oxtail", "liver", "kidney",
      "lard", "suet", "gelatine", "gelatin", "black pudding", "quail", "pheasant", "bone broth",
    ],
    exclude: ["kidney bean", "kidney beans", "lamb's lettuce", "lambs lettuce"],
  },
  fish: {
    keywords: [
      "fish", "salmon", "tuna", "cod", "haddock", "anchovy", "anchovies", "sardine", "mackerel",
      "trout", "tilapia", "halibut", "sea bass", "monkfish", "pollock", "kipper", "herring",
      "swordfish", "snapper", "plaice", "sole", "worcestershire sauce", "fish sauce",
    ],
    exclude: [],
  },
  shellfish: {
    keywords: [
      "prawn", "shrimp", "crab", "lobster", "mussel", "clam", "oyster", "scallop", "squid",
      "calamari", "octopus", "crayfish", "langoustine", "cockle",
    ],
    exclude: [],
  },
  dairy: {
    keywords: [
      "milk", "butter", "cheese", "cream", "yogurt", "yoghurt", "ghee", "creme fraiche",
      "crème fraîche", "mascarpone", "ricotta", "mozzarella", "parmesan", "parmigiano", "cheddar",
      "feta", "paneer", "buttermilk", "custard", "whey", "brie", "gruyere", "gruyère", "halloumi",
      "gouda", "stilton", "camembert", "pecorino", "fromage frais", "quark", "condensed milk",
    ],
    exclude: [
      "coconut milk", "coconut cream", "almond milk", "oat milk", "soy milk", "soya milk",
      "rice milk", "peanut butter", "almond butter", "cocoa butter", "butter beans",
      "cream of tartar", "creamed coconut",
    ],
  },
  eggs: {
    keywords: ["egg", "egg yolk", "egg white", "mayonnaise", "meringue", "aioli"],
    exclude: ["egg plant", "eggplant"], // aubergine, not egg
  },
  gluten: {
    keywords: [
      "flour", "wheat", "bread", "breadcrumbs", "pasta", "spaghetti", "noodle", "couscous",
      "barley", "rye", "semolina", "pastry", "tortilla", "soy sauce", "lasagne", "lasagna",
      "macaroni", "penne", "fettuccine", "tagliatelle", "linguine", "rigatoni", "bulgur",
      "beer", "biscuit", "digestive", "cracker", "pitta", "pita", "naan", "bun", "baguette",
      "ciabatta", "filo", "brioche", "croissant", "oats", "oat", "seitan", "farro", "spelt",
    ],
    exclude: [
      "rice flour", "cornflour", "corn flour", "almond flour", "coconut flour", "gram flour",
      "chickpea flour", "tapioca flour", "potato flour", "buckwheat flour", "rice noodles",
      "rice noodle", "glass noodles", "rice vermicelli", "gluten-free", "gluten free",
      "corn tortilla", "corn tortillas", "oat milk",
    ],
  },
  peanuts: { keywords: ["peanut", "groundnut", "satay"], exclude: [] },
  treeNuts: {
    keywords: [
      "almond", "walnut", "cashew", "pecan", "pistachio", "hazelnut", "macadamia", "brazil nut",
      "pine nut", "chestnut", "praline", "marzipan", "frangipane", "nutella",
    ],
    exclude: [],
  },
  soy: { keywords: ["soy", "soya", "soy sauce", "tofu", "edamame", "miso", "tempeh", "tamari"], exclude: [] },
  sesame: { keywords: ["sesame", "tahini", "hummus"], exclude: [] },
  honey: { keywords: ["honey"], exclude: [] },
  porkProducts: {
    keywords: [
      "pork", "bacon", "ham", "gammon", "pancetta", "prosciutto", "lard", "chorizo", "salami",
      "pepperoni", "gelatine", "gelatin",
    ],
    exclude: [],
  },
  alcohol: {
    keywords: [
      "wine", "beer", "ale", "stout", "lager", "rum", "brandy", "sherry", "vodka", "whisky",
      "whiskey", "bourbon", "cider", "mirin", "sake", "marsala", "kirsch", "liqueur", "cognac",
      "gin", "tequila", "champagne", "prosecco", "port", "vermouth", "amaretto", "cointreau",
      "grand marnier", "kahlua", "calvados",
    ],
    exclude: ["wine vinegar", "sherry vinegar", "cider vinegar", "rice wine vinegar"],
  },
};

const DIET_RULES = {
  Vegetarian: ["meat", "fish", "shellfish"],
  Vegan: ["meat", "fish", "shellfish", "dairy", "eggs", "honey"],
  Pescatarian: ["meat"],
  "Gluten Free": ["gluten"],
  "Dairy Free": ["dairy"],
  Halal: ["porkProducts", "alcohol"],
  Kosher: ["porkProducts", "shellfish"],
  "Low Carb": ["gluten"],
  Keto: ["gluten"],
};

const ALLERGEN_RULES = {
  Peanuts: ["peanuts"],
  "Tree Nuts": ["treeNuts"],
  Dairy: ["dairy"],
  Eggs: ["eggs"],
  Gluten: ["gluten"],
  Soy: ["soy"],
  Fish: ["fish"],
  Shellfish: ["shellfish"],
  Sesame: ["sesame"],
};

// Maps older/free-typed values onto the canonical ones above.
const ALIASES = {
  "gluten-free": "Gluten Free", "gluten free": "Gluten Free",
  "dairy-free": "Dairy Free", "dairy free": "Dairy Free",
  vegetarian: "Vegetarian", vegan: "Vegan", pescatarian: "Pescatarian", halal: "Halal",
  kosher: "Kosher",
  "low carb": "Low Carb", "low-carb": "Low Carb", lowcarb: "Low Carb",
  keto: "Keto", "keto-friendly": "Keto",
  peanut: "Peanuts", peanuts: "Peanuts",
  nuts: "Tree Nuts", "tree nut": "Tree Nuts", "tree nuts": "Tree Nuts",
  dairy: "Dairy", milk: "Dairy", lactose: "Dairy",
  egg: "Eggs", eggs: "Eggs",
  gluten: "Gluten", wheat: "Gluten",
  soy: "Soy", soya: "Soy",
  fish: "Fish", shellfish: "Shellfish", sesame: "Sesame",
};

export function dietLabel(value) {
  const match = DIET_OPTIONS.find((opt) => opt.value === value);
  return match ? match.label : value;
}

function canonical(value) {
  const key = String(value || "").trim().toLowerCase();
  return ALIASES[key] || String(value || "").trim();
}

// ---------- Storage ----------
function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function currentUid() {
  return readJson(USER_KEY, null)?.uid || null;
}

export function getPreferences() {
  const profile = readJson(PROFILE_KEY, {}) || {};
  const diets = (profile.diets || []).map(canonical).filter((d) => DIET_RULES[d]);
  const allergies = [...new Set((profile.allergies || []).map(canonical).filter(Boolean))];
  return {
    diets,
    allergies,
    hideFlagged: profile.hideFlagged === true,
    onboardingComplete: profile.onboardingComplete === true,
    onboardingStep: profile.onboardingStep === 2 ? 2 : 1,
  };
}

export function hasPreferences(prefs = getPreferences()) {
  return prefs.diets.length > 0 || prefs.allergies.length > 0;
}

// True when a logged-in user has not finished onboarding yet.
export function needsOnboarding() {
  return getPreferences().onboardingComplete !== true;
}

// Saves to localStorage immediately, then to Firestore (merge) in the background.
export async function savePreferences(partial) {
  const profile = { ...(readJson(PROFILE_KEY, {}) || {}), ...partial };
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  window.dispatchEvent(new CustomEvent("preferences-changed"));

  const uid = currentUid();
  if (uid) {
    try {
      const [{ db }, { doc, setDoc }] = await Promise.all([
        import("./firebase-config.js"),
        import("https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js"),
      ]);
      await setDoc(doc(db, "users", uid), partial, { merge: true });
    } catch (err) {
      console.warn("Could not save preferences to Firestore:", err);
    }
  }
}

// Pulls the latest preferences from Firestore into localStorage (with a timeout).
export async function syncPreferencesFromCloud(uid = currentUid(), timeoutMs = 3000) {
  if (!uid) return getPreferences();
  try {
    const [{ db }, { doc, getDoc }] = await Promise.all([
      import("./firebase-config.js"),
      import("https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js"),
    ]);
    const snap = await Promise.race([
      getDoc(doc(db, "users", uid)),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), timeoutMs)),
    ]);
    if (snap && snap.exists()) {
      const data = snap.data();
      const profile = readJson(PROFILE_KEY, {}) || {};
      ["diets", "allergies", "onboardingComplete", "onboardingStep", "hideFlagged"].forEach((key) => {
        if (data[key] !== undefined) profile[key] = data[key];
      });
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    }
  } catch (err) {
    console.warn("Could not sync preferences from Firestore:", err.message || err);
  }
  return getPreferences();
}

// ---------- Matching ----------
function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const regexCache = new Map();
function keywordRegex(keyword) {
  if (!regexCache.has(keyword)) {
    regexCache.set(keyword, new RegExp(`\\b${escapeRegex(keyword)}(?:e?s)?\\b`, "i"));
  }
  return regexCache.get(keyword);
}

function matchesGroup(ingredientName, group) {
  let text = ` ${ingredientName.toLowerCase()} `;
  group.exclude.forEach((phrase) => {
    text = text.split(phrase).join(" ");
  });
  return group.keywords.some((kw) => keywordRegex(kw).test(text));
}

function matchesGroups(ingredientName, groupNames) {
  return groupNames.some((name) => GROUPS[name] && matchesGroup(ingredientName, GROUPS[name]));
}

// Custom "Other" allergies are matched on the word itself.
function customGroup(allergy) {
  const word = allergy.toLowerCase().replace(/s$/, "");
  return { keywords: [word], exclude: [] };
}

// Checks a list of ingredient names against the user's preferences.
export function checkIngredients(ingredientNames, prefs = getPreferences()) {
  const names = (ingredientNames || []).filter(Boolean);
  const allergens = [];
  const dietConflicts = [];
  const byIngredient = {}; // lowercased ingredient name -> labels that flagged it

  const flag = (name, label) => {
    const key = name.toLowerCase();
    byIngredient[key] = byIngredient[key] || [];
    if (!byIngredient[key].includes(label)) byIngredient[key].push(label);
  };

  prefs.allergies.forEach((allergy) => {
    const groups = ALLERGEN_RULES[allergy];
    const matches = names.filter((n) =>
      groups ? matchesGroups(n, groups) : matchesGroup(n, customGroup(allergy))
    );
    if (matches.length) {
      allergens.push({ name: allergy, matches });
      matches.forEach((m) => flag(m, allergy));
    }
  });

  prefs.diets.forEach((diet) => {
    const matches = names.filter((n) => matchesGroups(n, DIET_RULES[diet]));
    if (matches.length) {
      dietConflicts.push({ name: diet, matches });
      matches.forEach((m) => flag(m, `Not ${dietLabel(diet)}`));
    }
  });

  return {
    known: names.length > 0,
    allergens,
    dietConflicts,
    byIngredient,
    hasAllergen: allergens.length > 0,
    hasDietConflict: dietConflicts.length > 0,
  };
}

export function checkRecipe(recipe, prefs = getPreferences()) {
  return checkIngredients((recipe.ingredients || []).map((i) => (typeof i === "string" ? i : i.name)), prefs);
}

// ---------- Ingredient lookup (search/category/favourite results have no ingredients) ----------
function readIngredientCache() {
  return readJson(INGREDIENT_CACHE_KEY, {}) || {};
}

function writeIngredientCache(cache) {
  const ids = Object.keys(cache);
  if (ids.length > INGREDIENT_CACHE_LIMIT) {
    ids.slice(0, ids.length - INGREDIENT_CACHE_LIMIT).forEach((id) => delete cache[id]);
  }
  try {
    localStorage.setItem(INGREDIENT_CACHE_KEY, JSON.stringify(cache));
  } catch (e) {}
}

// Returns ingredient names for a recipe, looking them up (and caching) when missing.
export async function getIngredientNames(recipe) {
  if (Array.isArray(recipe.ingredients) && recipe.ingredients.length) {
    return recipe.ingredients.map((i) => (typeof i === "string" ? i : i.name));
  }
  const id = String(recipe.id || "");
  if (!id) return [];
  const cache = readIngredientCache();
  if (cache[id]) return cache[id];
  try {
    const full = await getRecipeById(id);
    const names = (full?.ingredients || []).map((i) => i.name);
    if (names.length) {
      const fresh = readIngredientCache();
      fresh[id] = names;
      writeIngredientCache(fresh);
    }
    return names;
  } catch (e) {
    return [];
  }
}

// Checks many recipes, fetching missing ingredients with limited concurrency.
// Returns an array of { recipe, result } in the original order.
export async function checkRecipes(recipes, prefs = getPreferences(), concurrency = 6) {
  const out = new Array(recipes.length);
  let next = 0;
  async function worker() {
    while (next < recipes.length) {
      const index = next++;
      const names = await getIngredientNames(recipes[index]);
      out[index] = { recipe: recipes[index], result: checkIngredients(names, prefs) };
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, recipes.length) }, worker));
  return out;
}

// ---------- Shared UI ----------
const WARNING_SVG = `<svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>`;

// Adds allergen / diet badges to a card built by createRecipeCard().
export function decorateCard(card, result) {
  if (!card || !result) return;
  card.querySelector(".pref-badges")?.remove();
  if (!result.hasAllergen && !result.hasDietConflict) return;

  const host = card.querySelector(".relative") || card;
  const wrap = document.createElement("div");
  wrap.className = "pref-badges absolute top-3 left-3 right-3 flex flex-wrap gap-1.5 pointer-events-none";

  if (result.hasAllergen) {
    const names = result.allergens.map((a) => a.name).join(", ");
    wrap.insertAdjacentHTML(
      "beforeend",
      `<span class="inline-flex items-center gap-1 bg-red-600/95 text-white text-[11px] font-semibold px-2 py-1 rounded-full shadow-sm backdrop-blur" title="Contains ${escapeHtml(names)}">${WARNING_SVG}Contains ${escapeHtml(names)}</span>`
    );
  }
  result.dietConflicts.forEach((d) => {
    wrap.insertAdjacentHTML(
      "beforeend",
      `<span class="inline-flex items-center bg-white/95 text-stone-700 text-[11px] font-semibold px-2 py-1 rounded-full shadow-sm border border-stone-200">Not ${escapeHtml(dietLabel(d.name))}</span>`
    );
  });
  host.appendChild(wrap);
}

export function describeResult(result) {
  const parts = [];
  result.allergens.forEach((a) => parts.push(`${a.name} (${a.matches.join(", ")})`));
  result.dietConflicts.forEach((d) => parts.push(`not ${dietLabel(d.name)} (${d.matches.join(", ")})`));
  return parts.join("; ");
}

// ---------- Swap suggestions ----------
// What to use instead of a flagged ingredient. Each keyword group has a list of rules:
// the first rule whose `match` words appear in the ingredient name is used, and the
// rule without `match` is the fallback. Each option lists the keyword groups it
// contains in `has` (e.g. soy milk has "soy"), so we never suggest something the
// user also has to avoid. These are ideas, not safety advice.
const SWAPS = {
  dairy: [
    { match: ["buttermilk"], options: [{ text: "plant milk with a squeeze of lemon" }] },
    { match: ["milk"], options: [{ text: "oat milk", has: ["gluten"] }, { text: "soy milk", has: ["soy"] }, { text: "rice milk" }] },
    { match: ["butter", "ghee"], options: [{ text: "olive oil" }, { text: "dairy-free spread" }, { text: "coconut oil" }] },
    { match: ["cream", "creme fraiche", "crème fraîche", "mascarpone"], options: [{ text: "coconut cream" }, { text: "oat cream", has: ["gluten"] }] },
    { match: ["yogurt", "yoghurt"], options: [{ text: "coconut yogurt" }, { text: "soy yogurt", has: ["soy"] }] },
    { options: [{ text: "nutritional yeast (for a cheesy taste)" }, { text: "dairy-free cheese" }] },
  ],
  eggs: [
    { match: ["mayonnaise", "aioli"], options: [{ text: "egg-free (vegan) mayonnaise" }] },
    { match: ["meringue", "egg white"], options: [{ text: "aquafaba (the water from a tin of chickpeas)" }] },
    { options: [{ text: "1 tbsp ground flaxseed + 3 tbsp water for each one" }, { text: "mashed banana or apple sauce (in baking)" }] },
  ],
  gluten: [
    { match: ["soy sauce"], options: [{ text: "tamari (gluten-free soy sauce)", has: ["soy"] }, { text: "coconut aminos" }] },
    { match: ["breadcrumbs"], options: [{ text: "gluten-free breadcrumbs" }, { text: "ground almonds", has: ["treeNuts"] }] },
    { match: ["flour"], options: [{ text: "a gluten-free flour blend" }, { text: "cornflour (for thickening)" }] },
    { match: ["pasta", "spaghetti", "macaroni", "penne", "fettuccine", "tagliatelle", "linguine", "rigatoni", "lasagne", "lasagna"], options: [{ text: "gluten-free pasta" }, { text: "rice noodles" }] },
    { match: ["noodle"], options: [{ text: "rice noodles" }, { text: "glass noodles" }] },
    { match: ["couscous", "bulgur", "barley", "farro", "spelt"], options: [{ text: "quinoa" }, { text: "rice" }] },
    { match: ["oats", "oat"], options: [{ text: "oats labelled gluten-free" }] },
    { match: ["beer"], options: [{ text: "vegetable stock" }] },
    { match: ["tortilla"], options: [{ text: "corn tortillas" }] },
    { match: ["pastry", "filo"], options: [{ text: "gluten-free pastry" }] },
    { options: [{ text: "a gluten-free version" }] },
  ],
  peanuts: [
    { options: [{ text: "sunflower seed spread" }, { text: "toasted sunflower or pumpkin seeds" }] },
  ],
  treeNuts: [
    { match: ["marzipan", "frangipane", "praline", "nutella"], options: [{ text: "leave it out, or use a nut-free spread" }] },
    { options: [{ text: "toasted pumpkin or sunflower seeds" }, { text: "toasted oats", has: ["gluten"] }] },
  ],
  soy: [
    { match: ["soy sauce", "tamari"], options: [{ text: "coconut aminos" }] },
    { match: ["tofu", "tempeh"], options: [{ text: "chickpeas" }, { text: "paneer", has: ["dairy"] }] },
    { match: ["edamame"], options: [{ text: "peas" }, { text: "broad beans" }] },
    { options: [{ text: "a soy-free version" }] },
  ],
  sesame: [
    { match: ["sesame oil"], options: [{ text: "olive oil" }, { text: "sunflower oil" }] },
    { match: ["tahini"], options: [{ text: "sunflower seed spread" }] },
    { match: ["hummus"], options: [{ text: "a sesame-free bean dip" }] },
    { options: [{ text: "sunflower seeds" }, { text: "poppy seeds" }] },
  ],
  fish: [
    { match: ["fish sauce", "anchovy", "anchovies"], options: [{ text: "soy sauce", has: ["soy", "gluten"] }, { text: "a pinch of salt and a squeeze of lime" }] },
    { match: ["worcestershire sauce"], options: [{ text: "fish-free Worcestershire sauce" }, { text: "soy sauce", has: ["soy", "gluten"] }] },
    { options: [{ text: "chicken", has: ["meat"] }, { text: "firm tofu", has: ["soy"] }, { text: "chickpeas" }] },
  ],
  shellfish: [
    { options: [{ text: "chicken", has: ["meat"] }, { text: "firm tofu", has: ["soy"] }, { text: "mushrooms" }] },
  ],
  meat: [
    { match: ["mince", "minced"], options: [{ text: "lentils" }, { text: "plant-based mince" }] },
    { match: ["bacon", "pancetta"], options: [{ text: "smoked tofu", has: ["soy"] }, { text: "mushrooms with smoked paprika" }] },
    { match: ["sausage", "chorizo"], options: [{ text: "vegetarian sausages" }] },
    { match: ["gelatine", "gelatin"], options: [{ text: "agar agar" }] },
    { match: ["lard", "suet"], options: [{ text: "vegetable shortening" }, { text: "vegetable suet" }] },
    { match: ["bone broth"], options: [{ text: "vegetable stock" }] },
    { options: [{ text: "mushrooms" }, { text: "chickpeas or lentils" }, { text: "firm tofu", has: ["soy"] }] },
  ],
  porkProducts: [
    { match: ["bacon", "pancetta", "ham", "gammon", "prosciutto"], options: [{ text: "turkey or beef rashers", has: ["meat"] }, { text: "mushrooms with smoked paprika" }] },
    { match: ["gelatine", "gelatin"], options: [{ text: "agar agar" }] },
    { match: ["lard"], options: [{ text: "vegetable shortening" }] },
    { options: [{ text: "chicken or beef", has: ["meat"] }] },
  ],
  alcohol: [
    { match: ["mirin"], options: [{ text: "rice vinegar with a little sugar" }] },
    { match: ["wine", "sherry", "marsala", "port", "vermouth"], options: [{ text: "vegetable stock with a splash of vinegar" }, { text: "grape juice (in sweet dishes)" }] },
    { options: [{ text: "vegetable stock" }, { text: "a splash of vinegar or citrus juice" }] },
  ],
  honey: [
    { options: [{ text: "maple syrup" }, { text: "agave syrup" }] },
  ],
};

// Diets where a swap makes sense. Low Carb and Keto flag pasta and bread too, but
// "gluten-free pasta" is no help there, so they get no swaps.
const SWAP_DIETS = ["Vegetarian", "Vegan", "Pescatarian", "Gluten Free", "Dairy Free", "Halal", "Kosher"];

function swapRuleFor(ingredientName, groupName) {
  const rules = SWAPS[groupName] || [];
  return rules.find((rule) => !rule.match || rule.match.some((kw) => keywordRegex(kw).test(ingredientName))) || null;
}

// Returns swap ideas for the flagged ingredients in a checkRecipe/checkIngredients result:
// [{ ingredient: "butter", options: ["olive oil", "dairy-free spread"] }, ...]
export function getSwapSuggestions(result, prefs = getPreferences()) {
  if (!result) return [];

  // Every keyword group the user avoids, so an option that contains one is dropped.
  const avoided = new Set();
  (prefs.allergies || []).forEach((a) => (ALLERGEN_RULES[a] || []).forEach((g) => avoided.add(g)));
  (prefs.diets || []).forEach((d) => (DIET_RULES[d] || []).forEach((g) => avoided.add(g)));
  const customAllergies = (prefs.allergies || []).filter((a) => !ALLERGEN_RULES[a]);

  const isSafe = (option) =>
    !(option.has || []).some((g) => avoided.has(g)) &&
    !customAllergies.some((a) => matchesGroup(option.text, customGroup(a)));

  // ingredient (lowercase) -> { ingredient, options[] }, in the order they were flagged
  const byIngredient = new Map();
  const addSwaps = (ingredientName, groupNames) => {
    groupNames.forEach((groupName) => {
      if (!GROUPS[groupName] || !matchesGroup(ingredientName, GROUPS[groupName])) return;
      const rule = swapRuleFor(ingredientName, groupName);
      if (!rule) return;
      const key = ingredientName.toLowerCase();
      if (!byIngredient.has(key)) byIngredient.set(key, { ingredient: ingredientName, options: [] });
      const entry = byIngredient.get(key);
      rule.options.filter(isSafe).forEach((o) => {
        if (!entry.options.includes(o.text)) entry.options.push(o.text);
      });
    });
  };

  (result.allergens || []).forEach((a) => {
    (a.matches || []).forEach((m) => addSwaps(m, ALLERGEN_RULES[a.name] || []));
  });
  (result.dietConflicts || []).forEach((d) => {
    if (!SWAP_DIETS.includes(d.name)) return;
    (d.matches || []).forEach((m) => addSwaps(m, DIET_RULES[d.name] || []));
  });

  return [...byIngredient.values()]
    .filter((entry) => entry.options.length)
    .map((entry) => ({ ingredient: entry.ingredient, options: entry.options.slice(0, 3) }));
}

function capitalizeWords(text) {
  return String(text || "").replace(/(^|[\s(-])([a-z])/g, (m, pre, ch) => pre + ch.toUpperCase());
}

// Custom modal dialog that warns the user when a recipe has allergens or diet conflicts
export function openFlaggedRecipeModal(recipe, result) {
  return new Promise((resolve) => {
    // Clean up any stale modal in DOM
    const existing = document.getElementById("flagged-recipe-modal");
    if (existing) existing.remove();

    const backdrop = document.createElement("div");
    backdrop.id = "flagged-recipe-modal";
    backdrop.className = "fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm opacity-0 transition-opacity duration-200";
    backdrop.setAttribute("role", "dialog");
    backdrop.setAttribute("aria-modal", "true");

    // Simple table rows: the allergen (or diet) on the left, the ingredients it came from on the right.
    const flagRows = (items, titleOf) => items.map((item) => `
      <li class="flex items-baseline justify-between gap-4 px-4 py-2.5">
        <span class="text-sm font-semibold text-stone-900 shrink-0">${escapeHtml(titleOf(item))}</span>
        <span class="text-sm text-stone-500 text-right">${escapeHtml(item.matches.map(capitalizeWords).join(", "))}</span>
      </li>`).join("");

    const allergensList = (result.allergens || []).length
      ? `<ul class="rounded-2xl bg-red-50/70 border border-red-100 divide-y divide-red-100 text-left">
          ${flagRows(result.allergens, (a) => a.name)}
        </ul>`
      : "";

    const dietConflictsList = (result.dietConflicts || []).length
      ? `<ul class="rounded-2xl bg-amber-50/70 border border-amber-100 divide-y divide-amber-100 text-left">
          ${flagRows(result.dietConflicts, (d) => `Not ${dietLabel(d.name)}`)}
        </ul>`
      : "";

    const recipeName = escapeHtml(recipe.name || "This recipe");
    const recipeImage = recipe.image ? escapeHtml(recipe.image) : "";

    backdrop.innerHTML = `
      <div class="relative w-full max-w-md bg-white rounded-3xl border border-[#efe6dc] shadow-2xl p-6 sm:p-7 transform scale-95 opacity-0 transition-all duration-200 ease-out">
        <!-- Top Header with Recipe Info -->
        <div class="flex items-center gap-3 text-left mb-4 p-3 bg-stone-50/90 rounded-2xl border border-stone-100">
          ${recipeImage ? `
            <img src="${recipeImage}" alt="${recipeName}" class="w-12 h-12 rounded-xl object-cover flex-shrink-0 border border-stone-200">
          ` : `
            <div class="w-12 h-12 rounded-xl ${result.hasAllergen ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'} flex items-center justify-center flex-shrink-0">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              </svg>
            </div>
          `}
          <div class="min-w-0 flex-1">
            <h4 class="font-bold text-stone-900 text-sm sm:text-base leading-tight truncate">${recipeName}</h4>
            <span class="inline-flex items-center gap-1 text-xs font-semibold ${result.hasAllergen ? 'text-red-600' : 'text-amber-700'} mt-0.5">
              ${result.hasAllergen ? 'Contains Allergens' : 'Diet Conflict'}
            </span>
          </div>
          <!-- Close Button (inside the recipe box so it never overlaps it) -->
          <button type="button" id="flagged-modal-close" class="self-start w-8 h-8 rounded-full text-stone-400 hover:text-stone-700 hover:bg-white flex items-center justify-center text-xl flex-shrink-0 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ca5c2e]/40" aria-label="Close modal">
            &times;
          </button>
        </div>

        <h3 class="text-lg font-bold text-stone-900 tracking-tight text-left">
          ${result.hasAllergen ? "Allergen Warning" : "Diet Preference Conflict"}
        </h3>
        <p class="text-xs text-stone-500 mt-1 text-left">
          This recipe may not suit your preferences based on its ingredients:
        </p>

        <!-- Flagged Items List -->
        <div class="mt-3 space-y-2 max-h-56 overflow-y-auto">
          ${allergensList}
          ${dietConflictsList}
        </div>
        <p class="mt-2 text-[11px] text-stone-400 text-left">Matched on ingredient names, so this is a helper rather than a guarantee.</p>

        <p class="text-xs font-medium text-stone-600 mt-4 text-left">
          Would you like to add it to your meal plan anyway?
        </p>

        <!-- Action Buttons -->
        <div class="mt-5 flex items-center justify-end gap-3 pt-2">
          <button type="button" id="flagged-modal-cancel" class="flex-1 px-4 py-2.5 rounded-xl border border-stone-200 text-stone-700 hover:bg-stone-50 font-semibold text-sm transition focus:outline-none">
            Cancel
          </button>
          <button type="button" id="flagged-modal-confirm" class="flex-1 px-4 py-2.5 rounded-xl bg-[#ca5c2e] hover:bg-[#b34d23] text-white font-semibold text-sm shadow-sm transition focus:outline-none">
            Add Anyway
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);
    const dialog = backdrop.querySelector(".relative");

    // Animate in
    requestAnimationFrame(() => {
      backdrop.classList.remove("opacity-0");
      backdrop.classList.add("opacity-100");
      dialog.classList.remove("scale-95", "opacity-0");
      dialog.classList.add("scale-100", "opacity-100");
    });

    let closed = false;
    function cleanup(confirmed) {
      if (closed) return;
      closed = true;
      document.removeEventListener("keydown", onKeyDown);

      backdrop.classList.remove("opacity-100");
      backdrop.classList.add("opacity-0");
      dialog.classList.remove("scale-100", "opacity-100");
      dialog.classList.add("scale-95", "opacity-0");

      setTimeout(() => {
        backdrop.remove();
        resolve(confirmed);
      }, 200);
    }

    function onKeyDown(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        cleanup(false);
      }
    }

    document.addEventListener("keydown", onKeyDown);

    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) cleanup(false);
    });

    backdrop.querySelector("#flagged-modal-close")?.addEventListener("click", () => cleanup(false));
    backdrop.querySelector("#flagged-modal-cancel")?.addEventListener("click", () => cleanup(false));
    backdrop.querySelector("#flagged-modal-confirm")?.addEventListener("click", () => cleanup(true));
  });
}

// Asks for confirmation before adding a flagged recipe to the meal plan.
// Resolves true if the recipe is fine or the user confirms.
export async function confirmIfFlagged(recipe) {
  const prefs = getPreferences();
  if (!hasPreferences(prefs)) return true;
  const names = await getIngredientNames(recipe);
  const result = checkIngredients(names, prefs);
  if (!result.hasAllergen && !result.hasDietConflict) return true;
  return openFlaggedRecipeModal(recipe, result);
}
