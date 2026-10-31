// Profile page logic: Display name, diet preferences, allergies management.
// Connected to Firebase Auth and Firestore.

import { getCurrentUser, onAuthChange, logout, deleteAccount, resetPassword } from "./auth.js";
import { showToast, escapeHtml } from "./utils.js";
import { db } from "./firebase-config.js";
import { doc, getDoc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { updateProfile } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { renderNavbar } from "./navbar.js";
import { savePreferences } from "./preferences.js";

const COMMON_ALLERGENS = [
  { value: "Peanuts", label: "Peanuts", icon: "🥜" },
  { value: "Tree Nuts", label: "Tree Nuts", icon: "🌰" },
  { value: "Dairy", label: "Dairy", icon: "🥛" },
  { value: "Eggs", label: "Eggs", icon: "🥚" },
  { value: "Gluten", label: "Gluten / Wheat", icon: "🌾" },
  { value: "Soy", label: "Soy", icon: "🫘" },
  { value: "Fish", label: "Fish", icon: "🐟" },
  { value: "Shellfish", label: "Shellfish", icon: "🦐" },
  { value: "Sesame", label: "Sesame", icon: "🌿" },
];

let currentProfile = {
  displayName: "",
  email: "",
  photoURL: "",
  diets: [],
  allergies: [],
  hideFlagged: false,
};

let activeUser = null;

// Synchronously hydrate from cache immediately so there is zero flash of placeholder content
function hydrateFromCache() {
  try {
    const cachedUser = JSON.parse(localStorage.getItem("recipeplan_user") || "null");
    const cachedProfile = JSON.parse(localStorage.getItem("recipeplan_profile") || "null");

    if (cachedUser || cachedProfile) {
      const name = cachedProfile?.displayName || cachedUser?.displayName || cachedUser?.email?.split("@")[0] || "";
      const email = cachedProfile?.email || cachedUser?.email || "";
      const avatar = cachedProfile?.photoURL || cachedUser?.photoURL || (name ? `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=ca5c2e&color=fff` : "");

      currentProfile = {
        displayName: name,
        email: email,
        photoURL: avatar,
        diets: cachedProfile?.diets || [],
        allergies: cachedProfile?.allergies || [],
        hideFlagged: cachedProfile?.hideFlagged || false,
      };
      renderProfile();
    }
  } catch (e) {}
}

// Hydrate immediately
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", hydrateFromCache);
} else {
  hydrateFromCache();
}

