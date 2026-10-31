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
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { showToast } from "./utils.js";
import { needsOnboarding } from "./preferences.js";
import "./i18n.js";

// Where to send someone right after they sign up or log in.
function postAuthDestination() {
  const params = new URLSearchParams(window.location.search);
  const redirect = params.get("redirect");
  if (redirect) {
    if (!redirect.startsWith("http://") && !redirect.startsWith("https://") && !redirect.startsWith("//")) {
      return redirect;
    }
  }
  return needsOnboarding() ? "onboarding.html" : "index.html";
}

// Returns the logged-in user, or null.
export function getCurrentUser() {
  if (auth && auth.currentUser) return auth.currentUser;
  try {
    const raw = localStorage.getItem("recipeplan_user");
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

// Calls callback(user) now and every time the login state changes.
export function onAuthChange(callback) {
  try {
    return onAuthStateChanged(auth, (user) => {
      if (user) {
        callback(user);
      } else {
        const local = getCurrentUser();
        callback(local);
      }
    });
  } catch (err) {
    const local = getCurrentUser();
    callback(local);
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

    // Update profile and create initial firestore record in parallel
    Promise.all([
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
        localStorage.setItem("recipeplan_profile", JSON.stringify({
          ...snap.data(),
          photoURL: userObj.photoURL
        }));
      } else {
        localStorage.setItem("recipeplan_profile", JSON.stringify({
          displayName: displayName,
          email: credential.user.email,
          photoURL: userObj.photoURL,
          diets: [],
          allergies: []
        }));
      }
    } catch (e) {}

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
        localStorage.setItem("recipeplan_profile", JSON.stringify({
          ...snap.data(),
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

export async function logout() {
  localStorage.removeItem("recipeplan_user");
  localStorage.removeItem("recipeplan_profile");
  localStorage.removeItem("recipeplan_favourites");
  window.dispatchEvent(new CustomEvent("favourites-changed"));
  window.dispatchEvent(new CustomEvent("auth-changed"));
  try {
    await signOut(auth);
  } catch (e) {}
}

export async function deleteAccount() {
  const user = auth.currentUser;
  if (user) {
    // Delete user's Firestore document
    try {
      await deleteDoc(doc(db, "users", user.uid));
    } catch (e) {
      console.warn("Could not delete user firestore record:", e);
    }
    // Delete authentication account
    await deleteUser(user);
  }
  localStorage.removeItem("recipeplan_user");
  localStorage.removeItem("recipeplan_profile");
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
    case "auth/operation-not-allowed":
      return "Google sign-in is not enabled yet in your Firebase console under Authentication > Sign-in method.";
    case "auth/popup-closed-by-user":
      return "Google sign-in popup was closed before finishing.";
    case "auth/popup-blocked":
      return "Popup was blocked by your browser. Please allow popups for localhost.";
    case "auth/unauthorized-domain":
      return "Domain not authorized. Please check Authentication > Settings > Authorized domains in Firebase.";
    default:
      return error.message || "Something went wrong. Please try again.";
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

const loginForm = document.getElementById("login-form");
if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    showFormError(loginForm, "");
    try {
      await login(loginForm.email.value, loginForm.password.value);
      window.location.href = postAuthDestination();
    } catch (error) {
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

    const submitBtn = signupForm.querySelector('button[type="submit"]');
    const originalText = submitBtn ? submitBtn.innerHTML : "";
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.classList.add("opacity-75", "cursor-wait");
      submitBtn.innerHTML = `
        <span class="inline-flex items-center gap-2">
          <svg class="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
          </svg>
          Creating account...
        </span>
      `;
    }

    try {
      await signup(signupForm.name.value, signupForm.email.value, passwordVal);
      const params = new URLSearchParams(window.location.search);
      const redirect = params.get("redirect");
      window.location.href = redirect ? `onboarding.html?redirect=${encodeURIComponent(redirect)}` : "onboarding.html";
    } catch (error) {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.classList.remove("opacity-75", "cursor-wait");
        submitBtn.innerHTML = originalText;
      }
      showFormError(signupForm, friendlyAuthError(error));
    }
  });
}

export async function resetPassword(email) {
  if (!email) throw new Error("Please enter your email address first.");
  return sendPasswordResetEmail(auth, email);
}

// Google Sign-In button handlers
const googleLoginBtn = document.getElementById("google-login-btn");
if (googleLoginBtn) {
  googleLoginBtn.addEventListener("click", async () => {
    try {
      await loginWithGoogle();
      window.location.href = postAuthDestination();
    } catch (error) {
      if (loginForm) showFormError(loginForm, friendlyAuthError(error));
    }
  });
}

const googleSignupBtn = document.getElementById("google-signup-btn");
if (googleSignupBtn) {
  googleSignupBtn.addEventListener("click", async () => {
    try {
      await loginWithGoogle();
      window.location.href = postAuthDestination();
    } catch (error) {
      if (signupForm) showFormError(signupForm, friendlyAuthError(error));
    }
  });
}

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

    try {
      await resetPassword(email);
      showToast(`Password reset link sent to ${email}! Check your inbox.`);
      if (loginForm) showFormError(loginForm, "");
    } catch (err) {
      showToast(`Password reset email sent to ${email}! Check your inbox.`);
    }
  });
}

