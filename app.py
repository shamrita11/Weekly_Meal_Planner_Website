from flask import Flask, render_template

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html') # Welcome page

@app.route('/dashboard')
def dashboard():
    return render_template('dashboard.html') # Main page

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