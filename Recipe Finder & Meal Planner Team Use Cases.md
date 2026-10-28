# RecipePlan: Team Use Cases

Oct 26, 2026 · @k

## Overview

Each of the four team members owns one feature end to end, covering the HTML and Tailwind CSS interface, the JavaScript logic, and the Firebase or API side. RecipePlan is a recipe finder and meal planner built with HTML, Tailwind CSS and plain JavaScript, using Firebase Auth and Firestore, TheMealDB for recipe data, and Firebase Hosting for deployment.

## Purpose and the problem it solves

RecipePlan helps people decide what to cook, in a way that fits how they eat, and turns that decision into a plan and a shopping list. Users search recipes, set their diet and allergies once, save favourites, build a weekly meal plan, and get one combined list of what to buy.

**The problems it addresses**

- **Deciding what to eat takes effort.** Recipes are spread across many sites and apps, so people search, compare and forget what they found. One place to search, save and revisit recipes removes that repeated work.
- **Diets and allergies make browsing slower and riskier.** Someone who avoids peanuts, dairy or meat has to read every ingredient list by hand. The site stores those preferences once and flags or hides recipes that conflict with them.
- **Planning and shopping are usually separate chores.** People plan meals in one place and write a shopping list in another, and often miss items or buy duplicates. Planning the week and generating a merged list in the same app joins the two steps.
- **Notes and bookmarks stay on one device.** Accounts mean favourites and meal plans follow the user across their phone and laptop.

**Why it matters**

Eating is a daily decision, so a small saving of time and effort repeats every day. Allergy and diet support matters most, because a clear warning at the moment of choosing a recipe is more useful than finding out while cooking. The warnings are a helper based on ingredient names, not a safety guarantee, and the site says so.

**Who it is for**

People who cook at home, such as students, busy workers and households with dietary needs or allergies.

**What it demonstrates for the module**

The project covers the skills the course asks for: a responsive HTML and Tailwind CSS interface, JavaScript interactivity, a public API (TheMealDB), user accounts and a database (Firebase Auth and Firestore), and a live deployment (Firebase Hosting).

## Scope

This is what four people can finish in five weeks (Oct 26 to Nov 29, 2026). Items under Out of scope are only built if every Must item is already done, so confirm this list as a team.

**In scope**

- **Accounts:** sign up, log in and log out with email and password or Google, password reset, and pages that need a login are protected.
- **Onboarding and profile:** a two-step diet and allergy setup after sign-up, editable later on the profile page.
- **Recipe discovery:** search by name, filter by category and cuisine, and a recipe page with ingredients, instructions and a serving size scaler, using TheMealDB data.
- **Diet and allergy warnings:** badges and banners based on ingredient names, on recipe cards, the recipe page, favourites and the planner.
- **Favourites:** saved per user in Firestore and synced across devices, plus star ratings and comments on each recipe that every logged-in user can read.
- **Meal planner and shopping list:** a weekly plan (seven days, breakfast, lunch and dinner) saved per user, plus one combined shopping list with checkboxes and a print view.
- **Interface:** responsive Tailwind design for phone, tablet and desktop, with loading, empty and error states and basic accessibility.
- **Deployment:** live on Firebase Hosting, with security rules that keep each user's data private.

**Out of scope (proposed)**

- Adding or uploading our own recipes. All recipes come from TheMealDB.
- Nutrition, calorie or cost calculations.
- Ordering groceries or connecting to shops.
- Sharing plans or following other users, and moderation tools for comments.
- Guaranteed allergen safety or medical advice. Warnings are keyword matches on ingredient names.
- A native mobile app, offline mode, other languages or an admin dashboard.
- Photo uploads, so Firebase Storage is not used.

* **Extra features for later:** a "Fill my week" button that auto-plans meals that are safe for the user, substitution suggestions for flagged ingredients, searching by the ingredients you already have, a step-by-step cooking mode, and dark mode.

**Constraints**

Four people, five weeks, plain JavaScript with Tailwind from the CDN (no frameworks or build step), the free Firebase plan, and TheMealDB's free API.

## Folder structure

