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
  progress: document.getElementById("step-progress"),
  progressBar: document.getElementById("step-progress-bar"),
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

const CHECK_SVG = `<svg class="chip-check-icon w-3 h-3 text-white" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

function hasStep1Selection() {
  return state.diets.size > 0 || state.noDietPreference;
}

function updateNextBtnState() {
  if (state.step === 1) {
    const valid = hasStep1Selection();
    els.next.classList.toggle("opacity-60", !valid);
  } else {
    els.next.classList.remove("opacity-60");
  }
}

// ---------- Rendering ----------
function renderDietChips() {
  const chips = DIET_OPTIONS.map((opt) => {
    const checked = !state.noDietPreference && state.diets.has(opt.value);
    return `
      <button type="button" role="checkbox" class="choice-chip diet-chip flex items-center gap-2.5 p-2 sm:p-2.5 rounded-xl sm:rounded-2xl border ${checked ? 'border-[#ca5c2e] bg-[#fbf2ec]' : 'border-stone-200 bg-white'} text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ca5c2e]/40 transition group"
        data-value="${escapeHtml(opt.value)}" aria-checked="${checked}" aria-pressed="${checked}">
        <span class="chip-checkbox flex-shrink-0 w-4.5 h-4.5 rounded-md border-2 ${checked ? 'border-[#ca5c2e] bg-[#ca5c2e]' : 'border-stone-300 bg-white group-hover:border-stone-400'} flex items-center justify-center transition-colors shadow-xs">
          ${CHECK_SVG}
        </span>
        <span class="flex-1 min-w-0">
          <span class="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-stone-900 group-hover:text-[#ca5c2e] transition-colors">
            ${opt.icon ? `<span class="text-base">${opt.icon}</span>` : ""}
            <span>${escapeHtml(opt.label)}</span>
          </span>
          <span class="block text-[11px] sm:text-xs text-stone-500 mt-0.5 leading-tight">${escapeHtml(opt.description)}</span>
        </span>
      </button>`;
  }).join("");

  const checkedNone = state.noDietPreference;
  const none = `
    <button type="button" role="checkbox" class="choice-chip diet-chip sm:col-span-2 md:col-span-3 flex items-center justify-center gap-2.5 p-2 sm:p-2.5 rounded-xl sm:rounded-2xl border border-dashed ${checkedNone ? 'border-[#ca5c2e] bg-[#fbf2ec]' : 'border-stone-300 bg-white'} text-xs sm:text-sm font-semibold text-stone-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ca5c2e]/40 transition group"
      data-value="${NO_PREFERENCE}" aria-checked="${checkedNone}" aria-pressed="${checkedNone}">
      <span class="chip-checkbox flex-shrink-0 w-4.5 h-4.5 rounded-md border-2 ${checkedNone ? 'border-[#ca5c2e] bg-[#ca5c2e]' : 'border-stone-300 bg-white group-hover:border-stone-400'} flex items-center justify-center transition-colors shadow-xs">
        ${CHECK_SVG}
      </span>
      <span>No preference, I eat everything</span>
    </button>`;

  els.dietChips.innerHTML = chips + none;
}

function renderAllergyChips() {
  const chips = ALLERGEN_OPTIONS.map((opt) => {
    const checked = !state.noAllergies && state.allergies.has(opt.value);
    return `
      <button type="button" role="checkbox" class="choice-chip allergy-chip inline-flex items-center gap-2.5 px-4 py-2.5 rounded-full border ${checked ? 'border-[#ca5c2e] bg-[#fbf2ec]' : 'border-stone-200 bg-white'} text-sm font-semibold text-stone-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ca5c2e]/40 transition group"
        data-value="${escapeHtml(opt.value)}" aria-checked="${checked}" aria-pressed="${checked}">
        <span class="chip-checkbox flex-shrink-0 w-4 h-4 rounded border-2 ${checked ? 'border-[#ca5c2e] bg-[#ca5c2e]' : 'border-stone-300 bg-white group-hover:border-stone-400'} flex items-center justify-center transition-colors shadow-xs">
          ${CHECK_SVG}
        </span>
        <span>${escapeHtml(opt.label)}</span>
      </button>`;
  }).join("");

  const checkedNone = state.noAllergies;
  const none = `
    <button type="button" role="checkbox" class="choice-chip allergy-chip inline-flex items-center gap-2.5 px-4 py-2.5 rounded-full border border-dashed ${checkedNone ? 'border-[#ca5c2e] bg-[#fbf2ec]' : 'border-stone-300 bg-white'} text-sm font-semibold text-stone-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ca5c2e]/40 transition group"
      data-value="${NO_PREFERENCE}" aria-checked="${checkedNone}" aria-pressed="${checkedNone}">
      <span class="chip-checkbox flex-shrink-0 w-4 h-4 rounded border-2 ${checkedNone ? 'border-[#ca5c2e] bg-[#ca5c2e]' : 'border-stone-300 bg-white group-hover:border-stone-400'} flex items-center justify-center transition-colors shadow-xs">
        ${CHECK_SVG}
      </span>
      <span>None</span>
    </button>`;

  els.allergyChips.innerHTML = chips + none;
  renderCustomChips();
}

function renderCustomChips() {
  els.customChips.innerHTML = state.customAllergies
    .map(
      (name) => `
      <span class="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full text-xs font-semibold bg-[#fbf2ec] text-[#ca5c2e] border border-[#f3ddd0]">
        ${escapeHtml(name)}
        <button type="button" class="remove-custom w-5 h-5 rounded-full hover:bg-[#ca5c2e]/15 flex items-center justify-center" data-value="${escapeHtml(name)}" aria-label="Remove ${escapeHtml(name)}">&times;</button>
      </span>`
    )
    .join("");
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

  if (isDiet) {
    els.stepLabel.innerHTML = `Step 1 of 2 <span class="ml-1.5 inline-flex items-center text-[10px] font-bold text-[#ca5c2e] bg-[#ca5c2e]/10 px-2 py-0.5 rounded-full tracking-wider uppercase">Compulsory</span>`;
    els.skip.classList.add("hidden");
    els.back.classList.add("invisible");
  } else {
    els.stepLabel.innerHTML = `Step 2 of 2 <span class="ml-1.5 inline-flex items-center text-[10px] font-medium text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full tracking-normal normal-case">Optional</span>`;
    els.skip.classList.remove("hidden");
    els.back.classList.remove("invisible");
  }

  els.progress.setAttribute("aria-valuenow", String(step));
  els.progressBar.style.width = isDiet ? "50%" : "100%";
  els.nextLabel.textContent = isDiet ? "Next" : "Finish";
  els.error.textContent = "";
  document.title = `${isDiet ? "Your diet (Required)" : "Your allergies"} | RecipePlan`;

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
});

// ---------- Navigation ----------
function goHome() {
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
