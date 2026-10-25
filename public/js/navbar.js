// Navbar that changes when the user logs in or out. Owner: Person 1.
// Every page has <header id="navbar" class="navbar"></header> and loads this file.

import { onAuthChange, logout } from "./auth.js";

const LINKS = [
  ["index.html", "Recipes"],
  ["favourites.html", "Favourites"],
  ["planner.html", "Planner"],
];

function currentPage() {
  return window.location.pathname.split("/").pop() || "index.html";
}

function render(user) {
  const host = document.getElementById("navbar");
  if (!host) return;

  const page = currentPage();
  const links = LINKS.map(
    ([href, label]) => `<a href="${href}"${page === href ? ' aria-current="page"' : ""}>${label}</a>`
  ).join("");

  const account = user
    ? `<span class="navbar-user">
         <a href="profile.html" id="navbar-name"></a>
         <button class="btn btn-secondary" id="logout-button" type="button">Log out</button>
       </span>`
    : `<a href="login.html">Login</a><a class="btn" href="signup.html">Sign up</a>`;

  host.innerHTML = `
    <div class="container navbar-inner">
      <a class="navbar-logo" href="index.html">Recipe Planner</a>
      <button class="navbar-menu-button" id="menu-button" type="button" aria-expanded="false" aria-controls="navbar-links">Menu</button>
      <nav class="navbar-links" id="navbar-links" aria-label="Main">${links}${account}</nav>
    </div>`;

  if (user) {
    // textContent (not innerHTML) so a strange display name cannot inject HTML.
    document.getElementById("navbar-name").textContent = user.displayName || user.email;
    document.getElementById("logout-button").addEventListener("click", async () => {
      await logout();
      window.location.href = "index.html";
    });
  }

  const menuButton = document.getElementById("menu-button");
  const menu = document.getElementById("navbar-links");
  menuButton.addEventListener("click", () => {
    const open = menu.classList.toggle("open");
    menuButton.setAttribute("aria-expanded", String(open));
  });
}

// Show the logged-out navbar immediately, then update once Firebase knows who the user is.
render(null);
try {
  onAuthChange(render);
} catch (error) {
  console.error("Could not check login state. Is firebase-config.js filled in?", error);
}
