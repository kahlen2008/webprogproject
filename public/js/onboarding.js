// Two-step onboarding: diet, then allergies. Owner: Person 1.
// - Next (step 1) saves diets immediately so a refresh doesn't lose them.
// - Finish / Skip (step 2) marks onboarding complete.
// - Not logged in -> login.html. Already finished -> index.html.

import { onAuthChange } from "./auth.js";
import {
  DIET_OPTIONS,
  ALLERGEN_OPTIONS,
  getPreferences,
  savePreferences,
  syncPreferencesFromCloud,
} from "./preferences.js";
import { escapeHtml, showToast } from "./utils.js";

const NO_PREFERENCE = "__none__";

const els = {
  loading: document.getElementById("onboarding-loading"),
  card: document.getElementById("onboarding-card"),
  stepLabel: document.getElementById("step-label"),
  stepTitle: document.getElementById("step-title"),
  stepSub: document.getElementById("step-sub"),
  stepCount: document.getElementById("step-count"),
  progressBar: document.getElementById("step-progress-bar"),
  stepperItems: document.querySelectorAll(".stepper-item"),
  stepDiet: document.getElementById("step-diet"),
  stepAllergies: document.getElementById("step-allergies"),
  dietChips: document.getElementById("diet-chips"),
  allergyChips: document.getElementById("allergy-chips"),
  customChips: document.getElementById("custom-allergy-chips"),
  otherInput: document.getElementById("other-allergy-input"),
  otherAdd: document.getElementById("other-allergy-add"),
  error: document.getElementById("onboarding-error"),
  back: document.getElementById("back-btn"),
  skip: document.getElementById("skip-btn"),
  next: document.getElementById("next-btn"),
  nextLabel: document.getElementById("next-btn-label"),
};

const state = {
  step: 1,
  diets: new Set(),
  noDietPreference: false,
  allergies: new Set(),
  customAllergies: [],
  noAllergies: false,
  saving: false,
};

const STEP_TEXT = {
  1: {
    label: "Step 1 of 2 · Required",
    title: "How do you eat?",
    sub: "Pick any that apply. Recipes that don't fit get a warning, and you can change this anytime in Settings.",
  },
  2: {
    label: "Step 2 of 2 · Optional",
    title: "Any food allergies?",
    sub: "We'll warn you about recipes that contain these, and ask before you add one to your meal plan.",
  },
};

const ALLERGEN_ICONS = {
  Peanuts: "🥜", "Tree Nuts": "🌰", Dairy: "🥛", Eggs: "🥚", Gluten: "🌾",
  Soy: "🫘", Fish: "🐟", Shellfish: "🦐", Sesame: "🌿",
};

function hasStep1Selection() {
  return state.diets.size > 0 || state.noDietPreference;
}

function updateNextBtnState() {
  els.next.setAttribute("aria-disabled", String(state.step === 1 && !hasStep1Selection()));
}

// The count pill in the card header.
function updateCount() {
  if (!els.stepCount) return;
  if (state.step === 1) {
    els.stepCount.textContent = state.noDietPreference ? "No preference" : `${state.diets.size} selected`;
  } else {
    const n = state.allergies.size + state.customAllergies.length;
    els.stepCount.textContent = state.noAllergies ? "None" : `${n} selected`;
  }
}

// ---------- Rendering (same look as the Settings page) ----------
function checkMark(selected) {
  return `<span class="mt-0.5 w-5 h-5 rounded-full shrink-0 flex items-center justify-center border transition ${
    selected ? "bg-[#ca5c2e] border-[#ca5c2e] text-white" : "border-stone-300 bg-white text-transparent"
  }" aria-hidden="true"><svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="3.2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg></span>`;
}

function choiceCardClasses(selected) {
  return `group flex items-start gap-3 p-3.5 rounded-2xl border text-left transition select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ca5c2e]/40 ${
    selected
      ? "border-[#ca5c2e] bg-[#fdf6f1] ring-1 ring-[#ca5c2e]"
      : "border-stone-200 bg-white hover:border-[#ca5c2e]/40 hover:bg-[#fdfaf7]"
  }`;
}

// Full-width "none" option at the end of each step.
function noneOptionHtml(cls, selected, text) {
  return `
    <button type="button" class="${cls} col-span-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-2xl border border-dashed text-sm font-semibold transition select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ca5c2e]/40 ${
      selected ? "border-[#ca5c2e] bg-[#fdf6f1] text-[#a04e28] ring-1 ring-[#ca5c2e]" : "border-stone-300 bg-white text-stone-600 hover:border-[#ca5c2e]/40 hover:bg-[#fdfaf7]"
    }" data-value="${NO_PREFERENCE}" aria-pressed="${selected}">
      ${checkMark(selected).replace("mt-0.5 ", "")}
      <span>${text}</span>
    </button>`;
}

