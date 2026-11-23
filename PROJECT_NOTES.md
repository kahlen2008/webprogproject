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
  - **Exception:** `index.html`, `recipes.html` and `recipe.html` load a pre-built `css/tailwind.css` instead (faster first load). It only contains the classes that existed when it was generated, so a Tailwind class that is new to those pages (in their HTML or in JS that renders there) does nothing until the file is regenerated. It also bundles `css/base.css`, `components.css` and `recipes.css`, so regenerate after editing those too. From the repo root:
    `npx tailwindcss@3.4.17 -c tailwind.config.js -i tailwind.input.css -o public/css/tailwind.css --minify`
    (`tailwind.config.js` has the same theme as the CDN pages; neither file is deployed.)
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
| 2        | Recipe discovery, API, shared look, cooking mode                        | `index.html`, `recipes.html`, `recipe.html`, `js/api.js`, `js/recipes.js`, `js/cooking-mode.js`, `js/search-cta.js`, `js/home-demos.js`, `css/base.css`, `css/components.css`, `css/recipes.css`                                                                     |
| 3        | Favourites, ratings and comments, QA                                    | `favourites.html`, `js/favourites.js`, `css/favourites.css`, `js/ratings.js`                                                                                                                                                        |
| 4        | Meal planner, shopping list, cuisine filter, deployment, README         | `planner.html`, `js/planner.js`, `css/planner.css`, `firebase.json`, `.github/workflows/`, `README.md`. The cuisine filter lives in Person 2's files: the cuisine menu and "Clear filters" button in `recipes.html`, `listAreas` / `filterByArea` in `js/api.js`, and the combined filter code (`runActiveFilter`) in `js/recipes.js` |
| Anyone   | Small shared helpers                                                    | `js/utils.js` (add, do not change existing functions)                                                                                                                                                                                                            |

`privacy.html` and `terms.html` are Person 1's.

## Contracts between people

Use these functions instead of rewriting them. If you change a signature, tell the team first.

**`js/auth.js` (Person 1)**
`getCurrentUser()`, `onAuthChange(cb)`, `signup(name, email, password)`, `login(email, password)`, `loginWithGoogle()`, `logout()`, `deleteAccount()`, `resetPassword(email)`, `validatePasswordRequirements(password)` (returns an error string or `null`), `friendlyAuthError(error)`, `safeRedirect(value)` (turns a `?redirect=` value into a path on this site, or `null`; always use it before navigating to a redirect). `deleteAccount()` checks for a recent login first, then removes all the user's data with `deleteUserData(uid)` from `schema.js`.

**`js/preferences.js` (Person 1)**
`getPreferences()` returns `{ diets, allergies, hideFlagged, onboardingComplete, onboardingStep }`.
`savePreferences(partial)`, `syncPreferencesFromCloud()`, `needsOnboarding()`, `hasPreferences()`.
Checking: `checkRecipe(recipe, prefs)`, `checkRecipes(recipes)`, `checkIngredients(...)`, `getIngredientNames(recipe)`, `decorateCard(...)`, `describeResult(...)`, `openFlaggedRecipeModal(...)`, `confirmIfFlagged(recipe)` (asks the user before adding a flagged recipe, resolves `true` to continue).
Options: `DIET_OPTIONS`, `ALLERGEN_OPTIONS`, `dietLabel(value)`.
Swaps: `getSwapSuggestions(result, prefs)` takes a `checkRecipe` result and returns `[{ ingredient, options: [...] }]`, up to 3 ideas per flagged ingredient. Options that contain something else the user avoids are left out (each option in the `SWAPS` table lists what it contains in `has`). Low Carb and Keto get no swaps. The recipe page shows them as "Try instead" in the warning banner.

**`js/i18n.js` (Person 1)**
`LANGUAGES`, `getCurrentLanguage()`, `setLanguage(code)`, `translateQueryToEnglish(query)` (used by `searchRecipes`), `translatePlaceholders()`, `createLanguageSwitcherHtml()`, `bindLanguageSwitcher()`, `ensureStandaloneLanguageSwitcher()`. Wrap text that must not be translated (recipe search terms, the brand name) in `translate="no" class="notranslate"`.

**`js/schema.js` (Person 1)**
Firestore path helpers (`SchemaPaths`), document builders (`createUserDoc`, `createFavouriteDoc`, `createMealPlanDoc`, `createShoppingListDoc`, `createRatingDoc`) and read/write helpers (`deleteUserData`, `saveUserFavourite`, `fetchUserFavourites`, `saveUserMealPlan`, `fetchUserMealPlan`, `saveUserShoppingList`, `fetchUserShoppingList`, `saveRecipeRating`, `fetchRecipeRatings`, ...). Persons 3 and 4 should call these instead of writing Firestore code themselves.

