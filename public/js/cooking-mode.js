// Cooking Mode for recipe.html
// Provides a dedicated, full-screen, distraction-free cooking experience:
// - One step at a time with large readable text
// - Next and Back navigation (buttons and arrow keys)
// - Step X of Y progress indicator and visual progress bar
// - Direct jump to any step via step pills
// - Interactive ingredient checklist drawer
// - Smart kitchen timer detection with audio chime
// - Screen wake lock so display stays awake in the kitchen
// - Celebratory completion view with quick link to leave a review

import { escapeHtml, capitalizeIngredient } from "./utils.js";

/**
 * Converts parsed instruction items into sequential cooking steps.
 * @param {Array} parsedItems - Output of parseRecipeInstructions
 * @param {string} [rawInstructions] - Fallback raw instructions text
 * @returns {Array<{text: string, section: string|null, sectionIcon: string|null, isTip: boolean}>}
 */
export function prepareCookingSteps(parsedItems, rawInstructions = "") {
  const steps = [];
  let currentHeader = null;

  (parsedItems || []).forEach((item) => {
    if (item.type === "header") {
      currentHeader = item.header;
    } else if (item.type === "step") {
      steps.push({
        text: item.text,
        section: currentHeader ? currentHeader.label : null,
        sectionIcon: currentHeader ? currentHeader.icon : null,
        isTip: false,
      });
    } else if (item.type === "bullet") {
      steps.push({
        text: item.text,
        section: currentHeader ? currentHeader.label : "Chef's Tip",
        sectionIcon: currentHeader ? currentHeader.icon : "💡",
        isTip: true,
      });
    }
  });

  if (steps.length === 0) {
    const fallbackText = rawInstructions ? rawInstructions.trim() : "Follow standard cooking guidelines for this recipe.";
    steps.push({
      text: fallbackText,
      section: null,
      sectionIcon: null,
      isTip: false,
    });
  }

  return steps;
}

/**
 * Detects cooking time mentions (e.g. "cook for 15 minutes", "bake for 35 mins", "1-2 mins each side")
 * @param {string} text
 * @returns {{ seconds: number, label: string } | null}
 */
export function detectCookingTimer(text) {
  if (!text) return null;

  // Match durations: e.g. "for 35 minutes", "15 mins", "1-2 mins", "30 seconds", "1 hour"
  const regex = /\b(?:(?:for|about|approx(?:imately)?)\s+)?(\d+(?:\s*(?:-|to)\s*\d+)?)\s*(hours?|hrs?|minutes?|mins?|seconds?|secs?)\b/i;
  const match = text.match(regex);
  if (!match) return null;

  const rawNum = match[1];
  const unit = match[2].toLowerCase();

  let num = 0;
  if (rawNum.includes("-") || rawNum.includes("to")) {
    const parts = rawNum.split(/[-–—]|to/).map((p) => parseFloat(p.trim())).filter((n) => !isNaN(n));
    num = parts.length ? parts[parts.length - 1] : 0;
  } else {
    num = parseFloat(rawNum);
  }

  if (!num || isNaN(num) || num <= 0) return null;

  let totalSeconds = 0;
  let label = "";

  if (/hour|hr/.test(unit)) {
    if (num > 12) return null;
    totalSeconds = Math.round(num * 3600);
    label = `${num} hr${num === 1 ? "" : "s"}`;
  } else if (/min/.test(unit)) {
    if (num > 300) return null;
    totalSeconds = Math.round(num * 60);
    label = `${num} min${num === 1 ? "" : "s"}`;
  } else if (/sec/.test(unit)) {
    totalSeconds = Math.round(num);
    label = `${num} sec${num === 1 ? "" : "s"}`;
  }

  return totalSeconds > 0 ? { seconds: totalSeconds, label } : null;
}

/**
 * Plays a pleasant synthesizer chime using Web Audio API when a timer completes.
 */
function playTimerChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startTime = ctx.currentTime + i * 0.12;
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0.2, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.35);
    });
  } catch (e) {
    // Web audio blocked or unsupported
  }
}

