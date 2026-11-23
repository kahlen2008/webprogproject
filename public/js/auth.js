// Accounts: signup, login, logout. Owner: Person 1.
// Supports both Firebase Authentication and local demo simulation for testing.

import { auth, db } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
  deleteUser,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { showToast } from "./utils.js";
import { deleteUserData } from "./schema.js";
import { needsOnboarding } from "./preferences.js";
import "./i18n.js";

// Turns a ?redirect= value into a path on this site, or null if it points anywhere else.
// Resolving it as a URL and comparing origins blocks "javascript:", "/\evil.com",
// "HTTPS://evil.com" and every other trick a prefix check misses.
export function safeRedirect(value) {
  if (!value) return null;
  try {
    const url = new URL(value, window.location.href);
    if (url.origin !== window.location.origin) return null;
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.pathname + url.search + url.hash;
  } catch (e) {
    return null;
  }
}

// Where to send someone right after they sign up or log in.
// Onboarding always comes first; the redirect is passed along so onboarding
// sends the user on to it when they finish or skip.
function postAuthDestination() {
  const redirect = safeRedirect(new URLSearchParams(window.location.search).get("redirect"));
  if (needsOnboarding()) {
    return redirect ? `onboarding.html?redirect=${encodeURIComponent(redirect)}` : "onboarding.html";
  }
  return redirect || "index.html";
}

// Cached copies of the account kept in localStorage so pages can draw the
// logged-in UI before Firebase has restored the session.
const LOCAL_ACCOUNT_KEYS = ["recipeplan_user", "recipeplan_profile", "recipeplan_favourites"];

// Only runs when a cached account exists, so a guest's own local favourites are kept.
function clearLocalAccount() {
  try {
    if (!localStorage.getItem("recipeplan_user")) return;
  } catch (e) {
    return;
  }
  LOCAL_ACCOUNT_KEYS.forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch (e) {}
  });
}

// True once Firebase has said whether a session exists. Before that, the
// localStorage copy is the best guess; after it, Firebase is the only truth.
let authResolved = false;
try {
  onAuthStateChanged(auth, (user) => {
    authResolved = true;
    // Signed out (token expired, signed out in another tab, account deleted):
    // drop the cached copy so no page keeps showing the old account.
    if (!user) clearLocalAccount();
  });
} catch (e) {}

