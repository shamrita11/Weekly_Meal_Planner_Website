## Relational Schema
User (<ins>userID</ins>, username, login_id, password_hash)
<br>
Recipe (<ins>recipeID</ins>, userID, title, favorites, cook_time, instructions, image)
<br>
Ingredient (<ins>ingreID</ins>, ingredient)
<br>
Recipe_Ingredient (<ins>recipeID, ingreID</ins>, amount)
<br>
Tag (<ins>tagID</ins>, tag)
<br>
Recipe_Tag (<ins>recipeID, tagID</ins>)
<br>
MealPlan (<ins>mID</ins>, userID, week_date, day, meal_type, recipeID)
<br>
ShoppingList (<ins>itemID</ins>, userID, recipeID, ingreID, input_item, checked)

<hr>

Recipe [userID] $\subseteq$ User [userID]

Recipe_Ingredient [recipeID] $\subseteq$ Recipe [recipeID]
<br>
Recipe_Ingredient [ingreID] $\subseteq$ Ingredient [ingreID]

Recipe_Tag [recipeID] $\subseteq$ Recipe [recipeID]
<br>
Recipe_Tag [tagID] $\subseteq$ Tag [tagID]

MealPlan [userID] $\subseteq$ User [userID]
<br>
MealPlan [recipeID] $\subseteq$ Recipe [recipeID]

ShoppingList [userID] $\subseteq$ User [userID]
<br>
ShoppingList [recipeID, ingreID] $\subseteq$ Recipe_Ingredient [recipeID, ingreID]

<hr>
<br>
Note:

- All primary keys use `INTEGER PRIMARY KEY AUTOINCREMENT` to avoid rowid reuse.
- `login_id` in **User** is the **unique** identifier users log in with. `username` is their display name.
- `password_hash` in **User** stores a bcrypt-hashed password — plaintext passwords are never stored.
- `ingredient` and `tag` can only be added if there's not such in the display, i.e. these attributes should be unique to reduce redundancy.
- The attribute `image` in **Recipe** is the *filename* after being renamed by `uuid`, and the file will then be stored in `static/uploads/` folder locally.
- `checked` in **ShoppingList** indicates if it should be removed from the database. If `checked=='yes'`, it'll be displayed as a strikethrough and the tuple will be removed in the database when users refresh the page.
- All recipes, meal plans, and shopping list items are scoped to a specific user via `userID` foreign keys, ensuring data isolation between accounts.