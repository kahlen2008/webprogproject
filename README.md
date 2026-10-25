# Recipe Finder & Meal Planner

A web app where users search for recipes, save favourites, and plan their week of meals with an automatic shopping list.

Built with plain HTML, CSS and JavaScript. Firebase provides login (Authentication), saved data (Firestore) and hosting. Recipe data comes from [TheMealDB](https://www.themealdb.com/api.php).

## Team

| Person | Feature | Main files |
| --- | --- | --- |
| Person 1 | Accounts and profile | `login.html`, `signup.html`, `profile.html`, `js/auth.js`, `js/navbar.js`, `js/firebase-config.js`, `firestore.rules` |
| Person 2 | Recipe discovery and design system | `index.html`, `recipe.html`, `js/api.js`, `js/recipes.js`, `css/base.css`, `css/components.css` |
| Person 3 | Favourites and QA | `favourites.html`, `js/favourites.js`, `css/favourites.css` |
| Person 4 | Meal planner, shopping list, deployment | `planner.html`, `js/planner.js`, `css/planner.css`, `firebase.json`, this README |

Replace the table with your real names.

## Folder tour

```
public/            everything the browser loads (this is what gets deployed)
  *.html           one page per feature
  css/             base.css and components.css are shared, the rest belong to one page
  js/              one JavaScript file per feature, plus shared helpers
  images/          logo, icons, pictures
firestore.rules    who may read and write which data
firebase.json      Firebase Hosting settings
PROJECT_NOTES.md   the team's shared rules (read this first)
```

## Run it on your computer

JavaScript modules do not work if you double-click an HTML file. Serve the `public` folder instead:

```
npx serve public
```

Then open the address it prints (usually http://localhost:3000).

## First-time Firebase setup

1. Create a Firebase project in the Firebase console and add a Web app.
2. Copy the config object into `public/js/firebase-config.js`.
3. Enable Email/Password and Google under Authentication.
4. Create a Firestore database.
5. Install the CLI: `npm install -g firebase-tools`, then run `firebase login` and `firebase use --add` and pick your project.

## Deploy

```
firebase deploy
```

The command prints your live `web.app` address. Check that this domain is listed under Authentication > Settings > Authorized domains.

## Git workflow

- Never work directly on `main`.
- Make your own branch: `git checkout -b p1-auth` (or `p2-recipes`, `p3-favourites`, `p4-planner`).
- Commit small and often, then push and open a pull request.
- Another teammate reviews and merges. Pull `main` often so your branch stays up to date.