function renderDietChips() {
  const chips = DIET_OPTIONS.map((opt) => {
    const on = !state.noDietPreference && state.diets.has(opt.value);
    return `
      <button type="button" class="diet-chip ${choiceCardClasses(on)}" data-value="${escapeHtml(opt.value)}" aria-pressed="${on}">
        ${checkMark(on)}
        <span class="min-w-0">
          <span class="flex items-center gap-1.5 text-sm font-semibold ${on ? "text-[#a04e28]" : "text-stone-800"}">
            ${opt.icon ? `<span aria-hidden="true">${opt.icon}</span>` : ""}${escapeHtml(opt.label)}
          </span>
          <span class="block text-xs text-stone-500 mt-0.5 leading-snug">${escapeHtml(opt.description)}</span>
        </span>
      </button>`;
  }).join("");

  els.dietChips.innerHTML = chips + noneOptionHtml("diet-chip", state.noDietPreference, "No preference, I eat everything");
  updateCount();
}

function renderAllergyChips() {
  const chips = ALLERGEN_OPTIONS.map((opt) => {
    const on = !state.noAllergies && state.allergies.has(opt.value);
    return `
      <button type="button" class="allergy-chip flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-sm transition select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ca5c2e]/40 ${
        on ? "border-[#ca5c2e] bg-[#fdf6f1] text-[#a04e28] font-semibold ring-1 ring-[#ca5c2e]" : "border-stone-200 bg-white text-stone-700 font-medium hover:border-[#ca5c2e]/40 hover:bg-[#fdfaf7]"
      }" data-value="${escapeHtml(opt.value)}" aria-pressed="${on}">
        <span aria-hidden="true">${ALLERGEN_ICONS[opt.value] || "⚠️"}</span>
        <span class="truncate flex-1 text-left">${escapeHtml(opt.label)}</span>
        ${on ? `<svg class="w-4 h-4 shrink-0 text-[#ca5c2e]" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>` : ""}
      </button>`;
  }).join("");

  els.allergyChips.innerHTML = chips + noneOptionHtml("allergy-chip", state.noAllergies, "I have no food allergies");
  renderCustomChips();
}

function renderCustomChips() {
  els.customChips.innerHTML = state.customAllergies
    .map(
      (name) => `
      <span class="inline-flex items-center gap-1 pl-3 pr-1 py-1 rounded-full text-xs font-semibold bg-[#fbf2ec] text-[#a04e28] border border-[#f3ddd0]">
        ${escapeHtml(name)}
        <button type="button" class="remove-custom w-5 h-5 inline-flex items-center justify-center rounded-full hover:bg-[#ca5c2e]/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ca5c2e]/40" data-value="${escapeHtml(name)}" aria-label="Remove ${escapeHtml(name)}">
          <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.6" viewBox="0 0 24 24" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </span>`
    )
    .join("");
  updateCount();
}

function showStep(step, direction = "forward") {
  state.step = step;
  const isDiet = step === 1;
  els.stepDiet.classList.toggle("hidden", !isDiet);
  els.stepAllergies.classList.toggle("hidden", isDiet);

  const active = isDiet ? els.stepDiet : els.stepAllergies;
  active.classList.remove("step-enter", "step-enter-back");
  void active.offsetWidth; // restart animation
  active.classList.add(direction === "back" ? "step-enter-back" : "step-enter");

  const text = STEP_TEXT[step];
  els.stepLabel.textContent = text.label;
  els.stepTitle.textContent = text.title;
  els.stepSub.textContent = text.sub;

  // Stepper: current step highlighted, finished step ticked.
  els.stepperItems.forEach((item) => {
    const n = Number(item.dataset.step);
    item.classList.toggle("is-current", n === step);
    item.classList.toggle("is-done", n < step);
    const dot = item.querySelector(".stepper-dot");
    if (dot) dot.textContent = n < step ? "✓" : String(n);
    if (n === step) item.setAttribute("aria-current", "step");
    else item.removeAttribute("aria-current");
  });
  if (els.progressBar) els.progressBar.style.width = isDiet ? "0%" : "100%";

  els.skip.classList.toggle("hidden", isDiet);
  els.back.classList.toggle("invisible", isDiet);
  els.nextLabel.textContent = isDiet ? "Next" : "Finish";
  els.error.textContent = "";
  document.title = `${isDiet ? "Your diet (Required)" : "Your allergies"} | RecipePlan`;

  updateCount();
  updateNextBtnState();
}

function setSaving(saving) {
  state.saving = saving;
  [els.next, els.skip, els.back].forEach((btn) => (btn.disabled = saving));
}

// ---------- Chip interactions ----------
els.dietChips.addEventListener("click", (e) => {
  const chip = e.target.closest(".diet-chip");
  if (!chip) return;
  const value = chip.dataset.value;
  if (value === NO_PREFERENCE) {
    state.noDietPreference = !state.noDietPreference;
    if (state.noDietPreference) state.diets.clear();
  } else {
    state.noDietPreference = false;
    state.diets.has(value) ? state.diets.delete(value) : state.diets.add(value);
  }
  renderDietChips();
  // Re-rendering replaces the buttons, so put keyboard focus back on the one pressed.
  els.dietChips.querySelector(`.diet-chip[data-value="${CSS.escape(value)}"]`)?.focus();
  updateNextBtnState();
  if (hasStep1Selection()) {
    els.error.textContent = "";
  }
});