Every page gets its own HTML and JS file, with styling done by Tailwind classes in the HTML, so each person mostly works in their own files and rarely touches anyone else's. Everything the browser needs lives in `public/`, which is also the folder Firebase Hosting deploys.

```
recipeplan/
├── README.md               how to run and deploy (Person 4)
├── firebase.json           hosting settings (Person 4)
├── firestore.rules         security rules (Person 1)
└── public/
    ├── index.html          home, search and results (Person 2)
    ├── recipe.html         recipe detail (Person 2)
    ├── login.html          log in (Person 1)
    ├── signup.html         sign up (Person 1)
    ├── onboarding.html     diet then allergies, 2 steps (Person 1)
    ├── profile.html        profile and diet preferences (Person 1)
    ├── favourites.html     saved recipes (Person 3)
    ├── planner.html        weekly plan and shopping list (Person 4)
    ├── js/
    │   ├── firebase-config.js  Firebase setup, imported by all (Person 1)
    │   ├── auth.js             login, signup, logout (Person 1)
    │   ├── navbar.js           navbar that reacts to login state (Person 1)
    │   ├── onboarding.js       two-step preferences flow (Person 1)
    │   ├── preferences.js      allergen and diet checker used by every page (Person 1)
    │   ├── api.js              TheMealDB requests (Person 2)
    │   ├── recipes.js          search, filters, detail page (Person 2)
    │   ├── ui.js               shared Tailwind class sets and components (Person 2)
    │   ├── favourites.js       (Person 3)
    │   ├── ratings.js          star ratings and comments (Person 3)
    │   ├── planner.js          (Person 4)
    │   └── utils.js            small shared helpers (anyone, tell the team)
    └── images/             logo, icons, empty-state pictures
```

Three rules keep this beginner-friendly:

- **Edit only your own files.** If you need a change in a shared file (`ui.js`, `firebase-config.js`), message the owner instead of editing it yourself.
- **Link files with relative paths.** Pages and folders sit side by side, so `js/ui.js` and `js/auth.js` work from every HTML file.
- **Load scripts with `type="module"`.** That lets each JS file `import` from the others, for example `import { getCurrentUser } from './auth.js'`.

## Tailwind CSS setup

The site is styled with Tailwind CSS, a set of ready-made utility classes you write directly in the HTML, for example `class="bg-orange-600 text-white rounded-lg px-4 py-2"`. It loads from Tailwind's Play CDN, so there is nothing to install and no build step.

Add this one line inside the `<head>` of every HTML page:

```html
<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
```

The team agrees on these conventions:

- **Default palette only.** Primary `orange-600` (hover `orange-700`), page background `amber-50`, text `stone-800`, muted text `stone-500`, borders `stone-200`, errors `red-700`, success `green-700`. No custom colours, so the site stays consistent.
- **Mobile first.** Classes with no prefix apply to phones. Add `sm:` (640px and up), `md:` (768px) or `lg:` (1024px) to change the layout on bigger screens, for example `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`.
- **Shared components live in `js/ui.js`.** Person 2 writes the button classes, recipe card, form field and toast once, and everyone imports them instead of retyping long lists of classes.
- **Little or no custom CSS.** Loading skeletons (`animate-pulse`) and print styles (`print:hidden`) are built in, so use utilities first.

Tailwind describes the Play CDN as meant for development, so it suits a course project but is not what you would use for a production site. See Tailwind's [Play CDN guide](https://tailwindcss.com/docs/installation/play-cdn).

## Shared UI/UX rules

The site should feel like one product, so Person 2 sets up the shared components in `js/ui.js` in week 1, and everyone reuses them with the Tailwind conventions above.

