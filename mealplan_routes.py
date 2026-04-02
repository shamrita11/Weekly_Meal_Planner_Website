import sqlite3
from flask import Blueprint, request, jsonify, session

mealplan_bp = Blueprint('mealplan_bp', __name__)


def get_db_connection():
    conn = sqlite3.connect('./db/mydatabase.db')
    conn.row_factory = sqlite3.Row
    return conn


def get_current_user():
    return session.get('user_id')


# ── Save / Update / Clear a single meal plan cell ──
# The corresponding js function that sends the request is assignRecipeToCell
@mealplan_bp.route('/mealplan/sync', methods=['POST'])
def save_mealplan():
    uid = get_current_user()
    if not uid:
        return jsonify({"status": "error", "message": "Not logged in."}), 401

    data = request.get_json()
    week_date = data.get('week_date')
    day = data.get('day')
    meal_type = data.get('meal_type')
    recipe_id = data.get('recipe_id') # This will be None if the user is clearing the cell

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Check if this cell already exists for this user
        cursor.execute('''
            SELECT mID FROM MealPlan 
            WHERE userID = ? AND week_date = ? AND day = ? AND meal_type = ?
        ''', (uid, week_date, day, meal_type))
        row = cursor.fetchone()

        if recipe_id is None:
            # If the frontend sent null, the user clicked "Clear". Delete the row if it exists.
            if row:
                cursor.execute('DELETE FROM MealPlan WHERE mID = ?', (row['mID'],))
        else:
            # If a recipe was selected, either update the existing cell or insert a new one
            if row:
                cursor.execute(
                    'UPDATE MealPlan SET recipeID = ? WHERE mID = ?',
                    (recipe_id, row['mID'])
                )
            else:
                cursor.execute('''
                    INSERT INTO MealPlan (userID, week_date, day, meal_type, recipeID) 
                    VALUES (?, ?, ?, ?, ?)
                ''', (uid, week_date, day, meal_type, recipe_id))

        conn.commit()
        return jsonify({"status": "success"}), 200

    except Exception as e:
        conn.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        conn.close()


# ── Load all meal plan entries for the current user ──
# The corresponding js func is loadRecipesFromDB
@mealplan_bp.route('/mealplan/get', methods=['GET'])
def get_mealplans():
    uid = get_current_user()
    if not uid:
        return jsonify({"status": "error", "message": "Not logged in."}), 401

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            'SELECT week_date, day, meal_type, recipeID FROM MealPlan WHERE userID = ?',
            (uid,)
        )
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
