from flask import Flask, render_template

app = Flask(__name__)

# Hardcoded data simulating a database for now
mock_recipes = [
    {
        "id": 1,
        "name": "French Toast",
        "ingredients": ["2 slices bread", "1 egg", "¼ cup milk", "1 tsp sugar", "Berries to serve"],
        "instructions": "1. Whisk egg, milk, and sugar.\n2. Dip bread.\n3. Fry in butter 2 min per side.\n4. Serve with berries.",
        "time": "15 minutes",
        "tags": ["breakfast", "sweet", "bread", "egg"],
        "favourite": True,
        "image": None
    },
    {
        "id": 2,
        "name": "Garden Salad",
        "ingredients": ["2 cups lettuce", "½ cup cherry tomatoes", "¼ cucumber", "Dressing"],
        "instructions": "1. Wash and chop veggies.\n2. Toss together.\n3. Drizzle dressing.",
        "time": "10 minutes",
        "tags": ["lunch", "salad", "healthy", "vegetarian"],
        "favourite": True,
        "image": "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=300&q=80"
    }
]

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/dashboard')
def dashboard():
    # Pass the recipes list to the template
    return render_template('dashboard.html', recipes=mock_recipes)

@app.route('/recipes')
def recipes():
    return render_template('recipes.html', recipes=mock_recipes)

@app.route('/mealplan')
def mealplan():
    return render_template('mealplan.html', recipes=mock_recipes)

@app.route('/recipe/new')
def recipe_form():
    return render_template('recipe_form.html')

@app.route('/profile')
def profile():
    return render_template('profile.html')

if __name__ == '__main__':
    app.run(debug=True)