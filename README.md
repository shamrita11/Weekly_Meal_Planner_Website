# Weekly Meal Planner

A full-stack web application designed to help users organize their favorite recipes, generate weekly meal plans, and automatically create dynamic shopping lists based on the ingredients needed for the week.

## Live Demo
You can access and use the live version of this web application here: 
**[https://6beaming.pythonanywhere.com/](https://6beaming.pythonanywhere.com/)**

> **Note on Hosting (Best Before Date):**  This website is hosted on PythonAnywhere's free tier. To keep the website active and free, the hosting requires a manual renewal. I need to log in at least once every month and click the "Run until 1 month from today" button on the dashboard. **For long-term use, we recommend cloning this project and running it locally on your machine.**

## Features
* **User Authentication:** Secure sign-up and login system using `Flask-Bcrypt` for password hashing and session management.
* **Recipe Management:** Create, edit, delete, and favorite recipes. Supports image uploads, ingredient lists, instructions, and custom tags.
* **Interactive Meal Planning:** A dynamic weekly grid system where users can assign saved recipes to specific days and meals (Breakfast, Lunch, Dinner).
* **Automated Shopping List:** Ingredients from the meal plan are automatically aggregated into a shopping list. Consolidates duplicate ingredients and allows for custom item additions.
* **Responsive UI:** Clean interface with a dark/light mode toggle.

## Tech Stack
* **Backend:** Python, Flask
* **Database:** SQLite3 (Local)
* **Frontend:** HTML, CSS, JavaScript
* **Authentication:** Flask-Bcrypt

## Local Installation & Setup

If you would like to download and run this project locally on your own machine, follow these steps:

1. **Download the Project**

    Clone this repository or download the ZIP file and extract it to your desired folder.
   ```bash
   cd Weekly_Meal_Planner_Website
   ```

2. **Install Necessary Packages**

    Install Flask and Flask-Bcrypt using pip.
    ```bash
    pip install Flask Flask-Bcrypt
    ```

3. **Run the Application**

    Start the Flask local development server. The database (mydatabase.db) will be automatically generated in the ./db/ folder the first time the app runs.
    ```bash
    python app.py
    ```

4. **Access the Website**

    Open your web browser and navigate to: http://127.0.0.1:5000