import sqlite3
from flask import Blueprint, request, jsonify

#Create a Blueprint object
recipe_bp = Blueprint('recipe_bp', __name__)

def get_db_connection():
    conn = sqlite3.connect('./db/mydatabase.db')
    conn.row_factory = sqlite3.Row
    return conn

# -- CRUD (Save, Load, Update, Delete) of 
# tables{Recipe, Ingreident, Recipe_Ingredient, Tag, Recipe_Tag} --

# Load -- Corresponding js function is loadRecipesFromDB
@recipe_bp.route('/recipe/get', methods=['GET'])
def get_recipes():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # 1. Grab all recipes
        cursor.execute('SELECT * FROM Recipe')
        recipe_rows = cursor.fetchall()
        
        recipes_data = []
        
        for r_row in recipe_rows:
            recipe_id = r_row['recipeID']
            
            # 2. Grab ingredients for this specific recipe
            # Joining Recipe_Ingredient and Ingredient to get both the amount and the name
            cursor.execute('''
                SELECT ri.amount, i.ingredient 
                FROM Recipe_Ingredient ri
                JOIN Ingredient i ON ri.ingreID = i.ingreID
                WHERE ri.recipeID = ?
            ''', (recipe_id,))
            ing_rows = cursor.fetchall()
            
            # Format as the expected list of arrays: [[amount, name], ...]
            ingredients = [[row['amount'], row['ingredient']] for row in ing_rows]
            
            # 3. Grab tags for this specific recipe
            cursor.execute('''
                SELECT t.tag 
                FROM Recipe_Tag rt
                JOIN Tag t ON rt.tagID = t.tagID
                WHERE rt.recipeID = ?
            ''', (recipe_id,))
            tag_rows = cursor.fetchall()
            tags = [row['tag'] for row in tag_rows]
            
            # 4. Construct the dictionary to match the frontend JavaScript structure
            recipes_data.append({
                "id": recipe_id,
                "name": r_row['title'],
                "ingredients": ingredients,
                "time": r_row['cook_time'],
                "tags": tags,
                "instructions": r_row['instructions'],
                "favourite": True if r_row['favorites'] == 'yes' else False,
                "image": r_row['image']
            })
            
        return jsonify({"status": "success", "recipes": recipes_data}), 200
        
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        conn.close()

# Save -- Corresponding js func is saveRecipe(), createNewRecipe
@recipe_bp.route('/recipe/save', methods=['POST'])
def save_recipe():
    data = request.get_json()
    
    title = data.get('name')
    ingredients = data.get('ingredients', [])
    cook_time = data.get('time')
    tags = data.get('tags', [])
    instructions = data.get('instructions')
    if data.get('favoriate'):
        favorites = 'yes'
    else:
        favorites = 'no'
        
    image = data.get('image')

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # 1. Insert into Recipe table
        cursor.execute('''
            INSERT INTO Recipe (title, favorites, cook_time, instructions, image)
            VALUES (?, ?, ?, ?, ?)
        ''', (title, favorites, cook_time, instructions, image))
        recipe_id = cursor.lastrowid # Get the newly generated recipeID

        # 2. Insert into Ingredient and Recipe_Ingredient tables
        # EXPECTING ingredients to be a list of lists/tuples: [['1 cup', 'rice'], ['2', 'onions']]
        for ing_amount, ing_name in ingredients:
            ing_name = ing_name.strip()

            if not ing_name:
                continue # Skip empty ingredients

            # Check if ingredient already exists to avoid UNIQUE constraint errors
            cursor.execute('SELECT ingreID FROM Ingredient WHERE ingredient = ?', (ing_name,))
            row = cursor.fetchone()
            if row:
                ing_id = row['ingreID']
            else:
                cursor.execute('INSERT INTO Ingredient (ingredient) VALUES (?)', (ing_name,))
                ing_id = cursor.lastrowid
            
            # Map the recipe to the ingredient using the specific amount
            cursor.execute('''
                INSERT INTO Recipe_Ingredient (recipeID, ingreID, amount) 
                VALUES (?, ?, ?)
            ''', (recipe_id, ing_id, ing_amount))

        # 3. Insert into Tag and Recipe_Tag tables
        for t in tags:
            cursor.execute('SELECT tagID FROM Tag WHERE tag = ?', (t,))
            row = cursor.fetchone()
            if row:
                tag_id = row['tagID']
            else:
                cursor.execute('INSERT INTO Tag (tag) VALUES (?)', (t,))
                tag_id = cursor.lastrowid
            
            cursor.execute('INSERT INTO Recipe_Tag (recipeID, tagID) VALUES (?, ?)', (recipe_id, tag_id))

        conn.commit()
        return jsonify({"status": "success", "recipeID": recipe_id}), 201
    except Exception as e:
        conn.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        conn.close()

