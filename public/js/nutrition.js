// Rough nutrition estimates from a recipe's ingredient list.
// TheMealDB has no nutrition data, so we look up common ingredients in a small
// table (values per 100 g) and turn each measure ("2 tbsp", "1/2 cup", "400g")
// into grams. Anything we cannot recognise is skipped and reported as such.
// These are estimates for guidance only, not exact figures.

// kcal, protein, carbs, fat per 100 g.
// piece = grams for one item ("2 eggs"), cup = grams per cup when not ~240 g.
const FOODS = {
  // Meat and fish
  "chicken breast": { kcal: 165, p: 31, c: 0, f: 3.6, piece: 175 },
  "chicken thigh": { kcal: 209, p: 26, c: 0, f: 11, piece: 110 },
  "chicken": { kcal: 190, p: 27, c: 0, f: 8, piece: 150 },
  "beef": { kcal: 250, p: 26, c: 0, f: 15 },
  "minced beef": { kcal: 250, p: 26, c: 0, f: 15 },
  "lamb": { kcal: 282, p: 25, c: 0, f: 20 },
  "pork": { kcal: 242, p: 27, c: 0, f: 14 },
  "bacon": { kcal: 541, p: 37, c: 1.4, f: 42, piece: 12 },
  "sausage": { kcal: 301, p: 12, c: 2, f: 27, piece: 60 },
  "ham": { kcal: 145, p: 21, c: 1.5, f: 6, piece: 30 },
  "salmon": { kcal: 208, p: 20, c: 0, f: 13, piece: 150 },
  "tuna": { kcal: 132, p: 28, c: 0, f: 1.3 },
  "cod": { kcal: 82, p: 18, c: 0, f: 0.7, piece: 150 },
  "prawn": { kcal: 99, p: 24, c: 0.2, f: 0.3, piece: 12 },
  "shrimp": { kcal: 99, p: 24, c: 0.2, f: 0.3, piece: 12 },
  "fish": { kcal: 120, p: 22, c: 0, f: 3, piece: 150 },

  // Dairy and eggs
  "egg": { kcal: 143, p: 12.6, c: 0.7, f: 9.5, piece: 50 },
  "milk": { kcal: 61, p: 3.2, c: 4.8, f: 3.3 },
  "butter": { kcal: 717, p: 0.9, c: 0.1, f: 81, cup: 227 },
  "cheese": { kcal: 400, p: 25, c: 1.3, f: 33, cup: 113 },
  "cheddar": { kcal: 403, p: 25, c: 1.3, f: 33, cup: 113 },
  "pecorino": { kcal: 387, p: 32, c: 3.6, f: 27, cup: 100 },
  "parmesan": { kcal: 431, p: 38, c: 4, f: 29, cup: 100 },
  "mozzarella": { kcal: 280, p: 28, c: 3, f: 17, piece: 125, cup: 113 },
  "feta": { kcal: 264, p: 14, c: 4, f: 21, cup: 150 },
  "cream": { kcal: 340, p: 2.1, c: 2.8, f: 36 },
  "double cream": { kcal: 449, p: 1.7, c: 2.7, f: 48 },
  "creme fraiche": { kcal: 290, p: 2.4, c: 2.6, f: 30 },
  "yogurt": { kcal: 61, p: 3.5, c: 4.7, f: 3.3 },
  "yoghurt": { kcal: 61, p: 3.5, c: 4.7, f: 3.3 },

  // Grains, starches and baking
  "flour": { kcal: 364, p: 10, c: 76, f: 1, cup: 125 },
  "rice": { kcal: 130, p: 2.7, c: 28, f: 0.3, cup: 185 },
  "pasta": { kcal: 371, p: 13, c: 75, f: 1.5 },
  "spaghetti": { kcal: 371, p: 13, c: 75, f: 1.5 },
  "lasagne sheets": { kcal: 371, p: 13, c: 75, f: 1.5 },
  "noodles": { kcal: 138, p: 4.5, c: 25, f: 2 },
  "quinoa": { kcal: 368, p: 14, c: 64, f: 6, cup: 170 },
  "oats": { kcal: 389, p: 17, c: 66, f: 7, cup: 90 },
  "bread": { kcal: 265, p: 9, c: 49, f: 3.2, piece: 30 },
  "breadcrumbs": { kcal: 395, p: 13, c: 72, f: 5, cup: 108 },
  "potato": { kcal: 77, p: 2, c: 17, f: 0.1, piece: 170 },
  "potatoes": { kcal: 77, p: 2, c: 17, f: 0.1, piece: 170 },
  "puff pastry": { kcal: 558, p: 7, c: 46, f: 38 },
  "pastry": { kcal: 520, p: 6.5, c: 50, f: 32 },
  "sugar": { kcal: 387, p: 0, c: 100, f: 0, cup: 200 },
  "brown sugar": { kcal: 380, p: 0.1, c: 98, f: 0, cup: 220 },
  "honey": { kcal: 304, p: 0.3, c: 82, f: 0, cup: 340 },
  "maple syrup": { kcal: 260, p: 0, c: 67, f: 0.1, cup: 315 },
  "cornstarch": { kcal: 381, p: 0.3, c: 91, f: 0.1, cup: 128 },
  "cocoa": { kcal: 228, p: 20, c: 58, f: 14, cup: 86 },
  "chocolate": { kcal: 546, p: 4.9, c: 61, f: 31 },

  // Oils, sauces and stocks
  "oil": { kcal: 884, p: 0, c: 0, f: 100, cup: 218 },
  "olive oil": { kcal: 884, p: 0, c: 0, f: 100, cup: 216 },
  "soy sauce": { kcal: 53, p: 8, c: 4.9, f: 0.6 },
  "fish sauce": { kcal: 35, p: 5, c: 3.6, f: 0 },
  "tomato puree": { kcal: 82, p: 4.3, c: 19, f: 0.5 },
  "chopped tomatoes": { kcal: 21, p: 1, c: 4, f: 0.2 },
  "coconut milk": { kcal: 230, p: 2.3, c: 6, f: 24 },
  "stock": { kcal: 5, p: 0.5, c: 0.5, f: 0.2 },
  "stock cube": { kcal: 250, p: 10, c: 25, f: 12, piece: 10 },
  "red wine": { kcal: 85, p: 0.1, c: 2.6, f: 0 },
  "white wine": { kcal: 82, p: 0.1, c: 2.6, f: 0 },
  "mayonnaise": { kcal: 680, p: 1, c: 0.6, f: 75 },
  "mustard": { kcal: 66, p: 4, c: 5.8, f: 4 },

  // Vegetables
  "onion": { kcal: 40, p: 1.1, c: 9.3, f: 0.1, piece: 110 },
  "onions": { kcal: 40, p: 1.1, c: 9.3, f: 0.1, piece: 110 },
  "garlic": { kcal: 149, p: 6.4, c: 33, f: 0.5, piece: 5 },
  "tomato": { kcal: 18, p: 0.9, c: 3.9, f: 0.2, piece: 120 },
  "tomatoes": { kcal: 18, p: 0.9, c: 3.9, f: 0.2, piece: 120 },
  "carrot": { kcal: 41, p: 0.9, c: 10, f: 0.2, piece: 60 },
  "carrots": { kcal: 41, p: 0.9, c: 10, f: 0.2, piece: 60 },
  "celery": { kcal: 16, p: 0.7, c: 3, f: 0.2, piece: 40 },
  "pepper": { kcal: 31, p: 1, c: 6, f: 0.3, piece: 120 },
  "mushrooms": { kcal: 22, p: 3.1, c: 3.3, f: 0.3, piece: 18 },
  "spinach": { kcal: 23, p: 2.9, c: 3.6, f: 0.4, cup: 30 },
  "broccoli": { kcal: 34, p: 2.8, c: 7, f: 0.4, cup: 90 },
  "peas": { kcal: 81, p: 5.4, c: 14, f: 0.4, cup: 145 },
  "green beans": { kcal: 31, p: 1.8, c: 7, f: 0.2, cup: 110 },
  "cucumber": { kcal: 15, p: 0.7, c: 3.6, f: 0.1, piece: 300 },
  "courgette": { kcal: 17, p: 1.2, c: 3.1, f: 0.3, piece: 200 },
  "aubergine": { kcal: 25, p: 1, c: 6, f: 0.2, piece: 450 },
  "eggplant": { kcal: 25, p: 1, c: 6, f: 0.2, piece: 450 },
  "butter beans": { kcal: 103, p: 7, c: 18, f: 0.4, cup: 180 },
  "lettuce": { kcal: 15, p: 1.4, c: 2.9, f: 0.2, piece: 300 },
  "avocado": { kcal: 160, p: 2, c: 8.5, f: 15, piece: 150 },
  "olives": { kcal: 115, p: 0.8, c: 6, f: 11, piece: 4, cup: 135 },
  "stir-fry vegetables": { kcal: 35, p: 2, c: 7, f: 0.3, cup: 90 },
  "chickpeas": { kcal: 164, p: 8.9, c: 27, f: 2.6, cup: 165 },
  "lentils": { kcal: 116, p: 9, c: 20, f: 0.4, cup: 200 },
  "beans": { kcal: 127, p: 8.7, c: 23, f: 0.5, cup: 175 },

  // Fruit and nuts
  "banana": { kcal: 89, p: 1.1, c: 23, f: 0.3, piece: 120 },
  "apple": { kcal: 52, p: 0.3, c: 14, f: 0.2, piece: 180 },
  "lemon": { kcal: 29, p: 1.1, c: 9, f: 0.3, piece: 60 },
  "lime": { kcal: 30, p: 0.7, c: 11, f: 0.2, piece: 45 },
  "raspberries": { kcal: 52, p: 1.2, c: 12, f: 0.7, cup: 125 },
  "blueberries": { kcal: 57, p: 0.7, c: 14, f: 0.3, cup: 148 },
  "strawberries": { kcal: 32, p: 0.7, c: 7.7, f: 0.3, cup: 150 },
  "almonds": { kcal: 579, p: 21, c: 22, f: 50, cup: 143 },
  "pecan": { kcal: 691, p: 9, c: 14, f: 72, cup: 110 },
  "walnuts": { kcal: 654, p: 15, c: 14, f: 65, cup: 117 },
  "peanuts": { kcal: 567, p: 26, c: 16, f: 49, cup: 146 },
  "peanut butter": { kcal: 588, p: 25, c: 20, f: 50, cup: 258 },
};