// Returns the logged-in user, or null.
export function getCurrentUser() {
  if (auth && auth.currentUser) return auth.currentUser;
  if (authResolved) return null;
  try {
    const raw = localStorage.getItem("recipeplan_user");
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

// Calls callback(user) now and every time the login state changes.
// Firebase's answer is final: a signed-out session gives null, never the cached copy.
export function onAuthChange(callback) {
  try {
    return onAuthStateChanged(auth, (user) => {
      if (!user) clearLocalAccount();
      callback(user || null);
    });
  } catch (err) {
    callback(getCurrentUser());
    return () => {};
  }
}

export async function signup(name, email, password) {
  try {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    const userObj = {
      uid: credential.user.uid,
      displayName: name,
      email: email,
      photoURL: credential.user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=ca5c2e&color=fff`
    };
    localStorage.setItem("recipeplan_user", JSON.stringify(userObj));
    localStorage.setItem("recipeplan_profile", JSON.stringify({
      displayName: name,
      email: email,
      photoURL: userObj.photoURL,
      diets: [],
      allergies: [],
      hideFlagged: false,
      onboardingComplete: false,
      onboardingStep: 1
    }));

    // Update profile and create initial firestore record in parallel.
    // Awaited so the write finishes before the caller redirects away.
    await Promise.all([
      updateProfile(credential.user, { displayName: name }).catch(console.warn),
      setDoc(doc(db, "users", credential.user.uid), {
        displayName: name,
        email: email,
        diets: [],
        allergies: [],
        hideFlagged: false,
        onboardingComplete: false,
        onboardingStep: 1,
        createdAt: serverTimestamp(),
      }).catch(console.warn),
    ]);

    return credential.user;
  } catch (err) {
    console.error("Signup error:", err);
    throw err;
  }
}

export async function login(email, password) {
  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const displayName = credential.user.displayName || email.split("@")[0];
    const userObj = {
      uid: credential.user.uid,
      displayName: displayName,
      email: credential.user.email,
      photoURL: credential.user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=ca5c2e&color=fff`
    };
    localStorage.setItem("recipeplan_user", JSON.stringify(userObj));
    
    // Check if profile exists, otherwise save
    try {
      const snap = await getDoc(doc(db, "users", credential.user.uid));
      if (snap.exists()) {
        const data = snap.data();
        if (data.displayName) {
          userObj.displayName = data.displayName;
          if (!credential.user.photoURL) {
            userObj.photoURL = `https://ui-avatars.com/api/?name=${encodeURIComponent(data.displayName)}&background=ca5c2e&color=fff`;
          }
          localStorage.setItem("recipeplan_user", JSON.stringify(userObj));
        }
        localStorage.setItem("recipeplan_profile", JSON.stringify({
          ...data,
          photoURL: userObj.photoURL
        }));
      } else {
        // No profile doc (e.g. the signup write never landed) - create it now.
        await setDoc(doc(db, "users", credential.user.uid), {
          displayName: displayName,
          email: credential.user.email,
          diets: [],
          allergies: [],
          hideFlagged: false,
          onboardingComplete: false,
          onboardingStep: 1,
          createdAt: serverTimestamp(),
        });
        localStorage.setItem("recipeplan_profile", JSON.stringify({
          displayName: displayName,
          email: credential.user.email,
          photoURL: userObj.photoURL,
          diets: [],
          allergies: [],
          hideFlagged: false,
          onboardingComplete: false,
          onboardingStep: 1
        }));
      }
    } catch (e) {
      console.warn("Could not load or create user profile:", e);
    }

    return credential.user;
  } catch (err) {
    console.error("Login error:", err);
    throw err;
  }
}

export async function loginWithGoogle() {
  try {
    const credential = await signInWithPopup(auth, new GoogleAuthProvider());
    const displayName = credential.user.displayName || credential.user.email.split("@")[0];
    const userObj = {
      uid: credential.user.uid,
      displayName: displayName,
      email: credential.user.email,
      photoURL: credential.user.photoURL
    };
    localStorage.setItem("recipeplan_user", JSON.stringify(userObj));
    
    // Create users doc if it doesn't exist
    try {
      const userRef = doc(db, "users", credential.user.uid);
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        await setDoc(userRef, {
          displayName: displayName,
          email: credential.user.email,
          diets: [],
          allergies: [],
          hideFlagged: false,
          onboardingComplete: false,
          onboardingStep: 1,
          createdAt: serverTimestamp(),
        });
        localStorage.setItem("recipeplan_profile", JSON.stringify({
          displayName: displayName,
          email: credential.user.email,
          photoURL: userObj.photoURL,
          diets: [],
          allergies: [],
          hideFlagged: false,
          onboardingComplete: false,
          onboardingStep: 1
        }));
      } else {
        const data = snap.data();
        if (data.displayName) {
          userObj.displayName = data.displayName;
          localStorage.setItem("recipeplan_user", JSON.stringify(userObj));
        }
        localStorage.setItem("recipeplan_profile", JSON.stringify({
          ...data,
          photoURL: userObj.photoURL
        }));
      }
    } catch (e) {}

    return credential.user;
  } catch (err) {
    console.error("Google sign in error:", err);
    throw err;
  }
}

// Removes the copies other pages keep per user in this browser: the planner's
// meal plans and shopping lists (planner.js) and the navbar's favourites flag.
function clearUserBrowserData(uid) {
  if (!uid) return;
  try {
    localStorage.removeItem(`recipeplan_meal_plans_${uid}`);
    localStorage.removeItem(`recipeplan_shopping_${uid}`);
  } catch (e) {}
  try {
    sessionStorage.removeItem(`recipeplan_favs_loaded_${uid}`);
  } catch (e) {}
}

function currentUidForCleanup() {
  if (auth?.currentUser) return auth.currentUser.uid;
  try {
    return JSON.parse(localStorage.getItem("recipeplan_user") || "null")?.uid || null;
  } catch (e) {
    return null;
  }
}

export async function logout() {
  clearUserBrowserData(currentUidForCleanup());
  localStorage.removeItem("recipeplan_user");
  localStorage.removeItem("recipeplan_profile");
  localStorage.removeItem("recipeplan_favourites");
  window.dispatchEvent(new CustomEvent("favourites-changed"));
  window.dispatchEvent(new CustomEvent("auth-changed"));
  try {
    await signOut(auth);
  } catch (e) {}
}

// Firebase only deletes an account within about 5 minutes of signing in.
// We stop at 4, leaving time for the data to be deleted before deleteUser runs.
const RECENT_LOGIN_LIMIT_MS = 4 * 60 * 1000;

export async function deleteAccount() {
  const user = auth.currentUser;
  if (user) {
    // Check for a recent sign-in first, so the data is never wiped while the
    // account itself survives because deleteUser refused. Both times come from
    // Firebase's servers (a fresh token is issued "now"), so a wrong clock on
    // this computer can't fool the check.
    const { authTime, issuedAtTime } = await user.getIdTokenResult(true);
    if (new Date(issuedAtTime).getTime() - new Date(authTime).getTime() > RECENT_LOGIN_LIMIT_MS) {
      const err = new Error("Please log in again before deleting your account.");
      err.code = "auth/requires-recent-login";
      throw err;
    }
    // Reviews, favourites, meal plans, shopping lists and the profile document.
    await deleteUserData(user.uid);
    try {
      await deleteUser(user);
    } catch (err) {
      // Very unlikely after the check above (e.g. the connection dropped), but
      // say exactly what happened: the data is gone, the login still exists.
      err.dataDeleted = true;
      throw err;
    }
    clearUserBrowserData(user.uid);
  }
  clearLocalAccount();
  window.dispatchEvent(new CustomEvent("favourites-changed"));
  window.dispatchEvent(new CustomEvent("auth-changed"));
}

// Turns a Firebase error into a human-readable message.
export function friendlyAuthError(error) {
  if (!error) return "An unexpected error occurred.";
  console.error("Auth error details:", error.code, error.message);
  switch (error.code) {
    case "auth/email-already-in-use":
      return "An account with this email already exists.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/weak-password":
      return "Password must be at least 8 characters, and include at least 1 number and 1 special character.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Email or password is incorrect.";
    case "auth/password-does-not-meet-requirements":
      return "Password must be at least 8 characters, and include at least 1 number and 1 special character.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a few minutes and try again.";
    case "auth/network-request-failed":
      return "Could not reach the server. Check your connection and try again.";
    case "auth/user-disabled":
      return "This account has been disabled.";
    case "auth/requires-recent-login":
      return "For security, please log in again and then retry.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "Google sign-in was closed before it finished.";
    case "auth/popup-blocked":
      return "Your browser blocked the Google sign-in window. Please allow popups for this site and try again.";
    case "auth/account-exists-with-different-credential":
      return "An account with this email already exists. Log in with your password instead.";
    case "auth/operation-not-allowed":
    case "auth/unauthorized-domain":
      // Setup problems: the details are in the console above, not for users.
      return "This sign-in option isn't available right now. Please try another way.";
    default:
      // Never show Firebase's raw message, it can include internal details.
      return "Something went wrong. Please try again.";
  }
}

// Client-side password validation matching Firebase Authentication policy
export function validatePasswordRequirements(password) {
  if (!password || password.length < 8) {
    return "Password must be at least 8 characters long.";
  }
  if (!/\d/.test(password)) {
    return "Password must include at least one number (0-9).";
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) {
    return "Password must include at least one special character (e.g. !@#$%).";
  }
  return null;
}

// ---------- UI Wiring ----------
function showFormError(form, msg) {
  const box = form.querySelector(".form-error");
  if (box) box.textContent = msg;
}

// Password show/hide toggle with dynamic eye / eye-off icon states
const togglePwBtn = document.getElementById("toggle-password-btn");
const pwInput = document.getElementById("password");
if (togglePwBtn && pwInput) {
  const eyeOpenSvg = `
    <svg class="w-4 h-4 eye-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
      <circle cx="12" cy="12" r="3"></circle>
    </svg>
  `;
  const eyeOffSvg = `
    <svg class="w-4 h-4 eye-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
      <line x1="1" y1="1" x2="23" y2="23" stroke-linecap="round" stroke-linejoin="round"></line>
    </svg>
  `;

  togglePwBtn.addEventListener("click", () => {
    const isCurrentlyPassword = pwInput.type === "password";
    pwInput.type = isCurrentlyPassword ? "text" : "password";
    togglePwBtn.innerHTML = isCurrentlyPassword ? eyeOffSvg : eyeOpenSvg;
    togglePwBtn.classList.toggle("text-[#ca5c2e]", isCurrentlyPassword);
    togglePwBtn.setAttribute("aria-label", isCurrentlyPassword ? "Hide password" : "Show password");
  });
}

// Live password requirements ticks & crosses updater
const pwRequirementsList = document.getElementById("password-requirements");
if (pwInput && pwRequirementsList) {
  const reqLength = document.getElementById("req-length");
  const reqNumber = document.getElementById("req-number");
  const reqSpecial = document.getElementById("req-special");

  const tickSvg = `<svg class="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"></path></svg>`;
  const crossSvg = `<svg class="w-3.5 h-3.5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg>`;

  const setRuleStatus = (itemEl, isValid) => {
    if (!itemEl) return;
    const iconContainer = itemEl.querySelector(".rule-icon");
    if (iconContainer) {
      iconContainer.innerHTML = isValid ? tickSvg : crossSvg;
    }
    if (isValid) {
      itemEl.classList.remove("text-stone-500");
      itemEl.classList.add("text-emerald-700", "font-medium");
    } else {
      itemEl.classList.remove("text-emerald-700", "font-medium");
      itemEl.classList.add("text-stone-500");
    }
  };

  const evaluatePasswordRequirements = () => {
    const val = pwInput.value || "";
    setRuleStatus(reqLength, val.length >= 8);
    setRuleStatus(reqNumber, /\d/.test(val));
    setRuleStatus(reqSpecial, /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(val));

    // Clear password error alert if requirements are newly met
    const signupEl = document.getElementById("signup-form");
    if (signupEl) {
      const errBox = signupEl.querySelector(".form-error");
      if (errBox && errBox.textContent.includes("Password must") && !validatePasswordRequirements(val)) {
        errBox.textContent = "";
      }
    }
  };

  pwInput.addEventListener("input", evaluatePasswordRequirements);
  evaluatePasswordRequirements();
}

// Shows a spinner on a button while a request runs, and stops double clicks.
// Returns a function that puts the button back.
const SPINNER_SVG = `<svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24" aria-hidden="true"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>`;
const authButtons = () => document.querySelectorAll('#login-form button[type="submit"], #signup-form button[type="submit"], #google-login-btn, #google-signup-btn');

function setButtonLoading(btn, label) {
  if (!btn) return () => {};
  const originalHtml = btn.innerHTML;
  // Disable every sign-in button on the page, so a second request can't start.
  const others = [...authButtons()].filter((b) => !b.disabled);
  others.forEach((b) => (b.disabled = true));
  btn.setAttribute("aria-busy", "true");
  btn.classList.add("opacity-75", "cursor-wait");
  btn.innerHTML = `<span class="inline-flex items-center gap-2">${SPINNER_SVG}${label}</span>`;
  return () => {
    others.forEach((b) => (b.disabled = false));
    btn.removeAttribute("aria-busy");
    btn.classList.remove("opacity-75", "cursor-wait");
    btn.innerHTML = originalHtml;
  };
}

const loginForm = document.getElementById("login-form");
if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    showFormError(loginForm, "");

    const emailVal = loginForm.email.value.trim();
    if (!emailVal || !loginForm.password.value) {
      showFormError(loginForm, "Please enter your email and password.");
      (emailVal ? loginForm.password : loginForm.email).focus();
      return;
    }

    const restore = setButtonLoading(loginForm.querySelector('button[type="submit"]'), "Logging in...");
    try {
      await login(emailVal, loginForm.password.value);
      window.location.href = postAuthDestination();
    } catch (error) {
      restore();
      showFormError(loginForm, friendlyAuthError(error));
    }
  });
}