**`js/api.js` (Person 2)**
`searchRecipes(query)`, `getRecipeById(id)`, `listCategories()`, `filterByCategory(category)`, `normalizeRecipe(meal)`.
Cuisine filter (Person 4): `listAreas()` (cuisine names for the menu) and `filterByArea(area)`. TheMealDB lists ~195 cuisines, but only 37 have recipes, and 8 of those (French, Indian, American, Dutch, Norwegian, Argentinian, Venezuelan, Slovak) are missing from its list because their recipes use country names ("France"). So `listAreas` returns a fixed list (`AREAS_WITH_RECIPES` in `api.js`), and `filterByArea` maps those 8 to the names TheMealDB expects (`AREA_API_NAMES`). Don't check every cuisine from the browser: TheMealDB starts refusing requests after about 100 in a row.

Recipe object used everywhere:

```js
{ id, name, image, category, area, instructions, ingredients: [{ name, measure }], youtube }
```

**`js/cooking-mode.js` (Person 2)**
`openCookingMode({ recipe, parsedItems, allergenResult, onSwitchTab })` opens the full-screen cooking view. `parsedItems` is the output of the recipe page's instruction parser (steps, bullets and section headers), `allergenResult` is the `checkRecipe` result (used to mark flagged ingredients in the checklist) and `onSwitchTab("reviews")` is called by "Leave a Review" on the finished screen. Helpers: `prepareCookingSteps(parsedItems, rawInstructions)`, `detectCookingTimer(text)` (returns `{ seconds, label }` for e.g. "35 minutes", "1-2 mins" (uses the upper number), "1.5 hours", or `null`). The recipe page opens it from its two Cooking Mode buttons, or straight away when the URL has `?cook=1` or `#cook`.

**`js/favourites.js` (Person 3)**
`getFavourites()`, `addFavourite(recipe)` (also saves `ingredientNames`), `removeFavourite(recipeId)`, `isFavourite(recipeId)`, `watchFavourites(cb)`.
`watchFavourites` listens live with Firestore `onSnapshot` while signed in (localStorage when signed out or offline), calls `cb(favs, { pending })`, and returns a function that stops watching. `pending` is true while a signed-in session is still being restored.

**`js/planner.js` (Person 4)**
`DAYS`, `MEALS`, `emptyPlan()`, `shownWeekId()`, `getPlan(weekId?)`, `savePlan(plan, weekId?)`, `addToPlan(day, meal, recipe, options)`, `removeFromPlan(day, meal)`, `moveInPlan(fromDay, fromMeal, toDay, toMeal)`, `clearWeek()`, `generateFromFavourites()`, `renderPlannerTable()`, `renderShoppingList(plan)`, `openAddToPlanDialog(recipe, options)`.
`weekId` defaults to the week shown on the planner (this week on other pages). `addToPlan` options: `{ skipConfirm }` skips the replace and allergen prompts, `{ skipAllergenCheck }` skips only the allergen prompt (use it when the caller already ran `confirmIfFlagged`), `{ skipReplaceConfirm }` skips only the replace prompt. Other pages should call `addToPlan` instead of writing the plan themselves.
`openAddToPlanDialog(recipe, { skipAllergenCheck, day, meal })` is the shared day and meal dialog: it shows this week's days and the three meals, says what is already in the chosen slot, saves through `addToPlan`, and resolves `{ day, meal }` (plus `unchanged: true` if that recipe was already there) or `null` if cancelled.

**`js/utils.js` (shared)**
`escapeHtml` (escapes `& < > " '`, so it is safe in text and in quoted attributes), `showToast`, `toTitleCase`, `createRecipeCard(recipe, options)`, `cleanInstructionText` (fixes TheMealDB scraping typos such as missing first letters, common misspellings and doubled small words like "the the"), `showConfirmModal({ title, message, confirmText, cancelText, confirmColor, icon })` (resolves `true` or `false`), `capitalizeIngredient`, `combineMeasures`, `combineIngredients` (the last two merge shopping list items), `sumShoppingMeasures(measures)` (adds amounts up per unit for the shopping list, e.g. "170g + 6 tbsp").

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
  ratings/{recipeId}        { recipeId, ratedAt }  private list of reviewed recipes, used to delete reviews with the account

recipes/{recipeId}/ratings/{uid}   (Person 3)
  stars (whole number 1 to 5), comment (max 300), displayName (1 to 60), createdAt (server time)
