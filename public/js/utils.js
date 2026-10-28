// Shared helpers for RecipePlan with modern Tailwind aesthetics.
import { getCurrentUser } from "./auth.js";
import { db } from "./firebase-config.js";
import {
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

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

        const user = getCurrentUser();
        if (exists) {
          storedFavs = storedFavs.filter((f) => String(f.id) !== String(recipe.id));
          icon.setAttribute("fill", "none");
          icon.classList.remove("text-[#ca5c2e]", "text-red-500");
          favBtn.classList.remove("text-[#ca5c2e]", "text-red-500");
          showToast(`Removed "${recipe.name}" from favourites`);
          if (user && user.uid) {
            deleteDoc(doc(db, "users", user.uid, "favourites", String(recipe.id))).catch(console.warn);
          }
        } else {
          const favItem = {
            id: String(recipe.id),
            name: recipe.name || "",
            image: recipe.image || "",
            category: recipe.category || "Main",
            area: recipe.area || "",
            savedAt: new Date().toISOString(),
          };
          storedFavs.unshift(favItem);
          icon.setAttribute("fill", "#ca5c2e");
          icon.classList.add("text-[#ca5c2e]");
          favBtn.classList.add("text-[#ca5c2e]");
          showToast(`Saved "${recipe.name}" to favourites!`);
          if (user && user.uid) {
            setDoc(doc(db, "users", user.uid, "favourites", String(recipe.id)), {
              id: String(recipe.id),
              name: recipe.name || "",
              image: recipe.image || "",
              category: recipe.category || "Main",
              area: recipe.area || "",
              savedAt: serverTimestamp(),
            }).catch(console.warn);
          }
        }
        localStorage.setItem("recipeplan_favourites", JSON.stringify(storedFavs));
        window.dispatchEvent(new CustomEvent("favourites-changed"));
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

/**
 * Synchronizes heart icons across all rendered cards on the page.
 * Keeps them up-to-date even when navigating back via browser history / bfcache.
 */
export function syncAllCardHearts() {
  let storedFavs = [];
  try {
    storedFavs = JSON.parse(localStorage.getItem("recipeplan_favourites") || "[]");
  } catch (err) {}
  const favIdSet = new Set(storedFavs.map((f) => String(f.id)));

  document.querySelectorAll(".favourite-btn[data-id]").forEach((btn) => {
    const id = btn.getAttribute("data-id");
    const icon = btn.querySelector(".heart-icon");
    const isSaved = favIdSet.has(String(id));
    if (icon) {
      if (isSaved) {
        icon.setAttribute("fill", "#ca5c2e");
        icon.classList.add("text-[#ca5c2e]");
        btn.classList.add("text-[#ca5c2e]");
      } else {
        icon.setAttribute("fill", "none");
        icon.classList.remove("text-[#ca5c2e]");
        btn.classList.remove("text-[#ca5c2e]");
      }
    }
  });
}

// Automatically sync all heart buttons when page is shown (handles bfcache / back navigation) or favourites change
if (typeof window !== "undefined") {
  window.addEventListener("pageshow", syncAllCardHearts);
  window.addEventListener("favourites-changed", syncAllCardHearts);
  window.addEventListener("storage", syncAllCardHearts);
}

// Cleans common typos and missing drop-cap letters found in TheMealDB instructions
export function cleanInstructionText(text) {
  if (!text) return "";

  return text
    // Fix missing initial letter caused by drop-cap stripping during scraping in TheMealDB
    // (e.g. "emove and discard the bay leaf" -> "Remove and discard the bay leaf", "oak the beans" -> "Soak the beans")
    .replace(/(^|[.!?\n]\s*)emove\b/gi, "$1Remove")
    .replace(/(^|[.!?\n]\s*)oak the\b/gi, "$1Soak the")
    .replace(/(^|[.!?\n]\s*)dd the\b/gi, "$1Add the")
    .replace(/(^|[.!?\n]\s*)reheat\b/gi, "$1Preheat")
    .replace(/(^|[.!?\n]\s*)eat the (oven|oil|pan|skillet|pot)\b/gi, "$1Heat the $2")
    .replace(/(^|[.!?\n]\s*)ook for\b/gi, "$1Cook for")
    .replace(/(^|[.!?\n]\s*)ake for\b/gi, "$1Bake for")
    .replace(/(^|[.!?\n]\s*)our into\b/gi, "$1Pour into")
    .replace(/(^|[.!?\n]\s*)tir in\b/gi, "$1Stir in")
    .replace(/(^|[.!?\n]\s*)erve with\b/gi, "$1Serve with")
    .replace(/(^|[.!?\n]\s*)hisk together\b/gi, "$1Whisk together")
    // Fix common word-level typos found in community-submitted recipes
    .replace(/\buntill\b/gi, "until")
    .replace(/\bteaspon\b/gi, "teaspoon")
    .replace(/\btablespon\b/gi, "tablespoon")
    .replace(/\bseperate\b/gi, "separate")
    .replace(/\bseperated\b/gi, "separated")
    .replace(/\bminuts\b/gi, "minutes")
    .replace(/\bpeices\b/gi, "pieces")
    .replace(/\bpeice\b/gi, "piece");
}

// Unit definitions for parsing and combining recipe ingredient measurements
const UNIT_DEFS = [
  { key: "teaspoon", singular: "teaspoon", plural: "teaspoons", aliases: ["teaspoon", "teaspoons", "tsp", "tsps", "t.", "t"] },
  { key: "tablespoon", singular: "tablespoon", plural: "tablespoons", aliases: ["tablespoon", "tablespoons", "tbsp", "tbsps", "tbs", "tb", "tbs."] },
  { key: "cup", singular: "cup", plural: "cups", aliases: ["cup", "cups", "c"] },
  { key: "fluid_ounce", singular: "fluid ounce", plural: "fluid ounces", aliases: ["fluid ounce", "fluid ounces", "fl oz", "fl. oz.", "fl-oz"] },
  { key: "ounce", singular: "ounce", plural: "ounces", aliases: ["ounce", "ounces", "oz", "ozs", "oz."] },
  { key: "pound", singular: "pound", plural: "pounds", aliases: ["pound", "pounds", "lb", "lbs", "lb."] },
  { key: "gram", singular: "gram", plural: "grams", aliases: ["gram", "grams", "g", "gm", "gms", "g."] },
  { key: "kilogram", singular: "kilogram", plural: "kilograms", aliases: ["kilogram", "kilograms", "kg", "kgs", "kg."] },
  { key: "milliliter", singular: "milliliter", plural: "milliliters", aliases: ["milliliter", "milliliters", "ml", "mls", "ml."] },
  { key: "liter", singular: "liter", plural: "liters", aliases: ["liter", "liters", "l", "ltr", "litres", "litre"] },
  { key: "pinch", singular: "pinch", plural: "pinches", aliases: ["pinch", "pinches"] },
  { key: "dash", singular: "dash", plural: "dashes", aliases: ["dash", "dashes"] },
  { key: "clove", singular: "clove", plural: "cloves", aliases: ["clove", "cloves"] },
  { key: "slice", singular: "slice", plural: "slices", aliases: ["slice", "slices"] },
  { key: "stick", singular: "stick", plural: "sticks", aliases: ["stick", "sticks"] },
  { key: "can", singular: "can", plural: "cans", aliases: ["can", "cans"] },
  { key: "package", singular: "package", plural: "packages", aliases: ["package", "packages", "packet", "packets", "pkg", "pkgs"] },
  { key: "stalk", singular: "stalk", plural: "stalks", aliases: ["stalk", "stalks"] },
  { key: "sprig", singular: "sprig", plural: "sprigs", aliases: ["sprig", "sprigs"] },
  { key: "leaf", singular: "leaf", plural: "leaves", aliases: ["leaf", "leaves"] },
  { key: "piece", singular: "piece", plural: "pieces", aliases: ["piece", "pieces"] },
  { key: "large", singular: "large", plural: "large", aliases: ["large"] },
  { key: "medium", singular: "medium", plural: "medium", aliases: ["medium"] },
  { key: "small", singular: "small", plural: "small", aliases: ["small"] },
];

const UNIT_ALIAS_MAP = new Map();
for (const def of UNIT_DEFS) {
  for (const alias of def.aliases) {
    UNIT_ALIAS_MAP.set(alias.toLowerCase(), def);
  }
}

function normalizeUnicodeFractions(str) {
  return str
    .replace(/½/g, " 1/2")
    .replace(/⅓/g, " 1/3")
    .replace(/⅔/g, " 2/3")
    .replace(/¼/g, " 1/4")
    .replace(/¾/g, " 3/4")
    .replace(/⅛/g, " 1/8")
    .replace(/⅜/g, " 3/8")
    .replace(/⅝/g, " 5/8")
    .replace(/⅞/g, " 7/8");
}

function parseQuantity(numStr) {
  const s = numStr.trim();
  const mixed = s.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) {
    return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  }
  const frac = s.match(/^(\d+)\/(\d+)$/);
  if (frac) {
    return Number(frac[1]) / Number(frac[2]);
  }
  const num = Number(s);
  return isNaN(num) ? null : num;
}

