import sqlite3
from flask import Blueprint, request, jsonify

#Create a Blueprint object
mealplan_bp = Blueprint('recipe_bp', __name__)

def get_db_connection():
    conn = sqlite3.connect('./db/mydatabase.db')
    conn.row_factory = sqlite3.Row
    return conn

# -- CRUD (Save, Load, Update, Delete) of MealPlan --

# Update(Save and Delete) -- the corresponding js function that sends the request is assignRecipeToCell
@mealplan_bp.route('/mealplan/sync', methods=['POST'])
def save_mealplan():
    data = request.get_json()
    
    # Extract the cell coordinates and the recipe ID
    week_date = data.get('week_date')
    day = data.get('day')
    meal_type = data.get('meal_type')
    recipe_id = data.get('recipe_id') # This will be None if the user is clearing the cell

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Check if this exact cell already has a saved entry in the database
        cursor.execute('''
            SELECT mID FROM MealPlan 
            WHERE week_date = ? AND day = ? AND meal_type = ?
        ''', (week_date, day, meal_type))
        row = cursor.fetchone()

        if recipe_id is None:
            # If the frontend sent null, the user clicked "Clear". Delete the row if it exists.
            if row:
                cursor.execute('DELETE FROM MealPlan WHERE mID = ?', (row['mID'],))
        else:
            # If a recipe was selected, either update the existing cell or insert a new one
            if row:
                cursor.execute('''
                    UPDATE MealPlan SET recipeID = ? 
                    WHERE mID = ?
                ''', (recipe_id, row['mID']))
            else:
                cursor.execute('''
                    INSERT INTO MealPlan (week_date, day, meal_type, recipeID) 
                    VALUES (?, ?, ?, ?)
                ''', (week_date, day, meal_type, recipe_id))
        
        conn.commit()
        return jsonify({"status": "success"}), 200
        
    except Exception as e:
        conn.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        conn.close()

# Load -- the corresponding js func is loadRecipesFromDB
@mealplan_bp.route('/mealplan/get', methods=['GET'])
def get_mealplans():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Fetch all saved meal plan coordinates and their associated recipe IDs
        cursor.execute('SELECT week_date, day, meal_type, recipeID FROM MealPlan')
        rows = cursor.fetchall()
        
        plans_data = []
        for r in rows:
            plans_data.append({
                "week_date": r['week_date'],
                "day": r['day'],
                "meal_type": r['meal_type'],
                "recipe_id": r['recipeID']
            })
            
        return jsonify({"status": "success", "mealplans": plans_data}), 200
        
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        conn.close()
