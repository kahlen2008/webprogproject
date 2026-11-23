// Navbar that changes when the user logs in or out.
// Supports both Firebase Auth and local demo user state.


import { createLanguageSwitcherHtml, bindLanguageSwitcher } from "./i18n.js";
import { escapeHtml, showToast } from "./utils.js";

const LINKS = [
  ["index.html", "Home"],
  ["recipes.html", "Recipes"],
  ["favourites.html", "Favourites"],
  ["planner.html", "Planner"],
];

// The favourites cache is only filled on the favourites and planner pages, so
// load it once per session for a signed-in user (one Firestore read). Without
// this, the card hearts on other pages show as empty on a new device.
async function loadFavouritesOnce(user) {
  if (!user || !user.uid) return;
  const key = `recipeplan_favs_loaded_${user.uid}`;
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
  } catch (e) {}
  try {
    const { getFavourites } = await import("./favourites.js");
    await getFavourites();
    window.dispatchEvent(new CustomEvent("favourites-changed"));
  } catch (e) {}
}

function currentPage() {
  const path = window.location.pathname.split("/").pop();
  return path || "index.html";
}

// Login / Sign Up links carry the current page, so the user comes back to it.
const NO_RETURN_PAGES = ["index.html", "login.html", "signup.html", "onboarding.html", "404.html"];
function authLinkHref(target) {
  const page = currentPage();
  if (NO_RETURN_PAGES.includes(page)) return target;
  return `${target}?redirect=${encodeURIComponent(page + window.location.search + window.location.hash)}`;
}

