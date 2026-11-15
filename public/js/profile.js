// Settings page (profile.html): display name, diet preferences, allergies, password and account.
// Owner: Person 1. Connected to Firebase Auth and Firestore.
//
// Each section edits a draft. Its Save button stays disabled until the draft differs
// from what is saved, and Reset puts the draft back. Unsaved sections get a dot on
// their tab, and leaving the page with unsaved changes asks first.

import { onAuthChange, logout, deleteAccount, resetPassword } from "./auth.js";
import { showToast, escapeHtml } from "./utils.js";
import { auth, db } from "./firebase-config.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { updateProfile } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { renderNavbar } from "./navbar.js";
import { savePreferences, DIET_OPTIONS, ALLERGEN_OPTIONS, dietLabel } from "./preferences.js";

const ALLERGEN_ICONS = {
  Peanuts: "🥜", "Tree Nuts": "🌰", Dairy: "🥛", Eggs: "🥚", Gluten: "🌾",
  Soy: "🫘", Fish: "🐟", Shellfish: "🦐", Sesame: "🌿",
};

// Older or typed values that mean one of the standard options.
const ALIASES = {
  "gluten-free": "Gluten Free", "gluten free": "Gluten Free", "dairy-free": "Dairy Free", "dairy free": "Dairy Free",
  "low carb": "Low Carb", "low-carb": "Low Carb", lowcarb: "Low Carb", "keto-friendly": "Keto",
  peanut: "Peanuts", nuts: "Tree Nuts", "tree nut": "Tree Nuts", milk: "Dairy", lactose: "Dairy",
  egg: "Eggs", wheat: "Gluten", "gluten / wheat": "Gluten", soya: "Soy",
};

function canonicalise(value, options) {
  const raw = String(value || "").trim();
  const key = raw.toLowerCase();
  const match = options.find((o) => o.value.toLowerCase() === key || o.label.toLowerCase() === key);
  if (match) return match.value;
  if (ALIASES[key] && options.some((o) => o.value === ALIASES[key])) return ALIASES[key];
  return raw;
}