function formatQuantity(val) {
  if (val == null || isNaN(val) || val <= 0) return "";
  const rounded = Math.round(val * 10000) / 10000;
  const whole = Math.floor(rounded);
  const frac = rounded - whole;

  if (frac < 0.015) return String(whole);
  if (frac > 0.985) return String(whole + 1);

  const fractions = [
    { value: 1 / 8, str: "1/8" },
    { value: 1 / 6, str: "1/6" },
    { value: 1 / 4, str: "1/4" },
    { value: 1 / 3, str: "1/3" },
    { value: 3 / 8, str: "3/8" },
    { value: 1 / 2, str: "1/2" },
    { value: 5 / 8, str: "5/8" },
    { value: 2 / 3, str: "2/3" },
    { value: 3 / 4, str: "3/4" },
    { value: 5 / 6, str: "5/6" },
    { value: 7 / 8, str: "7/8" },
  ];

  for (const f of fractions) {
    if (Math.abs(frac - f.value) < 0.025) {
      return whole > 0 ? `${whole} ${f.str}` : f.str;
    }
  }

  return (Math.round(val * 100) / 100).toString();
}

function parseSinglePart(rawText) {
  if (!rawText) return null;
  let text = normalizeUnicodeFractions(rawText.trim());

  // Range support: e.g. "1-2"
  const rangeMatch = text.match(/^(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)\s*(.*)$/);
  if (rangeMatch) {
    const min = Number(rangeMatch[1]);
    const max = Number(rangeMatch[2]);
    const rest = (rangeMatch[3] || "").trim();
    const parsedRest = parseSinglePart(`1 ${rest}`);
    return {
      amount: (min + max) / 2,
      range: [min, max],
      unitDef: parsedRest.unitDef,
      unitKey: parsedRest.unitKey,
      unitRaw: parsedRest.unitRaw,
      modifier: parsedRest.modifier,
      isAbbrev: parsedRest.isAbbrev,
      raw: text,
    };
  }

  const qtyMatch = text.match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)\s*(.*)$/);
  if (!qtyMatch) {
    return {
      amount: null,
      unitDef: null,
      unitKey: null,
      unitRaw: "",
      modifier: text,
      isAbbrev: false,
      raw: text,
    };
  }

  const amount = parseQuantity(qtyMatch[1]);
  const rest = (qtyMatch[2] || "").trim();

  if (!rest) {
    return {
      amount,
      unitDef: null,
      unitKey: "__count__",
      unitRaw: "",
      modifier: "",
      isAbbrev: false,
      raw: text,
    };
  }

  const parts = rest.split(/\s+/);
  const firstWord = parts[0];
  const firstClean = firstWord.replace(/[.,]$/, "").toLowerCase();
  
  let unitDef = null;
  let unitRaw = "";
  let modifier = "";

  if (parts.length >= 2) {
    const twoWords = `${parts[0]} ${parts[1]}`.replace(/[.,]$/, "").toLowerCase();
    if (UNIT_ALIAS_MAP.has(twoWords)) {
      unitDef = UNIT_ALIAS_MAP.get(twoWords);
      unitRaw = `${parts[0]} ${parts[1]}`;
      modifier = parts.slice(2).join(" ");
    }
  }

  if (!unitDef && UNIT_ALIAS_MAP.has(firstClean)) {
    unitDef = UNIT_ALIAS_MAP.get(firstClean);
    unitRaw = firstWord;
    modifier = parts.slice(1).join(" ");
  }

  if (!unitDef) {
    unitDef = null;
    unitRaw = firstWord;
    modifier = parts.slice(1).join(" ");
  }

  const isAbbrev = unitDef ? (unitRaw.length <= 4 && !unitRaw.toLowerCase().startsWith("cup")) : false;
  const unitKey = unitDef ? unitDef.key : unitRaw.toLowerCase();

  return {
    amount,
    unitDef,
    unitKey,
    unitRaw,
    modifier,
    isAbbrev,
    raw: text,
  };
}

