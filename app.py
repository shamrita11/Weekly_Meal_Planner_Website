import os
from functools import wraps
from flask import Flask, render_template, session, redirect, url_for

from recipe_routes import recipe_bp
from mealplan_routes import mealplan_bp
from user_routes import user_bp, bcrypt

app = Flask(__name__)

# Secret key for signing session cookies in production, using an env variable
app.secret_key = os.environ.get('SECRET_KEY', 'dev-secret-change-in-production')

# Initialize bcrypt with the Flask app for password hashing
bcrypt.init_app(app)

# Register blueprints
app.register_blueprint(recipe_bp)
app.register_blueprint(mealplan_bp)
app.register_blueprint(user_bp)

# Decorator function that redirects to login if no user is in the session
def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('index'))
        return f(*args, **kwargs)
    return decorated


@app.route('/')
def index():
    # If already logged in, go straight to dashboard
    if 'user_id' in session:
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


if __name__ == '__main__':
    app.run(debug=True)