els.allergyChips.addEventListener("click", (e) => {
  const chip = e.target.closest(".allergy-chip");
  if (!chip) return;
  const value = chip.dataset.value;
  if (value === NO_PREFERENCE) {
    state.noAllergies = !state.noAllergies;
    if (state.noAllergies) {
      state.allergies.clear();
      state.customAllergies = [];
    }
  } else {
    state.noAllergies = false;
    state.allergies.has(value) ? state.allergies.delete(value) : state.allergies.add(value);
  }
  renderAllergyChips();
  els.allergyChips.querySelector(`.allergy-chip[data-value="${CSS.escape(value)}"]`)?.focus();
});

function addCustomAllergy() {
  const raw = els.otherInput.value.trim();
  if (!raw) return;
  raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((entry) => {
      const name = entry.charAt(0).toUpperCase() + entry.slice(1);
      const known = ALLERGEN_OPTIONS.find((o) => o.value.toLowerCase() === name.toLowerCase());
      if (known) {
        state.allergies.add(known.value);
      } else if (!state.customAllergies.some((c) => c.toLowerCase() === name.toLowerCase())) {
        state.customAllergies.push(name);
      }
    });
  state.noAllergies = false;
  els.otherInput.value = "";
  renderAllergyChips();
  els.otherInput.focus();
}

els.otherAdd.addEventListener("click", addCustomAllergy);
els.otherInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    addCustomAllergy();
  }
});

els.customChips.addEventListener("click", (e) => {
  const btn = e.target.closest(".remove-custom");
  if (!btn) return;
  state.customAllergies = state.customAllergies.filter((c) => c !== btn.dataset.value);
  renderCustomChips();
  els.otherInput.focus();
});

// ---------- Navigation ----------
function goHome() {
  const params = new URLSearchParams(window.location.search);
  const redirect = params.get("redirect");
  if (redirect && !redirect.startsWith("http://") && !redirect.startsWith("https://") && !redirect.startsWith("//")) {
    window.location.replace(redirect);
    return;
  }
  window.location.replace("index.html");
}

els.next.addEventListener("click", async () => {
  if (state.saving) return;

  // Step 1 is compulsory validation
  if (state.step === 1 && !hasStep1Selection()) {
    els.error.textContent = "Step 1 is compulsory. Please select at least one diet option or choose 'No preference'.";
    els.stepDiet.classList.remove("shake");
    void els.stepDiet.offsetWidth;
    els.stepDiet.classList.add("shake");
    return;
  }

  setSaving(true);
  try {
    if (state.step === 1) {
      const diets = state.noDietPreference ? [] : [...state.diets];
      await savePreferences({ diets, onboardingStep: 2 });
      showStep(2);
    } else {
      // Pick up anything typed in "Other" but not yet added.
      if (els.otherInput.value.trim()) addCustomAllergy();
      const allergies = state.noAllergies ? [] : [...state.allergies, ...state.customAllergies];
      await savePreferences({ allergies, onboardingComplete: true, onboardingStep: 2 });
      showToast("You're all set! Recipes are now tailored to you.");
      setTimeout(goHome, 600);
      return;
    }
  } catch (err) {
    els.error.textContent = "Couldn't save just now. Please try again.";
  }
  setSaving(false);
});

els.skip.addEventListener("click", async () => {
  if (state.saving) return;
  // Step 1 is compulsory, cannot skip
  if (state.step === 1) {
    return;
  }
  setSaving(true);
  try {
    await savePreferences({ onboardingComplete: true, onboardingStep: 2 });
    goHome();
    return;
  } catch (err) {
    els.error.textContent = "Couldn't save just now. Please try again.";
  }
  setSaving(false);
});

els.back.addEventListener("click", async () => {
  if (state.saving) return;
  if (state.step === 2) {
    showStep(1, "back");
    savePreferences({ onboardingStep: 1 });
    return;
  }
});

// ---------- Init ----------
function hydrateFromSaved(prefs) {
  state.diets = new Set(prefs.diets);
  if (prefs.onboardingStep === 2 && state.diets.size === 0) {
    state.noDietPreference = true;
  }
  const knownAllergens = new Set(ALLERGEN_OPTIONS.map((o) => o.value));
  state.allergies = new Set(prefs.allergies.filter((a) => knownAllergens.has(a)));
  state.customAllergies = prefs.allergies.filter((a) => !knownAllergens.has(a));
  renderDietChips();
  renderAllergyChips();
  updateNextBtnState();
}

let initialised = false;
onAuthChange(async (user) => {
  if (initialised) return;
  initialised = true;

  if (!user) {
    window.location.replace("login.html");
    return;
  }

  const prefs = await syncPreferencesFromCloud(user.uid);
  if (prefs.onboardingComplete) {
    goHome();
    return;
  }

  hydrateFromSaved(prefs);
  els.loading.classList.add("hidden");
  els.card.classList.remove("hidden");
  showStep(prefs.onboardingStep);
});