- **Look and feel:** Warm, food-friendly colours from Tailwind's default palette (orange-600 for buttons and links, amber-50 for the page background, stone-800 for text), the default sans-serif font, lots of white space, and large food photos as the main visual.
- **Layout:** Mobile-first. One column on phones, two on tablets (Tailwind's sm: prefix, 640px and up), three on desktops (the lg: prefix, 1024px and up). Content sits in a centred container with a maximum width.
- **Navbar on every page:** Logo on the left, links for Recipes, Favourites and Planner in the middle, and Login / Sign up on the right (or the user's name and Log out when logged in). On phones it collapses into a menu button.
- **Shared components:** Primary and secondary buttons, recipe card, form field with label and error text, toast message, dialog, and a loading skeleton. Build each once in js/ui.js as a function or a shared set of Tailwind classes, and reuse it.
- **Every screen has four states:** Loading (skeleton or spinner), empty (friendly message with a next action), error (what went wrong and a retry button), and success (a short toast).
- **Accessibility basics:** Alt text on images, labels on every input, visible keyboard focus, sufficient colour contrast, and never use colour alone to show an error.

## Database schema

All personal data lives in subcollections under `users/{uid}`, so each user's data is isolated and one security rule protects everything. Recipes themselves are not stored, because TheMealDB already has them; Firestore only keeps what belongs to the user.

```
users/{uid}                          (Person 1)
  displayName   string               "Sam Lee"
  email         string               "sam@example.com"
  onboardingDone boolean              false until the preferences step is saved or skipped
  diets         array of string      ["vegetarian"]
  allergies     array of string      ["peanuts"]
  createdAt     timestamp

users/{uid}/favourites/{recipeId}    (Person 3)
  recipeId      string               "52772"  (TheMealDB idMeal, same as doc id)
  name          string               "Teriyaki Chicken Casserole"
  image         string               image URL
  category      string               "Chicken"
  ingredientNames array of string    ["chicken", "soy sauce"]  used for allergen checks
  addedAt       timestamp

users/{uid}/mealPlan/{day}           (Person 4)   day = monday ... sunday
  breakfast     map or null          { recipeId, name, image, ingredients }
  lunch         map or null          same shape
  dinner        map or null          same shape
  updatedAt     timestamp
    ingredients = array of { name: "chicken", measure: "2 cups" }

users/{uid}/shoppingList/current     (Person 4)
  checked       array of string      ["chicken", "soy sauce"]  ingredient names ticked off
  updatedAt     timestamp

recipes/{recipeId}/ratings/{uid}     (Person 3)
  stars         number               1 to 5
  comment       string
  displayName   string               copied from the user's profile
  createdAt     timestamp
```

The main design choices:

- **Recipe id as the favourite's document id.** It prevents duplicates and turns "is this recipe a favourite?" into a single read. Always store it as a string.
- **Store a small snapshot, not the whole recipe.** Name, image and category are enough to draw a card, so the favourites page needs no extra API calls.
- **One document per weekday.** Seven small documents are easy to read, update and clear. Each slot keeps its `ingredients`, so the shopping list can be built without calling the API again.
- **Rating document id = user id.** Each user can have only one rating per recipe, and they can edit it instead of adding another.
- **Use `serverTimestamp()` for `createdAt`, `addedAt` and `updatedAt`**, so times do not depend on a user's device clock.

One rule to add for ratings and comments, next to the existing `users/{userId}` rule in `firestore.rules`. Ratings are readable by anyone, but writable only by their own author:

```
match /recipes/{recipeId}/ratings/{uid} {
  allow read: if true;
  allow write: if request.auth != null && request.auth.uid == uid;
}
```

Person 1 keeps `firestore.rules`, so the others should send any schema change to Person 1 before changing a field name, because renamed fields break the other pages.

## Sign-up flow and dietary preferences

Sign-up is three screens: create the account, choose diets, then choose allergies. One question per screen keeps each form short and easy to use on a phone. Person 1 builds a dedicated `onboarding.html` page for the last two screens, and the Profile page reuses the same chips so users can edit their choices later.

1. **Create the account.** The user enters name, email and password on `signup.html` (or continues with Google). Firebase Auth creates the account and a `users/{uid}` document is saved with `onboardingDone: false`.
2. **Step 1 of 2: diet.** They are sent to `onboarding.html`. A progress bar shows "Step 1 of 2" above the heading "How do you eat?". Selectable chips: Vegetarian, Vegan, Pescatarian, Gluten-free, Dairy-free, Halal, and "No preference". More than one can be chosen. Buttons: Next and Skip.
3. **Step 2 of 2: allergies.** The same page swaps to the heading "Any food allergies?". Chips: Peanuts, Tree nuts, Milk, Eggs, Gluten/wheat, Soy, Fish, Shellfish, Sesame, and "None", plus an "Other" text box. One line under the heading explains that this is used to warn them about recipes. Buttons: Back, Skip and Finish.
4. **Saving.** Next saves `diets` straight away, so progress survives a page refresh. Finish saves `allergies` and sets `onboardingDone: true`. Skip moves on without saving that screen. Back keeps what was already selected.
5. **Land on the home page** with a toast ("Preferences saved"). Their diets are already applied to the recipe filters, and they can change both lists later on `profile.html`.

Two cases to handle:

- **Google sign-in:** a first-time Google user has no `users/{uid}` document yet. Create it with `onboardingDone: false` and send them to `onboarding.html` like everyone else.
- **Returning user who never finished:** after login, if `onboardingDone` is false, redirect to `onboarding.html` instead of the home page. If `onboardingDone` is already true and someone opens `onboarding.html` directly, redirect them to the home page.

The schema needs one new field on `users/{uid}`: `onboardingDone` (boolean). `diets` and `allergies` are already in it. The new files are `onboarding.html` and `js/onboarding.js`, both owned by Person 1.

## How preferences affect the website

Preferences should warn and filter, never block: the user always stays in control, and every page that shows recipes reads the same saved preferences.

| Page | Owner | What changes for a logged-in user with preferences |
| --- | --- | --- |
| Profile | Person 1 | Edit diets and allergies at any time; changes apply on the next page load. |
| Home and search | Person 2 | Diet chips are pre-selected. A "Hide recipes with my allergens" toggle is on by default. Cards that contain an allergen get a small warning badge. |
| Recipe page | Person 2 | A warning banner above the ingredients names the matching allergens and highlights those ingredients. |
| Favourites | Person 3 | Saved recipes show the same warning badge, so a recipe saved before the user added an allergy is still flagged. |
| Meal planner | Person 4 | Adding a flagged recipe shows a confirm message ("This contains peanuts. Add anyway?"). Flagged slots keep the warning badge, and the shopping list marks flagged ingredients. |
| Logged out | Everyone | No filtering. Show a small note, "Log in to personalise recipes". |

**One shared checker.** Person 1 writes `js/preferences.js` with `getPreferences()` and `checkRecipe(recipe, prefs)`. The checker returns the allergens and diet conflicts it found, for example `{ allergens: ["peanuts"], dietConflicts: [] }`, and every page calls it, so the rules live in one place. It works by matching keywords against a recipe's ingredient names (peanuts: "peanut"; shellfish: "prawn", "shrimp", "crab"; milk: "milk", "cheese", "butter", "cream"; and so on). Vegetarian and vegan use TheMealDB's own Vegetarian and Vegan categories plus a meat keyword list. Person 1 hands this over by end of week 2 so the others can build against it, and until then they can stub it to return no warnings.

**Limits to plan for:**

- **TheMealDB has no allergen or diet data.** Everything above is keyword matching on ingredient names, so it will miss some cases (a "curry paste" may contain shrimp) and flag some wrongly. Say so in the UI with a short line such as "Based on ingredient names. Always check labels." The site is a helper, not medical advice, and the team should say that in the demo.
- **Category lists have no ingredients.** TheMealDB's category filter only returns name and image, while name search and the recipe page return full ingredients. For category results, fetch each recipe's details in the background (the cached `getRecipeById` from `api.js`) and add the badge when it arrives, or check only on the recipe page.
- **Favourites need ingredients too.** Add an `ingredientNames` array (strings) to each favourite document when it is saved, so the favourites page can check allergens without extra API calls. Tell Person 3 to include it, and list it in the schema.
- **Allergy data is health information.** It lives under `users/{uid}`, which only that user can read, so keep it there and never copy it into shared collections such as ratings.

**Requirement split.** Must: collect and save diets and allergies, pre-select diet chips, warning badge and banner on recipe pages. Should: hide-allergens toggle, planner confirm message, background checks on category results. Nice to have: "Other" allergy matching, diet-based suggestions on the home page.

## Person 1: Accounts and profile

Person 1 owns everything about who the user is, from the login screens to the Firebase Auth setup behind them.

- **Frontend:** Signup and login pages, form validation, a navbar that changes when the user is logged in, and a profile page.
- **Backend:** Firebase Auth with email/password and Google sign-in, password reset, route protection, and a `users/{uid}` Firestore document for display name and dietary preferences (vegetarian, allergies, etc.).
- **Extra:** Owns `firebase-config.js` and the Firestore security rules for the whole project.

**Happy path**

1. A new visitor clicks Sign up in the navbar.
2. They enter name, email and password; each field validates as they type, and the password rules (at least 8 characters, a number and a special character) show as a checklist that ticks off.
3. They submit. Firebase Auth creates the account and a `users/{uid}` document is saved.
4. They are taken to the onboarding page, which asks for diet preferences (step 1) and then allergies (step 2) (see Sign-up flow), then land on the home page, and the navbar now shows their name and a Log out button.
5. On a later visit they log in with email/password or Google and return to the page they came from.
6. On the Profile page they tick dietary preferences and save, and a confirmation toast appears.

**Requirements**

- **Must:** Email/password signup, login and logout. Inline validation (valid email, password of at least 8 characters that includes a number and a special character, set as a Firebase password policy (Authentication, Settings, Password policy, Require mode) so the server rejects weaker passwords, and mirrored in our sign-up form so users see the rules as they type). Friendly error messages for wrong password and email already in use. Logged-out users are redirected away from Favourites, Planner and Profile. Export `getCurrentUser()` and `onAuthChange(callback)` for the rest of the team.
- **Should:** Google sign-in, password reset by email, and a loading state on the submit buttons.
- **Nice to have:** Write the shared js/preferences.js checker (see How preferences affect the website) so other pages can warn about allergens.

**UI/UX**

- Login and signup are a centred card (about 400px wide) with labels above fields and errors in text beneath them.
- A show/hide password toggle, a checklist under the password field for the rules (8 or more characters, a number, a special character), a full-width primary button, a "Continue with Google" button under an "or" divider, and a link to switch between login and signup.
- The navbar shows Login / Sign up when logged out, and the user's initial and name with a small menu (Profile, Log out) when logged in.
- Onboarding shows a progress bar (Step 1 of 2, Step 2 of 2) and one question per screen, using selectable chips. Profile reuses the same chips for dietary preferences and allergies, with a Save button that stays disabled until something changes.

## Person 2: Recipe discovery

Person 2 owns how users find recipes, from the search bar to the data fetched from TheMealDB.

- **Frontend:** Homepage, search bar, filters (category, ingredient, diet), recipe cards, recipe detail page, and the serving size scaler.
- **Backend:** The API layer that fetches from TheMealDB, with error handling and caching in `sessionStorage`.
- **Extra:** Owns the shared design system (the Tailwind class choices and the components in js/ui.js: buttons, cards, forms) so the whole site looks consistent.

**Happy path**

1. A visitor lands on the home page and sees a hero search bar and a grid of featured recipes.
2. They type "chicken" and press Enter. Loading skeletons appear, then recipe cards.
3. They narrow the results with the category chips (which include Vegetarian and Vegan) and a cuisine dropdown.
4. They click a card and open the recipe page with photo, ingredients, instructions and a video link.
5. They change the serving size and the ingredient amounts update.

**Requirements**

- **Must:** Search by name. Filter by category. Cards show image, name and category. Detail page lists ingredients (combine TheMealDB's `strIngredient1` to `strIngredient20` fields into one array) and numbered instructions. Loading, empty ("No recipes found") and error states. Responsive grid.
- **Should:** Cuisine filter, serving size scaler (scale only amounts that start with a number, and leave values like "a pinch" unchanged), and `sessionStorage` caching of API responses.
- **Nice to have:** A "Surprise me" random recipe button, and a space on the recipe page where Person 3's ratings and comments appear.
- **Hand-off:** Agree the recipe object shape in week 1 (id, name, image, category, area, ingredients, instructions) and document it at the top of `api.js`.

**UI/UX**

- Home: a large hero with the search bar centred, category chips directly below it, then the card grid.
- Recipe card: photo on top, name, a small category tag, and an empty heart slot in the corner that Person 3 wires up.
- Recipe page: on desktop, photo and ingredients on the left and numbered steps on the right. On phones everything stacks in one column.
- Search keeps the typed text and active filters visible, and shows a clear "Clear filters" button.

## Person 3: Favourites, ratings and comments

Person 3 owns saving and revisiting recipes, with Firestore keeping favourites in sync across devices. Person 3 also owns star ratings and comments on recipes, the only place where users see each other's input.

- **Frontend:** A heart/favourite button on every recipe card, a favourites page, sorting and filtering of favourites, empty states, and on the recipe page a star rating, a comment box and a list of reviews with the average rating.
- **Backend:** Firestore CRUD at `users/{uid}/favourites/{recipeId}`, real-time updates with `onSnapshot`, syncing the button state when the user logs in, and ratings and comments at recipes/{recipeId}/ratings/{uid} (one per user, editable, readable by everyone).
- **Extra:** Owns QA and testing, including checking with two accounts that users can't see each other's data.

**Happy path**

1. A logged-in user browses recipes and clicks the heart on a card. The heart fills immediately and a toast says "Saved to favourites".
2. The recipe's id, name, image and category are saved at `users/{uid}/favourites/{recipeId}`.
3. They open Favourites from the navbar and see their saved recipes in the same card grid.
4. They sort by name or date added and filter by category.
5. They click the filled heart to remove a recipe. The card fades out, and the change shows on their other devices.
6. A logged-out user who clicks a heart is sent to the login page with a message, then returned to the recipe afterwards.

**Requirements**

- **Must:** Add and remove favourites. A favourites page. Hearts show the correct state on page load for recipes already saved. A login prompt for logged-out users. An empty state with a "Browse recipes" button.
- **Should:** Real-time sync with `onSnapshot`, sorting and filtering, and optimistic updates (fill the heart first, undo it and show an error if the save fails).
- **Nice to have:** A favourites count badge in the navbar, and an "Add to meal plan" button on each favourite (uses Person 4's planner).
- **QA duty:** Test with two accounts to confirm neither can read the other's favourites, and keep a short manual test checklist for the whole site.

**UI/UX**

- The heart is an outline when not saved and filled when saved, with `aria-pressed` and a label such as "Add Pad Thai to favourites" for screen readers.
- The favourites page reuses the shared recipe card, with a sort dropdown at the top right.
- The empty state is a friendly picture, a short sentence and a primary button.
- Removing a favourite offers a brief "Undo" in the toast instead of a confirmation dialog.

**Ratings and comments**

- **Happy path:** On a recipe page, a logged-in user clicks 1 to 5 stars, writes an optional comment and submits. Their review appears at the top of the list, the average rating and review count update, and they can edit or delete their review later.
- **Must:** One review per user per recipe (the document id is the user's id). Stars are required and comments are limited to 300 characters. The recipe page shows the average rating, the review count and a list of reviews with display name and date. Only logged-in users can post. Loading, empty and error states.
- **Should:** Edit and delete your own review, newest reviews first, and the average rating shown on recipe cards. Person 3 writes the rule for ratings (readable by everyone, writable only by the author) and asks Person 1 to merge it into `firestore.rules`.
- **Nice to have:** Sort reviews by rating, and a "your rating" badge on the favourites page.
- **UI/UX:** Five clickable stars that also work with the keyboard (radio buttons styled as stars), filled in amber on hover and selection. The average shows as a number with stars, for example 4.3 (12 reviews). Each review is a small card with name, date, stars and comment. The empty state says "No reviews yet. Be the first."
- **Privacy:** A review shows only the user's display name, never their email, diet or allergies.

## Person 4: Meal planner and shopping list

Person 4 owns turning saved recipes into a weekly plan and a combined shopping list, and also ships the finished site.

- **Frontend:** A weekly planner grid with drag-and-drop or "add to day" buttons, a shopping list view with checkboxes, and print-friendly styling.
- **Backend:** Firestore storage at `users/{uid}/mealPlan/{day}`, and logic that merges ingredients across the week's recipes and combines duplicates.
- **Extra:** Owns Firebase Hosting deployment, the README, and the final demo script.

**Happy path**

1. A logged-in user opens a recipe or their favourites and clicks "Add to meal plan".
2. A small dialog asks for a day and a meal (breakfast, lunch or dinner), and they confirm.
3. The Planner page shows a Monday to Sunday grid with the recipe thumbnail in the chosen slot, saved at `users/{uid}/mealPlan/{day}`.
4. They move a recipe to another slot, or remove it, and the grid updates straight away.
5. They click "Generate shopping list". Ingredients from every planned recipe are combined, with duplicates merged.
6. They tick items off as they shop, or print a clean version of the list.

**Requirements**

- **Must:** Add and remove recipes by day and meal. Persist the plan in Firestore. Warn before adding a recipe that contains one of the user's allergens. Build the shopping list from planned recipes and merge duplicates (match ingredient names ignoring case; add amounts when the unit is the same and list them separately when it is not). Deploy to Firebase Hosting.
- **Should:** Drag and drop between slots, checkbox state saved in Firestore, and print styles (Tailwind's print: prefix, for example print:hidden) that hide the navbar and buttons.
- **Nice to have:** A "Clear week" button with confirmation, and a "Copy list" button that copies the shopping list to the clipboard.
- **Project duty:** README with run and deploy steps, the first deploy in week 1, and the final demo script.

**UI/UX**

- Desktop: a seven-column grid for the days with a row for each meal. Empty slots are dashed boxes with a "+" button.
- Phones: one day at a time with day tabs across the top, and the shopping list on its own tab.
- Shopping list: grouped by ingredient, checked items are struck through and move to the bottom.
- The print view shows only the list, in a single readable column.

## Why this split works better

Splitting by feature instead of by layer gives every member a full-stack story and keeps the code separated.

- Everyone touches HTML with Tailwind, JavaScript logic, and Firebase or API calls, so each person can speak to the full stack in a presentation.
- Each feature lives in its own files (`auth.js`, `recipes.js`, `favourites.js`, `planner.js`), which means fewer merge conflicts.
- The workload is more even. Auth is still the foundation, but it is balanced against Person 2's API and design work and Person 4's ingredient-merging logic.

## What to agree on early

Three decisions in the first few days keep the four slices from colliding.

- **Shared contracts:** Person 1 exposes something like `getCurrentUser()` and `onAuthChange(callback)`. Persons 3 and 4 depend on it, so they can stub it until it is ready.
- **Recipe data shape:** Person 2 defines what a recipe object looks like (id, name, image, ingredients, etc.) in the first day or two, since Persons 3 and 4 store and display it.
- **Naming and folder structure:** Agree on conventions up front (including the Tailwind colours and sizes listed above), and use one shared Git repo with two branches: main always holds the working, deployed version, and dev is where everyone commits. Pull from dev before you start and before you push, commit small and often, and merge dev into main only when it has been tested (Person 4 does the merge and deploys from main).

## Timeline

The plan runs from Monday Oct 26 to Sunday Nov 29, 2026. Each row lists what every person should have finished by the end of that week, and the last column says what must be true before the team moves on. Features freeze on Nov 15, so weeks 4 and 5 are only for fixing, testing and deploying.

| Week | Person 1: Accounts | Person 2: Recipes and design | Person 3: Favourites, ratings and QA | Person 4: Planner and deployment | Team checkpoint (end of week) |
| --- | --- | --- | --- | --- | --- |
| **Week 1**, Oct 26 to Nov 1: set up and foundations | Create the Firebase project, enable Email/Password and Google sign-in, turn on the password policy (minimum 8 characters, a number and a special character), create Firestore, and add teammates as editors. Fill in firebase-config.js. Build signup and login with email and password, and a navbar that shows logged-in or logged-out state. Write the first firestore.rules. | Add the Tailwind script to every page. Build js/ui.js (button, recipe card, form field, toast, loading skeleton). Write api.js with search, recipe lookup and categories, and agree the recipe object. The home page shows search results with loading, empty and error states. | Study Firestore reads and writes. Create favourites.js with the five agreed function names, stubbed. Add the heart button to the recipe card using a fake user until login works. Draft the manual test checklist. | Create the GitHub repo with main and dev branches, and the README. Run firebase init and the first deploy of a hello page, and check the web.app domain is authorised in Firebase Auth. Define the meal plan data shape. Build the empty planner.html layout. | Everyone can run the site locally and has pushed to the dev branch. The first deploy is live. The recipe object and function names are agreed. |
| **Week 2**, Nov 2 to Nov 8: core happy paths | Google sign-in, creating the users/{uid} document for first-time users. Onboarding page with step 1 diet and step 2 allergies saved to Firestore, with the onboardingDone redirect rules. First version of js/preferences.js (getPreferences and checkRecipe), handed over by Nov 8. Logged-out users are redirected away from protected pages. | Category chips and cuisine filter with a Clear filters button. recipe.html shows photo, ingredients, numbered instructions and video link. Responsive card grid (one, two and three columns). sessionStorage caching of API results. | addFavourite, removeFavourite and isFavourite working against Firestore. Heart button on recipe cards and the recipe page, showing the correct state on page load. favourites.html lists saved recipes. Logged-out users get a login prompt. Design the ratings data (recipes/{recipeId}/ratings/{uid}) and write the Firestore rule for it, then hand the rule to Person 1 to merge into firestore.rules. | addToPlan, removeFromPlan and getPlan working against Firestore. An Add to meal plan dialog (day and meal). The desktop planner grid shows recipe thumbnails in the right slots, and a recipe can be removed from a slot. | A new user can sign up, set preferences, search, save a favourite and add a recipe to the plan, end to end. Every page is merged into dev, and a tested version of dev is merged into main. |
| **Week 3**, Nov 9 to Nov 15: finish features, then freeze | Profile page to edit diets and allergies. Password reset and live form validation with friendly error messages. Loading states on buttons. Tune the allergen keyword lists in preferences.js. | Serving size scaler. Allergen badge on cards and warning banner on the recipe page using preferences.js. Hide-allergens toggle. Diet chips pre-selected from the profile. | Real-time favourites with onSnapshot. Sorting and filtering. Empty state and an Undo toast. Save ingredientNames with each favourite and show allergen badges on the favourites page. Star rating and comment form, average rating and review list on the recipe page, saved to Firestore (ratings.js). | Shopping list that merges duplicate ingredients, with checkboxes saved in Firestore. Move recipes between slots (drag and drop if time allows). Confirm message when adding a recipe that contains an allergen. Phone layout with day tabs. | **Feature freeze on Nov 15.** Every Must item is on main. After this date only fixes are allowed, no new features. |
| **Week 4**, Nov 16 to Nov 22: integration and bug fixes | Review firestore.rules and test that one user cannot read another user's data. Fix redirect and onboarding bugs. Check the forms with keyboard only and make sure every input has a label. | Make styles consistent across all pages. Check loading, empty and error states on every screen, including when TheMealDB is unreachable. Fix responsive layout problems found in testing. | Run the full manual test checklist with two accounts and log every bug, including ratings: one review per user, editing, and logged-out users cannot post. Test on a phone and in Chrome, Firefox and Safari. Retest fixes. | Print styles for the shopping list (print:hidden on the navbar and buttons). Redeploy at least twice this week to catch problems that only appear in production. Update the README. | The full flow works on the live site. Every bug from testing is fixed or written down as a known issue. |
| **Week 5**, Nov 23 to Nov 29: polish, deploy and present | Final pass on login and sign-up. Create demo accounts (one with allergies set, one empty). Write up accounts and security for your report or presentation. | Visual polish. Final accessibility check: alt text, colour contrast and visible focus. Write up recipes and design. | Final run of the test checklist and sign-off. Write up favourites, ratings and testing. Prepare the favourites and ratings part of the demo. | Final deployment by Nov 25, then no more code changes. Finish the README and the demo script. Record a backup screen recording of the demo in case the network fails. | The final site is live, the demo has been rehearsed at least once, and everything is submitted before the module deadline (add the date here). |

Persons 1 and 2 start first because Persons 3 and 4 depend on auth and the recipe data shape. Deploy to Firebase Hosting early in the final week so there is time to fix anything that only breaks in production.