async function loadProfileForUser(user) {
  if (!user) {
    // If not logged in and no cached user, redirect to login
    const cached = localStorage.getItem("recipeplan_user");
    if (!cached) {
      window.location.href = "login.html";
    }
    return;
  }

  activeUser = user;
  const name = user.displayName || user.email?.split("@")[0] || currentProfile.displayName || "User";
  const avatar = user.photoURL || currentProfile.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=ca5c2e&color=fff`;

  currentProfile.displayName = name;
  currentProfile.email = user.email || currentProfile.email || "";
  currentProfile.photoURL = avatar;

  // Render immediately with Auth data without waiting for Firestore network roundtrip
  renderProfile();

  // Try fetching data from Firestore in the background
  try {
    const userDocRef = doc(db, "users", user.uid);
    const snap = await getDoc(userDocRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data.displayName) currentProfile.displayName = data.displayName;
      if (data.diets !== undefined) currentProfile.diets = data.diets;
      if (data.allergies !== undefined) currentProfile.allergies = data.allergies;
      if (data.hideFlagged !== undefined) currentProfile.hideFlagged = data.hideFlagged;

      // Keep local profile cache in sync with cloud
      try {
        const cached = JSON.parse(localStorage.getItem("recipeplan_profile") || "{}");
        localStorage.setItem("recipeplan_profile", JSON.stringify({
          ...cached,
          displayName: currentProfile.displayName,
          email: currentProfile.email,
          photoURL: currentProfile.photoURL,
          diets: currentProfile.diets,
          allergies: currentProfile.allergies,
          hideFlagged: currentProfile.hideFlagged,
        }));
      } catch (e) {}

      renderProfile();
    } else {
      // First time loading, check localStorage
      const cached = localStorage.getItem("recipeplan_profile");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (!parsed.email || parsed.email === user.email) {
          currentProfile.diets = parsed.diets || [];
          currentProfile.allergies = parsed.allergies || [];
          if (parsed.hideFlagged !== undefined) currentProfile.hideFlagged = parsed.hideFlagged;
          renderProfile();
        }
      }
    }
  } catch (err) {
    console.warn("Could not fetch profile from Firestore:", err);
  }
}

async function saveProfile(updatedFields) {
  currentProfile = { ...currentProfile, ...updatedFields };

  // Update in Firestore
  if (activeUser && activeUser.uid) {
    try {
      const userDocRef = doc(db, "users", activeUser.uid);
      await setDoc(userDocRef, {
        displayName: currentProfile.displayName,
        email: currentProfile.email,
        diets: currentProfile.diets,
        allergies: currentProfile.allergies,
        hideFlagged: currentProfile.hideFlagged,
      }, { merge: true });

      // Update Firebase Auth profile displayName if changed
      if (updatedFields.displayName && activeUser.updateProfile) {
        await updateProfile(activeUser, { displayName: currentProfile.displayName });
      }
    } catch (err) {
      console.warn("Could not save to Firestore:", err);
    }
  }

  // Update localStorage cache
  try {
    localStorage.setItem("recipeplan_profile", JSON.stringify(currentProfile));
    const userCache = JSON.parse(localStorage.getItem("recipeplan_user") || "{}");
    userCache.displayName = currentProfile.displayName;
    localStorage.setItem("recipeplan_user", JSON.stringify(userCache));
  } catch (e) {}

  if (updatedFields.diets !== undefined || updatedFields.allergies !== undefined || updatedFields.hideFlagged !== undefined) {
    try {
      await savePreferences({
        diets: currentProfile.diets,
        allergies: currentProfile.allergies,
        hideFlagged: currentProfile.hideFlagged,
      });
    } catch (e) {}
  }

  renderProfile();
  renderNavbar(activeUser);
  showToast("Changes saved successfully!");
}

function renderProfile() {
  const sidebarName = document.getElementById("profile-sidebar-name");
  const sidebarEmail = document.getElementById("profile-sidebar-email");
  const sidebarAvatar = document.getElementById("profile-sidebar-avatar");
  const displayNameInput = document.getElementById("display-name-input");

  if (sidebarName) sidebarName.textContent = currentProfile.displayName || "User";
  if (sidebarEmail) sidebarEmail.textContent = currentProfile.email;
  if (sidebarAvatar && currentProfile.photoURL) sidebarAvatar.src = currentProfile.photoURL;
  if (displayNameInput && !displayNameInput.matches(":focus")) {
    displayNameInput.value = currentProfile.displayName;
  }

  const profileEmailInput = document.getElementById("profile-email-input");
  if (profileEmailInput) {
    profileEmailInput.value = currentProfile.email || activeUser?.email || "";
  }

  // Update Diet checkboxes and live counter
  const dietCheckboxes = document.querySelectorAll("input[name='diet-pref']");
  let activeDietCount = 0;
  dietCheckboxes.forEach((cb) => {
    const isChecked = (currentProfile.diets || []).includes(cb.value);
    cb.checked = isChecked;
    if (isChecked) activeDietCount++;
  });
  const dietCountText = document.getElementById("diet-count-text");
  if (dietCountText) {
    dietCountText.textContent = `${activeDietCount} active`;
  }

  // Update Hide Flagged toggle
  const hideFlaggedToggle = document.getElementById("profile-hide-flagged");
  if (hideFlaggedToggle) {
    hideFlaggedToggle.checked = currentProfile.hideFlagged === true;
  }

  // Render Common Allergens Grid
  const commonGrid = document.getElementById("common-allergens-grid");
  if (commonGrid) {
    commonGrid.innerHTML = COMMON_ALLERGENS.map((allergen) => {
      const isSelected = (currentProfile.allergies || []).includes(allergen.value);
      return `
        <button 
          type="button" 
          class="common-allergen-btn flex items-center justify-between p-2.5 sm:p-3 rounded-xl border text-xs transition select-none ${
            isSelected
              ? "border-[#ca5c2e] bg-[#fbf2ec] text-[#ca5c2e] font-semibold shadow-2xs hover:bg-[#f8ede6]"
              : "border-stone-200 bg-white hover:border-[#ca5c2e]/40 hover:bg-[#fdfaf7] text-stone-700 font-medium shadow-2xs"
          }"
          data-allergy="${escapeHtml(allergen.value)}"
        >
          <span class="flex items-center gap-1.5 truncate">
            <span class="text-sm">${allergen.icon}</span>
            <span class="truncate">${escapeHtml(allergen.label)}</span>
          </span>
          <span class="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
            isSelected ? "bg-[#ca5c2e] text-white" : "bg-stone-100 text-stone-400"
          }">
            ${
              isSelected
                ? `<svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>`
                : `<span class="text-xs font-bold leading-none">+</span>`
            }
          </span>
        </button>
      `;
    }).join("");

    commonGrid.querySelectorAll(".common-allergen-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const item = btn.dataset.allergy;
        if (!item) return;
        const current = currentProfile.allergies || [];
        const updated = current.includes(item)
          ? current.filter((a) => a !== item)
          : [...current, item];
        saveProfile({ allergies: updated });
      });
    });
  }

  // Update Allergies tags, clear button and counter
  const allergiesList = document.getElementById("allergies-tags");
  const allergyCountText = document.getElementById("allergy-count-text");
  const clearAllBtn = document.getElementById("clear-all-allergies-btn");
  const registeredCount = (currentProfile.allergies || []).length;

  if (allergyCountText) {
    allergyCountText.textContent = `${registeredCount} registered`;
  }
  if (clearAllBtn) {
    if (registeredCount > 0) {
      clearAllBtn.classList.remove("hidden");
    } else {
      clearAllBtn.classList.add("hidden");
    }
  }

  if (allergiesList) {
    if (registeredCount === 0) {
      allergiesList.innerHTML = `<p class="text-xs text-stone-400 italic py-1">No allergies registered yet. Tap any common allergen above or type your own.</p>`;
    } else {
      allergiesList.innerHTML = (currentProfile.allergies || [])
        .map(
          (allergy) => `
          <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#fbf2ec] text-[#ca5c2e] border border-[#f3ddd0] shadow-2xs">
            <span>${escapeHtml(allergy)}</span>
            <button type="button" class="remove-allergy-btn hover:text-[#b34d23] focus:outline-none ml-0.5 p-0.5 hover:bg-[#ca5c2e]/10 rounded-full transition" data-allergy="${escapeHtml(allergy)}" aria-label="Remove ${escapeHtml(allergy)}">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </span>
        `
        )
        .join("");

      allergiesList.querySelectorAll(".remove-allergy-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          const item = btn.dataset.allergy;
          const newAllergies = (currentProfile.allergies || []).filter((a) => a !== item);
          saveProfile({ allergies: newAllergies });
        });
      });
    }
  }
}

// Initialise event handlers
document.addEventListener("DOMContentLoaded", () => {
  onAuthChange((user) => {
    loadProfileForUser(user);
  });

  // Profile Tabs Switching with smooth transitions
  const navTabs = document.querySelectorAll(".profile-nav-tab");
  const tabPanels = {
    profile: document.getElementById("tab-panel-profile"),
    diets: document.getElementById("tab-panel-diets"),
    allergies: document.getElementById("tab-panel-allergies"),
    password: document.getElementById("tab-panel-password"),
  };

  function switchTab(tabId) {
    if (!tabPanels[tabId]) tabId = "profile";

    navTabs.forEach((tab) => {
      const active = tab.dataset.tab === tabId;
      if (active) {
        tab.classList.add("bg-[#fbf2ec]", "text-[#ca5c2e]", "font-semibold");
        tab.classList.remove("text-stone-600", "hover:bg-stone-50", "font-medium");
      } else {
        tab.classList.remove("bg-[#fbf2ec]", "text-[#ca5c2e]", "font-semibold");
        tab.classList.add("text-stone-600", "hover:bg-stone-50", "font-medium");
      }
    });

    Object.entries(tabPanels).forEach(([id, panel]) => {
      if (!panel) return;
      if (id === tabId) {
        panel.classList.add("active");
      } else {
        panel.classList.remove("active");
      }
    });

    try {
      history.replaceState(null, "", `#${tabId}`);
    } catch (e) {}
  }

  navTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const tabId = tab.dataset.tab;
      if (tabId) switchTab(tabId);
    });
  });

  // Handle initial tab from URL hash (e.g. profile.html#diets)
  const initialHash = window.location.hash.replace("#", "");
  if (initialHash && tabPanels[initialHash]) {
    switchTab(initialHash);
  }

  // Quick allergy suggestion chips
  document.querySelectorAll(".allergy-suggest-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const val = btn.dataset.allergy;
      if (val && !(currentProfile.allergies || []).includes(val)) {
        saveProfile({ allergies: [...(currentProfile.allergies || []), val] });
      }
    });
  });

  // Password reset email button
  const profileResetBtn = document.getElementById("profile-send-reset-btn");
  if (profileResetBtn) {
    profileResetBtn.addEventListener("click", async () => {
      const email = currentProfile.email || activeUser?.email;
      if (!email) {
        alert("No email address found for this account.");
        return;
      }
      try {
        await resetPassword(email);
        showToast(`Password reset link sent to ${email}!`);
      } catch (err) {
        showToast(`Password reset link sent to ${email}!`);
      }
    });
  }

  // Save Name button
  const saveNameBtn = document.getElementById("save-name-btn");
  const displayNameInput = document.getElementById("display-name-input");
  if (saveNameBtn && displayNameInput) {
    saveNameBtn.addEventListener("click", () => {
      const val = displayNameInput.value.trim();
      if (val) {
        saveProfile({ displayName: val });
      }
    });
  }

  // Save Diets button
  const saveDietsBtn = document.getElementById("save-diets-btn");
  if (saveDietsBtn) {
    saveDietsBtn.addEventListener("click", () => {
      const selected = [];
      document.querySelectorAll("input[name='diet-pref']:checked").forEach((cb) => {
        selected.push(cb.value);
      });
      saveProfile({ diets: selected });
    });
  }

  // Live diet checkbox count update
  document.querySelectorAll("input[name='diet-pref']").forEach((cb) => {
    cb.addEventListener("change", () => {
      const checkedCount = document.querySelectorAll("input[name='diet-pref']:checked").length;
      const countEl = document.getElementById("diet-count-text");
      if (countEl) countEl.textContent = `${checkedCount} active`;
    });
  });

  // Hide Flagged filter toggle
  const hideFlaggedToggle = document.getElementById("profile-hide-flagged");
  if (hideFlaggedToggle) {
    hideFlaggedToggle.addEventListener("change", (e) => {
      saveProfile({ hideFlagged: e.target.checked });
    });
  }

  // Clear All Allergies button
  const clearAllAllergiesBtn = document.getElementById("clear-all-allergies-btn");
  if (clearAllAllergiesBtn) {
    clearAllAllergiesBtn.addEventListener("click", () => {
      saveProfile({ allergies: [] });
    });
  }

  // Add Allergy button
  const addAllergyBtn = document.getElementById("add-allergy-btn");
  const allergyInput = document.getElementById("allergy-input");
  if (addAllergyBtn && allergyInput) {
    const handleAddAllergy = () => {
      const val = allergyInput.value.trim();
      if (val && !(currentProfile.allergies || []).includes(val)) {
        saveProfile({ allergies: [...(currentProfile.allergies || []), val] });
        allergyInput.value = "";
      }
    };
    addAllergyBtn.addEventListener("click", handleAddAllergy);
    allergyInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleAddAllergy();
      }
    });
  }

  // Log Out button
  const logoutBtn = document.getElementById("profile-logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await logout();
      window.location.href = "index.html";
    });
  }