/**
 * Screen wake lock manager to keep the display on while cooking.
 */
let activeWakeLock = null;

async function requestScreenWakeLock() {
  if ("wakeLock" in navigator && !activeWakeLock) {
    try {
      activeWakeLock = await navigator.wakeLock.request("screen");
      activeWakeLock.addEventListener("release", () => {
        activeWakeLock = null;
      });
    } catch (e) {
      // Wake lock unavailable or denied
    }
  }
}

function releaseScreenWakeLock() {
  if (activeWakeLock) {
    activeWakeLock.release().catch(() => {});
    activeWakeLock = null;
  }
}

/**
 * Launches the full-screen Cooking Mode overlay.
 * @param {Object} options
 * @param {Object} options.recipe - The full recipe object
 * @param {Array} options.parsedItems - Items from parseRecipeInstructions
 * @param {Object} [options.allergenResult] - Allergen check result from preferences.js
 * @param {Function} [options.onSwitchTab] - Callback to switch tabs on the recipe page
 */
export function openCookingMode({ recipe, parsedItems, allergenResult = {}, onSwitchTab }) {
  // Remove any existing instance
  document.getElementById("cooking-mode-overlay")?.remove();

  const steps = prepareCookingSteps(parsedItems, recipe.instructions);
  const totalSteps = steps.length;
  let currentStepIndex = 0;
  const completedSteps = new Set();
  const checkedIngredients = new Set();

  // Active kitchen timer state
  let timerInterval = null;
  let timerSecondsLeft = 0;
  let timerTotalSeconds = 0;
  let isTimerRunning = false;

  // Lock body scroll
  const prevOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";

  // Request screen wake lock
  requestScreenWakeLock();

  // Create overlay container
  const overlay = document.createElement("div");
  overlay.id = "cooking-mode-overlay";
  overlay.className = "fixed inset-0 z-50 bg-[#faf7f2] flex flex-col overflow-hidden text-stone-800 font-sans antialiased animate-cm-fade";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", `Cooking Mode: ${recipe.name}`);

  overlay.innerHTML = `
    <!-- Top Bar -->
    <header class="flex-shrink-0 bg-white border-b border-[#ede4da] px-4 sm:px-6 py-3 flex items-center justify-between gap-3 shadow-2xs">
      <div class="flex items-center gap-3 min-w-0">
        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs flex-shrink-0">
          <svg class="w-3.5 h-3.5 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <span>Cooking Mode</span>
        </span>
        <h2 class="text-sm sm:text-base font-bold text-stone-900 truncate" title="${escapeHtml(recipe.name)}">
          ${escapeHtml(recipe.name)}
        </h2>
      </div>

      <div class="flex items-center gap-2 flex-shrink-0">
        <!-- Ingredients Checklist Toggle -->
        <button id="cm-ingredients-toggle" type="button" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700 text-xs sm:text-sm font-semibold transition shadow-2xs focus:outline-none focus:ring-2 focus:ring-stone-300">
          <svg class="w-4 h-4 text-stone-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          <span class="hidden sm:inline">Ingredients</span>
          <span id="cm-ingredients-count-badge" class="px-1.5 py-0.5 rounded-md bg-stone-200 text-stone-700 text-[11px] font-bold">
            ${(recipe.ingredients || []).length}
          </span>
        </button>

        <!-- Exit Button -->
        <button id="cm-exit-btn" type="button" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-200 bg-white hover:bg-red-50 hover:text-red-700 hover:border-red-200 text-stone-600 text-xs sm:text-sm font-semibold transition shadow-2xs focus:outline-none focus:ring-2 focus:ring-red-200" aria-label="Exit Cooking Mode">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
          <span class="hidden sm:inline">Exit</span>
        </button>
      </div>
    </header>

    <!-- Progress Bar & Step Info -->
    <div class="flex-shrink-0 bg-white border-b border-[#efe6dc]">
      <!-- Progress Bar line -->
      <div class="w-full bg-stone-100 h-1.5 overflow-hidden">
        <div id="cm-progress-bar" class="bg-[#ca5c2e] h-full transition-all duration-300" style="width: 0%;"></div>
      </div>
      
      <!-- Subheader with Step X of Y and Jump Pills -->
      <div class="max-w-4xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4">
        <div class="flex items-center gap-2 flex-shrink-0">
          <span id="cm-step-indicator" class="text-xs sm:text-sm font-extrabold text-[#ca5c2e] tracking-tight uppercase">
            Step 1 of ${totalSteps}
          </span>
          <span id="cm-progress-percentage" class="text-xs font-semibold text-stone-400">
            (0% completed)
          </span>
        </div>

        <!-- Quick Jump Step Pills -->
        <nav id="cm-step-pills" class="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none" aria-label="Step navigation">
          <!-- Rendered dynamically -->
        </nav>
      </div>
    </div>

    <!-- Main Content Area -->
    <div class="flex-1 overflow-y-auto relative p-4 sm:p-6 lg:p-8 flex items-center justify-center">
      <!-- Active Step Container -->
      <div id="cm-step-container" class="max-w-3xl w-full mx-auto my-auto space-y-6">
        <!-- Step card injected here -->
      </div>

      <!-- Slide-over Ingredients Checklist Drawer -->
      <aside id="cm-ingredients-drawer" class="fixed inset-y-0 right-0 w-full sm:w-96 max-w-full bg-white shadow-2xl border-l border-[#ede4da] z-40 transform translate-x-full transition-transform duration-300 ease-in-out flex flex-col" aria-label="Ingredients Checklist">
        <!-- Drawer Header -->
        <div class="p-4 sm:p-5 border-b border-[#ede4da] flex items-center justify-between bg-[#faf7f2]">
          <div>
            <h3 class="font-bold text-base text-stone-900">Ingredients Checklist</h3>
            <p id="cm-checklist-summary" class="text-xs text-stone-500">0 of ${(recipe.ingredients || []).length} gathered</p>
          </div>
          <button id="cm-drawer-close-btn" type="button" class="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-white transition focus:outline-none" aria-label="Close ingredients checklist">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <!-- Checklist List -->
        <div class="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2">
          <ul id="cm-ingredients-list" class="space-y-2 list-none p-0 m-0">
            <!-- Dynamically populated -->
          </ul>
        </div>

        <!-- Drawer Footer -->
        <div class="p-4 border-t border-[#ede4da] bg-stone-50 flex items-center justify-between gap-3">
          <button id="cm-check-all-btn" type="button" class="text-xs font-semibold text-stone-700 hover:text-stone-900 px-3 py-1.5 rounded-lg border border-stone-200 bg-white transition shadow-2xs">
            Check All
          </button>
          <button id="cm-reset-checks-btn" type="button" class="text-xs font-semibold text-stone-500 hover:text-stone-800 transition">
            Reset
          </button>
        </div>
      </aside>

      <!-- Drawer Backdrop -->
      <div id="cm-drawer-backdrop" class="fixed inset-0 bg-stone-900/30 backdrop-blur-2xs z-30 hidden" aria-hidden="true"></div>
    </div>

    <!-- Sticky Bottom Navigation -->
    <footer class="flex-shrink-0 bg-white border-t border-[#ede4da] px-4 sm:px-8 py-3.5 sm:py-4 shadow-lg">
      <div class="max-w-3xl mx-auto flex items-center justify-between gap-4">
        <!-- Back Button -->
        <button id="cm-prev-btn" type="button" class="inline-flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-2xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 font-bold text-sm sm:text-base transition shadow-xs disabled:opacity-30 disabled:pointer-events-none focus:outline-none focus:ring-2 focus:ring-stone-300">
          <svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
          <span>Back</span>
        </button>

        <!-- Center Indicator & Keyboard Tip -->
        <div class="text-center">
          <div id="cm-bottom-step-indicator" class="text-xs sm:text-sm font-bold text-stone-700">
            Step 1 of ${totalSteps}
          </div>
          <div class="hidden sm:block text-[11px] text-stone-400 font-normal">
            Shortcuts: &larr; Back &bull; &rarr; Next &bull; Esc Exit
          </div>
        </div>

        <!-- Next / Finish Button -->
        <button id="cm-next-btn" type="button" class="inline-flex items-center gap-2 px-5 sm:px-7 py-2.5 sm:py-3 rounded-2xl bg-[#ca5c2e] hover:bg-[#b34d23] text-white font-bold text-sm sm:text-base transition shadow-sm hover:shadow focus:outline-none focus:ring-2 focus:ring-[#ca5c2e]/40">
          <span id="cm-next-btn-text">Next</span>
          <svg id="cm-next-btn-icon" class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
      </div>
    </footer>
  `;

  document.body.appendChild(overlay);

  // Element references
  const stepContainer = overlay.querySelector("#cm-step-container");
  const progressBar = overlay.querySelector("#cm-progress-bar");
  const stepIndicator = overlay.querySelector("#cm-step-indicator");
  const progressPercentage = overlay.querySelector("#cm-progress-percentage");
  const bottomStepIndicator = overlay.querySelector("#cm-bottom-step-indicator");
  const stepPillsNav = overlay.querySelector("#cm-step-pills");
  const prevBtn = overlay.querySelector("#cm-prev-btn");
  const nextBtn = overlay.querySelector("#cm-next-btn");
  const nextBtnText = overlay.querySelector("#cm-next-btn-text");
  const nextBtnIcon = overlay.querySelector("#cm-next-btn-icon");

  const ingredientsDrawer = overlay.querySelector("#cm-ingredients-drawer");
  const drawerBackdrop = overlay.querySelector("#cm-drawer-backdrop");
  const ingredientsToggle = overlay.querySelector("#cm-ingredients-toggle");
  const drawerCloseBtn = overlay.querySelector("#cm-drawer-close-btn");
  const ingredientsList = overlay.querySelector("#cm-ingredients-list");
  const checklistSummary = overlay.querySelector("#cm-checklist-summary");
  const checkAllBtn = overlay.querySelector("#cm-check-all-btn");
  const resetChecksBtn = overlay.querySelector("#cm-reset-checks-btn");

  // Timer helpers
  function stopActiveTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    isTimerRunning = false;
  }

  function formatTime(totalSeconds) {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  // Populate Ingredients Checklist
  function renderIngredientsChecklist() {
    const ings = recipe.ingredients || [];
    if (!ings.length) {
      ingredientsList.innerHTML = `<li class="text-stone-400 text-sm italic py-4 text-center">No ingredients listed.</li>`;
      return;
    }

    ingredientsList.innerHTML = ings
      .map((ing, idx) => {
        const isChecked = checkedIngredients.has(idx);
        const flaggedLabels = allergenResult.byIngredient?.[ing.name.toLowerCase()] || [];
        const isFlagged = flaggedLabels.length > 0;
        const flagHtml = isFlagged
          ? `<span class="inline-block mt-0.5 text-[10px] font-semibold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.2 rounded-full">Allergen: ${escapeHtml(flaggedLabels[0])}</span>`
          : "";

        return `
          <li class="flex items-start gap-3 p-2.5 rounded-xl border ${isChecked ? "bg-stone-50 border-stone-200/60" : "bg-white border-stone-100 hover:bg-stone-50"} transition cursor-pointer select-none">
            <input 
              type="checkbox" 
              id="cm-ing-item-${idx}" 
              data-index="${idx}"
              class="cm-ing-checkbox mt-1 w-4 h-4 rounded text-[#ca5c2e] focus:ring-[#ca5c2e] cursor-pointer"
              ${isChecked ? "checked" : ""}
            >
            <label for="cm-ing-item-${idx}" class="flex-1 cursor-pointer min-w-0">
              <div class="flex items-baseline justify-between gap-2">
                <span class="font-medium text-sm text-stone-900 ${isChecked ? "line-through text-stone-400" : ""}">
                  ${escapeHtml(capitalizeIngredient(ing.name))}
                </span>
                <span class="text-xs text-stone-500 flex-shrink-0">
                  ${escapeHtml(ing.measure || "")}
                </span>
              </div>
              ${flagHtml}
            </label>
          </li>
        `;
      })
      .join("");

    updateChecklistSummary();
  }

  function updateChecklistSummary() {
    const ings = recipe.ingredients || [];
    const count = checkedIngredients.size;
    checklistSummary.textContent = `${count} of ${ings.length} gathered`;
    overlay.querySelector("#cm-ingredients-count-badge").textContent = `${count}/${ings.length}`;
  }

  // Toggle drawer
  function openIngredientsDrawer() {
    ingredientsDrawer.classList.remove("translate-x-full");
    drawerBackdrop.classList.remove("hidden");
  }

  function closeIngredientsDrawer() {
    ingredientsDrawer.classList.add("translate-x-full");
    drawerBackdrop.classList.add("hidden");
  }

  ingredientsToggle.addEventListener("click", () => {
    const isOpen = !ingredientsDrawer.classList.contains("translate-x-full");
    if (isOpen) {
      closeIngredientsDrawer();
    } else {
      openIngredientsDrawer();
    }
  });
  drawerCloseBtn.addEventListener("click", closeIngredientsDrawer);
  drawerBackdrop.addEventListener("click", closeIngredientsDrawer);

  // Checkbox interactions
  ingredientsList.addEventListener("change", (e) => {
    if (e.target && e.target.classList.contains("cm-ing-checkbox")) {
      const idx = parseInt(e.target.dataset.index, 10);
      if (e.target.checked) {
        checkedIngredients.add(idx);
      } else {
        checkedIngredients.delete(idx);
      }
      renderIngredientsChecklist();
    }
  });

  checkAllBtn.addEventListener("click", () => {
    (recipe.ingredients || []).forEach((_, idx) => checkedIngredients.add(idx));
    renderIngredientsChecklist();
  });

  resetChecksBtn.addEventListener("click", () => {
    checkedIngredients.clear();
    renderIngredientsChecklist();
  });

  // Render Step Navigation Pills
  function renderStepPills() {
    stepPillsNav.innerHTML = steps
      .map((_, idx) => {
        const isCurrent = idx === currentStepIndex;
        const isDone = completedSteps.has(idx);

        let pillClasses = "min-w-[28px] h-7 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center focus:outline-none ";
        if (isCurrent) {
          pillClasses += "bg-[#ca5c2e] text-white shadow-xs ring-2 ring-[#ca5c2e]/25";
        } else if (isDone) {
          pillClasses += "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100";
        } else {
          pillClasses += "bg-stone-50 text-stone-500 border border-stone-200 hover:bg-stone-100 hover:text-stone-800";
        }

        return `
          <button 
            type="button" 
            data-step="${idx}" 
            class="cm-step-pill ${pillClasses}"
            aria-current="${isCurrent ? "step" : "false"}"
            aria-label="Go to Step ${idx + 1}"
          >
            ${isDone && !isCurrent ? `✓` : `${idx + 1}`}
          </button>
        `;
      })
      .join("");

    // Auto-scroll active pill into view
    const activePill = stepPillsNav.querySelector(`[data-step="${currentStepIndex}"]`);
    if (activePill) {
      activePill.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }

  // Render Step Details
  function renderStep(index) {
    stopActiveTimer();
    const step = steps[index];
    const isFirst = index === 0;
    const isLast = index === totalSteps - 1;
    const isDone = completedSteps.has(index);

    // Update Progress Indicator
    const progressPercent = Math.round(((index + 1) / totalSteps) * 100);
    progressBar.style.width = `${progressPercent}%`;
    stepIndicator.textContent = `Step ${index + 1} of ${totalSteps}`;
    progressPercentage.textContent = `(${progressPercent}% completed)`;
    bottomStepIndicator.textContent = `Step ${index + 1} of ${totalSteps}`;

    // Update Navigation buttons
    prevBtn.disabled = isFirst;

    if (isLast) {
      nextBtnText.textContent = "Finish Cooking 🎉";
      nextBtnIcon.innerHTML = `<polyline points="20 6 9 17 4 12"></polyline>`;
    } else {
      nextBtnText.textContent = "Next";
      nextBtnIcon.innerHTML = `<polyline points="9 18 15 12 9 6"></polyline>`;
    }

    renderStepPills();

    // Check timer in step text
    const detectedTimer = detectCookingTimer(step.text);

    // Render Step Card
    stepContainer.innerHTML = `
      <div class="bg-white rounded-3xl border border-[#efe6dc] shadow-sm p-6 sm:p-8 md:p-10 space-y-6">
        <!-- Step Top Row: Section label & remaining steps -->
        <div class="flex items-center justify-between gap-3 flex-wrap">
          ${step.section ? `
            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-stone-100 text-stone-800 border border-stone-200">
              <span>${step.sectionIcon || "🍳"}</span> ${escapeHtml(step.section)}
            </span>
          ` : `
            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[#fbece4] text-[#ca5c2e]">
              Cooking Step
            </span>
          `}

          <span class="text-xs sm:text-sm font-semibold text-stone-400">
            ${isLast ? "Final Step" : `${totalSteps - index - 1} more step${totalSteps - index - 1 === 1 ? "" : "s"} to go`}
          </span>
        </div>

        <!-- Step Number & Main Text -->
        <div class="space-y-4">
          <div class="flex items-start gap-4 sm:gap-5">
            <span class="flex-shrink-0 w-11 h-11 sm:w-13 sm:h-13 rounded-2xl bg-[#fbece4] text-[#ca5c2e] font-extrabold text-lg sm:text-2xl flex items-center justify-center shadow-2xs mt-1">
              ${index + 1}
            </span>
            <div class="flex-1">
              <p class="text-xl sm:text-2xl md:text-3xl font-medium text-stone-900 leading-relaxed sm:leading-loose">
                ${escapeHtml(step.text)}
              </p>
            </div>
          </div>
        </div>

        <!-- Timer Assistant Widget (if duration detected) -->
        ${detectedTimer ? `
          <div class="pt-5 border-t border-stone-100 flex items-center justify-between flex-wrap gap-3">
            <div class="flex items-center gap-2.5">
              <span class="w-8 h-8 rounded-full bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center text-base">⏱️</span>
              <div>
                <span class="text-sm font-bold text-stone-800">Timer detected: ${detectedTimer.label}</span>
                <p class="text-xs text-stone-500">Need a countdown timer for this step?</p>
              </div>
            </div>
            <div id="cm-step-timer-wrapper">
              <button 
                id="cm-start-timer-btn" 
                type="button" 
                data-seconds="${detectedTimer.seconds}" 
                data-label="${detectedTimer.label}"
                class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs sm:text-sm font-semibold transition shadow-xs focus:outline-none"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                <span>Start ${detectedTimer.label} Timer</span>
              </button>
            </div>
          </div>
        ` : ""}

        <!-- Step Mark Done & Navigation Helper -->
        <div class="pt-3 border-t border-stone-100 flex items-center justify-between flex-wrap gap-2 text-xs text-stone-400">
          <label class="inline-flex items-center gap-2 cursor-pointer select-none">
            <input 
              type="checkbox" 
              id="cm-step-done-check" 
              class="w-4 h-4 rounded text-[#ca5c2e] focus:ring-[#ca5c2e] cursor-pointer"
              ${isDone ? "checked" : ""}
            >
            <span class="text-stone-600 font-semibold text-xs sm:text-sm">Mark this step as completed</span>
          </label>
          <span class="hidden sm:inline text-stone-400">
            Press <kbd class="px-1.5 py-0.5 rounded bg-stone-100 border border-stone-200 font-mono text-[10px]">Space</kbd> or <kbd class="px-1.5 py-0.5 rounded bg-stone-100 border border-stone-200 font-mono text-[10px]">&rarr;</kbd> for next step
          </span>
        </div>
      </div>
    `;

    // Step Done Checkbox binding
    const stepDoneCheck = stepContainer.querySelector("#cm-step-done-check");
    stepDoneCheck?.addEventListener("change", (e) => {
      if (e.target.checked) {
        completedSteps.add(index);
      } else {
        completedSteps.delete(index);
      }
      renderStepPills();
    });

    // Step Timer Button binding
    const startTimerBtn = stepContainer.querySelector("#cm-start-timer-btn");
    const timerWrapper = stepContainer.querySelector("#cm-step-timer-wrapper");

    if (startTimerBtn && timerWrapper) {
      startTimerBtn.addEventListener("click", () => {
        timerTotalSeconds = parseInt(startTimerBtn.dataset.seconds, 10);
        timerSecondsLeft = timerTotalSeconds;
        isTimerRunning = true;

        const updateTimerUI = () => {
          timerWrapper.innerHTML = `
            <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-amber-300 bg-amber-50 shadow-2xs">
              <span id="cm-timer-display" class="font-mono text-base font-bold text-amber-900 min-w-[54px] text-center">
                ${formatTime(timerSecondsLeft)}
              </span>
              <button id="cm-timer-toggle-btn" type="button" class="p-1 rounded-lg hover:bg-amber-100 text-amber-800 transition focus:outline-none" aria-label="${isTimerRunning ? "Pause timer" : "Resume timer"}">
                ${isTimerRunning ? `
                  <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                ` : `
                  <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                `}
              </button>
              <button id="cm-timer-reset-btn" type="button" class="p-1 rounded-lg hover:bg-amber-100 text-stone-500 hover:text-stone-800 transition focus:outline-none" aria-label="Reset timer">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
              </button>
            </div>
          `;

          const toggleBtn = timerWrapper.querySelector("#cm-timer-toggle-btn");
          const resetBtn = timerWrapper.querySelector("#cm-timer-reset-btn");

          toggleBtn?.addEventListener("click", () => {
            isTimerRunning = !isTimerRunning;
            updateTimerUI();
          });

          resetBtn?.addEventListener("click", () => {
            stopActiveTimer();
            renderStep(index);
          });
        };

        updateTimerUI();

        timerInterval = setInterval(() => {
          if (!isTimerRunning) return;
          if (timerSecondsLeft > 0) {
            timerSecondsLeft--;
            const display = timerWrapper.querySelector("#cm-timer-display");
            if (display) display.textContent = formatTime(timerSecondsLeft);
          } else {
            stopActiveTimer();
            playTimerChime();
            timerWrapper.innerHTML = `
              <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-800 font-bold text-xs animate-bounce">
                <span>⏱️ Time's up!</span>
                <button id="cm-timer-dismiss-btn" type="button" class="underline ml-1">Dismiss</button>
              </div>
            `;
            timerWrapper.querySelector("#cm-timer-dismiss-btn")?.addEventListener("click", () => {
              renderStep(index);
            });
          }
        }, 1000);
      });
    }
  }

  // Render Celebratory Completion Screen
  function renderCompletionScreen() {
    stopActiveTimer();
    progressBar.style.width = "100%";
    stepIndicator.textContent = `Completed! (${totalSteps} of ${totalSteps})`;
    progressPercentage.textContent = "(100% completed)";
    bottomStepIndicator.textContent = "Cooking Completed 🎉";

    prevBtn.disabled = false;
    nextBtnText.textContent = "Finished 🎉";
    nextBtn.disabled = true;

    stepContainer.innerHTML = `
      <div class="bg-white rounded-3xl border border-[#efe6dc] shadow-sm p-8 sm:p-12 text-center space-y-6 max-w-xl mx-auto">
        <div class="w-20 h-20 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center text-4xl mx-auto shadow-sm">
          🎉
        </div>
        <div class="space-y-2">
          <h3 class="text-2xl sm:text-3xl font-extrabold text-stone-900 tracking-tight">
            Bon Appétit!
          </h3>
          <p class="text-stone-600 text-base leading-relaxed">
            You've completed all <strong class="text-stone-800 font-bold">${totalSteps} steps</strong> for <strong class="text-stone-800 font-bold">${escapeHtml(recipe.name)}</strong>. Enjoy your meal!
          </p>
        </div>

        <div class="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button 
            id="cm-finish-review-btn" 
            type="button" 
            class="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#ca5c2e] hover:bg-[#b34d23] text-white font-bold text-sm transition shadow-sm focus:outline-none"
          >
            <span>★ Leave a Review</span>
          </button>
          <button 
            id="cm-finish-exit-btn" 
            type="button" 
            class="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 font-semibold text-sm transition shadow-2xs focus:outline-none"
          >
            <span>Back to Recipe</span>
          </button>
          <button 
            id="cm-finish-restart-btn" 
            type="button" 
            class="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-stone-500 hover:text-stone-800 text-sm font-semibold transition focus:outline-none"
          >
            <span>Restart Steps</span>
          </button>
        </div>
      </div>
    `;

    overlay.querySelector("#cm-finish-review-btn")?.addEventListener("click", () => {
      closeCookingMode();
      if (typeof onSwitchTab === "function") {
        onSwitchTab("reviews");
      }
      setTimeout(() => {
        const ratingSection = document.getElementById("recipe-ratings-section");
        ratingSection?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);
    });

    overlay.querySelector("#cm-finish-exit-btn")?.addEventListener("click", closeCookingMode);

    overlay.querySelector("#cm-finish-restart-btn")?.addEventListener("click", () => {
      nextBtn.disabled = false;
      goToStep(0);
    });
  }

  // Navigation logic
  function goToStep(index) {
    if (index < 0) return;
    if (index >= totalSteps) {
      renderCompletionScreen();
      return;
    }
    currentStepIndex = index;
    renderStep(currentStepIndex);
  }

  // Button clicks
  prevBtn.addEventListener("click", () => {
    if (currentStepIndex > 0) {
      goToStep(currentStepIndex - 1);
    }
  });

  nextBtn.addEventListener("click", () => {
    completedSteps.add(currentStepIndex);
    goToStep(currentStepIndex + 1);
  });

  // Jump to step pill click
  stepPillsNav.addEventListener("click", (e) => {
    const pill = e.target.closest(".cm-step-pill");
    if (pill && pill.dataset.step !== undefined) {
      nextBtn.disabled = false;
      const targetStep = parseInt(pill.dataset.step, 10);
      goToStep(targetStep);
    }
  });

  // Exit cleanup
  function closeCookingMode() {
    stopActiveTimer();
    releaseScreenWakeLock();
    window.removeEventListener("keydown", onKeyDown);
    document.body.style.overflow = prevOverflow;
    overlay.remove();
  }

  overlay.querySelector("#cm-exit-btn")?.addEventListener("click", closeCookingMode);

  // Keyboard navigation
  function onKeyDown(e) {
    // If user is focused on an input or textarea, don't hijack keys
    if (["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) return;

    if (e.key === "Escape") {
      e.preventDefault();
      const isOpen = !ingredientsDrawer.classList.contains("translate-x-full");
      if (isOpen) {
        closeIngredientsDrawer();
      } else {
        closeCookingMode();
      }
    } else if (e.key === "ArrowRight" || e.key === " " || e.key === "n" || e.key === "N") {
      e.preventDefault();
      if (!nextBtn.disabled) {
        completedSteps.add(currentStepIndex);
        goToStep(currentStepIndex + 1);
      }
    } else if (e.key === "ArrowLeft" || e.key === "p" || e.key === "P") {
      e.preventDefault();
      if (currentStepIndex > 0) {
        nextBtn.disabled = false;
        goToStep(currentStepIndex - 1);
      }
    } else if (e.key === "i" || e.key === "I") {
      e.preventDefault();
      const isOpen = !ingredientsDrawer.classList.contains("translate-x-full");
      if (isOpen) {
        closeIngredientsDrawer();
      } else {
        openIngredientsDrawer();
      }
    }
  }

  window.addEventListener("keydown", onKeyDown);

  // Initialize
  renderIngredientsChecklist();
  goToStep(0);
}