export function renderNavbar(user) {
  const host = document.getElementById("navbar");
  if (!host) return;

  host.classList.add("sticky", "top-0", "z-40");

  // Check cached user and profile from localStorage
  let cachedUser = null;
  let cachedProfile = null;
  try {
    const storedUser = localStorage.getItem("recipeplan_user");
    if (storedUser) cachedUser = JSON.parse(storedUser);
    const storedProfile = localStorage.getItem("recipeplan_profile");
    if (storedProfile) cachedProfile = JSON.parse(storedProfile);
  } catch (e) {}

  let activeUser = user || cachedUser;

  const page = currentPage();
  const linksHtml = LINKS.map(([href, label]) => {
    const isCurrent = page === href || (href === "index.html" && page === "");
    return `<a href="${href}" class="relative py-1 text-sm font-semibold transition-colors duration-200 ${
      isCurrent
        ? "text-[#ca5c2e]"
        : "text-stone-600 hover:text-[#ca5c2e]"
    }" ${isCurrent ? 'aria-current="page"' : ""}>
      ${label}
      ${isCurrent ? '<span class="absolute bottom-0 left-0 w-full h-0.5 bg-[#ca5c2e] rounded-full transition-all duration-300"></span>' : ''}
    </a>`;
  }).join("");

  const logoSvg = `
    <svg class="w-6 h-6 text-[#ca5c2e]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M18 2v6a3 3 0 0 1-3 3 3 3 0 0 1-3-3V2"></path>
      <path d="M15 2v18"></path>
      <path d="M6 2v7a3 3 0 0 0 6 0V2"></path>
      <path d="M9 2v18"></path>
    </svg>`;

  const chevronDownSvg = `
    <svg class="w-4 h-4 text-stone-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>`;

  const menuSvg = `
    <svg class="w-6 h-6 text-stone-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="3" y1="12" x2="21" y2="12"></line>
      <line x1="3" y1="6" x2="21" y2="6"></line>
      <line x1="3" y1="18" x2="21" y2="18"></line>
    </svg>`;

  let userDisplayHtml = "";
  if (activeUser) {
    const sameAccount =
      (!cachedProfile?.email && !cachedUser?.email) ||
      cachedProfile?.email === activeUser.email ||
      cachedUser?.email === activeUser.email ||
      cachedUser?.uid === activeUser.uid;

    const displayName =
      (sameAccount ? cachedProfile?.displayName || cachedUser?.displayName : "") ||
      activeUser.displayName ||
      activeUser.email?.split("@")[0] ||
      "User";

    const rawPhoto =
      activeUser.photoURL && !String(activeUser.photoURL).includes("ui-avatars.com/api/")
        ? activeUser.photoURL
        : (sameAccount ? cachedProfile?.photoURL || cachedUser?.photoURL : "");

    const avatarUrl =
      rawPhoto && !String(rawPhoto).includes("ui-avatars.com/api/")
        ? rawPhoto
        : `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=ca5c2e&color=fff`;

    userDisplayHtml = `
      <div class="relative group flex-shrink-0">
        <button id="user-menu-btn" type="button" class="flex items-center gap-1.5 sm:gap-2.5 pl-1.5 sm:pl-2 pr-1 py-1 rounded-full hover:bg-stone-100 transition focus:outline-none" aria-haspopup="true">
          <img class="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover border border-stone-200 flex-shrink-0" src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(displayName)}">
          <span class="text-sm font-semibold text-stone-800 hidden sm:inline" id="navbar-name">${escapeHtml(displayName)}</span>
          ${chevronDownSvg}
        </button>
        <div id="user-dropdown" class="hidden absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-lg border border-stone-100 py-2 z-50 transition-all">
          <div class="px-4 py-2 border-b border-stone-100">
            <p class="text-xs text-stone-400">Signed in as</p>
            <p class="text-sm font-semibold text-stone-800 truncate">${escapeHtml(activeUser.email || displayName)}</p>
          </div>
          <a href="profile.html" class="flex items-center gap-2 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 hover:text-[#ca5c2e]">
            Profile Settings
          </a>
          <a href="favourites.html" class="flex items-center gap-2 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 hover:text-[#ca5c2e]">
            My Favourites
          </a>
          <a href="planner.html" class="flex items-center gap-2 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 hover:text-[#ca5c2e]">
            Meal Planner
          </a>
          <div class="border-t border-stone-100 my-1"></div>
          <button id="logout-button" type="button" class="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50">
            Log out
          </button>
        </div>
      </div>
    `;
  } else {
    userDisplayHtml = `
      <div class="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
        <a href="${authLinkHref("login.html")}" class="text-xs sm:text-sm font-semibold text-stone-700 hover:text-[#ca5c2e] px-1.5 sm:px-2 py-1.5 transition">Login</a>
        <a href="${authLinkHref("signup.html")}" class="text-xs sm:text-sm font-semibold text-white bg-[#ca5c2e] hover:bg-[#b34d23] px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl transition shadow-sm whitespace-nowrap">Sign Up</a>
      </div>
    `;
  }

  host.innerHTML = `
    <div class="w-full bg-[#fcf9f5]/90 backdrop-blur-md border-b border-[#ede4da]">
      <div class="relative max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        <!-- Brand Logo -->
        <a href="index.html" translate="no" class="flex items-center gap-2 text-xl tracking-tight select-none notranslate z-10 flex-shrink-0">
          ${logoSvg}
          <span class="font-normal text-stone-800">Recipe<span class="font-extrabold text-stone-900">Plan</span></span>
        </a>

        <!-- Desktop Navigation Links (Centered) -->
        <nav class="hidden lg:flex items-center gap-8 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" aria-label="Main">
          ${linksHtml}
        </nav>

        <!-- Right Side: Account & Mobile Toggle -->
        <div class="flex items-center gap-1.5 sm:gap-3 z-10 flex-shrink-0">
          ${createLanguageSwitcherHtml("nav")}
          ${userDisplayHtml}

          <!-- Mobile Hamburger Toggle -->
          <button id="menu-button" type="button" class="lg:hidden p-1.5 rounded-xl hover:bg-stone-100 text-stone-700 flex-shrink-0" aria-label="Open Menu">
            ${menuSvg}
          </button>
        </div>
      </div>

      <!-- Mobile Dropdown Navigation -->
      <div id="mobile-menu" class="hidden lg:hidden border-t border-[#ede4da] bg-[#fcf9f5] px-4 pt-3 pb-5 space-y-3">
        <nav class="flex flex-col space-y-2">
          ${LINKS.map(([href, label]) => {
            const active = page === href || (href === "index.html" && page === "");
            return `<a href="${href}" class="px-3 py-2 rounded-xl text-base font-medium ${active ? "bg-[#f5ebe4] text-[#ca5c2e] font-semibold" : "text-stone-700 hover:bg-stone-100"}">${label}</a>`;
          }).join("")}
          ${activeUser ? '<a href="profile.html" class="px-3 py-2 rounded-xl text-base font-medium text-stone-700 hover:bg-stone-100">Profile Settings</a>' : ""}
        </nav>
      </div>
    </div>
  `;

  // Setup event listeners
  bindLanguageSwitcher("nav");
  if (user) loadFavouritesOnce(user);
  const menuBtn = document.getElementById("menu-button");
  const mobileMenu = document.getElementById("mobile-menu");
  if (menuBtn && mobileMenu) {
    menuBtn.addEventListener("click", () => {
      mobileMenu.classList.toggle("hidden");
    });
  }

  const userMenuBtn = document.getElementById("user-menu-btn");
  const userDropdown = document.getElementById("user-dropdown");
  if (userMenuBtn && userDropdown) {
    userMenuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      userDropdown.classList.toggle("hidden");
    });
    document.addEventListener("click", () => {
      userDropdown.classList.add("hidden");
    });
  }

  const logoutBtn = document.getElementById("logout-button");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      try {
        const { logout } = await import("./auth.js");
        await logout();
      } catch (err) {}
      localStorage.removeItem("recipeplan_user");
      window.location.href = "index.html";
    });
  }
}

// Shared site footer, rendered once on every page that loads this script.
// Pages can place <footer id="site-footer"></footer> where it should go;
// otherwise it is appended after <main>.
export function renderFooter() {
  let host = document.getElementById("site-footer");
  if (!host) {
    host = document.createElement("footer");
    host.id = "site-footer";
    const main = document.querySelector("main");
    if (main) main.after(host);
    else document.body.appendChild(host);
  }

  host.className = "mt-auto border-t border-[#ede4da] bg-[#faf7f2] py-4 sm:py-5 text-xs text-stone-500";
  const year = new Date().getFullYear();
  const links = [
    ["recipes.html", "Browse Recipes"],
    ["planner.html", "Meal Planner"],
    ["terms.html", "Terms"],
    ["privacy.html", "Privacy"],
  ];
  const page = currentPage();

  host.innerHTML = `
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-center">
      <p>&copy; ${year} RecipePlan. Eat better, cook smarter.</p>
      <nav class="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 font-medium" aria-label="Footer">
        ${links
          .map(([href, label]) => `<a href="${href}" class="${page === href ? "text-[#ca5c2e]" : "text-stone-600 hover:text-[#ca5c2e]"} transition" ${page === href ? 'aria-current="page"' : ""}>${label}</a>`)
          .join("")}
      </nav>
    </div>
  `;
}

renderFooter();

// A message left by the previous page just before it navigated away
// (e.g. "Your account has been deleted."), shown once here.
try {
  const flash = sessionStorage.getItem("recipeplan_flash");
  if (flash) {
    sessionStorage.removeItem("recipeplan_flash");
    showToast(flash, 4000);
  }
} catch (e) {}

// Initial render with potential demo fallback
renderNavbar(null);

try {
  const syncAuth = () => {
    import("./auth.js")
      .then(({ onAuthChange }) => onAuthChange((user) => renderNavbar(user)))
      .catch(() => {});
  };

  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(syncAuth, { timeout: 2000 });
  } else {
    setTimeout(syncAuth, 1200);
  }
} catch (error) {
  // Graceful fallback for offline / mock testing
  renderNavbar(null);
}

// Smooth page-to-page navigation transition
document.addEventListener("click", (e) => {
  const link = e.target.closest("a");
  if (!link || !link.href || link.target || link.getAttribute("href")?.startsWith("#")) return;
  const url = new URL(link.href, window.location.href);
  if (url.origin === window.location.origin && url.pathname !== window.location.pathname) {
    // If native cross-document view transitions are supported, the browser performs a smooth cross-fade natively.
    // In other browsers, provide a quick gentle exit transition.
    if (!("startViewTransition" in document)) {
      const main = document.querySelector("main");
      if (main) {
        e.preventDefault();
        main.classList.add("page-exit");
        setTimeout(() => {
          window.location.href = link.href;
        }, 120);
      }
    }
  }
});

// ---------- Placeholder for recipe photos that fail to load ----------
// Recipe photos come from TheMealDB. If it can't be reached (or one photo is missing),
// show a neutral plate picture instead of the browser's broken-image icon.
// "error" events don't bubble, so we listen in the capture phase for the whole page.
const PHOTO_PLACEHOLDER =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice">` +
      `<rect width="400" height="300" fill="#f3eee8"/>` +
      `<g fill="none" stroke="#d6c9bb" stroke-width="6" stroke-linecap="round">` +
      `<circle cx="200" cy="150" r="52"/><circle cx="200" cy="150" r="34"/>` +
      `<path d="M118 108v30a10 10 0 0 0 20 0v-30M128 108v84"/>` +
      `<path d="M282 108c-12 8-14 30-2 40v44"/>` +
      `</g></svg>`
  );

function usePhotoPlaceholder(img) {
  if (!img || img.dataset.photoFallback || !/^https?:/i.test(img.currentSrc || img.src || "")) return;
  if (img.closest(".skiptranslate")) return; // Google Translate's own images
  img.dataset.photoFallback = "1";
  img.removeAttribute("srcset");
  img.src = PHOTO_PLACEHOLDER;
}

document.addEventListener(
  "error",
  (e) => {
    if (e.target instanceof HTMLImageElement) usePhotoPlaceholder(e.target);
  },
  true
);

// Photos that already failed before this file loaded.
document.querySelectorAll("img").forEach((img) => {
  if (img.complete && img.naturalWidth === 0) usePhotoPlaceholder(img);
});
