import sqlite3
from flask import Blueprint, request, jsonify, session
from datetime import datetime, date, timedelta

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

    # Determine if the edit is for a past week
    try:
        today = date.today()
        current_monday = today - timedelta(days=today.weekday())
        plan_monday = datetime.strptime(week_date, '%Y-%m-%d').date()
        
        # If the plan's Monday is before this week's Monday, it's in the past
        is_past_week = plan_monday < current_monday
    except (ValueError, TypeError):
        is_past_week = False

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Check what is currently sitting in this cell
        cursor.execute('''
            SELECT mID, recipeID FROM MealPlan 
            WHERE userID = ? AND week_date = ? AND day = ? AND meal_type = ?
        ''', (uid, week_date, day, meal_type))
        row = cursor.fetchone()
        
        old_recipe_id = row['recipeID'] if row else None
        # If they assign the exact same recipe back and forth, do nothing to ensure
        # the consistency of the shopping list
        if old_recipe_id == recipe_id:
            return jsonify({"status": "success"}), 200

        # -- Remove old recipe's ingre from shopping list--
        if old_recipe_id and not is_past_week:
            cursor.execute('SELECT ingreID FROM Recipe_Ingredient WHERE recipeID = ?', (old_recipe_id,))
            old_ings = cursor.fetchall()
            
            for ing in old_ings:
                cursor.execute('''
                    DELETE FROM ShoppingList 
                    WHERE itemID = (
                        SELECT itemID FROM ShoppingList 
                        WHERE userID = ? AND recipeID = ? AND ingreID = ?
                        LIMIT 1
                    )
                ''', (uid, old_recipe_id, ing['ingreID']))
        
        # -- Update the MealPlan grid --
        if recipe_id is None:
            # User clicked clear
            if row:
                cursor.execute('DELETE FROM MealPlan WHERE mID = ?', (row['mID'],))
        else:
            # User assigned a new recipe
            if row:
                cursor.execute('UPDATE MealPlan SET recipeID = ? WHERE mID = ?', (recipe_id, row['mID']))
            else:
                cursor.execute('''
                    INSERT INTO MealPlan (userID, week_date, day, meal_type, recipeID) 
                    VALUES (?, ?, ?, ?, ?)
                ''', (uid, week_date, day, meal_type, recipe_id))

        # -- Add new ingredients to shopping list --
        if recipe_id is not None and not is_past_week:
            cursor.execute('SELECT ingreID FROM Recipe_Ingredient WHERE recipeID = ?', (recipe_id,))
            new_ings = cursor.fetchall()
            
            for ing in new_ings:
                cursor.execute('''
                    INSERT INTO ShoppingList (userID, recipeID, ingreID, input_item, checked) 
                    VALUES (?, ?, ?, NULL, 'no')
                ''', (uid, recipe_id, ing['ingreID']))

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
