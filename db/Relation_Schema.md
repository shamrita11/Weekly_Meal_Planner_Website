## Relational Schema
Recipe (<ins>recipeID</ins>, title, favorites, cook_time, instructions, image) <br>
Ingredient (<ins>ingreID</ins>, ingredient)
<br>
Recipe_Ingredient (<ins>recipeID, ingreID</ins>, qty, unit)
<br>
Tag (<ins>tagID</ins>, tag)
<br>
Recipe_Tag (<ins>recipeID, tagID</ins>)
<br>
MealPlan (<ins>mID</ins>, week_date, day, mealTime, recipeID)
<br>
ShoppingList (<ins>itemID</ins>, recipeID, ingreID, checked)

<hr>

Recipe_Ingredient [recipeID] $\subseteq$ Recipe [recipeID]
<br>
Recipe_Ingredient [ingreID] $\subseteq$ Ingredient [ingreID]

Recipe_Tag [recipeID] $\subseteq$ Recipe [recipeID]
<br>
Recipe_Tag [tagID] $\subseteq$ Tag [tagID]

MealPlan [recipeID] $\subseteq$ Recipe [recipeID]

ShoppingList [recipeID, ingreID] $\subseteq$ Recipe_Ingredient [recipeID, ingreID]

<hr>
<br>
Note for backend logic :

- `week_date` in **MealPlan** is the start date of the week, which is helpful to display the meals history.
- `day` in **MealPlan** is referred to Monday, Tuesday, ... ; `mealTime` is referred to Breakfast, Lunch, and Dinner
- `ingredient` and `tag` can only be added if there's not such in the display, i.e. these attributes should be unique to reduce redundancy.
- The attribute `image` in **Recipe** is the *name* of the file after being renamed by `uuid`, and the file will then be stored in `static/uploads/` folder locally.
- `checked` in **ShoppingList** indicates if it should be removed from the database. if `checked==yes`, the tuple will be removed. 