// Ingredients that add almost nothing (salt, spices, water, herbs).
// They count as "recognised" so they do not lower the coverage score.
const NEGLIGIBLE = [
  "salt", "black pepper", "water", "baking powder", "baking soda", "bicarbonate",
  "vanilla", "cinnamon", "cumin", "paprika", "turmeric", "oregano", "thyme",
  "basil", "parsley", "coriander", "cilantro", "mint", "rosemary", "bay leaf",
  "bay leaves", "chilli", "chili", "ginger", "nutmeg", "cayenne", "garam masala",
  "curry powder", "spice", "seasoning", "vinegar", "lemongrass", "galangal",
  "kaffir", "lime leaves", "saffron", "cloves", "cardamom", "dill", "chives",
];

// Grams per unit. Volume units assume roughly water density unless the food sets "cup".
const UNIT_GRAMS = {
  g: 1, gram: 1, grams: 1, kg: 1000,
  ml: 1, l: 1000, litre: 1000, liter: 1000,
  oz: 28.35, lb: 453.6, lbs: 453.6, pound: 453.6, pounds: 453.6,
  tsp: 5, teaspoon: 5, teaspoons: 5,
  tbsp: 15, tbs: 15, tbls: 15, tblsp: 15, tablespoon: 15, tablespoons: 15,
  cup: 240, cups: 240,
  pinch: 0.5, dash: 0.5,
  handful: 30,
  clove: 5, cloves: 5,
  slice: 30, slices: 30,
  can: 400, tin: 400,
};