function parseMeasure(measureStr) {
  if (!measureStr || typeof measureStr !== "string") return null;
  const str = measureStr.trim();
  if (!str) return null;

  const parenMatch = str.match(/^([^(]+)\s*\(([^)]+)\)$/);
  if (parenMatch) {
    const primary = parseSinglePart(parenMatch[1]);
    const secondary = parseSinglePart(parenMatch[2]);
    return {
      type: "compound",
      primary,
      secondary,
      raw: str,
    };
  }

  const single = parseSinglePart(str);
  return {
    type: "single",
    primary: single,
    secondary: null,
    raw: str,
  };
}

function formatSinglePart(part) {
  if (!part) return "";
  if (part.amount == null) {
    return part.modifier || part.raw || "";
  }
  const qtyStr = part.range ? `${part.range[0]}-${part.range[1]}` : formatQuantity(part.amount);
  if (!part.unitKey || part.unitKey === "__count__") {
    return part.modifier ? `${qtyStr} ${part.modifier}` : qtyStr;
  }

  let unitStr = part.unitRaw;
  if (part.unitDef) {
    if (part.isAbbrev) {
      unitStr = (part.amount > 1 && part.unitDef.key === "pound" && !part.unitRaw.endsWith("s"))
        ? `${part.unitRaw}s`
        : part.unitRaw;
    } else {
      unitStr = part.amount > 1 ? part.unitDef.plural : part.unitDef.singular;
    }
  }

  const noSpace = /^\d+[a-zA-Z]+$/.test(part.raw?.replace(/\s+/g, "") || "");
  const base = (noSpace && ["g", "kg", "ml", "l"].includes(unitStr.toLowerCase()))
    ? `${qtyStr}${unitStr}`
    : `${qtyStr} ${unitStr}`;

  return part.modifier ? `${base} ${part.modifier}` : base;
}

