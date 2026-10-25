// Firebase setup. Owner: Person 1.
// Every other file imports `auth` and `db` from here, so only set Firebase up in this one file.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA_0jVHJbwiQjJew8Tg-D39rR1sjRgQ68c",
  authDomain: "recipe-plan-app.firebaseapp.com",
  projectId: "recipe-plan-app",
  storageBucket: "recipe-plan-app.firebasestorage.app",
  messagingSenderId: "639938230207",
  appId: "1:639938230207:web:97cc2918fb9f7fc63f930a",
  measurementId: "G-PQYSG7N7VZ"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
