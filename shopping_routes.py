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
        
        cursor.execute("SELECT itemID, input_item, checked FROM ShoppingList WHERE userID = ?", (uid,))
        rows = cursor.fetchall()
        
        items = [] # we want a list of dictinoary
        for r in rows:
            items.append({
                "id": r['itemID'],
                "text": r['input_item'],
                "checked": False # They will all be false since we just deleted the 'yes' ones!
            })
            
        conn.commit()
        return jsonify({"status": "success", "items": items}), 200

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