function uniq(list) {
  const seen = new Set();
  return list.filter((v) => {
    const k = v.toLowerCase();
    if (!v || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

let currentProfile = {
  displayName: "",
  email: "",
  photoURL: "",
  diets: [],
  allergies: [],
  hideFlagged: false,
};

// Unsaved edits, one per section.
const draft = {
  displayName: "",
  diets: [],
  allergies: [],
  hideFlagged: false,
};

let activeUser = null;
let hasLocalNameEdit = false;

// ---------- Avatar helpers ----------
function isGeneratedAvatarUrl(url) {
  return !url || String(url).includes("ui-avatars.com/api/");
}

function buildAvatarUrl(name, existingUrl) {
  if (existingUrl && !isGeneratedAvatarUrl(existingUrl)) return existingUrl;
  const fallback = name || "User";
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(fallback)}&background=ca5c2e&color=fff`;
}

// ---------- Draft state ----------
function savedDiets() {
  return uniq((currentProfile.diets || []).map((d) => canonicalise(d, DIET_OPTIONS)));
}

function savedAllergies() {
  return uniq((currentProfile.allergies || []).map((a) => canonicalise(a, ALLERGEN_OPTIONS)));
}

function sameSet(a, b) {
  if (a.length !== b.length) return false;
  const set = new Set(a.map((v) => v.toLowerCase()));
  return b.every((v) => set.has(v.toLowerCase()));
}

const isDirty = {
  profile: () => draft.displayName.trim() !== (currentProfile.displayName || "").trim(),
  diets: () => !sameSet(draft.diets, savedDiets()),
  allergies: () => !sameSet(draft.allergies, savedAllergies()) || draft.hideFlagged !== (currentProfile.hideFlagged === true),
};

// Copies saved values into a section's draft (all sections by default).
function resetDraft(section) {
  if (!section || section === "profile") draft.displayName = currentProfile.displayName || "";
  if (!section || section === "diets") draft.diets = savedDiets();
  if (!section || section === "allergies") {
    draft.allergies = savedAllergies();
    draft.hideFlagged = currentProfile.hideFlagged === true;
  }
}

// When saved values change (cache, Firestore), refresh only the drafts the user hasn't touched.
function syncCleanDrafts() {
  ["profile", "diets", "allergies"].forEach((section) => {
    if (!isDirty[section]()) resetDraft(section);
  });
}

// ---------- Rendering ----------
function renderSidebar() {
  const name = currentProfile.displayName || "User";
  const sidebarName = document.getElementById("profile-sidebar-name");
  const sidebarEmail = document.getElementById("profile-sidebar-email");
  const sidebarAvatar = document.getElementById("profile-sidebar-avatar");
  if (sidebarName) sidebarName.textContent = name;
  if (sidebarEmail) sidebarEmail.textContent = currentProfile.email || "";
  if (sidebarAvatar && currentProfile.photoURL) {
    sidebarAvatar.src = currentProfile.photoURL;
    sidebarAvatar.alt = `${name}'s profile picture`;
  }

  const summary = document.getElementById("profile-summary");
  if (summary) {
    const diets = savedDiets();
    const allergies = savedAllergies();
    const pill = (text, title) =>
      `<span class="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#faf7f2] border border-[#efe6dc] text-stone-600" title="${escapeHtml(title)}">${escapeHtml(text)}</span>`;
    summary.innerHTML =
      pill(diets.length ? `${diets.length} diet${diets.length === 1 ? "" : "s"}` : "No diet set", diets.map(dietLabel).join(", ") || "No diet preference") +
      pill(allergies.length ? `${allergies.length} allerg${allergies.length === 1 ? "y" : "ies"}` : "No allergies", allergies.join(", ") || "No allergies saved");
  }
}

function renderProfileSection() {
  const input = document.getElementById("display-name-input");
  if (input && !input.matches(":focus")) input.value = draft.displayName;
  updateNameCount();

  const email = currentProfile.email || activeUser?.email || "";
  const emailInput = document.getElementById("profile-email-input");
  if (emailInput) emailInput.value = email;
  const resetEmail = document.getElementById("reset-email");
  if (resetEmail) resetEmail.textContent = email || "your email";

  // Only show "Verified" when Firebase says so.
  const badge = document.getElementById("email-verified-badge");
  const user = auth?.currentUser || activeUser;
  if (badge && user) {
    const verified = user.emailVerified === true;
    badge.className = `inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
      verified ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-stone-500 bg-stone-50 border-stone-200"
    }`;
    badge.textContent = verified ? "✓ Verified" : "Not verified";
  }

  // Sign-in method, and password help for Google-only accounts.
  const providers = (auth?.currentUser?.providerData || []).map((p) => p.providerId);
  const usesGoogle = providers.includes("google.com");
  const usesPassword = providers.includes("password");
  const method = document.getElementById("sign-in-method");
  if (method && providers.length) {
    // A short label reads better than a sentence here, e.g. "Sign-in method: Google".
    const value = usesGoogle && usesPassword ? "Google, or email and password" : usesGoogle ? "Google" : "Email and password";
    method.innerHTML = `Sign-in method: <span class="font-semibold text-stone-600">${value}</span>`;
  }
  const passwordHelp = document.getElementById("password-help");
  if (passwordHelp && providers.length) {
    passwordHelp.textContent = usesGoogle && !usesPassword
      ? "Your account uses Google sign-in, so it has no password yet. Send a reset link to add one."
      : "We'll email you a link to set a new password.";
  }
}

function choiceCardClasses(selected) {
  return `group flex items-start gap-3 p-3.5 rounded-2xl border text-left transition select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ca5c2e]/40 ${
    selected
      ? "border-[#ca5c2e] bg-[#fdf6f1] ring-1 ring-[#ca5c2e]"
      : "border-stone-200 bg-white hover:border-[#ca5c2e]/40 hover:bg-[#fdfaf7]"
  }`;
}

function checkMark(selected) {
  return `<span class="mt-0.5 w-5 h-5 rounded-full shrink-0 flex items-center justify-center border transition ${
    selected ? "bg-[#ca5c2e] border-[#ca5c2e] text-white" : "border-stone-300 bg-white text-transparent"
  }" aria-hidden="true"><svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="3.2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg></span>`;
}

function renderDietSection() {
  const host = document.getElementById("diet-options");
  if (host) {
    const selected = new Set(draft.diets.map((d) => d.toLowerCase()));
    host.innerHTML = DIET_OPTIONS.map((opt) => {
      const on = selected.has(opt.value.toLowerCase());
      return `
        <button type="button" class="diet-choice ${choiceCardClasses(on)}" data-value="${escapeHtml(opt.value)}" aria-pressed="${on}">
          ${checkMark(on)}
          <span class="min-w-0">
            <span class="flex items-center gap-1.5 text-sm font-semibold ${on ? "text-[#a04e28]" : "text-stone-800"}">
              <span aria-hidden="true">${opt.icon}</span>${escapeHtml(opt.label)}
            </span>
            <span class="block text-xs text-stone-500 mt-0.5 leading-snug">${escapeHtml(opt.description)}</span>
          </span>
        </button>`;
    }).join("");
  }
  const count = document.getElementById("diet-count-text");
  if (count) count.textContent = draft.diets.length ? `${draft.diets.length} selected` : "No preference";
}

function renderAllergySection() {
  const grid = document.getElementById("common-allergens-grid");
  const selected = new Set(draft.allergies.map((a) => a.toLowerCase()));
  if (grid) {
    grid.innerHTML = ALLERGEN_OPTIONS.map((opt) => {
      const on = selected.has(opt.value.toLowerCase());
      return `
        <button type="button" class="allergen-choice flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-sm transition select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ca5c2e]/40 ${
          on ? "border-[#ca5c2e] bg-[#fdf6f1] text-[#a04e28] font-semibold ring-1 ring-[#ca5c2e]" : "border-stone-200 bg-white text-stone-700 font-medium hover:border-[#ca5c2e]/40 hover:bg-[#fdfaf7]"
        }" data-value="${escapeHtml(opt.value)}" aria-pressed="${on}">
          <span aria-hidden="true">${ALLERGEN_ICONS[opt.value] || "⚠️"}</span>
          <span class="truncate flex-1 text-left">${escapeHtml(opt.label)}</span>
          ${on ? `<svg class="w-4 h-4 shrink-0 text-[#ca5c2e]" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>` : ""}
        </button>`;
    }).join("");
  }

  // Anything not in the common list shows as a removable tag.
  const commonValues = new Set(ALLERGEN_OPTIONS.map((o) => o.value.toLowerCase()));
  const custom = draft.allergies.filter((a) => !commonValues.has(a.toLowerCase()));
  const tags = document.getElementById("allergies-tags");
  if (tags) {
    tags.innerHTML = custom
      .map(
        (a) => `
        <span class="inline-flex items-center gap-1 pl-3 pr-1 py-1 rounded-full text-xs font-semibold bg-[#fbf2ec] text-[#a04e28] border border-[#f3ddd0]">
          ${escapeHtml(a)}
          <button type="button" class="remove-allergy-btn w-5 h-5 inline-flex items-center justify-center rounded-full hover:bg-[#ca5c2e]/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ca5c2e]/40" data-value="${escapeHtml(a)}" aria-label="Remove ${escapeHtml(a)}">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.6" viewBox="0 0 24 24" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </span>`
      )
      .join("");
  }

  const toggle = document.getElementById("profile-hide-flagged");
  if (toggle) toggle.checked = draft.hideFlagged;

  const count = document.getElementById("allergy-count-text");
  if (count) count.textContent = draft.allergies.length ? `${draft.allergies.length} selected` : "None";
}

function updateNameCount() {
  const input = document.getElementById("display-name-input");
  const count = document.getElementById("display-name-count");
  if (input && count) count.textContent = `${input.value.length}/40`;
}

// Save bars and tab dots reflect which sections have unsaved changes.
function updateDirtyUi() {
  ["profile", "diets", "allergies"].forEach((section) => {
    const dirty = isDirty[section]();
    const bar = document.querySelector(`[data-savebar="${section}"]`);
    if (bar && !bar.classList.contains("is-saving")) {
      bar.classList.toggle("is-dirty", dirty);
      const status = bar.querySelector(".savebar-status");
      if (status) status.textContent = dirty ? "Unsaved changes" : "All changes saved";
      const save = bar.querySelector(".savebar-save");
      const invalid = section === "profile" && !draft.displayName.trim();
      if (save) save.disabled = !dirty || invalid;
    }
    document.querySelector(`.profile-nav-tab[data-tab="${section === "diets" ? "diets" : section}"]`)?.classList.toggle("is-dirty", dirty);
  });

  const nameInput = document.getElementById("display-name-input");
  const nameError = document.getElementById("display-name-error");
  const emptyName = !draft.displayName.trim() && isDirty.profile();
  nameInput?.setAttribute("aria-invalid", String(emptyName));
  nameError?.classList.toggle("hidden", !emptyName);
}

function renderAll() {
  renderSidebar();
  renderProfileSection();
  renderDietSection();
  renderAllergySection();
  updateDirtyUi();
}

// ---------- Loading ----------
// Paint straight away from the local cache, so there is no flash of empty fields.
function hydrateFromCache() {
  try {
    const cachedUser = JSON.parse(localStorage.getItem("recipeplan_user") || "null");
    const cachedProfile = JSON.parse(localStorage.getItem("recipeplan_profile") || "null");
    if (!cachedUser && !cachedProfile) return;

    const name = cachedProfile?.displayName || cachedUser?.displayName || cachedUser?.email?.split("@")[0] || "";
    currentProfile = {
      displayName: name,
      email: cachedProfile?.email || cachedUser?.email || "",
      photoURL: cachedProfile?.photoURL || cachedUser?.photoURL || (name ? buildAvatarUrl(name) : ""),
      diets: cachedProfile?.diets || [],
      allergies: cachedProfile?.allergies || [],
      hideFlagged: cachedProfile?.hideFlagged === true,
    };
    resetDraft();
    renderAll();
  } catch (e) {}
}

async function loadProfileForUser(user) {
  if (!user) {
    if (!localStorage.getItem("recipeplan_user")) window.location.href = "login.html?redirect=profile.html";
    return;
  }
  activeUser = user;

  let cachedProfile = null;
  let cachedUser = null;
  try {
    cachedProfile = JSON.parse(localStorage.getItem("recipeplan_profile") || "null");
    cachedUser = JSON.parse(localStorage.getItem("recipeplan_user") || "null");
  } catch (e) {}

  // Prefer a cached name for the same account, so a stale Firebase Auth displayName
  // doesn't overwrite a name that was just changed.
  const sameAccount =
    (!cachedProfile?.email && !cachedUser?.email) ||
    cachedProfile?.email === user.email ||
    cachedUser?.email === user.email ||
    cachedUser?.uid === user.uid;
  const preferredCachedName = sameAccount ? cachedProfile?.displayName || cachedUser?.displayName || currentProfile.displayName : "";
  const name = preferredCachedName || user.displayName || user.email?.split("@")[0] || "User";
  const rawPhoto = user.photoURL && !isGeneratedAvatarUrl(user.photoURL)
    ? user.photoURL
    : sameAccount ? cachedProfile?.photoURL || cachedUser?.photoURL : "";

  currentProfile.displayName = name;
  currentProfile.email = user.email || currentProfile.email || "";
  currentProfile.photoURL = buildAvatarUrl(name, rawPhoto);
  syncCleanDrafts();
  renderAll();
  renderNavbar(activeUser);

  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (snap.exists()) {
      const data = snap.data();
      if (data.displayName && !hasLocalNameEdit) {
        currentProfile.displayName = data.displayName;
        currentProfile.photoURL = buildAvatarUrl(data.displayName, currentProfile.photoURL);
      }
      if (data.diets !== undefined) currentProfile.diets = data.diets;
      if (data.allergies !== undefined) currentProfile.allergies = data.allergies;
      if (data.hideFlagged !== undefined) currentProfile.hideFlagged = data.hideFlagged === true;

      if (auth?.currentUser && currentProfile.displayName && auth.currentUser.displayName !== currentProfile.displayName) {
        updateProfile(auth.currentUser, { displayName: currentProfile.displayName }).catch(() => {});
      }
      writeCaches(user.uid);
    } else if (cachedProfile && (!cachedProfile.email || cachedProfile.email === user.email)) {
      currentProfile.diets = cachedProfile.diets || [];
      currentProfile.allergies = cachedProfile.allergies || [];
      if (cachedProfile.hideFlagged !== undefined) currentProfile.hideFlagged = cachedProfile.hideFlagged === true;
    }
    syncCleanDrafts();
    renderAll();
    renderNavbar(activeUser);
  } catch (err) {
    console.warn("Could not fetch profile from Firestore:", err);
  }
}

function writeCaches(uid) {
  try {
    const cached = JSON.parse(localStorage.getItem("recipeplan_profile") || "{}");
    localStorage.setItem("recipeplan_profile", JSON.stringify({ ...cached, ...currentProfile }));
    const userCache = JSON.parse(localStorage.getItem("recipeplan_user") || "{}");
    localStorage.setItem("recipeplan_user", JSON.stringify({
      ...userCache,
      uid: uid || userCache.uid,
      email: currentProfile.email || userCache.email,
      displayName: currentProfile.displayName,
      photoURL: currentProfile.photoURL,
    }));
  } catch (e) {}
}

// ---------- Saving ----------
async function saveProfile(updatedFields) {
  if (updatedFields.displayName) {
    hasLocalNameEdit = true;
    updatedFields.photoURL = buildAvatarUrl(updatedFields.displayName, currentProfile.photoURL);
  }
  currentProfile = { ...currentProfile, ...updatedFields };

  const uid = activeUser?.uid || auth?.currentUser?.uid;
  writeCaches(uid);
  renderNavbar(activeUser);

  const tasks = [];
  if (updatedFields.displayName && auth?.currentUser) {
    tasks.push(updateProfile(auth.currentUser, { displayName: currentProfile.displayName }));
  }
  if (uid) {
    tasks.push(
      setDoc(doc(db, "users", uid), {
        displayName: currentProfile.displayName,
        email: currentProfile.email,
        diets: currentProfile.diets,
        allergies: currentProfile.allergies,
        hideFlagged: currentProfile.hideFlagged,
      }, { merge: true })
    );
  }
  const results = await Promise.allSettled(tasks);

  if (updatedFields.diets !== undefined || updatedFields.allergies !== undefined || updatedFields.hideFlagged !== undefined) {
    try {
      await savePreferences({
        diets: currentProfile.diets,
        allergies: currentProfile.allergies,
        hideFlagged: currentProfile.hideFlagged,
      });
    } catch (e) {}
  }

  renderNavbar(activeUser);
  const failed = results.find((r) => r.status === "rejected");
  if (failed) console.warn("Could not save everything to your account:", failed.reason);
  return !failed;
}

const SAVE_MESSAGES = {
  profile: "Name updated",
  diets: "Diet preferences saved",
  allergies: "Allergies saved",
};

async function saveSection(section) {
  if (!isDirty[section]()) return;
  if (section === "profile" && !draft.displayName.trim()) return;

  const bar = document.querySelector(`[data-savebar="${section}"]`);
  const btn = bar?.querySelector(".savebar-save");
  const label = btn?.textContent;
  bar?.classList.add("is-saving");
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>Saving…`;
  }

  const fields =
    section === "profile" ? { displayName: draft.displayName.trim() }
      : section === "diets" ? { diets: [...draft.diets] }
        : { allergies: [...draft.allergies], hideFlagged: draft.hideFlagged };

  const ok = await saveProfile(fields);

  bar?.classList.remove("is-saving");
  if (btn) btn.textContent = label;
  resetDraft(section);
  renderAll();
  showToast(ok ? SAVE_MESSAGES[section] : "Saved on this device, but it couldn't reach your account. Try again later.");
}

// ---------- Tabs ----------
const TAB_IDS = ["profile", "diets", "allergies", "account"];

function switchTab(tabId, { focus = false } = {}) {
  if (tabId === "password") tabId = "account"; // old link
  if (!TAB_IDS.includes(tabId)) tabId = "profile";

  document.querySelectorAll(".profile-nav-tab").forEach((tab) => {
    const on = tab.dataset.tab === tabId;
    tab.setAttribute("aria-selected", String(on));
    tab.tabIndex = on ? 0 : -1;
    if (on && focus) tab.focus();
    if (on) tab.scrollIntoView({ block: "nearest", inline: "nearest" });
  });
  TAB_IDS.forEach((id) => {
    document.getElementById(`tab-panel-${id}`)?.classList.toggle("active", id === tabId);
  });
  try {
    history.replaceState(null, "", `#${tabId}`);
  } catch (e) {}
}

