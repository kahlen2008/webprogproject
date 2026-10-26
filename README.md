# 🍳 RecipePlan

> **Smart Recipe Discovery, Dietary Safeguards & Weekly Meal Planning**
> An intuitive web application designed to help home cooks discover recipes tailored to their dietary needs, plan weekly meals seamlessly, and generate consolidated shopping lists.

[![Firebase](<https://img.shields.io/badge/Firebase-Auth%20%7C%20Firestore%20%7C%20Hosting-FFCA28?logo=firebase&logoColor=black>)](https://firebase.google.com/)
[![Tailwind CSS](<https://img.shields.io/badge/TailwindCSS-v3%20CDN-38B2AC?logo=tailwind-css&logoColor=white>)](https://tailwindcss.com/)
[![JavaScript](<https://img.shields.io/badge/JavaScript-ES%20Modules-F7DF1E?logo=javascript&logoColor=black>)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![TheMealDB](https://img.shields.io/badge/API-TheMealDB-orange)](https://www.themealdb.com/api.php)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## 📖 Table of Contents

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
| 🛡️ **Dietary & Allergen Detection** | Real-time keyword scanning on recipe cards and detail views alerting users of matching allergen risks.                               |
| 📅 **Weekly Meal Planner**            | Interactive 7-day schedule (Breakfast, Lunch, Dinner) with slot-based meal scheduling.                                               |
| 🛒 **Smart Shopping List**            | Aggregates all ingredients across planned recipes, merging common items with interactive check-off and print view.                   |
| ❤️ **Personal Favourites**          | One-click cloud saving, persistent collection management, and offline local fallback.                                                |
| 👤 **User Accounts & Onboarding**     | Secure Firebase email/password & Google OAuth, 2-step onboarding wizard, password safety validation, and account profile management. |
| 📜 **Legal & Compliance**             | Transparent British English Terms of Service and Privacy Policy pages.                                                               |

---

## 👥 Team & Responsibilities

RecipePlan was developed collaboratively by a 4-person team. Each member holds end-to-end ownership of their respective feature module:

| Member                       | Role & Module                              | Responsibilities                                                                                                                                                   | Key Files                                                                                                            |
| ---------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| **Kahlen - 202699471** | **Accounts, Profile & Security**     | User authentication (Email/Password, Google OAuth), 2-step onboarding questionnaire, profile editing, password security rules, and Firestore user document schema. | `login.htmlsignup.html``onboarding.htmlprofile.html``js/auth.jsjs/navbar.js``js/firebase-config.jsfirestore.rules` |
| **Person 2**           | **Recipe Discovery & Design System** | Homepage search, category/cuisine filtering, recipe detail views, serving-size scaler, TheMealDB API integration, and core Tailwind/CSS design system.             | `index.htmlrecipe.html``css/base.csscss/components.css``css/recipes.cssjs/api.js``js/recipes.js`                   |
| **Person 3**           | **Favourites & Quality Assurance**   | Favourites collection view, heart toggles, star ratings/feedback, cross-device Firestore data sync, and responsive layout testing.                                 | `favourites.htmlcss/favourites.css``js/favourites.jsjs/ratings.js`                                                 |
| **Person 4**           | **Meal Planner & Deployment**        | Weekly meal calendar interface, automated ingredient consolidation for grocery lists, print formatting, Firebase Hosting deployment, and documentation.            | `planner.htmlcss/planner.css``js/planner.jsfirebase.json``README.md`                                               |

*(Note: Replace "Person 1–4" with your group members' actual names).*

---

## 🛠️ Technology Stack

- **Frontend Core:** Plain HTML5, Modern Vanilla JavaScript (ES6 Modules)
- **Styling:** Vanilla CSS design tokens (`base.css`) + Tailwind CSS (via CDN)
- **Authentication:** Google Firebase Authentication (Email/Password & Google Identity Services)
- **Database:** Google Cloud Firestore (NoSQL cloud database)
- **Recipe Data API:** [TheMealDB REST API](https://www.themealdb.com/api.php)
- **Hosting & CI/CD:** Firebase Hosting with automated GitHub Actions continuous deployment (`deploy.yml`)
- **Typography:** Google Fonts (`Outfit` for headings, `Inter` for clean body typography)

---

## 📁 Project Architecture & Directory Tour

All production web assets reside within the `public/` directory for direct hosting:

```text
webprogproject/
├── .github/workflows/
│   └── deploy.yml              # GitHub Actions automated deployment workflow
├── firestore.rules             # Firestore security and privacy access rules
├── firebase.json               # Firebase Hosting configuration
├── PROJECT_NOTES.md            # Team guidelines and shared conventions
├── README.md                   # Project overview and technical documentation
└── public/
    ├── index.html              # Homepage with recipe search and discovery
    ├── recipe.html             # Detailed recipe viewer with ingredient scaler
    ├── login.html              # Split-screen responsive login page
    ├── signup.html             # Split-screen sign up page with password validation
    ├── onboarding.html         # 2-step dietary and allergy configuration wizard
    ├── profile.html            # Profile management, preferences, and security
    ├── favourites.html         # User saved recipes collection
    ├── planner.html            # 7-day meal planner and smart grocery list
    ├── terms.html              # Terms of Service (British English)
    ├── privacy.html            # Privacy Policy (British English)
    ├── css/
    │   ├── base.css            # Global CSS variables, reset, and typography tokens
    │   ├── components.css      # Reusable buttons, cards, and modal components
    │   ├── auth.css            # Authentication form styling
    │   ├── recipes.css         # Recipe card grids and category chips
    │   ├── favourites.css      # Favourites grid styles
    │   └── planner.css         # Weekly calendar grid and shopping list printable styles
    ├── js/
    │   ├── firebase-config.js  # Firebase project credentials and initialisation
    │   ├── auth.js             # Authentication, session observer, and password rules
    │   ├── navbar.js           # Dynamic navigation header reflecting user auth state
    │   ├── api.js              # TheMealDB API client methods
    │   ├── recipes.js          # Search, category filtering, and recipe page rendering
    │   ├── preferences.js      # Diet and allergy keyword matching engine
    │   ├── onboarding.js       # Step wizard state and preference storage
    │   ├── favourites.js       # Favourites Firestore and LocalStorage synchroniser
    │   ├── planner.js          # Meal calendar state and consolidated grocery list builder
    │   └── utils.js            # Shared helpers (toasts, formatters, debounce)
    └── images/
        └── pasta-hero.jpg      # Showcase culinary photography
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

The project includes a GitHub Actions workflow in [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). Any push or merged pull request to the `main` branch automatically deploys the latest build to Firebase Hosting.

### Manual CLI Deployment

To deploy manually using the Firebase CLI:

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

This project was built for educational purposes under the **MIT Licence**. See the [LICENSE](LICENSE) file for details.