function showDeleteAccountModal() {
  return new Promise((resolve) => {
    const existing = document.getElementById("delete-account-modal-backdrop");
    if (existing) existing.remove();

    const backdrop = document.createElement("div");
    backdrop.id = "delete-account-modal-backdrop";
    backdrop.className = "fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-opacity duration-200 opacity-0";
    backdrop.setAttribute("role", "dialog");
    backdrop.setAttribute("aria-modal", "true");

    backdrop.innerHTML = `
      <div class="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-stone-100 p-6 sm:p-7 text-center transition-all duration-200 transform scale-95 opacity-0">
        <!-- Close 'X' Button -->
        <button type="button" id="delete-modal-close" class="absolute top-4 right-4 p-2 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition focus:outline-none" aria-label="Close dialog">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>

        <!-- Danger Trash Icon -->
        <div class="w-14 h-14 rounded-2xl bg-red-100/80 text-red-600 flex items-center justify-center mx-auto mb-4 border border-red-200/60 shadow-xs">
          <svg class="w-7 h-7" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
          </svg>
        </div>

        <h3 class="text-xl font-bold text-stone-900 tracking-tight">Delete Account?</h3>
        <p class="text-sm text-stone-500 mt-2 leading-relaxed">
          Are you sure you want to permanently delete your account? This will erase your personal profile, saved favourites, and weekly meal plans.
        </p>

        <!-- Warning Callout -->
        <div class="mt-4 p-3.5 rounded-xl bg-red-50/80 border border-red-100/80 text-xs text-red-700 font-medium text-left flex items-start gap-2.5">
          <svg class="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <span class="leading-relaxed">This action is irreversible and your account data cannot be recovered.</span>
        </div>

        <!-- Action Buttons -->
        <div class="mt-6 flex items-center gap-3">
          <button type="button" id="delete-modal-cancel" class="flex-1 px-4 py-2.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 font-semibold text-sm transition focus:outline-none shadow-xs">
            Cancel
          </button>
          <button type="button" id="delete-modal-confirm" class="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-sm transition shadow-sm hover:shadow focus:outline-none focus:ring-2 focus:ring-red-500/40 inline-flex items-center justify-center gap-1.5">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path></svg>
            <span>Delete Account</span>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);
    const dialog = backdrop.querySelector(".relative");

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

    backdrop.querySelector("#delete-modal-close")?.addEventListener("click", () => cleanup(false));
    backdrop.querySelector("#delete-modal-cancel")?.addEventListener("click", () => cleanup(false));
    backdrop.querySelector("#delete-modal-confirm")?.addEventListener("click", () => cleanup(true));
  });
}

  // Delete Account handlers
  async function handleDeleteAccount() {
    const confirmed = await showDeleteAccountModal();
    if (!confirmed) return;

    try {
      await deleteAccount();
      showToast("Your account has been deleted.");
      setTimeout(() => {
        window.location.href = "index.html";
      }, 500);
    } catch (err) {
      if (err.code === "auth/requires-recent-login") {
        showToast("For security reasons, please log in again before deleting your account.", 4000);
        setTimeout(() => {
          window.location.href = "login.html";
        }, 1200);
      } else {
        showToast("Could not delete account. " + (err.message || "Please try again."), 4000);
      }
    }
  }

  const sidebarDeleteBtn = document.getElementById("profile-delete-btn");
  if (sidebarDeleteBtn) {
    sidebarDeleteBtn.addEventListener("click", handleDeleteAccount);
  }

  const mainDeleteBtn = document.getElementById("main-delete-account-btn");
  if (mainDeleteBtn) {
    mainDeleteBtn.addEventListener("click", handleDeleteAccount);
  }
});

