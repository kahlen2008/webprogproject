# RecipePlan: Project Notes

Shared rules for the whole team. Read this before you edit anything. Full use cases, flows and the timeline are in `Recipe Finder & Meal Planner Team Use Cases.md`.

## What we are building

**RecipePlan** is a recipe finder and weekly meal planner for home cooks, especially people with a diet or allergy. Users:

- create an account and pick their diet and allergies in a 2-step onboarding page
- search recipes (TheMealDB API) and see a warning on recipes that clash with their preferences
- save favourites, rate and comment on recipes
- plan a week of meals (Mon to Sun, Breakfast / Lunch / Dinner)
- get one merged shopping list for the week

TheMealDB has no allergen data, so warnings are keyword matching on ingredient names. It is a helper, not a guarantee. Keep that wording in the UI.

Course: K0126002 Web Programming, Gachon University, Fall 2026.

## Stack

- Plain HTML, CSS and JavaScript. No frameworks, no build step.
- Tailwind CSS v3 via CDN (`https://cdn.tailwindcss.com`). Every page has the same `tailwind.config` block with the `brand` colours (`#ca5c2e` main). Copy it from an existing page.
- Shared CSS files still exist: `css/base.css`, `css/components.css`, plus one CSS file per page where needed.
- JavaScript uses ES modules (`<script type="module">`), so use a local server (`npx serve public`), not `file://`.
- Firebase Authentication (email/password and Google) and Cloud Firestore.
- TheMealDB: `https://www.themealdb.com/api/json/v1/1`
- Fonts: Inter (body), Outfit (headings).
- Languages: a headless Google Translate engine (`js/i18n.js`) gives a language switcher with 130+ languages.

## Git workflow

- `main` = stable and deployed. Do not work on it directly.
- `dev` = daily work. Pull before you start and before you push: `git pull origin dev`.
- Person 4 merges tested `dev` into `main` (pull request).
- Commit small and often. Message says what changed.

## Deployment

All site files live in `public/`. The repo currently has:

- GitHub Pages: `.github/workflows/deploy.yml` uploads `./public`
- Firebase Hosting: `firebase.json`, `.firebaserc` (project `recipe-plan-app`) and the two `firebase-hosting-*.yml` workflows