const signupForm = document.getElementById("signup-form");
if (signupForm) {
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    showFormError(signupForm, "");

    const nameVal = signupForm.name.value.trim();
    if (!nameVal) {
      showFormError(signupForm, "Please enter your display name.");
      signupForm.name.focus();
      return;
    }

    const emailVal = signupForm.email.value.trim();
    if (!emailVal) {
      showFormError(signupForm, "Please enter your email address.");
      signupForm.email.focus();
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailVal)) {
      showFormError(signupForm, "Please enter a valid email address.");
      signupForm.email.focus();
      return;
    }

    const passwordVal = signupForm.password.value;
    const pwError = validatePasswordRequirements(passwordVal);
    if (pwError) {
      showFormError(signupForm, pwError);
      signupForm.password.focus();
      return;
    }

    const restore = setButtonLoading(signupForm.querySelector('button[type="submit"]'), "Creating account...");
    try {
      await signup(nameVal, emailVal, passwordVal);
      const redirect = safeRedirect(new URLSearchParams(window.location.search).get("redirect"));
      window.location.href = redirect ? `onboarding.html?redirect=${encodeURIComponent(redirect)}` : "onboarding.html";
    } catch (error) {
      restore();
      showFormError(signupForm, friendlyAuthError(error));
    }
  });
}

