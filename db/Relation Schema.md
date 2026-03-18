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
Seasoning (<ins>sID</ins>, seasoning)
<br>
Recipe_Seasoning (<ins>recipeID, sID</ins>, qty, unit)
<br>
MealPlan (<ins>mID</ins>, wID, day, mealTime, recipeID)
<br>
ShoppingList (<ins>itemID</ins>, ingreID, unit, qty, checked)

<hr>

Recipe_Ingredient [recipeID] $\subseteq$ Recipe [recipeID]
<br>
Recipe_Ingredient [ingreID] $\subseteq$ Ingredient [ingreID]

Recipe_Tag [recipeID] $\subseteq$ Recipe [recipeID]
<br>
Recipe_Tag [tagID] $\subseteq$ Tag [tagID]

Recipe_Seasoning [recipeID] $\subseteq$ Recipe [recipeID]
<br>
Recipe_Seasoning [sID] $\subseteq$ Seasoning [sID]

MealPlan [recipeID] $\subseteq$ Recipe [recipeID]

ShoppingList [ingreID] $\subseteq$ Ingredient [ingreID]

<hr>
<br>
Note for backend logic :

- `wID` in **MealPlan** is the start date of the week, which is helpful to display the meals history.
- Only ingredients will show up in ShoppingList, Seasoning is not included.
- `ingredient`, `tag` and `seasoning` can only be added if there's not such in the display, i.e. these attributes should be unique to reduce redundancy.
- The attribute `image` in **Recipe** is the *name* of the file after being renamed by `uuid`, and the file will then be stored in `static/uploads/` folder locally.
- The `qty` in **ShoppingList** should be calculated based on the amount of ingredients from all recipes of that week.
  - If users use two or more different `unit`s for the same ingredients, we will display them separately, and the qunatity will be calculated for the same unit, *e.g.* 5 lbs, 5 lbs, 5 oz Ribeye will become 10 lbs Ribeye and 5 oz Ribeye. 
  - `checked` indicates if it displays as strikethrough. When users update their weekly meal plans, if the ingredients still exist and updated quantity $\le$ the original quantity, `checked` should **remain** the same.