Both deploy on every push to `main`. The GitHub Pages link (<https://kahlen2008.github.io/webprogproject/>) is the one used in the proposal and README, so treat it as the submission link.

## Rules

1. Plain HTML, CSS and JS only. No React, Vue or build tools.
2. One page = one HTML file + one JS file (+ one CSS file if it needs one).
3. Edit only your own files (table below). Need a change in someone else's file? Ask them.
4. Do not weaken `firestore.rules`. Ask Person 1.
5. Every page that loads data has four states: loading, empty, error, content.
6. Escape any user or API text before putting it in `innerHTML` (`escapeHtml` in `utils.js`).
7. Passwords: at least 8 characters, one number, one special character. Enforced by the Firebase password policy and by `validatePasswordRequirements` in `auth.js`.

## Who owns what

| Person   | Area                                                                    | Files                                                                                                                                                                                                                                                              |
| -------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1 (Lead) | Accounts, onboarding, profile, diet and allergy checker, languages (i18n), Firestore schema helpers, security rules. Also helps with integration and small fixes in other areas (agreed with the file owner first) | `login.html`, `signup.html`, `onboarding.html`, `profile.html`, `js/auth.js`, `js/onboarding.js`, `js/profile.js`, `js/preferences.js`, `js/navbar.js`, `js/i18n.js`, `js/schema.js`, `js/firebase-config.js`, `css/auth.css`, `css/onboarding.css`, `firestore.rules` |
| 2        | Recipe discovery, API, shared look                                      | `index.html`, `recipes.html`, `recipe.html`, `js/api.js`, `js/recipes.js`, `js/search-cta.js`, `css/base.css`, `css/components.css`, `css/recipes.css`                                                                                           |
| 3        | Favourites, ratings and comments, QA                                    | `favourites.html`, `js/favourites.js`, `css/favourites.css`, `js/ratings.js`                                                                                                                                                        |
| 4        | Meal planner, shopping list, deployment, README                         | `planner.html`, `js/planner.js`, `css/planner.css`, `firebase.json`, `.github/workflows/`, `README.md`                                                                                                                                                 |
| Anyone   | Small shared helpers                                                    | `js/utils.js` (add, do not change existing functions)                                                                                                                                                                                                            |

`privacy.html` and `terms.html` are Person 1's.

## Contracts between people

Use these functions instead of rewriting them. If you change a signature, tell the team first.

**`js/auth.js` (Person 1)**
`getCurrentUser()`, `onAuthChange(cb)`, `signup(name, email, password)`, `login(email, password)`, `loginWithGoogle()`, `logout()`, `deleteAccount()`, `resetPassword(email)`, `validatePasswordRequirements(password)` (returns an error string or `null`), `friendlyAuthError(error)`.

**`js/preferences.js` (Person 1)**
`getPreferences()` returns `{ diets, allergies, hideFlagged, onboardingComplete, onboardingStep }`.
`savePreferences(partial)`, `syncPreferencesFromCloud()`, `needsOnboarding()`, `hasPreferences()`.
Checking: `checkRecipe(recipe, prefs)`, `checkRecipes(recipes)`, `checkIngredients(...)`, `getIngredientNames(recipe)`, `decorateCard(...)`, `describeResult(...)`, `openFlaggedRecipeModal(...)`, `confirmIfFlagged(recipe)` (asks the user before adding a flagged recipe, resolves `true` to continue).
Options: `DIET_OPTIONS`, `ALLERGEN_OPTIONS`, `dietLabel(value)`.

**`js/i18n.js` (Person 1)**
`LANGUAGES`, `getCurrentLanguage()`, `setLanguage(code)`, `translateQueryToEnglish(query)` (used by `searchRecipes`), `translatePlaceholders()`, `createLanguageSwitcherHtml()`, `bindLanguageSwitcher()`, `ensureStandaloneLanguageSwitcher()`. Wrap text that must not be translated (recipe search terms, the brand name) in `translate="no" class="notranslate"`.

**`js/schema.js` (Person 1)**
Firestore path helpers (`SchemaPaths`), document builders (`createUserDoc`, `createFavouriteDoc`, `createMealPlanDoc`, `createShoppingListDoc`, `createRatingDoc`) and read/write helpers (`saveUserFavourite`, `fetchUserFavourites`, `saveUserMealPlan`, `fetchUserMealPlan`, `saveUserShoppingList`, `fetchUserShoppingList`, `saveRecipeRating`, `fetchRecipeRatings`, ...). Persons 3 and 4 should call these instead of writing Firestore code themselves.

**`js/api.js` (Person 2)**
`searchRecipes(query)`, `getRecipeById(id)`, `listCategories()`, `filterByCategory(category)`, `normalizeRecipe(meal)`.

Recipe object used everywhere:

```js
{ id, name, image, category, area, instructions, ingredients: [{ name, measure }], youtube }
```

**`js/favourites.js` (Person 3)**
`getFavourites()`, `addFavourite(recipe)` (also saves `ingredientNames`), `removeFavourite(recipeId)`, `isFavourite(recipeId)`, `watchFavourites(cb)`.
`watchFavourites` listens live with Firestore `onSnapshot` while signed in (localStorage when signed out or offline), calls `cb(favs, { pending })`, and returns a function that stops watching. `pending` is true while a signed-in session is still being restored.

**`js/planner.js` (Person 4)**
`DAYS`, `MEALS`, `emptyPlan()`, `shownWeekId()`, `getPlan(weekId?)`, `savePlan(plan, weekId?)`, `addToPlan(day, meal, recipe, options)`, `removeFromPlan(day, meal)`, `moveInPlan(fromDay, fromMeal, toDay, toMeal)`, `clearWeek()`, `generateFromFavourites()`, `renderPlannerTable()`.
`weekId` defaults to the week shown on the planner (this week on other pages). `addToPlan` options: `{ skipConfirm }` skips the replace and allergen prompts, `{ skipAllergenCheck }` skips only the allergen prompt (use it when the caller already ran `confirmIfFlagged`). Other pages should call `addToPlan` instead of writing the plan themselves.

**`js/utils.js` (shared)**
`escapeHtml`, `showToast`, `toTitleCase`, `createRecipeCard(recipe, options)`, `cleanInstructionText`, `capitalizeIngredient`, `combineMeasures`, `combineIngredients` (the last two merge shopping list items).

**`js/firebase-config.js`** exports `app`, `auth`, `db`. Import these, never call `initializeApp` again.

## Database schema (Firestore)

```
users/{uid}
  displayName, email, createdAt
  diets: []                 e.g. ["Vegetarian", "Halal"]
  allergies: []             e.g. ["Peanuts", "Shellfish"]
  hideFlagged: boolean
  onboardingComplete: boolean
  onboardingStep: 1 | 2
  favourites/{recipeId}     { id, name, image, category, area, ingredientNames, savedAt }
  mealPlan/{weekId}         { Mon: { Breakfast, Lunch, Dinner }, ... }
  shoppingList/{weekId}     { items: [{ name, measure, checked }] }

recipes/{recipeId}/ratings/{uid}   (Person 3)
  stars (1 to 5), comment, displayName, createdAt
```

Rules (`firestore.rules`): everything under `users/{uid}` is readable and writable only by that user. Ratings are readable by anyone and writable only by their author.

Onboarding routing: after signup go to `onboarding.html`. Not logged in goes to `login.html`. `onboardingComplete` true goes to `index.html`. Step 1 is diet, step 2 is allergies. Next on step 1 saves diets straight away. Skip and Finish both set `onboardingComplete`.

## Current status vs plan (check before you build)

- Favourites sync to Firestore live (`onSnapshot`) and store `ingredientNames`. The favourites page has category and sort menus.
- The weekly plan is saved per week to `users/{uid}/mealPlan/{weekId}` through `schema.js`, with a localStorage copy per user. The week arrows now show each week's own plan. The recipe page's "Add to meal plan" goes through `addToPlan` (still always Mon Dinner).
- Planner: drag and drop between slots (tablet and desktop; dropping on a filled slot swaps them), day tabs on phones, Clear week with Undo, and a week switcher with a "Back to today" button.
- The card heart buttons in `utils.js` and `search-cta.js` still write favourites to Firestore themselves instead of calling `favourites.js`. The favourites page adds the missing `ingredientNames` in the background, but these should switch to `addFavourite` / `removeFavourite`.
- The shopping list on `planner.html` is still sample markup. It needs to be built from the plan using `combineIngredients` (Person 4).
- Ratings and comments are built (`ratings.js`).
- The demo plan is gone. An old browser-only plan is moved to the current week on the account once (an unedited demo plan is dropped).
- Still to do (Person 4), in this order: build the shopping list from the plan, save checkbox state to `shoppingList/{weekId}`, then the print view and Copy list.
- "Fill from favourites" (in the planner's ⋯ menu, next to Clear week) is an extra we added.
- Translation is machine translation, so wording can be imperfect. Allergen matching always runs on the English ingredient names from TheMealDB.

## Shared UI/UX rules

- Use the `brand` Tailwind colours and the Inter / Outfit fonts. Cream page background, white rounded cards, orange main button.
- Mobile first. Check every page at phone width.
- Buttons and inputs must have labels and visible focus. Images need `alt` text.
- Show toasts (`showToast`) for success and errors, not `alert()`.
- Allergen and diet warnings use the same badge and modal from `preferences.js` on every page.

## Out of scope (only if everything else is done)

"Fill my week" smart auto-planner, substitution suggestions, search by ingredients on hand, cooking mode, dark mode. (Multi-language support was moved into scope and is built.)

## Timeline

Team dates (Oct 26 to Nov 29, feature freeze Nov 15):

| Week | Dates            | Goal                                                                                       |
| ---- | ---------------- | ------------------------------------------------------------------------------------------ |
| 1    | Oct 26 to Nov 1  | Repo, Firebase, auth and onboarding, recipe search, page shells                            |
| 2    | Nov 2 to Nov 8   | Recipe detail, preferences checker on cards, favourites on Firestore, planner table        |
| 3    | Nov 9 to Nov 15  | Ratings and comments, planner on Firestore, shopping list. **Feature freeze Nov 15** |
| 4    | Nov 16 to Nov 22 | Testing, bug fixes, responsive and accessibility pass, README                              |
| 5    | Nov 23 to Nov 29 | Deploy, final check, slides and demo                                                       |
