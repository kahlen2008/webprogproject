# Team 3: RecipePlan project proposal

K0126002 Web Programming, Fall 2026 · Gachon University

Open [`index.html`](index.html) for the video, the slides and the team. The same proposal is written out below and in the [main README](../../README.md#-project-proposal).

## Who is responsible for what

- **Kahlen Ong (202699471):** sign up, login and Google sign-in, password rules, diet and allergy onboarding, profile page, diet and allergy warnings, language switcher, Firestore security rules
- **Shrestha Puja (202537250):** recipe search and filters, TheMealDB connection, recipe detail page, shared design
- **Sunar Roshani (202537197):** favourites, star ratings and comments, testing
- **Aale Aaditi (202537195):** weekly meal planner, shopping list, deployment, README

## Project concept

**RecipePlan** is a recipe finder and weekly meal planner for home cooks. A user creates an account, tells the site their diet and allergies once, searches thousands of recipes, saves favourites, plans a week of meals and gets one combined shopping list. Everything is tied to the account, so it is available on a phone, a tablet or a laptop.

The recipes come from TheMealDB. The site adds the parts that service does not have: accounts, preferences, warnings, saved recipes, a planner and a shopping list.

## The problem it solves

- **Deciding what to eat takes effort.** Recipes are spread across many sites and apps, so people search, compare and forget what they found. RecipePlan gives one place to search, save and revisit recipes.
- **Diets and allergies make browsing slower and riskier.** Someone who avoids peanuts, dairy or meat has to read every ingredient list by hand. RecipePlan stores those preferences once and flags or hides recipes that conflict with them. The warnings come from keywords in ingredient names, so they are a helper and not a safety guarantee, and the site says so.
- **Planning and shopping are usually separate chores.** People plan meals in one place and write a shopping list in another, and often miss items or buy duplicates. RecipePlan builds one merged list from the weekly plan.
- **Notes and bookmarks stay on one device.** Accounts keep favourites and plans available everywhere.

## Target users

People who cook at home: students, busy workers, and households with dietary needs or allergies. They want to decide quickly what to cook, avoid ingredients they cannot eat, and shop once for the week.

## Core features

| Feature | What it does | Priority |
| --- | --- | --- |
| Accounts and onboarding | Sign up and log in with email or Google. Passwords need 8+ characters, a number and a special character. After sign-up, a two-step page asks for diet, then allergies. | MVP |
| Recipe search and filters | Search TheMealDB by name, filter by category, and open a recipe page with ingredients and instructions. | MVP |
| Diet and allergy warnings | Badges and banners on recipes that clash with the user's profile, an option to hide flagged recipes, and a confirm prompt before adding one to the planner. | MVP |
| Favourites | Save a recipe with a heart button and see all saved recipes on a favourites page. | MVP |
| Weekly meal planner and shopping list | Plan breakfast, lunch and dinner for seven days, then get one combined shopping list with checkboxes and a print view. | MVP |
| Language switcher | Use the site in 130+ languages. Non-English searches are translated to English before they query TheMealDB. | Bonus |
| Ratings and comments | Star ratings and comments on each recipe. | Bonus |
| Serving size scaler | Change the number of servings and the ingredient amounts update. | Bonus |
| More filters | Filter by cuisine, diet and cooking time. | Bonus |

## Progress so far (Nov 2)

**Built:** accounts and Google sign-in, the two-step onboarding, the profile page, recipe search with category filters, diet and allergy warnings, a favourites page, the weekly planner with a recipe picker, and the language switcher.

**Still to do:** saving favourites and the weekly plan to Firestore so they sync across devices, building the shopping list from the plan, ratings and comments, and the serving size scaler.

## Technology stack

- **HTML, CSS and JavaScript:** plain HTML and ES-module JavaScript, with no framework or build step.
- **Styling:** Tailwind CSS v3 from the CDN, with Inter and Outfit from Google Fonts.
- **External API:** [TheMealDB](https://www.themealdb.com/api.php), base URL `https://www.themealdb.com/api/json/v1/1`.
- **Services:** Firebase Authentication for accounts, Cloud Firestore for each user's data, and a Google Translate engine for the language switcher.
- **Hosting:** GitHub Pages, deployed from the `public/` folder by a GitHub Actions workflow.
- **Repository:** [github.com/kahlen2008/webprogproject](https://github.com/kahlen2008/webprogproject), with a `main` branch for the stable version and a `dev` branch for daily work.

## UI wireframes

The slides show two key screens.

- **Homepage:** a search bar at the top, category chips below it, and the results as a grid of recipe cards. Each card has a photo, the recipe name, a heart button and an allergy warning when needed.
- **Weekly planner:** a table with the seven days as rows and Breakfast, Lunch and Dinner as columns. Each cell holds a recipe or an add button. The shopping list sits underneath with a checkbox for each item.

## Project timeline

| Week | Dates | Goal |
| --- | --- | --- |
| 10 | Nov 3 to Nov 9 | Finalise the design, connect the API and Firebase, and set up the page structure |
| 11 | Nov 10 to Nov 16 | Build the core features: accounts, onboarding, search, favourites and the planner |
| 12 | Nov 17 to Nov 23 | Finish all MVP features, add the shopping list, and start polishing |
| 13 | Nov 24 to Nov 30 | Code review, bug fixing, responsive and accessibility checks, and preparing the presentation |
| 14 | Dec 1 to Dec 7 | Final presentation and live demo |

## Repository setup

The repository has a README, a `.gitignore` that excludes `.env` files, all four members as collaborators, and a `main` and `dev` branch workflow. Aale merges tested `dev` work into `main`.
