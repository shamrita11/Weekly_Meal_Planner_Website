from flask import Flask, render_template
from recipe_routes import recipe_bp 

app = Flask(__name__)

# Register the blueprint
app.register_blueprint(recipe_bp)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/dashboard')
def dashboard():
    return render_template('dashboard.html')

@app.route('/recipes')
def recipes():
    return render_template('recipes.html')

@app.route('/mealplan')
def mealplan():
    return render_template('mealplan.html')

@app.route('/recipe/new')
def recipe_form():
    return render_template('recipe_form.html')

@app.route('/profile')
def profile():
    return render_template('profile.html')

if __name__ == '__main__':
    app.run(debug=True)