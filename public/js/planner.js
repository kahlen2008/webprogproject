// Meal planner and shopping list. Owner: Person 4.
// Data lives in Firestore at:  users/{uid}/mealPlan/{day}   (day = "monday" ... "sunday")
// Each day document has breakfast, lunch and dinner. A slot is null or
//   { recipeId, name, image, ingredients: [{ name, measure }] }
// Checked shopping items are saved at:  users/{uid}/shoppingList/current  ({ checked: [...] })
//
// Other people import these functions, so keep the names exactly as they are.

export const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
export const MEALS = ["breakfast", "lunch", "dinner"];

// Puts a recipe into one slot, for example addToPlan("tuesday", "dinner", recipe).
export async function addToPlan(day, meal, recipe) {
  // TODO: setDoc(doc(db, "users", uid, "mealPlan", day), { [meal]: {...}, updatedAt: serverTimestamp() }, { merge: true })
}

// Empties one slot.
export async function removeFromPlan(day, meal) {
  // TODO
}

// Returns the whole week as an object: { monday: { breakfast, lunch, dinner }, ... }
export async function getPlan() {
  // TODO
  return {};
}

// Takes the plan and returns a combined list: [{ name: "chicken", amounts: ["2 cups", "1 cup"] }, ...]
// Merge duplicates by ingredient name, ignoring upper/lower case.
export function buildShoppingList(plan) {
  // TODO
  return [];
}

// ---------- Planner page ----------
// TODO (Person 4): 7-column grid, "Add to meal plan" dialog, shopping list with checkboxes,
// print button, and a one-day-at-a-time view on phones.