# Delete -- Corresponding js function is deleteRecipe
@recipe_bp.route('/recipe/delete/<int:recipe_id>', methods=['DELETE'])
def delete_recipe(recipe_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # 1. Delete references in mapping tables first to avoid Foreign Key constraint errors
        cursor.execute('DELETE FROM Recipe_Ingredient WHERE recipeID = ?', (recipe_id,))
        cursor.execute('DELETE FROM Recipe_Tag WHERE recipeID = ?', (recipe_id,))
        cursor.execute('DELETE FROM MealPlan WHERE recipeID = ?', (recipe_id,))
        
        # 2. Now it is safe to delete the recipe itself
        cursor.execute('DELETE FROM Recipe WHERE recipeID = ?', (recipe_id,))
        
        conn.commit()
        return jsonify({"status": "success"}), 200
        
    except Exception as e:
        conn.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        conn.close()

# Update -- The corresponding js func is saveRecipe, updateExistingRecipe
@recipe_bp.route('/recipe/update/<int:recipe_id>', methods=['PUT'])
def update_recipe(recipe_id):
    data = request.get_json()
    
    title = data.get('name')
    ingredients = data.get('ingredients', [])
    cook_time = data.get('time')
    tags = data.get('tags', [])
    instructions = data.get('instructions')
    favorites = 'yes' if data.get('favourite') else 'no'
    image = data.get('image')

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # 1. Update the main Recipe table
        cursor.execute('''
            UPDATE Recipe 
            SET title = ?, favorites = ?, cook_time = ?, instructions = ?, image = ?
            WHERE recipeID = ?
        ''', (title, favorites, cook_time, instructions, image, recipe_id))

        # 2. Clear old ingredient and tag mappings for this recipe
        cursor.execute('DELETE FROM Recipe_Ingredient WHERE recipeID = ?', (recipe_id,))
        cursor.execute('DELETE FROM Recipe_Tag WHERE recipeID = ?', (recipe_id,))

        # 3. Re-insert the updated ingredients
        for ing_amount, ing_name in ingredients:
            ing_name = ing_name.strip()
            if not ing_name:
                continue

            cursor.execute('SELECT ingreID FROM Ingredient WHERE ingredient = ?', (ing_name,))
            row = cursor.fetchone()
            if row:
                ing_id = row['ingreID']
            else:
                cursor.execute('INSERT INTO Ingredient (ingredient) VALUES (?)', (ing_name,))
                ing_id = cursor.lastrowid
            
            cursor.execute('''
                INSERT INTO Recipe_Ingredient (recipeID, ingreID, amount) 
                VALUES (?, ?, ?)
            ''', (recipe_id, ing_id, ing_amount))

        # 4. Re-insert the updated tags
        for t in tags:
            cursor.execute('SELECT tagID FROM Tag WHERE tag = ?', (t,))
            row = cursor.fetchone()
            if row:
                tag_id = row['tagID']
            else:
                cursor.execute('INSERT INTO Tag (tag) VALUES (?)', (t,))
                tag_id = cursor.lastrowid
            
            cursor.execute('INSERT INTO Recipe_Tag (recipeID, tagID) VALUES (?, ?)', (recipe_id, tag_id))

        conn.commit()
        return jsonify({"status": "success"}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        conn.close()
