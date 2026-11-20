# 🍳 RecipePlan

> **Smart Recipe Discovery, Dietary Safeguards & Weekly Meal Planning**
> An intuitive web application designed to help home cooks discover recipes tailored to their dietary needs, plan weekly meals seamlessly, and generate consolidated shopping lists.

[![Firebase](<https://img.shields.io/badge/Firebase-Auth%20%7C%20Firestore%20%7C%20Hosting-FFCA28?logo=firebase&logoColor=black>)](https://firebase.google.com/)
[![Tailwind CSS](<https://img.shields.io/badge/TailwindCSS-v3%20CDN-38B2AC?logo=tailwind-css&logoColor=white>)](https://tailwindcss.com/)
[![JavaScript](<https://img.shields.io/badge/JavaScript-ES%20Modules-F7DF1E?logo=javascript&logoColor=black>)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![TheMealDB](https://img.shields.io/badge/API-TheMealDB-orange)](https://www.themealdb.com/api.php)

---

## 📖 Table of Contents

- [Project Proposal](#-project-proposal)
- [Overview &amp; The Problem It Solves](#-overview--the-problem-it-solves)
- [Key Features](#-key-features)
- [Team &amp; Responsibilities](#-team--responsibilities)
- [Technology Stack](#-technology-stack)
- [Project Architecture &amp; Directory Tour](#-project-architecture--directory-tour)
- [Getting Started (Local Development)](#-getting-started-local-development)
- [Firebase Setup &amp; Configuration](#-firebase-setup--configuration)
- [Security &amp; API Keys (Why Keys Are Not Hidden)](#-security--api-keys-why-keys-are-not-hidden)
- [Deployment](#-deployment)
- [Design System &amp; Aesthetic Guidelines](#-design-system--aesthetic-guidelines)
- [Contributing &amp; Git Workflow](#-contributing--git-workflow)

---

## 📝 Project Proposal

**Team 3 · K0126002 Web Programming, Fall 2026 · Gachon University**
Live site: <https://kahlen2008.github.io/webprogproject/> · Proposal page (video and slides): <https://kahlen2008.github.io/webprogproject/proposal/>

### Team

| Member | Student ID | Responsible for | GitHub |
| --- | --- | --- | --- |
| Kahlen Ong | 202699471 | Sign up, login and Google sign-in, password rules, the two-step diet and allergy onboarding, the profile page, diet and allergy warnings, the language switcher and the Firestore security rules. Also helped with small fixes and integration on the other features | [kahlen2008](https://github.com/kahlen2008) |
| Shrestha Puja | 202537250 | Recipe search and filters, the TheMealDB connection, the recipe detail page, cooking mode (step-by-step instructions), and the shared design (colours, buttons and recipe cards) | [ps8023724-sys](https://github.com/ps8023724-sys) |
| Sunar Roshani | 202537197 | Favourites, star ratings and comments, and testing the whole site on phone and desktop | [roshani123sunar](https://github.com/roshani123sunar) |
| Aale Aaditi | 202537195 | The weekly meal planner, the combined shopping list, the cuisine filter, deployment to GitHub Pages and the README | [aadi-eee](https://github.com/aadi-eee) |

### Project concept

**RecipePlan** is a recipe finder and weekly meal planner. Users search recipes, tell the site their diet and allergies once, save favourites, plan a week of meals and get one combined shopping list. Everything is saved to their account, so it follows them from phone to laptop.

### The problem it solves

- **Deciding what to eat takes effort.** Recipes are spread across many sites and apps, so people search, compare and forget what they found. RecipePlan gives one place to search, save and revisit recipes.
- **Diets and allergies make browsing slower and riskier.** Someone who avoids peanuts, dairy or meat has to read every ingredient list by hand. RecipePlan stores those preferences once and flags or hides recipes that conflict with them. The warnings come from keywords in ingredient names, so they are a helper and not a safety guarantee, and the site says so.
- **Planning and shopping are usually separate chores.** People plan meals in one place and write a shopping list in another, and often miss items or buy duplicates. RecipePlan builds one merged shopping list from the weekly plan.
- **Notes and bookmarks stay on one device.** Accounts keep favourites and plans available on every device.

### Target users

People who cook at home, such as students, busy workers and households with dietary needs or allergies.

### Core features

| Feature | What it does | Priority |
| --- | --- | --- |
| Accounts and onboarding | Sign up and log in with email or Google (password: 8+ characters, a number and a special character), then choose diet and allergies in a two-step setup | MVP |
| Recipe search and filters | Search TheMealDB by name and filter by category, with a recipe page showing ingredients and instructions | MVP |
| Diet and allergy warnings | Badges and banners on recipes that clash with the user's profile, with an option to hide flagged recipes | MVP |
| Favourites | Save recipes with a heart button and see them on a favourites page | MVP |
| Weekly meal planner and shopping list | Plan breakfast, lunch and dinner for seven days, then get one combined shopping list with checkboxes and a print view | MVP |
| Cooking mode | Dedicated cooking view with step-by-step instructions, clear progress tracking, and ingredient checklists for active kitchen preparation | Bonus |
| Language switcher | Use the site in 130+ languages, and non-English searches are translated to English before they query TheMealDB | Bonus |
| Ratings and comments | Star ratings and comments on each recipe | Bonus |
| Serving size scaler | Change the number of servings and the ingredient amounts update | Bonus |
| More filters | Filter by cuisine and diet | Bonus |

### Technology stack

- **HTML, CSS and JavaScript:** plain HTML and ES-module JavaScript, with no framework or build step.
- **Styling:** Tailwind CSS v3 from the CDN, with Inter and Outfit from Google Fonts.
- **External API:** [TheMealDB](https://www.themealdb.com/api.php), base URL `https://www.themealdb.com/api/json/v1/1`.
- **Libraries and services:** Firebase Authentication, Cloud Firestore and a Google Translate engine for the language switcher.
- **Hosting:** GitHub Pages, deployed from the `public/` folder by a GitHub Actions workflow.
- **Repository:** <https://github.com/kahlen2008/webprogproject>, with a `main` branch for the stable version and a `dev` branch for daily work.

### UI wireframes

The proposal slides show the two key screens: the **homepage**, with the search bar, category chips and recipe result cards, and the **weekly planner**, with the seven-day grid and the shopping list underneath. Each recipe card shows a photo, the name, a heart button and any allergy warning.

### Project timeline

| Week | Dates | Goal |
| --- | --- | --- |
| 10 | Nov 3 to Nov 9 | Finalise the design, connect the API and Firebase, and set up the page structure |
| 11 | Nov 10 to Nov 16 | Build the core features: accounts, onboarding, search, favourites and the planner |
| 12 | Nov 17 to Nov 23 | Finish all MVP features, add the shopping list, and start polishing |
| 13 | Nov 24 to Nov 30 | Code review, bug fixing, responsive and accessibility checks, and preparing the presentation |
| 14 | Dec 1 to Dec 7 | Final presentation and live demo |

### Repository setup

The repository has a README, a `.gitignore` that excludes `.env` files, all four members as collaborators, and a `main` and `dev` branch workflow. Person 4 merges tested `dev` work into `main`.

---

## 💡 Overview & The Problem It Solves

Deciding what to cook every day is time-consuming and often fragmented across bookmarks, loose notes, and separate shopping apps. Furthermore, individuals and households with specific dietary requirements or food allergies must manually inspect every recipe ingredient list.

**RecipePlan** addresses these challenges by consolidating the entire culinary planning cycle into a single, cohesive experience:

1. **Centralised Recipe Discovery:** Search thousands of global recipes from [TheMealDB](https://www.themealdb.com/api.php) filtered by cuisine, category, or ingredient.
2. **Automated Dietary & Allergen Safeguards:** Save dietary preferences (e.g., *Halal, Vegan, Keto, Vegetarian*) and allergen flags (e.g., *Peanuts, Gluten, Dairy*) once; RecipePlan automatically highlights safe options and flags potential allergen conflicts.
3. **Unified Weekly Planner & Smart Grocery List:** Schedule meals across a 7-day calendar and generate an instant, consolidated shopping list with checkboxes and print capabilities.
4. **Cross-Device Cloud Sync:** Powered by Firebase Authentication and Cloud Firestore, personal favourites and meal schedules sync seamlessly across phones, tablets, and desktop computers.

---

## ✨ Key Features

| Feature                                     | Description                                                                                                                          |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 🔍 **Recipe Search & Filtering**      | Instant keyword search, categorized exploration (Chicken, Seafood, Vegetarian, Pasta, etc.), and international cuisine filters.      |
| 📖 **Dynamic Recipe Details**         | Full instructions, ingredient quantities, YouTube video tutorials, and interactive serving-size scaling.                             |
| 👩‍🍳 **Cooking Mode**                  | Full-screen, one step at a time, sized to fit the screen, with Next/Back (or arrow keys), progress, an ingredient checklist and section headings. Kitchen timers start from times found in a step and keep running across steps, several at once. The screen stays awake while cooking. |
| 🛡️ **Dietary & Allergen Detection** | Real-time keyword scanning on recipe cards and detail views alerting users of matching allergen risks.                               |
| 📅 **Weekly Meal Planner**            | 7-day schedule (Breakfast, Lunch, Dinner) saved per week to your account. Drag meals between slots, switch weeks, clear a week with Undo, and use day tabs on phones. |
| 🛒 **Smart Shopping List**            | Combines the ingredients from every planned recipe into one list (same units added up), with ticks saved to your account, checked items moved to the bottom, a print view and a Copy list button. |
| ⭐ **Ratings & Reviews**              | Star ratings and written reviews on every recipe, with the average and review count shown at the top of the recipe page.            |
| 🌐 **Language Switcher**              | Use the site in 130+ languages; searches typed in another language are translated to English before they query TheMealDB.          |
| ❤️ **Personal Favourites**          | One-click saving to your account, live sync across devices, filter by category and sort by date or name, with an offline fallback. |
| 👤 **User Accounts & Onboarding**     | Secure Firebase email/password & Google OAuth, 2-step onboarding wizard, password safety validation, and account profile management. |
| 📜 **Legal & Compliance**             | Transparent British English Terms of Service and Privacy Policy pages.                                                               |

---

## 👥 Team & Responsibilities

RecipePlan was developed collaboratively by a 4-person team. Each member holds end-to-end ownership of their respective feature module:

| Member                       | Role & Module                              | Responsibilities                                                                                                                                                   | Key Files                                                                                                            |
| ---------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| **Kahlen Ong - 202699471** | **Accounts, Profile & Security**     | User authentication (Email/Password, Google OAuth), 2-step onboarding questionnaire, profile and settings page, diet and allergy checker, password security rules, language switcher, and the Firestore schema and security rules. Also gave some help with integration and small fixes across the other modules. | `login.html`, `signup.html`, `onboarding.html`, `profile.html`, `js/auth.js`, `js/onboarding.js`, `js/profile.js`, `js/preferences.js`, `js/navbar.js`, `js/i18n.js`, `js/schema.js`, `js/firebase-config.js`, `firestore.rules` |
| **Shrestha Puja - 202537250** | **Recipe Discovery & Design System** | Homepage search, category filtering, recipe detail views, serving-size scaler, cooking mode, TheMealDB API integration, and core Tailwind/CSS design system. | `index.html`, `recipes.html`, `recipe.html`, `css/base.css`, `css/components.css`, `css/recipes.css`, `js/api.js`, `js/recipes.js`, `js/cooking-mode.js`, `js/search-cta.js` |
| **Sunar Roshani - 202537197** | **Favourites & Quality Assurance**   | Favourites collection view, heart toggles, star ratings/feedback, cross-device Firestore data sync, and responsive layout testing.                                 | `favourites.html`, `css/favourites.css`, `js/favourites.js`, `js/ratings.js` |
| **Aale Aaditi - 202537195** | **Meal Planner & Deployment**        | Weekly meal calendar interface, automated ingredient consolidation for grocery lists, print formatting, the cuisine filter on the recipes page, deployment (GitHub Pages and Firebase Hosting), and documentation.            | `planner.html`, `css/planner.css`, `js/planner.js`, `firebase.json`, `.github/workflows/`, `README.md` |

---

## 🛠️ Technology Stack

- **Frontend Core:** Plain HTML5, Modern Vanilla JavaScript (ES6 Modules)
- **Styling:** Vanilla CSS design tokens (`base.css`) + Tailwind CSS (via CDN; the home and recipe pages use a prebuilt `css/tailwind.css`, see `tailwind.config.js` to rebuild it)
- **Authentication:** Google Firebase Authentication (Email/Password & Google Identity Services)
- **Database:** Google Cloud Firestore (NoSQL cloud database)
- **Recipe Data API:** [TheMealDB REST API](https://www.themealdb.com/api.php)
- **Hosting & CI/CD:** GitHub Pages with automated GitHub Actions deployment (`deploy.yml`)
- **Typography:** Google Fonts (`Outfit` for headings, `Inter` for clean body typography)

---

## 📁 Project Architecture & Directory Tour

All production web assets reside within the `public/` directory for direct hosting:

```text
webprogproject/
├── .github/workflows/
│   ├── deploy.yml                          # Deploys public/ to GitHub Pages on push to main
│   ├── firebase-hosting-merge.yml          # Deploys to Firebase Hosting (live) on push to main
│   └── firebase-hosting-pull-request.yml   # Firebase Hosting preview for each pull request
├── .firebaserc                 # Firebase project id (recipe-plan-app)
├── firebase.json               # Firebase Hosting and Firestore rules configuration
├── firestore.rules             # Firestore security rules
├── PROJECT_NOTES.md            # Team rules, file owners, shared contracts and status
├── Recipe Finder & Meal Planner Team Use Cases.md   # Use cases, flows and timeline
├── README.md                   # This file
└── public/                     # Everything the site serves
    ├── index.html              # Home page with hero search and featured recipes
    ├── recipes.html            # Browse and search recipes with category filters
    ├── recipe.html             # Recipe detail: ingredients, steps, ratings and reviews
    ├── login.html              # Log in (email/password or Google)
    ├── signup.html             # Sign up with live password rules
    ├── onboarding.html         # 2-step diet and allergy setup
    ├── profile.html            # Profile, diet and allergy preferences, account settings
    ├── favourites.html         # Saved recipes with category filter and sort
    ├── planner.html            # Weekly meal planner and shopping list
    ├── terms.html              # Terms of Service
    ├── privacy.html            # Privacy Policy
    ├── 404.html                # Page not found
    ├── favicon.svg, favicon.ico, apple-touch-icon.png
    ├── css/
    │   ├── tailwind.css        # Prebuilt Tailwind CSS used by the home and recipe pages (rebuild: see tailwind.config.js)
    │   ├── base.css            # Global variables, reset and typography
    │   ├── components.css      # Shared buttons, cards and modals
    │   ├── auth.css            # Login and sign-up pages
    │   ├── onboarding.css      # Onboarding steps and chips
    │   ├── recipes.css         # Recipe grids, category chips and cooking mode helpers
    │   ├── favourites.css      # Favourites page menus
    │   └── planner.css         # Planner page
    ├── js/
    │   ├── firebase-config.js  # Firebase initialisation (exports app, auth, db)
    │   ├── auth.js             # Sign up, log in, Google sign-in, password rules, session
    │   ├── navbar.js           # Navbar and footer that react to login state
    │   ├── onboarding.js       # 2-step preferences flow
    │   ├── profile.js          # Profile page
    │   ├── preferences.js      # Diet and allergy checker, warning badges and prompts
    │   ├── schema.js           # Firestore paths, document builders and read/write helpers
    │   ├── i18n.js             # Language switcher (130+ languages) and search translation
    │   ├── api.js              # TheMealDB client with sessionStorage caching
    │   ├── recipes.js          # Search, filters and the recipe detail page
    │   ├── cooking-mode.js     # Full-screen cooking mode: steps, timers, ingredient checklist, wake lock
    │   ├── search-cta.js       # Home page: rotating search placeholder and featured recipe cards
    │   ├── nutrition.js        # Rough calorie and servings estimates from ingredients
    │   ├── ratings.js          # Star ratings and reviews
    │   ├── favourites.js       # Favourites: live Firestore sync, sort and filter
    │   ├── planner.js          # Weekly planner: per-week Firestore plans, drag and drop, day tabs
    │   └── utils.js            # Shared helpers (toasts, modals, recipe cards, ingredient merging)
    ├── images/                 # Hero photo and category images (.webp, .jpg)
    └── proposal/               # Proposal page, slides (PDF) and proposal README
```

---

## 🚀 Getting Started (Local Development)

Because RecipePlan uses native browser ES Modules (`import`/`export`), opening files directly via the file protocol (`file:///`) will be blocked by CORS policy. You must serve the `public/` folder with a local HTTP server.

### Option 1: Using Node / npx (Recommended)

```bash
# Clone the repository
git clone https://github.com/kahlen2008/webprogproject.git
cd webprogproject

# Serve the public directory
npx serve public
```

Open your browser at `http://localhost:3000` (or the URL printed in the terminal).

### Option 2: Using VS Code Live Server

1. Install the **Live Server** extension in Visual Studio Code.
2. Right-click on `public/index.html`.
3. Select **"Open with Live Server"**.

---

## ⚙️ Firebase Setup & Configuration

To link your own Firebase project:

1. Create a new project in the [Firebase Console](https://console.firebase.google.com/).
2. Under **Authentication > Sign-in method**, enable **Email/Password** and **Google**.
3. Under **Firestore Database**, create a database in production mode.
4. Deploy the database rules:
   ```bash
   firebase deploy --only firestore:rules
   ```
5. In your Firebase Project Settings, create a Web App and copy the configuration snippet into [`public/js/firebase-config.js`](public/js/firebase-config.js):
   ```javascript
   export const firebaseConfig = {
     apiKey: "YOUR_API_KEY",
     authDomain: "YOUR_AUTH_DOMAIN",
     projectId: "YOUR_PROJECT_ID",
     storageBucket: "YOUR_STORAGE_BUCKET",
     messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
     appId: "YOUR_APP_ID"
   };
   ```

---

## 🔐 Security & API Keys (Why Keys Are Not Hidden)

You may notice that API keys and configurations are committed directly in the repository rather than stored in a hidden `.env` file. Here is why this is intentional and standard practice for this project's architecture:

### 1. TheMealDB API Key
- **Free, Public Developer Key:** In [`public/js/api.js`](public/js/api.js), the application calls `https://www.themealdb.com/api/json/v1/1/`.
- The `"1"` at the end is **TheMealDB's official, open test key**. The creators of TheMealDB provide this endpoint publicly for educational and non-commercial development. It is not a secret or private credential, carries no billing account, and requires no hidden environment variable.

### 2. Firebase Client Configuration
- **Browser-Facing Project Identifiers:** The values inside [`public/js/firebase-config.js`](public/js/firebase-config.js) (such as `apiKey`, `projectId`, and `appId`) are **client-side identifiers**, not secret administrative keys. In static/vanilla frontend applications without a server backend, the browser *must* receive these identifiers to connect to the Firebase project.
- **Security is Enforced by Backend Rules:** In Firebase architecture, client API keys do not grant admin database access. Real security is governed by:
  - **[`firestore.rules`](firestore.rules):** Strict server-side security rules that enforce authentication and prevent users from reading or editing other users' profiles, meal plans, or favourites.
  - **Firebase Authentication:** Passwords are never stored in plaintext and user sessions are cryptographically validated by Google Firebase Auth servers.

---

## 🚢 Deployment

### Automated Deployment (CI/CD)

Every push to `main` (including a merged pull request) runs two GitHub Actions workflows:

- [`deploy.yml`](.github/workflows/deploy.yml) publishes the `public/` folder to **GitHub Pages**: <https://kahlen2008.github.io/webprogproject/>. This is the link used in the proposal and for submission.
- [`firebase-hosting-merge.yml`](.github/workflows/firebase-hosting-merge.yml) deploys the same folder to **Firebase Hosting** (project `recipe-plan-app`).

[`firebase-hosting-pull-request.yml`](.github/workflows/firebase-hosting-pull-request.yml) also builds a Firebase preview link for each pull request.

The GitHub Pages domain must be listed under **Authentication > Settings > Authorised domains** in Firebase, or Google sign-in will not work on the live site.

### Manual CLI Deployment

To deploy to Firebase Hosting manually with the Firebase CLI:

```bash
# Install Firebase Tools globally
npm install -g firebase-tools

# Log in to your Google Account
firebase login

# Deploy hosting and firestore rules
firebase deploy
```

---

## 🎨 Design System & Aesthetic Guidelines

- **Harmonious Warm Palette:**
  - **Primary Brand:** Terracotta (`#ca5c2e` / Dark: `#b34d23`)
  - **Background Surfaces:** Warm Cream (`#faf7f2`), Pure White (`#ffffff`), Muted Sand (`#fdf8f4`)
  - **Border & Dividers:** Warm Stone (`#ede4da` / `#efe6dc`)
  - **Pill Accents:** Soft Almond (`#f5ebe4` with `#a04e28` typography)
- **Typography:** Modern Google Fonts pairing — `Outfit` for energetic headings and `Inter` for crisp readability.
- **Language & Localization:** Consistently authored in **British English** (`favourites`, `personalised`, `licence`, `catalogue`, `utilise`).

---

## 🌿 Contributing & Git Workflow

To maintain clean code quality and prevent merge conflicts across team members:

1. **Branch Isolation:** Never push directly to `main`. Always create a descriptive branch:
   ```bash
   git switch -c p1-auth-improvements
   ```
2. **Commit Often:** Make small, clear commits using conventional commit messages (e.g., `feat:`, `fix:`, `docs:`, `refactor:`).
3. **Pull Requests:** Push your branch and open a Pull Request against `dev` or `main`.
4. **Code Reviews:** Request a review from at least one teammate before merging.

---

## 📄 Licence

This project was built for the K0126002 Web Programming course at Gachon University. No open-source licence has been chosen yet, so there is no `LICENSE` file. If the team decides on one (for example MIT), add a `LICENSE` file at the root and link it here.