// TheMealDB does not have a dedicated servings field, so we first check if the author
// stated servings in the instructions (e.g. "Makes about four servings", "Serves 4"),
// and if not, we estimate from the total calories: about 600 kcal per portion, between 1 and 8 servings.
const KCAL_PER_PORTION = 600;
const MIN_SERVINGS = 1;
const MAX_SERVINGS = 8;

const NUMBER_WORDS = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12,
};

export function extractStatedServings(text) {
  if (!text || typeof text !== "string") return null;
  const wordOrNum = "(?:[0-9]+|one|two|three|four|five|six|seven|eight|nine|ten|twelve)";
  const pattern1 = new RegExp(
    `(?:makes|serves|servings?|yields?)\\s*(?::)?\\s*(?:about|approx\\.?|approximately)?\\s*(${wordOrNum})(?:\\s*(?:-|to)\\s*(${wordOrNum}))?\\s*(?:servings?|portions?|people|plates|bowls)?`,
    "i"
  );
  const match1 = text.match(pattern1);
  if (match1) {
    const parseNum = (s) => {
      if (!s) return null;
      const n = parseInt(s, 10);
      if (!isNaN(n) && n > 0) return n;
      return NUMBER_WORDS[s.toLowerCase().trim()] || null;
    };
    const min = parseNum(match1[1]);
    const max = parseNum(match1[2]);
    if (min && max) return Math.min(MAX_SERVINGS, Math.max(MIN_SERVINGS, Math.round((min + max) / 2)));
    if (min) return Math.min(MAX_SERVINGS, Math.max(MIN_SERVINGS, min));
  }

  const pattern2 = new RegExp(`for\\s+(${wordOrNum})\\s+(?:servings?|people|portions?)`, "i");
  const match2 = text.match(pattern2);
  if (match2) {
    const parseNum = (s) => {
      if (!s) return null;
      const n = parseInt(s, 10);
      if (!isNaN(n) && n > 0) return n;
      return NUMBER_WORDS[s.toLowerCase().trim()] || null;
    };
    const val = parseNum(match2[1]);
    if (val) return Math.min(MAX_SERVINGS, Math.max(MIN_SERVINGS, val));
  }
  return null;
}