function updateTabOrientation() {
  const list = document.getElementById("profile-tabs");
  if (list) list.setAttribute("aria-orientation", window.matchMedia("(min-width: 768px)").matches ? "vertical" : "horizontal");
}

// ---------- Delete account ----------
function showDeleteAccountModal() {
  return new Promise((resolve) => {
    document.getElementById("delete-account-modal-backdrop")?.remove();

    const backdrop = document.createElement("div");
    backdrop.id = "delete-account-modal-backdrop";
    backdrop.className = "fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-opacity duration-200 opacity-0";
    backdrop.setAttribute("role", "dialog");
    backdrop.setAttribute("aria-modal", "true");
    backdrop.setAttribute("aria-labelledby", "delete-modal-title");

    backdrop.innerHTML = `
      <div class="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-stone-100 p-6 sm:p-7 text-center transition-all duration-200 transform scale-95 opacity-0">
        <button type="button" id="delete-modal-close" class="absolute top-4 right-4 p-2 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-300" aria-label="Close dialog">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
        <div class="w-14 h-14 rounded-2xl bg-red-100/80 text-red-600 flex items-center justify-center mx-auto mb-4 border border-red-200/60">
          <svg class="w-7 h-7" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
        </div>
        <h3 id="delete-modal-title" class="text-xl font-bold text-stone-900 tracking-tight">Delete your account?</h3>
        <p class="text-sm text-stone-500 mt-2 leading-relaxed">This permanently erases your profile, saved favourites and meal plans. It can't be undone.</p>
        <div class="mt-6 flex items-center gap-3">
          <button type="button" id="delete-modal-cancel" class="flex-1 h-11 rounded-full border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 font-semibold text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-300">Cancel</button>
          <button type="button" id="delete-modal-confirm" class="flex-1 h-11 rounded-full bg-red-600 hover:bg-red-700 text-white font-semibold text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400">Delete account</button>
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);
    const dialog = backdrop.querySelector(".relative");
    requestAnimationFrame(() => {
      backdrop.classList.replace("opacity-0", "opacity-100");
      dialog.classList.remove("scale-95", "opacity-0");
      dialog.classList.add("scale-100", "opacity-100");
      backdrop.querySelector("#delete-modal-cancel")?.focus();
    });

    let closed = false;
    function cleanup(confirmed) {
      if (closed) return;
      closed = true;
      document.removeEventListener("keydown", onKeyDown);
      backdrop.classList.replace("opacity-100", "opacity-0");
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
    backdrop.querySelector("#delete-modal-close")?.addEventListener("click", () => cleanup(false));
    backdrop.querySelector("#delete-modal-cancel")?.addEventListener("click", () => cleanup(false));
    backdrop.querySelector("#delete-modal-confirm")?.addEventListener("click", () => cleanup(true));
  });
}

async function handleDeleteAccount() {
  if (!(await showDeleteAccountModal())) return;
  try {
    await deleteAccount();
    showToast("Your account has been deleted.");
    setTimeout(() => (window.location.href = "index.html"), 500);
  } catch (err) {
    if (err.code === "auth/requires-recent-login") {
      showToast("For security, please log in again before deleting your account.", 4000);
      setTimeout(() => (window.location.href = "login.html?redirect=profile.html%23account"), 1200);
    } else {
      showToast("Could not delete your account. " + (err.message || "Please try again."), 4000);
    }
  }
}

// ---------- Start ----------
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", hydrateFromCache);
} else {
  hydrateFromCache();
}

document.addEventListener("DOMContentLoaded", () => {
  onAuthChange((user) => loadProfileForUser(user));

  // Tabs: click, and arrow keys in either direction (vertical on desktop, horizontal on phones).
  const tabList = document.getElementById("profile-tabs");
  tabList?.addEventListener("click", (e) => {
    const tab = e.target.closest(".profile-nav-tab");
    if (tab) switchTab(tab.dataset.tab);
  });
  tabList?.addEventListener("keydown", (e) => {
    const tabs = Array.from(document.querySelectorAll(".profile-nav-tab"));
    const i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    let next = null;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") next = (i + 1) % tabs.length;
    else if (e.key === "ArrowUp" || e.key === "ArrowLeft") next = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    if (next !== null) {
      e.preventDefault();
      switchTab(tabs[next].dataset.tab, { focus: true });
    }
  });
  updateTabOrientation();
  window.addEventListener("resize", updateTabOrientation);
  switchTab(window.location.hash.replace("#", "") || "profile");

  // Display name
  const nameInput = document.getElementById("display-name-input");
  nameInput?.addEventListener("input", () => {
    draft.displayName = nameInput.value;
    updateNameCount();
    updateDirtyUi();
  });
  nameInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveSection("profile");
    }
  });

  // Diet cards
  document.getElementById("diet-options")?.addEventListener("click", (e) => {
    const card = e.target.closest(".diet-choice");
    if (!card) return;
    const value = card.dataset.value;
    const has = draft.diets.some((d) => d.toLowerCase() === value.toLowerCase());
    draft.diets = has ? draft.diets.filter((d) => d.toLowerCase() !== value.toLowerCase()) : [...draft.diets, value];
    renderDietSection();
    updateDirtyUi();
    document.querySelector(`.diet-choice[data-value="${CSS.escape(value)}"]`)?.focus();
  });

  // Allergies: common grid, custom input, tags, hide toggle
  const toggleAllergy = (value) => {
    const has = draft.allergies.some((a) => a.toLowerCase() === value.toLowerCase());
    draft.allergies = has ? draft.allergies.filter((a) => a.toLowerCase() !== value.toLowerCase()) : [...draft.allergies, value];
  };
  document.getElementById("common-allergens-grid")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".allergen-choice");
    if (!btn) return;
    toggleAllergy(btn.dataset.value);
    renderAllergySection();
    updateDirtyUi();
    document.querySelector(`.allergen-choice[data-value="${CSS.escape(btn.dataset.value)}"]`)?.focus();
  });

  const allergyInput = document.getElementById("allergy-input");
  const addAllergy = () => {
    const raw = allergyInput?.value.trim();
    if (!raw) return;
    const value = canonicalise(raw, ALLERGEN_OPTIONS);
    if (draft.allergies.some((a) => a.toLowerCase() === value.toLowerCase())) {
      showToast(`"${value}" is already on your list`);
    } else {
      draft.allergies = [...draft.allergies, value];
      renderAllergySection();
      updateDirtyUi();
    }
    allergyInput.value = "";
    allergyInput.focus();
  };
  document.getElementById("add-allergy-btn")?.addEventListener("click", addAllergy);
  allergyInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addAllergy();
    }
  });
  document.getElementById("allergies-tags")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".remove-allergy-btn");
    if (!btn) return;
    toggleAllergy(btn.dataset.value);
    renderAllergySection();
    updateDirtyUi();
    allergyInput?.focus();
  });
  document.getElementById("profile-hide-flagged")?.addEventListener("change", (e) => {
    draft.hideFlagged = e.target.checked;
    updateDirtyUi();
  });

  // Save and Reset buttons
  document.querySelectorAll("[data-save]").forEach((btn) =>
    btn.addEventListener("click", () => saveSection(btn.dataset.save))
  );
  document.querySelectorAll("[data-reset]").forEach((btn) =>
    btn.addEventListener("click", () => {
      resetDraft(btn.dataset.reset);
      renderAll();
    })
  );

  // Ask before leaving with unsaved changes.
  window.addEventListener("beforeunload", (e) => {
    if (["profile", "diets", "allergies"].some((s) => isDirty[s]())) {
      e.preventDefault();
      e.returnValue = "";
    }
  });

  // Password reset email
  const resetBtn = document.getElementById("profile-send-reset-btn");
  resetBtn?.addEventListener("click", async () => {
    const email = currentProfile.email || activeUser?.email;
    if (!email) {
      showToast("No email address found for this account.");
      return;
    }
    const label = resetBtn.textContent;
    resetBtn.disabled = true;
    resetBtn.textContent = "Sending…";
    try {
      await resetPassword(email);
      showToast(`Reset link sent to ${email}`);
      resetBtn.textContent = "Link sent";
      setTimeout(() => {
        resetBtn.disabled = false;
        resetBtn.textContent = label;
      }, 30000); // avoid sending lots of emails in a row
    } catch (err) {
      console.warn("Password reset failed:", err);
      showToast("Couldn't send the reset link. Please try again in a moment.");
      resetBtn.disabled = false;
      resetBtn.textContent = label;
    }
  });

  // Log out
  const doLogout = async () => {
    await logout();
    window.location.href = "index.html";
  };
  document.getElementById("profile-logout-btn")?.addEventListener("click", doLogout);
  document.getElementById("profile-logout-btn-mobile")?.addEventListener("click", doLogout);

  // Delete account
  document.getElementById("main-delete-account-btn")?.addEventListener("click", handleDeleteAccount);
});
