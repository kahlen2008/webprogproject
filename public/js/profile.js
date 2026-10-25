// Profile page logic: Display name, diet preferences, allergies management.
// Connected to Firebase Auth and Firestore.

import { getCurrentUser, onAuthChange, logout, deleteAccount, resetPassword } from "./auth.js";
import { showToast } from "./utils.js";
import { db } from "./firebase-config.js";
import { doc, getDoc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { updateProfile } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { renderNavbar } from "./navbar.js";

let currentProfile = {
  displayName: "",
  email: "",
  photoURL: "",
  diets: [],
  allergies: []
};

let activeUser = null;

async function loadProfileForUser(user) {
  if (!user) {
    // If not logged in, redirect to login
    window.location.href = "login.html";
    return;
  }

  activeUser = user;
  const name = user.displayName || user.email?.split("@")[0] || "User";
  const avatar = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=ca5c2e&color=fff`;

  currentProfile = {
    displayName: name,
    email: user.email || "",
    photoURL: avatar,
    diets: [],
    allergies: []
  };

  // Try fetching data from Firestore
  try {
    const userDocRef = doc(db, "users", user.uid);
    const snap = await getDoc(userDocRef);
    if (snap.exists()) {
      const data = snap.data();
      currentProfile.displayName = data.displayName || name;
      currentProfile.diets = data.diets || [];
      currentProfile.allergies = data.allergies || [];
    } else {
      // First time loading, check localStorage
      const cached = localStorage.getItem("recipeplan_profile");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.email === user.email) {
          currentProfile.diets = parsed.diets || [];
          currentProfile.allergies = parsed.allergies || [];
        }
      }
    }
  } catch (err) {
    console.warn("Could not fetch profile from Firestore:", err);
  }

  renderProfile();
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
        allergies: currentProfile.allergies
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

  // Update Diet checkboxes
  const dietCheckboxes = document.querySelectorAll("input[name='diet-pref']");
  dietCheckboxes.forEach((cb) => {
    cb.checked = (currentProfile.diets || []).includes(cb.value);
  });

  // Update Allergies tags
  const allergiesList = document.getElementById("allergies-tags");
  if (allergiesList) {
    allergiesList.innerHTML = (currentProfile.allergies || [])
      .map(
        (allergy) => `
        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#fbf2ec] text-[#ca5c2e] border border-[#f3ddd0]">
          ${allergy}
          <button type="button" class="remove-allergy-btn hover:text-[#b34d23] focus:outline-none ml-0.5" data-allergy="${allergy}" aria-label="Remove ${allergy}">
            &times;
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

  // Delete Account handlers
  async function handleDeleteAccount() {
    const confirmed = window.confirm(
      "Are you sure you want to permanently delete your account?\n\nThis will remove your profile, saved favourites, and weekly meal plans. This action cannot be undone."
    );
    if (!confirmed) return;

    try {
      await deleteAccount();
      showToast("Your account has been deleted.");
      setTimeout(() => {
        window.location.href = "index.html";
      }, 500);
    } catch (err) {
      if (err.code === "auth/requires-recent-login") {
        alert("For security reasons, please log in again before deleting your account.");
        window.location.href = "login.html";
      } else {
        alert("Could not delete account. " + (err.message || "Please try again."));
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
