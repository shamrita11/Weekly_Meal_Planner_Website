import sqlite3
from flask import Blueprint, request, jsonify, session

shop_bp = Blueprint('shop_bp', __name__)

def get_db_connection():
    conn = sqlite3.connect('./db/mydatabase.db')
    conn.row_factory = sqlite3.Row
    return conn

def get_current_user():
    return session.get('user_id')

# ── Load Items (and clean up checked ones) ──
@shop_bp.route('/shop/get', methods=['GET'])
def get_shop_items():
    uid = get_current_user()
    if not uid:
        return jsonify({"status": "error", "message": "Not logged in."}), 401

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # delete any items marked as 'yes' when refresh
        cursor.execute("DELETE FROM ShoppingList WHERE userID = ? AND checked = 'yes'", (uid,))
        
        cursor.execute('''
            SELECT 
                MIN(sl.itemID) as itemID, 
                sl.recipeID, 
                i.ingredient,
                r.title as recipe_title,
                COUNT(sl.itemID) as multiplier
            FROM ShoppingList sl
            JOIN Ingredient i ON sl.ingreID = i.ingreID
            JOIN Recipe r ON sl.recipeID = r.recipeID
            WHERE sl.userID = ? AND sl.input_item IS NULL
            GROUP BY sl.recipeID, sl.ingreID, i.ingredient, r.title
        ''', (uid,))

        recipe_rows = cursor.fetchall()
        
        recipes_dict = {} # {recipe_id: {title, count, ingredients: [{itemID, ingredient, checked}, ...]}, ...}
                          # keep track of recipe to group the same one
        for r in recipe_rows:
            rec_id = r['recipeID']
            if rec_id not in recipes_dict:
                recipes_dict[rec_id] = {
                    "title": r['recipe_title'],
                    "count": r['multiplier'], 
                    "ingredients": []
                }

            if r['multiplier'] > recipes_dict[rec_id]['count']:
                recipes_dict[rec_id]['count'] = r['multiplier']
            
            # SQL's group by has removed the duplicate ingredients
            recipes_dict[rec_id]['ingredients'].append({
                "id": r['itemID'],
                "name": r['ingredient'],
                "checked": False
            })

        recipe_items = list(recipes_dict.values()) # [{title, count, ingredients: [{itemID, ingredient, checked}, ...]},..]

        # For custom manual input items
        cursor.execute('''
            SELECT itemID, input_item
            FROM ShoppingList
            WHERE userID = ? AND input_item IS NOT NULL
        ''', (uid,))
        custom_rows = cursor.fetchall()
        
        custom_items = []
        for cr in custom_rows:
            custom_items.append({
                "id": cr['itemID'],
                "name": cr['input_item'],
                "checked": False
            })

        conn.commit()
        return jsonify({"status": "success", 
            "recipe_items": recipe_items, 
            "custom_items": custom_items
        }), 200

    except Exception as e:
        conn.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        conn.close()

# ── Add a New Item ──
@shop_bp.route('/shop/add', methods=['POST'])
def add_shop_item():
    uid = get_current_user()
    if not uid:
        return jsonify({"status": "error", "message": "Not logged in."}), 401

    data = request.get_json()
    input_item = data.get('input_item', '').strip()

    if not input_item:
        return jsonify({"status": "error", "message": "Item cannot be empty."}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute('''
            INSERT INTO ShoppingList (userID, input_item, checked) 
            VALUES (?, ?, 'no')
        ''', (uid, input_item))
        item_id = cursor.lastrowid
        conn.commit()
        
        return jsonify({"status": "success", "id": item_id}), 201
    except Exception as e:
        conn.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        conn.close()

# ── Toggle Checked Status ──
@shop_bp.route('/shop/toggle/<int:item_id>', methods=['POST'])
def toggle_shop_item(item_id):
    uid = get_current_user()
    if not uid:
        return jsonify({"status": "error", "message": "Not logged in."}), 401

    data = request.get_json()
    is_checked = 'yes' if data.get('checked') else 'no'

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # check if this item belongs to a recipe or is a custom item
        cursor.execute('''
            SELECT recipeID, ingreID 
            FROM ShoppingList 
            WHERE itemID = ? AND userID = ?
        ''', (item_id, uid))
        row = cursor.fetchone()

        if not row:
            return jsonify({"status": "error", "message": "Item not found."}), 404

        if row['recipeID'] is not None and row['ingreID'] is not None:
            # It's a recipe ingredient, toggle all tuples that have (recipeId, ingreID)
            cursor.execute('''
                UPDATE ShoppingList SET checked = ? 
                WHERE userID = ? AND recipeID = ? AND ingreID = ? AND input_item IS NULL
            ''', (is_checked, uid, row['recipeID'], row['ingreID']))
        else:
            # It's a custom input item
            cursor.execute('''
                UPDATE ShoppingList SET checked = ? 
                WHERE itemID = ? AND userID = ?
            ''', (is_checked, item_id, uid))
            
        conn.commit()
        return jsonify({"status": "success"}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        conn.close()

# ── Clear Entire Shopping List ──
@shop_bp.route('/shop/clear', methods=['DELETE'])
def clear_shop_list():
    uid = get_current_user()
    if not uid:
        return jsonify({"status": "error", "message": "Not logged in."}), 401

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Delete all shopping list items for this user
        cursor.execute('DELETE FROM ShoppingList WHERE userID = ?', (uid,))
        conn.commit()
        
        return jsonify({"status": "success"}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        conn.close()