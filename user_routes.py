import sqlite3
from flask import Blueprint, request, jsonify, session
from flask_bcrypt import Bcrypt

user_bp = Blueprint('user_bp', __name__)
bcrypt = Bcrypt()


def get_db_connection():
    conn = sqlite3.connect('./db/mydatabase.db')
    conn.row_factory = sqlite3.Row
    return conn


# ── SIGNUP ──
@user_bp.route('/auth/signup', methods=['POST'])
def signup():
    data = request.get_json()
    username = data.get('username', '').strip()
    login_id = data.get('login_id', '').strip()
    password = data.get('password', '').strip()

    if not username or not login_id or not password:
        return jsonify({"status": "error", "message": "All fields are required."}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Check if login_id already taken — parameterised query prevents SQL injection
        cursor.execute('SELECT userID FROM User WHERE login_id = ?', (login_id,))
        if cursor.fetchone():
            return jsonify({"status": "error", "message": "That User ID is already taken."}), 409

        # Hash the password with bcrypt before storing — never store plaintext
        hashed = bcrypt.generate_password_hash(password).decode('utf-8')

        cursor.execute(
            'INSERT INTO User (username, login_id, password_hash) VALUES (?, ?, ?)',
            (username, login_id, hashed)
        )
        conn.commit()

        # Automatically log in the new user
        session['user_id'] = cursor.lastrowid
        session['username'] = username

        return jsonify({"status": "success"}), 201

    except Exception as e:
        conn.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        conn.close()


# ── LOGIN ──
@user_bp.route('/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    login_id = data.get('login_id', '').strip()
    password = data.get('password', '').strip()

    if not login_id or not password:
        return jsonify({"status": "error", "message": "Both fields are required."}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Parameterised query — safe from SQL injection
        cursor.execute(
            'SELECT userID, username, password_hash FROM User WHERE login_id = ?',
            (login_id,)
        )
        user = cursor.fetchone()

        if not user or not bcrypt.check_password_hash(user['password_hash'], password):
            return jsonify({"status": "error", "message": "Invalid User ID or password."}), 401

        # Store user info in the session cookie
        session['user_id'] = user['userID']
        session['username'] = user['username']

        return jsonify({"status": "success"}), 200

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        conn.close()


# ── LOGOUT ──
@user_bp.route('/auth/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({"status": "success"}), 200


# ── GET PROFILE ──
@user_bp.route('/auth/profile', methods=['GET'])
def get_profile():
    uid = session.get('user_id')
    if not uid:
        return jsonify({"status": "error", "message": "Not logged in."}), 401

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            'SELECT username, login_id FROM User WHERE userID = ?', (uid,)
        )
        user = cursor.fetchone()
        if not user:
            return jsonify({"status": "error", "message": "User not found."}), 404

        # Count recipes and favourites for this user
        cursor.execute('SELECT COUNT(*) as cnt FROM Recipe WHERE userID = ?', (uid,))
        recipe_count = cursor.fetchone()['cnt']

        cursor.execute(
            "SELECT COUNT(*) as cnt FROM Recipe WHERE userID = ? AND favorites = 'yes'",
            (uid,)
        )
        fav_count = cursor.fetchone()['cnt']

        return jsonify({
            "status": "success",
            "username": user['username'],
            "login_id": user['login_id'],
            "recipe_count": recipe_count,
            "fav_count": fav_count
        }), 200

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        conn.close()


# ── CHANGE PASSWORD ──
@user_bp.route('/auth/change-password', methods=['POST'])
def change_password():
    uid = session.get('user_id')
    if not uid:
        return jsonify({"status": "error", "message": "Not logged in."}), 401

    data = request.get_json()
    current_pw = data.get('current_password', '').strip()
    new_pw = data.get('new_password', '').strip()

    if not current_pw or not new_pw:
        return jsonify({"status": "error", "message": "Both fields are required."}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute('SELECT password_hash FROM User WHERE userID = ?', (uid,))
        user = cursor.fetchone()

        if not user or not bcrypt.check_password_hash(user['password_hash'], current_pw):
            return jsonify({"status": "error", "message": "Current password is incorrect."}), 401

        new_hash = bcrypt.generate_password_hash(new_pw).decode('utf-8')
        cursor.execute(
            'UPDATE User SET password_hash = ? WHERE userID = ?',
            (new_hash, uid)
        )
        conn.commit()

        return jsonify({"status": "success"}), 200

    except Exception as e:
        conn.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        conn.close()