```

Rules (`firestore.rules`): everything under `users/{uid}` is readable and writable only by that user. Ratings are readable by anyone and writable only by their author, and the rules reject a rating with other fields, stars outside 1 to 5, a comment over 300 characters or a display name over 60. Rules are not deployed by the workflows: after changing them run `firebase deploy --only firestore:rules`.

Onboarding routing: after signup go to `onboarding.html`. Not logged in goes to `login.html`. `onboardingComplete` true goes to `index.html`. Step 1 is diet, step 2 is allergies. Next on step 1 saves diets straight away. Skip and Finish both set `onboardingComplete`.

## Current status vs plan (check before you build)

- Favourites sync to Firestore live (`onSnapshot`) and store `ingredientNames`. The favourites page has category and sort menus.
- The weekly plan is saved per week to `users/{uid}/mealPlan/{weekId}` through `schema.js`, with a localStorage copy per user. The week arrows now show each week's own plan. The recipe page's "Add to meal plan" goes through `addToPlan`.
- Planner: drag and drop between slots (tablet and desktop; dropping on a filled slot swaps them), day tabs on phones, Clear week with Undo, and a week switcher with a "Back to today" button.
- The recipe page's "Add to meal plan" opens the shared day and meal dialog (`openAddToPlanDialog`).
- The card heart buttons in `utils.js` and `search-cta.js` go through `toggleCardFavourite` (in `utils.js`), which calls `addFavourite` / `removeFavourite`. If the save fails, the heart flips back and an error toast shows.
- The navbar loads the favourites list once per session after login, so card hearts are right on a new device. Favourite cards show a "You ★4" badge when the user has rated that recipe.
- The shopping list on `planner.html` is built from the shown week's plan with `combineIngredients` (a recipe planned twice counts twice). Slots added through `addToPlan` keep the recipe's `ingredients`, so the list only calls the API for older slots. Ticks are saved to `users/{uid}/shoppingList/{weekId}` (plus a localStorage copy). Items are grouped by aisle (keyword rules in `planner.js`: Produce, Meat & fish, Dairy & eggs, Bakery, Pantry, Herbs & spices, Frozen, Other) as compact checklist rows. Staples like salt, oil and water fold into "Probably in your cupboard". Checked items are struck through and move to a folded "In the basket" group at the bottom. Items that match the user's allergies or diet get a warning mark. On phones the list has its own tab (Meals / Shopping list). Copy list copies what is still to buy; Print shows only the list, in one column, with no navbar or buttons.
- Ratings and comments are built (`ratings.js`).
- Cuisine filter is built (Person 4): a cuisine menu on `recipes.html` that combines with the search box and the category chips (the results are the recipes that match all of them), a "Clear filters" button, and `?cuisine=` in the URL.
- Serving size scaler is built on the recipe page (`scaleMeasure` in `utils.js`). It scales amounts that start with a number and leaves "a pinch" or "to taste" alone. "Add to meal plan" and cooking mode use the scaled amounts.
- Cooking mode is built (`cooking-mode.js`, opened from `recipe.html`). One step at a time with Next/Back and arrow keys, step pills, progress based on finished steps, an ingredient checklist drawer and a finished screen linking to reviews. The step text shrinks to fit the screen (down to 16px). Times found in a step ("cook for 35 minutes") offer a timer. Timers keep running across steps in a bar above Back/Next, several can run at once, and leaving with one running asks first. The screen wake lock keeps the display on (secure pages only; it fails silently elsewhere).
- Instructions: short ALL-CAPS lines (e.g. "MARINATING THE CHICKEN.") are shown as section headings, not numbered steps. This is switched off for recipes written mostly in capitals. It changes 8 TheMealDB recipes (Beef Lo Mein, Chicken Congee, General Tsos Chicken, Hot and Sour Soup, Pouding chomeur, Shrimp Chow Fun, Smoky Lentil Chili with Squash, Szechuan Beef).
- Recipe page: on tablet and desktop the photo takes the height of the details column, so it lines up with the description for one and two line titles.
- The demo plan is gone. An old browser-only plan is moved to the current week on the account once (an unedited demo plan is dropped).
- "Fill from favourites" (in the planner's ⋯ menu, next to Clear week) is an extra we added.
- Nutrition estimates are an extra we added (`nutrition.js`): rough calories, protein, carbs and fat per serving on the recipe page, and a daily calorie total on the planner. TheMealDB has no nutrition data, so they come from a small per-100 g table and the ingredient amounts, and the UI calls them a rough guide.
- Translation is machine translation, so wording can be imperfect. Allergen matching always runs on the English ingredient names from TheMealDB.

## Shared UI/UX rules

- Use the `brand` Tailwind colours and the Inter / Outfit fonts. Cream page background, white rounded cards, orange main button.
- Mobile first. Check every page at phone width.
- Buttons and inputs must have labels and visible focus. Images need `alt` text.
- Show toasts (`showToast`) for success and errors, not `alert()`.
- Allergen and diet warnings use the same badge and modal from `preferences.js` on every page.

## Out of scope (only if everything else is done)

"Fill my week" smart auto-planner, search by ingredients on hand, dark mode. (Multi-language support, cooking mode and substitution suggestions were moved into scope and are built.)

## Timeline

Team dates (Oct 26 to Nov 23, feature freeze Nov 21, submission Nov 23):

| Week | Dates            | Goal                                                                                       |
| ---- | ---------------- | ------------------------------------------------------------------------------------------ |
| 1    | Oct 26 to Nov 1  | Repo, Firebase, auth and onboarding, recipe search, page shells                            |
| 2    | Nov 2 to Nov 8   | Recipe detail, preferences checker on cards, favourites on Firestore, planner table        |
| 3    | Nov 9 to Nov 15  | Ratings and comments, planner on Firestore, profile and allergen checks                   |
| 4    | Nov 16 to Nov 21 | Shopping list, day and meal dialog, cooking mode, last fixes. **Feature freeze Nov 21**    |
| 5    | Nov 22 to Nov 23 | Testing with two accounts, bug fixes, final deploy (Nov 22), README, demo. **Submit Nov 23** |