export async function resetPassword(email) {
  if (!email) throw new Error("Please enter your email address first.");
  return sendPasswordResetEmail(auth, email);
}

// Google Sign-In button handlers (same flow on the login and signup pages)
function bindGoogleButton(btn, form) {
  if (!btn) return;
  btn.addEventListener("click", async () => {
    if (form) showFormError(form, "");
    const restore = setButtonLoading(btn, "Connecting to Google...");
    try {
      await loginWithGoogle();
      window.location.href = postAuthDestination();
    } catch (error) {
      restore();
      if (form) showFormError(form, friendlyAuthError(error));
    }
  });
}
bindGoogleButton(document.getElementById("google-login-btn"), loginForm);
bindGoogleButton(document.getElementById("google-signup-btn"), signupForm);

// Forgot password reset link handler
const forgotPasswordLink = document.getElementById("forgot-password-link");
if (forgotPasswordLink) {
  forgotPasswordLink.addEventListener("click", async () => {
    const emailField = document.getElementById("email");
    const email = emailField ? emailField.value.trim() : "";
    if (!email) {
      if (loginForm) showFormError(loginForm, "Please enter your email address above to reset password.");
      emailField?.focus();
      return;
    }

    // One message whether or not the account exists, so this can't be used
    // to find out which emails are registered.
    const sentMessage = `If an account exists for ${email}, a reset link is on its way. Check your inbox.`;
    try {
      await resetPassword(email);
      showToast(sentMessage, 5000);
      if (loginForm) showFormError(loginForm, "");
    } catch (err) {
      if (err?.code === "auth/user-not-found") {
        showToast(sentMessage, 5000);
      } else if (loginForm) {
        // Real failures (bad email format, no connection, too many tries) say what went wrong.
        showFormError(loginForm, friendlyAuthError(err));
      } else {
        showToast(friendlyAuthError(err), 5000);
      }
    }
  });
}