export function combineMeasures(measureList) {
  const cleanList = (measureList || [])
    .map((m) => (typeof m === "string" ? m.trim() : ""))
    .filter(Boolean);

  if (cleanList.length === 0) return "";
  if (cleanList.length === 1) return cleanList[0];

  const parsedList = cleanList.map(parseMeasure).filter(Boolean);
  if (parsedList.length !== cleanList.length) {
    return cleanList.join(" + ");
  }

  const allHavePrimary = parsedList.every((v) => v.primary && v.primary.amount != null);
  if (!allHavePrimary) {
    return cleanList.join(" + ");
  }

  const firstP = parsedList[0].primary;
  const samePrimaryUnit = parsedList.every(
    (v) => v.primary.unitKey === firstP.unitKey
  );

  if (!samePrimaryUnit) {
    return cleanList.join(" + ");
  }

  const hasRange = parsedList.some((v) => v.primary.range);
  let combinedPrimary;
  if (hasRange) {
    let minSum = 0;
    let maxSum = 0;
    for (const v of parsedList) {
      if (v.primary.range) {
        minSum += v.primary.range[0];
        maxSum += v.primary.range[1];
      } else {
        minSum += v.primary.amount;
        maxSum += v.primary.amount;
      }
    }
    combinedPrimary = {
      ...firstP,
      amount: (minSum + maxSum) / 2,
      range: [minSum, maxSum],
    };
  } else {
    const totalPrimaryAmount = parsedList.reduce((sum, v) => sum + v.primary.amount, 0);
    combinedPrimary = {
      ...firstP,
      amount: totalPrimaryAmount,
    };
  }

  const primaryFormatted = formatSinglePart(combinedPrimary);

  // Check secondary
  const allHaveSecondary = parsedList.every(
    (v) => v.secondary && v.secondary.amount != null
  );

  if (allHaveSecondary) {
    const firstS = parsedList[0].secondary;
    const sameSecondaryUnit = parsedList.every(
      (v) => v.secondary.unitKey === firstS.unitKey
    );
    if (sameSecondaryUnit) {
      const totalSecondaryAmount = parsedList.reduce((sum, v) => sum + v.secondary.amount, 0);
      const combinedSecondary = {
        ...firstS,
        amount: totalSecondaryAmount,
      };
      const secondaryFormatted = formatSinglePart(combinedSecondary);
      return `${primaryFormatted} (${secondaryFormatted})`;
    }
  }

  return primaryFormatted;
}

// Ensures every word of an ingredient starts with a capital letter (e.g. "Garlic Powder", "Stir-Fry Vegetables", "Prawns (Shrimp)")
export function capitalizeIngredient(str) {
  if (!str) return "";
  return String(str)
    .trim()
    .toLowerCase()
    .replace(/(?:^|[\s\-(/])[a-z]/g, (match) => match.toUpperCase());
}

// Combines repeated ingredients in a recipe, adding up their measurements
export function combineIngredients(ingredients) {
  if (!Array.isArray(ingredients)) return [];
  const map = new Map();

  for (const item of ingredients) {
    const name = typeof item === "string" ? item : item.name;
    const measure = typeof item === "string" ? "" : (item.measure || "");
    if (!name || !name.trim()) continue;

    const cleanName = name.trim();
    const key = cleanName.toLowerCase();

    if (!map.has(key)) {
      map.set(key, {
        name: cleanName,
        measures: measure ? [measure.trim()] : [],
      });
    } else {
      const existing = map.get(key);
      if (measure && measure.trim()) {
        existing.measures.push(measure.trim());
      }
    }
  }

  const result = [];
  for (const [, entry] of map) {
    const combinedMeasure = combineMeasures(entry.measures);
    result.push({
      name: capitalizeIngredient(entry.name),
      measure: combinedMeasure,
    });
  }
  return result;
}



