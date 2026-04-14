import os
import sqlite3
from functools import wraps
from datetime import timedelta
from flask import Flask, render_template, session, redirect, url_for

from recipe_routes import recipe_bp
from mealplan_routes import mealplan_bp
from shopping_routes import shop_bp
from user_routes import user_bp, bcrypt

app = Flask(__name__)

# Secret key for signing session cookies in production, using an env variable
app.secret_key = os.environ.get('SECRET_KEY', 'dev-secret-change-in-production')
# Session is valid for 7 days
app.permanent_session_lifetime = timedelta(days=7)

# Initialize bcrypt with the Flask app for password hashing
bcrypt.init_app(app)

# Register blueprints
app.register_blueprint(recipe_bp)
app.register_blueprint(mealplan_bp)
app.register_blueprint(shop_bp)
app.register_blueprint(user_bp)
    
def is_valid_user():
    """ Validates the current session against the database."""
    if 'user_id' not in session:
        return False
    user_id = session.get('user_id')
    conn = sqlite3.connect('./db/mydatabase.db')
    cursor = conn.cursor()

    try:
        cursor.execute('SELECT userID FROM User WHERE userID = ?', (user_id,))
        if cursor.fetchone():
            return True
        else:
            # If the DB says they don't exist, destroy their invalid cookie
            session.pop('user_id', None)
            session.pop('username', None)
            return False
            
    except Exception as e:
        print(f"Database error during validation: {e}")
        return False
        
    finally:
        conn.close()

# Decorator function that redirects to login if no user is in the session
def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not is_valid_user():
            return redirect(url_for('index'))
        return f(*args, **kwargs)
    return decorated

@app.route('/')
def index():
    # If already logged in, go straight to dashboard
    if is_valid_user():
        return redirect(url_for('dashboard'))
    return render_template('index.html')


@app.route('/login')
def login_page():
    return render_template('login.html')


@app.route('/signup')
def signup_page():
    return render_template('signup.html')


@app.route('/dashboard')
@login_required
def dashboard():
    return render_template('dashboard.html')


@app.route('/recipes')
@login_required
def recipes():
    return render_template('recipes.html')


@app.route('/mealplan')
@login_required
def mealplan():
    return render_template('mealplan.html')


@app.route('/recipe/new')
@login_required
def recipe_form():
    return render_template('recipe_form.html')


@app.route('/profile')
@login_required
def profile():
    return render_template('profile.html')

# database initialization
def init_db():
    db_path = './db/mydatabase.db'
    schema_path = './db/schema.sql'

    # If the database file is missing, we build it using the schema
    if not os.path.exists(db_path):
        if os.path.exists(schema_path):
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()

            with open(schema_path, 'r') as f:
                cursor.executescript(f.read())
                
            conn.commit()
            conn.close()
            print("Database initialized.")
        else:
            print("Error: schema.sql not found in ./db/")

# Run the initialization check before the app starts
init_db()

if __name__ == '__main__':
    app.run(debug=True)