// Accounts: signup, login, logout. Owner: Person 1.
// Other people import these functions, so keep the names exactly as they are
// (see "Contracts between people" in PROJECT_NOTES.md).

import { auth, db } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

// Returns the logged-in user, or null.
// Careful: right after the page loads this can be null for a moment. Prefer onAuthChange.
export function getCurrentUser() {
  return auth.currentUser;
}

// Calls callback(user) now and every time the login state changes. user is null when logged out.
export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function signup(name, email, password) {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(credential.user, { displayName: name });
  await setDoc(doc(db, "users", credential.user.uid), {
    displayName: name,
    email: email,
    diets: [],
    allergies: [],
    createdAt: serverTimestamp(),
  });
  return credential.user;
}

export async function login(email, password) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

export async function loginWithGoogle() {
  // TODO (Person 1): create the users/{uid} document the first time a Google user signs in.
  const credential = await signInWithPopup(auth, new GoogleAuthProvider());
  return credential.user;
}

export function logout() {
  return signOut(auth);
}

// Turns a Firebase error into a message a person can understand.
export function friendlyAuthError(error) {
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
    default:
      return "Something went wrong. Please try again.";
  }
}

// ---------- Wiring for login.html and signup.html ----------
// TODO (Person 1): add live validation, a loading state, Google button, password reset, redirect back to the previous page.

function showFormError(form, message) {
  const box = form.querySelector(".form-error");
  if (box) box.textContent = message;
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
