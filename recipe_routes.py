import sqlite3
from flask import Blueprint, request, jsonify, session

recipe_bp = Blueprint('recipe_bp', __name__)


def get_db_connection():
    conn = sqlite3.connect('./db/mydatabase.db')
    conn.row_factory = sqlite3.Row
    return conn


def get_current_user():
    """Return the logged-in user's ID, or None."""
    return session.get('user_id')


# ── Load all recipes for the current user ──
# The Corresponding js function that sends the request is loadRecipesFromDB
@recipe_bp.route('/recipe/get', methods=['GET'])
def get_recipes():
    uid = get_current_user()
    if not uid:
        return jsonify({"status": "error", "message": "Not logged in."}), 401

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Only fetch recipes belonging to this user
        cursor.execute('SELECT * FROM Recipe WHERE userID = ?', (uid,))
        recipe_rows = cursor.fetchall()

        recipes_data = []

        for r_row in recipe_rows:
            recipe_id = r_row['recipeID']

            # Grab ingredients for this recipe
            cursor.execute('''
                SELECT ri.amount, i.ingredient 
                FROM Recipe_Ingredient ri
                JOIN Ingredient i ON ri.ingreID = i.ingreID
                WHERE ri.recipeID = ?
            ''', (recipe_id,))
            ing_rows = cursor.fetchall()
            ingredients = [[row['amount'], row['ingredient']] for row in ing_rows]

            # Grab tags for this recipe
            cursor.execute('''
                SELECT t.tag 
                FROM Recipe_Tag rt
                JOIN Tag t ON rt.tagID = t.tagID
                WHERE rt.recipeID = ?
            ''', (recipe_id,))
            tag_rows = cursor.fetchall()
            tags = [row['tag'] for row in tag_rows]

            # Construct the dictionary to match the js structure
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


# ── Save a new recipe ──
# The corresponding js func is saveRecipe(), createNewRecipe
@recipe_bp.route('/recipe/save', methods=['POST'])
def save_recipe():
    uid = get_current_user()
    if not uid:
        return jsonify({"status": "error", "message": "Not logged in."}), 401

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
        # Insert into Recipe table
        cursor.execute('''
            INSERT INTO Recipe (userID, title, favorites, cook_time, instructions, image)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (uid, title, favorites, cook_time, instructions, image))
        recipe_id = cursor.lastrowid

        # Insert into Ingredient and Recipe_Ingredient tables
        # EXPECTING ingredients to be a list of lists/tuples: [['1 cup', 'rice'], ['2', 'onions']]
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

        # Insert into Tag and Recipe_Tag tables
        for t in tags:
            t = t.strip()
            if not t:
                continue
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


# ── Delete a recipe ──
# The corresponding js function is deleteRecipe
@recipe_bp.route('/recipe/delete/<int:recipe_id>', methods=['DELETE'])
def delete_recipe(recipe_id):
    uid = get_current_user()
    if not uid:
        return jsonify({"status": "error", "message": "Not logged in."}), 401

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Verify the recipe belongs to this user before deleting
        cursor.execute('SELECT recipeID FROM Recipe WHERE recipeID = ? AND userID = ?', (recipe_id, uid))
        if not cursor.fetchone():
            return jsonify({"status": "error", "message": "Recipe not found."}), 404

        # Delete references in mapping tables first to avoid Foreign Key constraint errors
        cursor.execute('DELETE FROM Recipe_Ingredient WHERE recipeID = ?', (recipe_id,))
        cursor.execute('DELETE FROM Recipe_Tag WHERE recipeID = ?', (recipe_id,))
        cursor.execute('DELETE FROM MealPlan WHERE recipeID = ?', (recipe_id,))
        # Now it's safe to delete the recipe itself
        cursor.execute('DELETE FROM Recipe WHERE recipeID = ?', (recipe_id,))

        conn.commit()
        return jsonify({"status": "success"}), 200

    except Exception as e:
        conn.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        conn.close()


# ── Update a recipe ──
# The corresponding js func is saveRecipe, updateExistingRecipe
@recipe_bp.route('/recipe/update/<int:recipe_id>', methods=['PUT'])
def update_recipe(recipe_id):
    uid = get_current_user()
    if not uid:
        return jsonify({"status": "error", "message": "Not logged in."}), 401

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
        # Verify ownership
        cursor.execute('SELECT recipeID FROM Recipe WHERE recipeID = ? AND userID = ?', (recipe_id, uid))
        if not cursor.fetchone():
            return jsonify({"status": "error", "message": "Recipe not found."}), 404

        # Update the main Recipe table
        cursor.execute('''
            UPDATE Recipe 
            SET title = ?, favorites = ?, cook_time = ?, instructions = ?, image = ?
            WHERE recipeID = ? AND userID = ?
        ''', (title, favorites, cook_time, instructions, image, recipe_id, uid))

        # Clear old ingredient and tag mappings for this recipe
        cursor.execute('DELETE FROM Recipe_Ingredient WHERE recipeID = ?', (recipe_id,))
        cursor.execute('DELETE FROM Recipe_Tag WHERE recipeID = ?', (recipe_id,))

        # Re-insert the updated ingredients
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

        # Re-insert the updated ingredients
        for t in tags:
            t = t.strip()
            if not t:
                continue
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


# ── Toggle favourite status ──
@recipe_bp.route('/recipe/toggle-fav/<int:recipe_id>', methods=['POST'])
def toggle_favourite(recipe_id):
    uid = get_current_user()
    if not uid:
        return jsonify({"status": "error", "message": "Not logged in."}), 401

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            'SELECT favorites FROM Recipe WHERE recipeID = ? AND userID = ?',
            (recipe_id, uid)
        )
        row = cursor.fetchone()
        if not row:
            return jsonify({"status": "error", "message": "Recipe not found."}), 404

        new_val = 'no' if row['favorites'] == 'yes' else 'yes'
        cursor.execute(
            'UPDATE Recipe SET favorites = ? WHERE recipeID = ? AND userID = ?',
            (new_val, recipe_id, uid)
        )
        conn.commit()

        return jsonify({
            "status": "success",
            "favourite": True if new_val == 'yes' else False
        }), 200

    except Exception as e:
        conn.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        conn.close()