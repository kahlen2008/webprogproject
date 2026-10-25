# Recipe Finder & Meal Planner: Team Use Cases

Oct 26, 2026 · @k

## Overview

Each of the four team members owns one feature end to end, covering the HTML and Tailwind CSS interface, the JavaScript logic, and the Firebase or API side. The site is a recipe finder and meal planner built with HTML, Tailwind CSS and plain JavaScript, using Firebase Auth and Firestore, TheMealDB for recipe data, and Firebase Hosting for deployment.

## Folder structure

Every page gets its own HTML and JS file, with styling done by Tailwind classes in the HTML, so each person mostly works in their own files and rarely touches anyone else's. Everything the browser needs lives in `public/`, which is also the folder Firebase Hosting deploys.

```
recipe-planner/
├── README.md               how to run and deploy (Person 4)
├── firebase.json           hosting settings (Person 4)
├── firestore.rules         security rules (Person 1)
└── public/
    ├── index.html          home, search and results (Person 2)
    ├── recipe.html         recipe detail (Person 2)
    ├── login.html          log in (Person 1)
    ├── signup.html         sign up (Person 1)
    ├── profile.html        profile and diet preferences (Person 1)
    ├── favourites.html     saved recipes (Person 3)
    ├── planner.html        weekly plan and shopping list (Person 4)
    ├── js/
    │   ├── firebase-config.js  Firebase setup, imported by all (Person 1)
    │   ├── auth.js             login, signup, logout (Person 1)
    │   ├── navbar.js           navbar that reacts to login state (Person 1)
    │   ├── api.js              TheMealDB requests (Person 2)
    │   ├── recipes.js          search, filters, detail page (Person 2)
    │   ├── ui.js               shared Tailwind class sets and components (Person 2)
    │   ├── favourites.js       (Person 3)
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
  diets         array of string      ["vegetarian"]
  allergies     array of string      ["peanuts"]
  createdAt     timestamp

users/{uid}/favourites/{recipeId}    (Person 3)
  recipeId      string               "52772"  (TheMealDB idMeal, same as doc id)
  name          string               "Teriyaki Chicken Casserole"
  image         string               image URL
  category      string               "Chicken"
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

recipes/{recipeId}/ratings/{uid}     (Person 2, optional)
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

One rule to add for the optional ratings, next to the existing `users/{userId}` rule in `firestore.rules`. Ratings are readable by anyone, but writable only by their own author:

```
match /recipes/{recipeId}/ratings/{uid} {
  allow read: if true;
  allow write: if request.auth != null && request.auth.uid == uid;
}
```

Person 1 keeps `firestore.rules`, so the others should send any schema change to Person 1 before changing a field name, because renamed fields break the other pages.

## Person 1: Accounts and profile

Person 1 owns everything about who the user is, from the login screens to the Firebase Auth setup behind them.

- **Frontend:** Signup and login pages, form validation, a navbar that changes when the user is logged in, and a profile page.
- **Backend:** Firebase Auth with email/password and Google sign-in, password reset, route protection, and a `users/{uid}` Firestore document for display name and dietary preferences (vegetarian, allergies, etc.).
- **Extra:** Owns `firebase-config.js` and the Firestore security rules for the whole project.

**Happy path**

1. A new visitor clicks Sign up in the navbar.
2. They enter name, email and password; each field validates as they type.
3. They submit. Firebase Auth creates the account and a `users/{uid}` document is saved.
4. They land on the home page, and the navbar now shows their name and a Log out button.
5. On a later visit they log in with email/password or Google and return to the page they came from.
6. On the Profile page they tick dietary preferences and save, and a confirmation toast appears.

**Requirements**

- **Must:** Email/password signup, login and logout. Inline validation (valid email, password of at least 6 characters, which is Firebase's minimum). Friendly error messages for wrong password and email already in use. Logged-out users are redirected away from Favourites, Planner and Profile. Export `getCurrentUser()` and `onAuthChange(callback)` for the rest of the team.
- **Should:** Google sign-in, password reset by email, and a loading state on the submit buttons.
- **Nice to have:** Saved dietary preferences pre-select the diet filter on the recipes page.

**UI/UX**

- Login and signup are a centred card (about 400px wide) with labels above fields and errors in text beneath them.
- A show/hide password toggle, a full-width primary button, a "Continue with Google" button under an "or" divider, and a link to switch between login and signup.
- The navbar shows Login / Sign up when logged out, and the user's initial and name with a small menu (Profile, Log out) when logged in.
- Profile shows dietary preferences as selectable chips, with a Save button that stays disabled until something changes.

## Person 2: Recipe discovery

Person 2 owns how users find recipes, from the search bar to the data fetched from TheMealDB.

- **Frontend:** Homepage, search bar, filters (category, ingredient, diet), recipe cards, recipe detail page, and the serving size scaler.
- **Backend:** The API layer that fetches from TheMealDB, with error handling and caching in `sessionStorage`. For a Firestore piece, add user ratings or comments stored per recipe.
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
- **Nice to have:** A "Surprise me" random recipe button, and star ratings stored in Firestore per recipe.
- **Hand-off:** Agree the recipe object shape in week 1 (id, name, image, category, area, ingredients, instructions) and document it at the top of `api.js`.

**UI/UX**

- Home: a large hero with the search bar centred, category chips directly below it, then the card grid.
- Recipe card: photo on top, name, a small category tag, and an empty heart slot in the corner that Person 3 wires up.
- Recipe page: on desktop, photo and ingredients on the left and numbered steps on the right. On phones everything stacks in one column.
- Search keeps the typed text and active filters visible, and shows a clear "Clear filters" button.

## Person 3: Favourites

Person 3 owns saving and revisiting recipes, with Firestore keeping favourites in sync across devices.

- **Frontend:** A heart/favourite button on every recipe card, a favourites page, sorting and filtering of favourites, and empty states.
- **Backend:** Firestore CRUD at `users/{uid}/favourites/{recipeId}`, real-time updates with `onSnapshot`, and syncing the button state when the user logs in.
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

- **Must:** Add and remove recipes by day and meal. Persist the plan in Firestore. Build the shopping list from planned recipes and merge duplicates (match ingredient names ignoring case; add amounts when the unit is the same and list them separately when it is not). Deploy to Firebase Hosting.
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
- **Naming and folder structure:** Agree on conventions up front (including the Tailwind colours and sizes listed above), and use one shared Git repo with feature branches.

## Timeline

Features freeze on Nov 15, the end of week 3, so the last two weeks go to integration and deployment.

&#91;embedded content: 5-week plan · 4 feature tracks, 1 freeze\]

Persons 1 and 2 start first because Persons 3 and 4 depend on auth and the recipe data shape. Deploy to Firebase Hosting early in the final week so there is time to fix anything that only breaks in production.
