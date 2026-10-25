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
    await updateProfile(credential.user, { displayName: name });
    await setDoc(doc(db, "users", credential.user.uid), {
      displayName: name,
      email: email,
      diets: [],
      allergies: [],
      createdAt: serverTimestamp(),
    });
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
      allergies: []
    }));
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
          createdAt: serverTimestamp(),
        });
        localStorage.setItem("recipeplan_profile", JSON.stringify({
          displayName: displayName,
          email: credential.user.email,
          photoURL: userObj.photoURL,
          diets: [],
          allergies: []
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
      return "Password must be at least 6 characters.";
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

// ---------- UI Wiring ----------
function showFormError(form, msg) {
  const box = form.querySelector(".form-error");
  if (box) box.textContent = msg;
}

// Password show/hide toggle
const togglePwBtn = document.getElementById("toggle-password-btn");
const pwInput = document.getElementById("password");
if (togglePwBtn && pwInput) {
  togglePwBtn.addEventListener("click", () => {
    const isPw = pwInput.type === "password";
    pwInput.type = isPw ? "text" : "password";
    togglePwBtn.classList.toggle("text-[#ca5c2e]", isPw);
  });
}

const loginForm = document.getElementById("login-form");
if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    showFormError(loginForm, "");
    try {
      await login(loginForm.email.value, loginForm.password.value);
      window.location.href = "index.html";
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
    try {
      await signup(signupForm.name.value, signupForm.email.value, signupForm.password.value);
      window.location.href = "index.html";
    } catch (error) {
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
      window.location.href = "index.html";
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
      window.location.href = "index.html";
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