export function estimateServings(totalKcal) {
  const guess = Math.round(totalKcal / KCAL_PER_PORTION);
  return Math.min(MAX_SERVINGS, Math.max(MIN_SERVINGS, guess));
}

function findFood(name) {
  const n = name.toLowerCase();
  if (NEGLIGIBLE.some((word) => n.includes(word)) && !n.includes("oil")) {
    return "negligible";
  }
  // Prefer the longest matching key, so "chicken stock" matches "stock" over "chicken"
  // and "olive oil" matches "olive oil" over "oil".
  let best = null;
  for (const key of Object.keys(FOODS)) {
    if (n.includes(key) && (!best || key.length > best.length)) best = key;
  }
  if (best === "chicken" && n.includes("stock")) best = "stock";
  if (best === "beef" && n.includes("stock")) best = "stock";
  return best ? FOODS[best] : null;
}

// Reads the leading number from a measure: "1 1/2", "1/2", "0.5", "½", "2-3" (uses the first).
function parseQuantity(text) {
  const t = text
    .replace(/½/g, " 1/2").replace(/¼/g, " 1/4").replace(/¾/g, " 3/4").replace(/⅓/g, " 1/3")
    .trim();
  const mixed = t.match(/^(\d+)\s+(\d+)\/(\d+)/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const frac = t.match(/^(\d+)\/(\d+)/);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  const num = t.match(/^(\d+(?:\.\d+)?)/);
  if (num) return Number(num[1]);
  return null;
}

// Converts one ingredient into grams, or null when the measure cannot be read.
function toGrams(measure, food) {
  const m = (measure || "").toLowerCase().trim();
  if (!m) return food.piece || null;

  const qty = parseQuantity(m);
  // Unit can be glued to the number ("400g") or separate ("400 g").
  const unitMatch = m.replace(/^[\d\s./½¼¾⅓-]+/, "").match(/^([a-z]+)/);
  const unit = unitMatch ? unitMatch[1] : "";

  if (unit === "cup" || unit === "cups") {
    return (qty ?? 1) * (food.cup || UNIT_GRAMS.cup);
  }
  if (UNIT_GRAMS[unit] !== undefined) {
    return (qty ?? 1) * UNIT_GRAMS[unit];
  }
  if (unit === "juice" && food.piece) {
    // "Juice of 1/2" a lemon: count the juice as about a third of the fruit.
    const q = parseQuantity(m.replace(/^juice\s+of\s+/, "")) ?? 1;
    return q * food.piece * 0.35;
  }
  // A bare number or a size word ("2", "1 large", "2 medium") means whole items.
  if (qty !== null && food.piece) {
    const sizeFactor = /large/.test(m) ? 1.25 : /small/.test(m) ? 0.75 : 1;
    return qty * food.piece * sizeFactor;
  }
  return null;
}

// Returns { total, perServing, servings, counted, skipped }.
// total and perServing are { kcal, protein, carbs, fat } rounded for display.
// Leave servings out to have it guessed from the total calories.
export function estimateNutrition(ingredients = [], servings, instructions = "") {
  const sum = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  const skipped = [];
  let counted = 0;

  for (const ing of ingredients) {
    const food = findFood(ing.name || "");
    if (food === "negligible") {
      counted++;
      continue;
    }
    const grams = food ? toGrams(ing.measure, food) : null;
    if (!food || !grams) {
      skipped.push(ing.name);
      continue;
    }
    const factor = grams / 100;
    sum.kcal += food.kcal * factor;
    sum.protein += food.p * factor;
    sum.carbs += food.c * factor;
    sum.fat += food.f * factor;
    counted++;
  }

  const round = (obj, div = 1) => ({
    kcal: Math.round(obj.kcal / div / 10) * 10,
    protein: Math.round(obj.protein / div),
    carbs: Math.round(obj.carbs / div),
    fat: Math.round(obj.fat / div),
  });

  if (!servings) {
    if (instructions) servings = extractStatedServings(instructions);
    if (!servings) servings = estimateServings(sum.kcal);
  }

  return {
    total: round(sum),
    perServing: round(sum, servings),
    servings,
    counted,
    skipped,
  };
}
