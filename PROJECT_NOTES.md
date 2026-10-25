# Project notes (read before every task)

This file is the team's shared reference. If you use an AI coding assistant, tell it to read this file first.

## What we are building

A recipe finder and meal planner. Users search recipes (TheMealDB API), log in (Firebase Auth), save favourites and a weekly meal plan (Firestore), and get a combined shopping list. Deployed on Firebase Hosting.

## Rules

- Plain HTML, CSS and JavaScript only. No frameworks and no build step.
- All site files live in `public/`. Pages sit next to each other, so links are `css/base.css` and `js/auth.js`.
- JavaScript uses ES modules: `<script type="module" src="js/xyz.js"></script>` and `import { ... } from './auth.js'`.
- Edit only your own files. To change a shared file (`base.css`, `components.css`, `firebase-config.js`, `auth.js`, `api.js`), ask its owner.
- One page = one HTML file + one CSS file + one JS file.
- Do not weaken `firestore.rules` to make an error go away. Ask Person 1.
- Check every screen in four states: loading, empty, error, success.

## Ownership

| Person | Owns |
| --- | --- |
| 1 | Accounts and profile: `login.html`, `signup.html`, `profile.html`, `css/auth.css`, `js/auth.js`, `js/navbar.js`, `js/firebase-config.js`, `firestore.rules` |
| 2 | Recipe discovery and design system: `index.html`, `recipe.html`, `css/base.css`, `css/components.css`, `css/recipes.css`, `js/api.js`, `js/recipes.js` |
| 3 | Favourites and QA: `favourites.html`, `css/favourites.css`, `js/favourites.js` |
| 4 | Meal planner and deployment: `planner.html`, `css/planner.css`, `js/planner.js`, `firebase.json`, `README.md` |
| anyone | `js/utils.js` (small shared helpers, tell the team when you change it) |

## Contracts between people

Person 1 exports from `js/auth.js`:

- `getCurrentUser()` returns the logged-in user or `null`.
- `onAuthChange(callback)` calls `callback(user)` now and whenever login state changes.
- `signup(name, email, password)`, `login(email, password)`, `loginWithGoogle()`, `logout()`.

Person 2 exports from `js/api.js` and defines the **recipe object**:

```js
{
  id: "52772",            // string, TheMealDB idMeal
  name: "Teriyaki Chicken Casserole",
  image: "https://...",
  category: "Chicken",
  area: "Japanese",
  instructions: "...",
  youtube: "https://...",
  ingredients: [{ name: "soy sauce", measure: "3/4 cup" }]
}
```

Person 3 exports from `js/favourites.js`: `addFavourite(recipe)`, `removeFavourite(recipeId)`, `getFavourites()`, `isFavourite(recipeId)`, `watchFavourites(callback)`.

Person 4 exports from `js/planner.js`: `addToPlan(day, meal, recipe)`, `removeFromPlan(day, meal)`, `getPlan()`, `buildShoppingList(plan)`.

Until a teammate's function is ready, write a temporary fake version in your own file and replace it later.

## Database schema (Firestore)

All personal data lives under `users/{uid}`. Recipes are not stored, only what belongs to the user. Use `serverTimestamp()` for every timestamp.

```
users/{uid}                          (Person 1)
  displayName   string
  email         string
  diets         array of string      e.g. ["vegetarian"]
  allergies     array of string
  createdAt     timestamp

users/{uid}/favourites/{recipeId}    (Person 3)   doc id = TheMealDB idMeal as a string
  recipeId      string
  name          string
  image         string
  category      string
  addedAt       timestamp

users/{uid}/mealPlan/{day}           (Person 4)   day = monday ... sunday
  breakfast     map or null          { recipeId, name, image, ingredients }
  lunch         map or null
  dinner        map or null
  updatedAt     timestamp
    ingredients = array of { name, measure }

users/{uid}/shoppingList/current     (Person 4)
  checked       array of string      ingredient names ticked off
  updatedAt     timestamp

recipes/{recipeId}/ratings/{uid}     (Person 2, optional)
  stars         number               1 to 5
  comment       string
  displayName   string
  createdAt     timestamp
```

Tell Person 1 before renaming any field, because other pages depend on the names.

## Shared UI/UX rules

- Mobile first. One column on phones, two from about 600px, three or four from about 900px.
- Use the colours, spacing and components defined in `css/base.css` and `css/components.css`. Do not invent new ones for a single page.
- Navbar on every page: logo, Recipes, Favourites, Planner, and Login / Sign up (or the user's name and Log out).
- Every screen handles loading, empty, error and success states.
- Accessibility: alt text on images, a label on every input, visible keyboard focus, and never show an error with colour alone.

## Timeline (5 weeks)

| Weeks | Goal |
| --- | --- |
| Week 1 | Setup, Firebase project, first deploy, recipe object agreed, design system started |
| Weeks 1-2 | Each person builds their happy path with stubs for the others |
| Week 3 | Finish features, then feature freeze at the end of the week |
| Week 4 | Integration and bug fixes |
| Week 5 | QA, responsive and accessibility polish, final deploy, demo preparation |
