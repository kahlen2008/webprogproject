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

import { escapeHtml, capitalizeIngredient, showConfirmModal } from "./utils.js";

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
  // Decimals are allowed so "1.5 hours" isn't read as "5 hours".
  const regex = /(?:^|[^\d.])(\d+(?:\.\d+)?(?:\s*(?:-|–|—|to)\s*\d+(?:\.\d+)?)?)\s*(hours?|hrs?|minutes?|mins?|seconds?|secs?)\b/i;
  const match = text.match(regex);
  if (!match) return null;

  const rawNum = match[1];
  const unit = match[2].toLowerCase();

  let num = 0;
  if (/[-–—]|to/.test(rawNum)) {
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
    label = `${num} hour${num === 1 ? "" : "s"}`;
  } else if (/min/.test(unit)) {
    if (num > 300) return null;
    totalSeconds = Math.round(num * 60);
    label = `${num} minute${num === 1 ? "" : "s"}`;
  } else if (/sec/.test(unit)) {
    totalSeconds = Math.round(num);
    label = `${num} second${num === 1 ? "" : "s"}`;
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

// The browser drops the wake lock whenever the tab is hidden, so take it again on return.
function reacquireWakeLockOnVisible() {
  if (document.visibilityState === "visible" && document.getElementById("cooking-mode-overlay")) {
    requestScreenWakeLock();
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
  // Only one instance at a time; reuse the open one rather than stacking listeners.
  if (document.getElementById("cooking-mode-overlay")) return;

  const steps = prepareCookingSteps(parsedItems, recipe.instructions);
  const totalSteps = steps.length;
  let currentStepIndex = 0;
  let isComplete = false;
  const completedSteps = new Set();
  const checkedIngredients = new Set();

  // Kitchen timers, keyed by the step that started them. They live at the overlay level so
  // they keep counting while the cook moves between steps, and several can run at once.
  // Each countdown uses an end timestamp so it stays accurate when the browser throttles
  // timers in a background tab.
  // { label, endsAt, remaining (seconds), running, done }
  const timers = new Map();
  let timerTick = null;
  let currentDetectedTimer = null;

  // Lock body scroll and remember focus so it can be restored on exit
  const prevOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  const prevFocus = document.activeElement;

  // Request screen wake lock
  requestScreenWakeLock();
  document.addEventListener("visibilitychange", reacquireWakeLockOnVisible);

  // Keycap style for the shortcut hints in the footer
  const KBD = "inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-md border border-stone-200 border-b-2 bg-stone-50 font-sans text-[10px] font-semibold text-stone-500";

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
          <span id="cm-progress-percentage" class="hidden sm:inline text-xs font-semibold text-stone-400">
            (0% completed)
          </span>
        </div>

        <!-- Quick Jump Step Pills (min-w-0 lets the row shrink and scroll instead of overflowing) -->
        <nav id="cm-step-pills" class="min-w-0 flex items-center gap-1.5 overflow-x-auto px-1 py-1 scrollbar-none" aria-label="Step navigation">
          <!-- Rendered dynamically -->
        </nav>
      </div>
    </div>

    <!-- Main Content Area -->
    <!-- No items-center here: centring a scrollable flex child cuts off the top of long steps.
         The child's my-auto centres short steps and still scrolls from the top on long ones. -->
    <div id="cm-main" class="flex-1 overflow-y-auto relative p-4 sm:p-6 lg:p-8 flex">
      <!-- Active Step Container -->
      <div id="cm-step-container" class="max-w-3xl w-full mx-auto my-auto space-y-6">
        <!-- Step card injected here -->
      </div>

      <!-- Slide-over Ingredients Checklist Drawer -->
      <aside id="cm-ingredients-drawer" class="fixed inset-y-0 right-0 w-full sm:w-96 max-w-full bg-white shadow-2xl border-l border-[#ede4da] z-40 transform translate-x-full transition-transform duration-300 ease-in-out flex flex-col" aria-label="Ingredients Checklist" inert>
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

    <!-- Running Timers Bar (shown on every step while any timer exists) -->
    <div id="cm-timer-tray" class="flex-shrink-0 hidden" aria-label="Kitchen timers">
      <div id="cm-timer-list" class="max-w-3xl mx-auto px-4 sm:px-8 pb-3 flex flex-wrap items-center justify-center gap-2" aria-live="polite"></div>
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
        <div class="text-center min-w-0">
          <div id="cm-bottom-step-indicator" class="text-sm font-medium text-stone-400 tabular-nums"></div>
          <div class="hidden md:flex items-center justify-center gap-3 mt-1.5 text-[11px] font-medium text-stone-400" aria-hidden="true">
            <span class="inline-flex items-center gap-1"><kbd class="${KBD}">&larr;</kbd><kbd class="${KBD}">&rarr;</kbd> Steps</span>
            <span class="inline-flex items-center gap-1"><kbd class="${KBD}">I</kbd> Ingredients</span>
            <span class="inline-flex items-center gap-1"><kbd class="${KBD}">Esc</kbd> Exit</span>
          </div>
        </div>

        <!-- Next / Finish Button -->
        <button id="cm-next-btn" type="button" class="inline-flex items-center gap-2 px-5 sm:px-7 py-2.5 sm:py-3 rounded-2xl bg-[#ca5c2e] hover:bg-[#b34d23] text-white font-bold text-sm sm:text-base whitespace-nowrap transition shadow-sm hover:shadow disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus:ring-2 focus:ring-[#ca5c2e]/40">
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

  const timerTray = overlay.querySelector("#cm-timer-tray");
  const timerList = overlay.querySelector("#cm-timer-list");

  // Timer helpers
  function formatTime(totalSeconds) {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    const mmss = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    return hrs > 0 ? `${hrs}:${mmss}` : mmss;
  }

  function hasActiveTimers() {
    return [...timers.values()].some((t) => !t.done);
  }

  function startTimer(stepIndex, seconds, label) {
    timers.set(stepIndex, { label, total: seconds, endsAt: Date.now() + seconds * 1000, remaining: seconds, running: true, done: false });
    ensureTicking();
    renderTimers();
  }

  function toggleTimer(stepIndex) {
    const t = timers.get(stepIndex);
    if (!t || t.done) return;
    t.running = !t.running;
    // Resuming: push the end time forward by however long it was paused
    if (t.running) t.endsAt = Date.now() + t.remaining * 1000;
    ensureTicking();
    renderTimers();
  }

  function removeTimer(stepIndex) {
    timers.delete(stepIndex);
    renderTimers();
  }

  function ensureTicking() {
    if (timerTick) return;
    timerTick = setInterval(() => {
      let changed = false;
      timers.forEach((t, stepIndex) => {
        if (!t.running) return;
        t.remaining = Math.max(0, Math.ceil((t.endsAt - Date.now()) / 1000));
        if (t.remaining === 0) {
          t.running = false;
          t.done = true;
          changed = true;
          playTimerChime();
          navigator.vibrate?.([200, 100, 200]);
        } else {
          overlay.querySelectorAll(`[data-timer-display="${stepIndex}"]`).forEach((el) => {
            el.textContent = formatTime(t.remaining);
          });
          overlay.querySelectorAll(`[data-timer-ring="${stepIndex}"]`).forEach((el) => {
            el.setAttribute("stroke-dashoffset", ringOffset(t).toFixed(2));
          });
        }
      });
      if (changed) renderTimers();
      if (![...timers.values()].some((t) => t.running)) {
        clearInterval(timerTick);
        timerTick = null;
      }
    }, 250);
  }

  function clearAllTimers() {
    if (timerTick) clearInterval(timerTick);
    timerTick = null;
    timers.clear();
  }

  // Rebuilds the timer bar and the current step's timer widget, keeping focus on the
  // control that was pressed (the buttons are recreated).
  function renderTimers() {
    const focused = document.activeElement;
    const focusKey = overlay.contains(focused) && focused?.dataset.timerAction
      ? `[data-timer-action="${focused.dataset.timerAction}"][data-step="${focused.dataset.step}"]`
      : null;

    const entries = [...timers.entries()].sort((a, b) => a[0] - b[0]);
    timerTray.classList.toggle("hidden", entries.length === 0);
    // Compact versions of the step timer panel: mini ring, step + time, round controls
    const chipBtn = "w-8 h-8 rounded-full inline-flex items-center justify-center transition focus:outline-none focus-visible:ring-2";
    timerList.innerHTML = entries
      .map(([stepIndex, t]) => {
        const state = t.done ? "done" : t.running ? "running" : "paused";
        const c = {
          running: { chip: "bg-white border-amber-200", track: "text-amber-100", bar: "text-amber-500", eyebrow: "text-amber-700", time: "text-stone-900" },
          paused: { chip: "bg-white border-stone-200", track: "text-stone-100", bar: "text-stone-300", eyebrow: "text-stone-400", time: "text-stone-400" },
          done: { chip: "bg-emerald-50 border-emerald-300 ring-4 ring-emerald-100", track: "text-emerald-500", bar: "", eyebrow: "text-emerald-700", time: "text-emerald-800" },
        }[state];

        const ring = `
          <span class="relative w-9 h-9 flex-shrink-0">
            <svg class="w-9 h-9 -rotate-90" viewBox="0 0 52 52" aria-hidden="true">
              <circle cx="26" cy="26" r="22" fill="${state === "done" ? "currentColor" : "none"}" stroke="currentColor" stroke-width="6" class="${c.track}"></circle>
              ${state !== "done" ? `
                <circle data-timer-ring="${stepIndex}" cx="26" cy="26" r="22" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"
                  class="${c.bar} transition-[stroke-dashoffset] duration-300 ease-linear"
                  stroke-dasharray="${RING_CIRCUMFERENCE.toFixed(2)}" stroke-dashoffset="${ringOffset(t).toFixed(2)}"></circle>` : ""}
            </svg>
            ${state === "done" ? `<span class="absolute inset-0 flex items-center justify-center text-white">${ICONS.checkSmall}</span>` : ""}
          </span>`;

        const controls = state === "done"
          ? `<button type="button" data-timer-action="remove" data-step="${stepIndex}" class="h-8 px-3.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300">Dismiss</button>`
          : `
            <button type="button" data-timer-action="toggle" data-step="${stepIndex}" class="${chipBtn} ${state === "running" ? "bg-amber-100 hover:bg-amber-200 text-amber-800 focus-visible:ring-amber-300" : "bg-stone-900 hover:bg-stone-800 text-white focus-visible:ring-stone-300"}" aria-label="${state === "running" ? "Pause" : "Resume"} step ${stepIndex + 1} timer">
              ${state === "running" ? ICONS.pauseSmall : ICONS.playSmall}
            </button>
            <button type="button" data-timer-action="remove" data-step="${stepIndex}" class="${chipBtn} text-stone-400 hover:bg-stone-100 hover:text-stone-700 focus-visible:ring-stone-300" aria-label="Cancel step ${stepIndex + 1} timer">
              ${ICONS.close}
            </button>`;

        return `
          <div class="inline-flex items-center gap-2.5 pl-1.5 pr-1.5 py-1.5 rounded-full border ${c.chip} shadow-sm">
            <button type="button" data-timer-action="goto" data-step="${stepIndex}" class="group inline-flex items-center gap-2.5 rounded-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300" aria-label="Go to step ${stepIndex + 1}">
              ${ring}
              <span class="leading-none pr-1">
                <span class="block text-[10px] font-bold uppercase tracking-wider ${c.eyebrow} group-hover:underline">
                  Step ${stepIndex + 1}${state === "paused" ? " · Paused" : ""}
                </span>
                <span ${state === "done" ? "" : `data-timer-display="${stepIndex}"`} class="block mt-1 font-heading text-base font-bold tabular-nums ${c.time}">
                  ${state === "done" ? "Time's up!" : formatTime(t.remaining)}
                </span>
              </span>
            </button>
            <span class="flex items-center gap-1">${controls}</span>
          </div>
        `;
      })
      .join("");

    renderStepTimerWidget();
    renderStepPills();
    // The timer bar takes space from the step area when it appears, so refit the card
    if (!isComplete) fitStepCard();

    if (focusKey) {
      // A pressed "Start" button turns into the countdown, so move focus to its pause button
      const toggleKey = `[data-timer-action="toggle"][data-step="${focused.dataset.step}"]`;
      const target = focused.dataset.timerAction === "start"
        ? overlay.querySelector(toggleKey) || overlay.querySelector(focusKey)
        : overlay.querySelector(focusKey) || overlay.querySelector(toggleKey);
      target?.focus({ preventScroll: true });
    }
  }

  // The right-hand side of the "Timer detected" row on the current step card.
  // Progress ring geometry (r = 22 in a 52×52 viewBox)
  const RING_CIRCUMFERENCE = 2 * Math.PI * 22;
  const ringOffset = (t) => (t ? RING_CIRCUMFERENCE * (1 - t.remaining / t.total) : 0);

  const ICONS = {
    clock: `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"></circle><path stroke-linecap="round" stroke-linejoin="round" d="M12 7v5l3 2"></path></svg>`,
    play: `<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5.5v13a1 1 0 001.5.86l10.5-6.5a1 1 0 000-1.72L9.5 4.64A1 1 0 008 5.5z"/></svg>`,
    pause: `<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>`,
    reset: `<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 12a8 8 0 1 0 2.34-5.66M4 4v4h4"/></svg>`,
    check: `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>`,
    checkSmall: `<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>`,
    playSmall: `<svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5.5v13a1 1 0 001.5.86l10.5-6.5a1 1 0 000-1.72L9.5 4.64A1 1 0 008 5.5z"/></svg>`,
    pauseSmall: `<svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>`,
    close: `<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>`,
  };

  // The timer panel on the current step card: idle, running, paused or finished.
  function renderStepTimerWidget() {
    const panel = stepContainer.querySelector("#cm-step-timer");
    if (!panel || !currentDetectedTimer || isComplete) return;

    const step = currentStepIndex;
    const t = timers.get(step);
    const state = !t ? "idle" : t.done ? "done" : t.running ? "running" : "paused";
    const seconds = t ? t.remaining : currentDetectedTimer.seconds;

    const theme = {
      idle: { panel: "bg-[#fdf8f4] border-[#f3e3d6]", ring: "text-[#f3e3d6]", bar: "text-[#ca5c2e]", icon: "text-[#ca5c2e]", eyebrow: "text-[#a04e28]", time: "text-stone-900" },
      running: { panel: "bg-amber-50 border-amber-200", ring: "text-amber-100", bar: "text-amber-500", icon: "text-amber-600", eyebrow: "text-amber-700", time: "text-amber-950" },
      paused: { panel: "bg-stone-50 border-stone-200", ring: "text-stone-200", bar: "text-stone-400", icon: "text-stone-400", eyebrow: "text-stone-500", time: "text-stone-500" },
      done: { panel: "bg-emerald-50 border-emerald-200", ring: "text-emerald-500", bar: "text-emerald-500", icon: "text-emerald-600", eyebrow: "text-emerald-700", time: "text-emerald-800" },
    }[state];

    const eyebrow = { idle: "Suggested timer", running: "Timer running", paused: "Paused", done: "Time's up" }[state];
    const caption = {
      idle: `${currentDetectedTimer.label}. It keeps running when you change steps.`,
      running: "Keeps running when you change steps.",
      paused: "Resume when you're ready.",
      done: "This step's timer has finished.",
    }[state];

    const roundBtn = "w-10 h-10 rounded-full inline-flex items-center justify-center transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";
    let actions = "";
    if (state === "idle") {
      actions = `
        <button type="button" data-timer-action="start" data-step="${step}" class="inline-flex items-center gap-2 pl-4 pr-5 h-10 rounded-full bg-stone-900 hover:bg-stone-800 text-white text-sm font-semibold transition shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-stone-400">
          ${ICONS.play}<span>Start</span>
        </button>`;
    } else if (state === "done") {
      actions = `
        <button type="button" data-timer-action="start" data-step="${step}" class="inline-flex items-center gap-2 px-4 h-10 rounded-full bg-white border border-emerald-200 hover:bg-emerald-100 text-emerald-800 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400">
          ${ICONS.reset}<span>Again</span>
        </button>
        <button type="button" data-timer-action="remove" data-step="${step}" class="inline-flex items-center px-4 h-10 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-400">
          Dismiss
        </button>`;
    } else {
      actions = `
        <button type="button" data-timer-action="toggle" data-step="${step}" class="${roundBtn} ${state === "running" ? "bg-amber-500 hover:bg-amber-600 text-white focus-visible:ring-amber-400" : "bg-stone-900 hover:bg-stone-800 text-white focus-visible:ring-stone-400"} shadow-xs" aria-label="${state === "running" ? "Pause" : "Resume"} timer">
          ${state === "running" ? ICONS.pause : ICONS.play}
        </button>
        <button type="button" data-timer-action="start" data-step="${step}" class="${roundBtn} bg-white border border-stone-200 hover:bg-stone-100 text-stone-500 hover:text-stone-800 focus-visible:ring-stone-300" aria-label="Restart timer">
          ${ICONS.reset}
        </button>`;
    }

    panel.className = `rounded-2xl border ${theme.panel} p-4 sm:p-5 flex items-center gap-4 flex-wrap transition-colors`;
    panel.innerHTML = `
      <div class="relative w-14 h-14 flex-shrink-0">
        <svg class="w-14 h-14 -rotate-90" viewBox="0 0 52 52" aria-hidden="true">
          <circle cx="26" cy="26" r="22" fill="none" stroke="currentColor" stroke-width="4" class="${theme.ring}"></circle>
          ${state === "running" || state === "paused" ? `
            <circle data-timer-ring="${step}" cx="26" cy="26" r="22" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"
              class="${theme.bar} transition-[stroke-dashoffset] duration-300 ease-linear"
              stroke-dasharray="${RING_CIRCUMFERENCE.toFixed(2)}" stroke-dashoffset="${ringOffset(t).toFixed(2)}"></circle>` : ""}
        </svg>
        <span class="absolute inset-0 flex items-center justify-center ${theme.icon}">
          ${state === "done" ? ICONS.check : ICONS.clock}
        </span>
      </div>

      <div class="flex-1 min-w-[150px]">
        <p class="text-[11px] font-bold uppercase tracking-wider ${theme.eyebrow}">${eyebrow}</p>
        <p data-timer-display="${step}" class="font-heading text-3xl font-bold leading-tight tabular-nums ${theme.time}">${formatTime(seconds)}</p>
        <p class="text-xs text-stone-500 mt-0.5">${escapeHtml(caption)}</p>
      </div>

      <div class="flex items-center gap-2 ml-auto">${actions}</div>
    `;
  }

  // One delegated handler for every timer control (bar and step card)
  overlay.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-timer-action]");
    if (!btn) return;
    const stepIndex = Number(btn.dataset.step);
    switch (btn.dataset.timerAction) {
      case "start":
        if (currentDetectedTimer) startTimer(stepIndex, currentDetectedTimer.seconds, currentDetectedTimer.label);
        break;
      case "toggle":
        toggleTimer(stepIndex);
        break;
      case "remove":
        removeTimer(stepIndex);
        break;
      case "goto":
        goToStep(stepIndex);
        break;
    }
  });

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
        const flaggedLabels = allergenResult.byIngredient?.[String(ing.name || "").toLowerCase()] || [];
        const isFlagged = flaggedLabels.length > 0;
        const flagHtml = isFlagged
          ? `<span class="inline-block mt-0.5 text-[10px] font-semibold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full">Allergen: ${escapeHtml(flaggedLabels.join(", "))}</span>`
          : "";

        return `
          <li data-index="${idx}" class="cm-ing-row flex items-start gap-3 p-2.5 rounded-xl border transition select-none">
            <input
              type="checkbox"
              id="cm-ing-item-${idx}"
              data-index="${idx}"
              class="cm-ing-checkbox mt-1 w-4 h-4 flex-shrink-0 rounded accent-[#ca5c2e] cursor-pointer"
              ${isChecked ? "checked" : ""}
            >
            <label for="cm-ing-item-${idx}" class="flex-1 cursor-pointer min-w-0">
              <div class="flex items-baseline justify-between gap-2">
                <span class="cm-ing-name font-medium text-sm break-words">
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

    syncChecklistState();
  }

  // Updates the checked styling in place, so ticking a box keeps keyboard focus on it.
  function syncChecklistState() {
    ingredientsList.querySelectorAll(".cm-ing-row").forEach((row) => {
      const idx = Number(row.dataset.index);
      const checked = checkedIngredients.has(idx);
      const box = row.querySelector(".cm-ing-checkbox");
      if (box) box.checked = checked;
      row.classList.toggle("bg-stone-50", checked);
      row.classList.toggle("border-stone-200", checked);
      row.classList.toggle("bg-white", !checked);
      row.classList.toggle("border-stone-100", !checked);
      row.classList.toggle("hover:bg-stone-50", !checked);
      const name = row.querySelector(".cm-ing-name");
      name?.classList.toggle("line-through", checked);
      name?.classList.toggle("text-stone-400", checked);
      name?.classList.toggle("text-stone-900", !checked);
    });
    updateChecklistSummary();
  }

  function updateChecklistSummary() {
    const ings = recipe.ingredients || [];
    const count = checkedIngredients.size;
    checklistSummary.textContent = `${count} of ${ings.length} gathered`;
    overlay.querySelector("#cm-ingredients-count-badge").textContent = `${count}/${ings.length}`;
  }

  // Toggle drawer. `inert` keeps the off-screen drawer out of the Tab order while closed.
  const isDrawerOpen = () => !ingredientsDrawer.classList.contains("translate-x-full");

  function openIngredientsDrawer() {
    ingredientsDrawer.classList.remove("translate-x-full");
    ingredientsDrawer.inert = false;
    drawerBackdrop.classList.remove("hidden");
    ingredientsToggle.setAttribute("aria-expanded", "true");
    drawerCloseBtn.focus({ preventScroll: true });
  }

  function closeIngredientsDrawer() {
    const hadFocus = ingredientsDrawer.contains(document.activeElement);
    ingredientsDrawer.classList.add("translate-x-full");
    ingredientsDrawer.inert = true;
    drawerBackdrop.classList.add("hidden");
    ingredientsToggle.setAttribute("aria-expanded", "false");
    if (hadFocus) ingredientsToggle.focus({ preventScroll: true });
  }

  function toggleIngredientsDrawer() {
    if (isDrawerOpen()) closeIngredientsDrawer();
    else openIngredientsDrawer();
  }

  ingredientsToggle.setAttribute("aria-expanded", "false");
  ingredientsToggle.addEventListener("click", toggleIngredientsDrawer);
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
      syncChecklistState();
    }
  });

  checkAllBtn.addEventListener("click", () => {
    (recipe.ingredients || []).forEach((_, idx) => checkedIngredients.add(idx));
    syncChecklistState();
  });

  resetChecksBtn.addEventListener("click", () => {
    checkedIngredients.clear();
    syncChecklistState();
  });

  // Render Step Navigation Pills
  function renderStepPills() {
    stepPillsNav.innerHTML = steps
      .map((_, idx) => {
        const isCurrent = !isComplete && idx === currentStepIndex;
        const isDone = completedSteps.has(idx);
        const hasTimer = timers.has(idx);

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
            class="cm-step-pill relative ${pillClasses}"
            aria-current="${isCurrent ? "step" : "false"}"
            aria-label="Go to Step ${idx + 1}${hasTimer ? " (has a timer)" : ""}"
          >
            ${isDone && !isCurrent ? `✓` : `${idx + 1}`}
            ${hasTimer ? `<span class="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-white" aria-hidden="true"></span>` : ""}
          </button>
        `;
      })
      .join("");

    // Scroll only the pill row (scrollIntoView can also shift the page behind the overlay)
    const activePill = stepPillsNav.querySelector(`[data-step="${currentStepIndex}"]`);
    if (activePill && stepPillsNav.scrollWidth > stepPillsNav.clientWidth) {
      const left = activePill.offsetLeft - stepPillsNav.clientWidth / 2 + activePill.offsetWidth / 2;
      stepPillsNav.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
    }
  }

  function updateProgress(stepLabel) {
    const done = isComplete ? totalSteps : completedSteps.size;
    const percent = Math.round((done / totalSteps) * 100);
    progressBar.style.width = `${percent}%`;
    progressPercentage.textContent = `(${percent}% completed)`;
    stepIndicator.textContent = stepLabel;
  }

  // Render Step Details
  function renderStep(index) {
    const step = steps[index];
    const isFirst = index === 0;
    const isLast = index === totalSteps - 1;

    // Update Progress Indicator (based on steps actually completed, not the current position)
    updateProgress(`Step ${index + 1} of ${totalSteps}`);
    bottomStepIndicator.innerHTML = `Step <span class="text-stone-900 font-bold">${index + 1}</span> of ${totalSteps}`;

    // Update Navigation buttons
    prevBtn.disabled = isFirst;
    nextBtn.disabled = false;

    if (isLast) {
      nextBtnText.textContent = "Finish 🎉";
      nextBtnIcon.innerHTML = `<polyline points="20 6 9 17 4 12"></polyline>`;
    } else {
      nextBtnText.textContent = "Next";
      nextBtnIcon.innerHTML = `<polyline points="9 18 15 12 9 6"></polyline>`;
    }

    renderStepPills();

    // Check timer in step text
    const detectedTimer = detectCookingTimer(step.text);
    currentDetectedTimer = detectedTimer;

    // Render Step Card
    stepContainer.innerHTML = `
      <div class="bg-white rounded-3xl border border-[#efe6dc] shadow-sm p-5 sm:p-7 md:p-8 space-y-5">
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
            <span class="flex-shrink-0 w-11 h-11 sm:w-14 sm:h-14 rounded-2xl bg-[#fbece4] text-[#ca5c2e] font-extrabold text-lg sm:text-2xl flex items-center justify-center shadow-2xs">
              ${index + 1}
            </span>
            <div class="flex-1 min-w-0">
              <p id="cm-step-text" class="font-medium text-stone-900 break-words" style="line-height: 1.45;">
                ${escapeHtml(step.text)}
              </p>
            </div>
          </div>
        </div>

        <!-- Timer Assistant Widget (if duration detected) -->
        ${detectedTimer ? `<div id="cm-step-timer"></div>` : ""}
      </div>
    `;

    // Timer widget for this step (start button, or the live countdown if one is running)
    renderStepTimerWidget();
  }

  // Render Celebratory Completion Screen
  function renderCompletionScreen() {
    isComplete = true;
    currentDetectedTimer = null;
    updateProgress("Completed!");
    bottomStepIndicator.innerHTML = `<span class="text-emerald-700 font-bold">All done 🎉</span>`;
    renderStepPills();

    prevBtn.disabled = false;
    nextBtnText.textContent = "Done";
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

    overlay.querySelector("#cm-finish-review-btn")?.addEventListener("click", async () => {
      if (!(await requestExit())) return;
      if (typeof onSwitchTab === "function") {
        onSwitchTab("reviews");
      }
      setTimeout(() => {
        const ratingSection = document.getElementById("recipe-ratings-section");
        ratingSection?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);
    });

    overlay.querySelector("#cm-finish-exit-btn")?.addEventListener("click", requestExit);

    overlay.querySelector("#cm-finish-restart-btn")?.addEventListener("click", () => {
      completedSteps.clear();
      goToStep(0);
    });

    overlay.querySelector("#cm-finish-review-btn")?.focus({ preventScroll: true });
  }

  // Navigation logic
  function goToStep(index) {
    if (index < 0) return;
    if (index >= totalSteps) {
      renderCompletionScreen();
      return;
    }
    isComplete = false;
    currentStepIndex = index;
    renderStep(currentStepIndex);
    fitStepCard();
    mainArea.scrollTop = 0;
  }

  function goNext() {
    if (isComplete) return;
    completedSteps.add(currentStepIndex);
    goToStep(currentStepIndex + 1);
  }

  function goBack() {
    // From the completion screen, Back returns to the last step rather than skipping it
    if (isComplete) goToStep(currentStepIndex);
    else if (currentStepIndex > 0) goToStep(currentStepIndex - 1);
  }

  const mainArea = overlay.querySelector("#cm-main");

  // Shrinks the step text until the whole card fits in the space between the header and
  // footer, so the cook never has to scroll mid-recipe. Starts from the largest size for
  // the screen width and stops at a readable minimum (very long steps on small screens
  // can still scroll).
  const MIN_STEP_FONT = 16;
  function fitStepCard() {
    const text = stepContainer.querySelector("#cm-step-text");
    if (!text) return;
    const vw = window.innerWidth;
    const maxFont = vw >= 768 ? 30 : vw >= 640 ? 24 : 20;
    const styles = getComputedStyle(mainArea);
    const available = mainArea.clientHeight - parseFloat(styles.paddingTop) - parseFloat(styles.paddingBottom);

    let size = maxFont;
    text.style.fontSize = `${size}px`;
    while (size > MIN_STEP_FONT && stepContainer.scrollHeight > available) {
      size -= 1;
      text.style.fontSize = `${size}px`;
    }
  }

  // Refit when the window changes size (rotating a tablet, resizing the browser)
  let fitFrame = 0;
  function onResize() {
    cancelAnimationFrame(fitFrame);
    fitFrame = requestAnimationFrame(() => {
      if (!isComplete) fitStepCard();
    });
  }
  window.addEventListener("resize", onResize);
  // Inter may finish loading after the first fit and change the text's height
  document.fonts?.ready.then(onResize).catch(() => {});

  // Button clicks
  prevBtn.addEventListener("click", goBack);
  nextBtn.addEventListener("click", goNext);

  // Jump to step pill click
  stepPillsNav.addEventListener("click", (e) => {
    const pill = e.target.closest(".cm-step-pill");
    if (pill && pill.dataset.step !== undefined) {
      goToStep(parseInt(pill.dataset.step, 10));
    }
  });

  // Asks before leaving while a timer is still counting. Resolves to true if Cooking Mode closed.
  let exitPromptOpen = false;
  async function requestExit() {
    if (exitPromptOpen) return false;
    if (hasActiveTimers()) {
      exitPromptOpen = true;
      const running = [...timers.values()].filter((t) => !t.done).length;
      const confirmPromise = showConfirmModal({
        title: running === 1 ? "Your timer is still running" : `${running} timers are still running`,
        message: "Leaving Cooking Mode will stop your kitchen timers. Do you want to leave anyway?",
        confirmText: "Stop & leave",
        cancelText: "Keep cooking",
        confirmColor: "danger",
        icon: "alert",
      });
      // The modal is added synchronously; start on the safe choice so Enter doesn't leave
      document.querySelector("#custom-confirm-modal #confirm-modal-cancel")?.focus({ preventScroll: true });
      const leave = await confirmPromise;
      exitPromptOpen = false;
      if (!leave) {
        overlay.querySelector("#cm-exit-btn")?.focus({ preventScroll: true });
        return false;
      }
    }
    closeCookingMode();
    return true;
  }

  // Exit cleanup
  function closeCookingMode() {
    clearAllTimers();
    releaseScreenWakeLock();
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("resize", onResize);
    cancelAnimationFrame(fitFrame);
    document.removeEventListener("visibilitychange", reacquireWakeLockOnVisible);
    document.body.style.overflow = prevOverflow;
    overlay.remove();
    if (prevFocus && document.contains(prevFocus)) prevFocus.focus({ preventScroll: true });
  }

  overlay.querySelector("#cm-exit-btn")?.addEventListener("click", requestExit);

  // Keyboard navigation
  function onKeyDown(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    // The leave-confirmation dialog handles its own keys (Esc = keep cooking)
    if (exitPromptOpen || document.getElementById("custom-confirm-modal")) return;
    const el = document.activeElement;
    const tag = el?.tagName;
    const isTextField =
      tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable ||
      (tag === "INPUT" && !["checkbox", "radio", "button"].includes(el.type));
    // Never hijack typing in a text field
    if (isTextField) return;

    if (e.key === "Escape") {
      e.preventDefault();
      if (isDrawerOpen()) closeIngredientsDrawer();
      else requestExit();
      return;
    }

    // Space/Enter on a focused button or checkbox should press that control, not change step
    if (e.key === " " && (tag === "BUTTON" || tag === "INPUT")) return;

    // Steps shouldn't change behind the open ingredients drawer
    if (isDrawerOpen() && e.key !== "i" && e.key !== "I") return;

    if (e.key === "ArrowRight" || e.key === " " || e.key === "n" || e.key === "N") {
      e.preventDefault();
      goNext();
    } else if (e.key === "ArrowLeft" || e.key === "p" || e.key === "P") {
      e.preventDefault();
      goBack();
    } else if (e.key === "i" || e.key === "I") {
      e.preventDefault();
      toggleIngredientsDrawer();
    }
  }

  window.addEventListener("keydown", onKeyDown);

  // Initialize
  renderIngredientsChecklist();
  goToStep(0);
  nextBtn.focus({ preventScroll: true });
}
