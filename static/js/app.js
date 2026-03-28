// ══════════════════════════════════════════
//  WEEKLY MEAL PLANNER — app.js
// ══════════════════════════════════════════

// ── DATA FROM DATABASE ──
let recipes = [];

// mealPlans[weekKey][day][meal] = recipeId
// weekKey = ISO Monday date string e.g. "2026-03-16"
let mealPlans = {};

// Current week offsets (0 = this week, -1 = last week, +1 = next week, etc.)
let mainWeekOffset = 0;
let mpWeekOffset = 0;

let shoppingList = ["Eggs", "Bread", "Blueberries", "Lettuce"];

let nextId = 3;
let currentModalRecipeId = null;
let pendingCell = null; // { dayIdx, mealIdx, gridId, weekOffset }

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const MEALS = ["Breakfast","Lunch","Dinner"];

function getMonday(offset) {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const diff = (day === 0 ? -6 : 1 - day); // shift to Monday
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff + offset * 7);
  monday.setHours(0,0,0,0);
  return monday;
}

function weekKey(offset) {
  const m = getMonday(offset);
  return m.toISOString().slice(0,10);
}

function getMealPlan(offset) {
  const key = weekKey(offset);
  if (!mealPlans[key]) mealPlans[key] = Array.from({length:7}, () => [null,null,null]);
  return mealPlans[key];
}

function setMealCell(offset, dayIdx, mealIdx, recipeId) {
  getMealPlan(offset)[dayIdx][mealIdx] = recipeId;
}

function getWeekLabel(offset) {
  const monday = getMonday(offset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const label = offset === 0 ? 'This Week' : offset === -1 ? 'Last Week' : offset === 1 ? 'Next Week' : '';
  return (label ? label + ' · ' : '') + fmt(monday) + ' – ' + fmt(sunday);
}

// ══════════════════ NAVIGATION (Updated for Flask) ══════════════════
function navigate(target) {
  const routes = {
    'home': '/',
    'main': '/dashboard',
    'recipes': '/recipes',
    'mealplan': '/mealplan',
    'recipe-form': '/recipe/new'
  };
  window.location.href = routes[target] || '/';
}

// ══════════════════ MAIN PAGE ══════════════════
function renderMainPage() {
  renderRecipeStrip();
  updateMainWeekLabel();
  renderPlanGrid('main-plan-grid', mainWeekOffset);
  renderShoppingList();
}

function updateMainWeekLabel() {
  document.getElementById('main-week-label').textContent = getWeekLabel(mainWeekOffset);
  document.getElementById('main-prev-week').disabled = false; // allow past
}

function mainChangeWeek(dir) {
  mainWeekOffset += dir;
  updateMainWeekLabel();
  renderPlanGrid('main-plan-grid', mainWeekOffset);
}

// ══════════════════ MEAL PLAN PAGE ══════════════════
function renderMealPlanPage() {
  updateMpWeekLabel();
  renderPlanGrid('mealplan-grid', mpWeekOffset);
}

function updateMpWeekLabel() {
  document.getElementById('mp-week-label').textContent = getWeekLabel(mpWeekOffset);
}

function mpChangeWeek(dir) {
  mpWeekOffset += dir;
  updateMpWeekLabel();
  renderPlanGrid('mealplan-grid', mpWeekOffset);
}

function renderRecipeStrip() {
  const container = document.getElementById('main-recipe-list');
  container.innerHTML = '';
  recipes.forEach(r => {
    const img = document.createElement('img');
    if (r.image) {
      img.src = r.image;
      img.alt = r.name;
      img.className = 'thumb';
      img.title = r.name;
      img.onclick = () => openRecipeModal(r.id);
      container.appendChild(img);
    } else {
      const nameThumb = document.createElement('div');
      nameThumb.className = 'thumb name-thumb';
      nameThumb.title = r.name;
      nameThumb.textContent = r.name;
      nameThumb.onclick = () => openRecipeModal(r.id);
      container.appendChild(nameThumb);
    }
  });
}

let stripScroll = 0;
function scrollRecipeStrip(dir) {
  const container = document.getElementById('main-recipe-list');
  stripScroll = Math.max(0, Math.min(stripScroll + dir, recipes.length - 1));
  const thumbWidth = 90;
  container.style.transform = `translateX(-${stripScroll * thumbWidth}px)`;
}

function renderShoppingList() {
  const ul = document.getElementById('shopping-list');
  ul.innerHTML = '';
  shoppingList.forEach((item, idx) => {
    const li = document.createElement('li');
    li.className = 'shop-item';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.id = 'shop-cb-' + idx;
    cb.className = 'shop-cb';
    const circle = document.createElement('span');
    circle.className = 'shop-circle';
    const label = document.createElement('label');
    label.htmlFor = 'shop-cb-' + idx;
    label.className = 'shop-label';
    label.textContent = item;
    li.appendChild(cb);
    li.appendChild(circle);
    li.appendChild(label);
    // clicking the circle manually toggles the checkbox
    circle.addEventListener('click', () => { cb.checked = !cb.checked; cb.dispatchEvent(new Event('change')); circle.classList.toggle('checked', cb.checked); label.classList.toggle('checked', cb.checked); });
    ul.appendChild(li);
  });
}

function addShopItem(e) {
  if (e.key === 'Enter') {
    const input = document.getElementById('shop-input');
    const val = input.value.trim();
    if (val) {
      shoppingList.push(val);
      input.value = '';
      renderShoppingList();
    }
  }
}

// ══════════════════ PLAN GRID ══════════════════
function renderPlanGrid(gridId, weekOffset) {
  const grid = document.getElementById(gridId);
  if (!grid) return;
  grid.innerHTML = '';
  const plan = getMealPlan(weekOffset !== undefined ? weekOffset : 0);

  // Top-left blank
  grid.appendChild(makeCell('', 'header-cell'));
  DAYS.forEach(d => grid.appendChild(makeCell(d, 'header-cell')));

  MEALS.forEach((meal, mealIdx) => {
    // mealIdx is 0 (Breakfast), 1 (Lunch), or 2 (Dinner)
    grid.appendChild(makeCell(meal, 'row-label plan-cell'));
    DAYS.forEach((_, dayIdx) => {
      // dayIdx is 0 (Monday) through 6 (Sunday)
      const cell = document.createElement('div');
      cell.className = 'plan-cell meal-cell';
      const recipeId = plan[dayIdx][mealIdx];
      if (recipeId) {
        const r = recipes.find(x => x.id === recipeId);
        if (r) {
          if (r.image) {
            const img = document.createElement('img');
            img.src = r.image;
            img.alt = r.name;
            img.title = r.name;
            img.onclick = (e) => { e.stopPropagation(); openRecipeModal(r.id); };
            cell.appendChild(img);
          } else {
            const nameDiv = document.createElement('div');
            nameDiv.className = 'cell-name-label';
            nameDiv.textContent = r.name;
            nameDiv.onclick = (e) => { e.stopPropagation(); openRecipeModal(r.id); };
            cell.appendChild(nameDiv);
          }
        }
      }
      const offset = weekOffset !== undefined ? weekOffset : 0;
      cell.onclick = () => openCellPicker(dayIdx, mealIdx, gridId, offset);
      grid.appendChild(cell);
    });
  });
}

function makeCell(text, classes) {
  const d = document.createElement('div');
  d.className = 'plan-cell ' + classes;
  d.textContent = text;
  return d;
}

// ══════════════════ CELL PICKER ══════════════════
function openCellPicker(dayIdx, mealIdx, gridId, weekOffset) {
  pendingCell = { dayIdx, mealIdx, gridId, weekOffset };
  document.getElementById('cell-search').value = '';
  renderCellPickerGrid('');
  document.getElementById('cell-picker').classList.add('open');
}

function closeCellPicker(e) {
  if (e && e.target !== document.getElementById('cell-picker')) return;
  document.getElementById('cell-picker').classList.remove('open');
  pendingCell = null;
}

function filterCellPicker() {
  const q = document.getElementById('cell-search').value.toLowerCase();
  renderCellPickerGrid(q);
}

function renderCellPickerGrid(query) {
  const grid = document.getElementById('cell-picker-grid');
  grid.innerHTML = '';

  // "Clear" option
  const clearDiv = document.createElement('div');
  clearDiv.className = 'no-img-thumb';
  clearDiv.textContent = '✕ Clear';
  clearDiv.style.background = 'rgba(192,57,43,0.5)';
  clearDiv.onclick = () => assignRecipeToCell(null);
  grid.appendChild(clearDiv);

  const filtered = recipes.filter(r => {
    if (!query) return true;
    return r.name.toLowerCase().includes(query) ||
           r.tags.some(t => t.toLowerCase().includes(query));
  });

  filtered.forEach(r => {
    const wrap = document.createElement('div');
    wrap.className = 'recipe-thumb-wrap';
    if (r.image) {
      const img = document.createElement('img');
      img.src = r.image;
      img.alt = r.name;
      img.title = r.name;
      wrap.appendChild(img);
    } else {
      const d = document.createElement('div');
      d.className = 'no-img-thumb';
      d.textContent = r.name;
      wrap.appendChild(d);
    }
    wrap.onclick = () => assignRecipeToCell(r.id);
    grid.appendChild(wrap);
  });
}

function assignRecipeToCell(recipeId) {
  if (!pendingCell) return;
  
  // 1. Calculate the exact coordinates of the cell
  const weekDate = weekKey(pendingCell.weekOffset || 0); // e.g., "2026-03-16"
  const dayName = DAYS[pendingCell.dayIdx];              // e.g., "Monday"
  const mealName = MEALS[pendingCell.mealIdx];           // e.g., "Breakfast"

  // 2. Package the payload for the database
  const payload = {
    week_date: weekDate,
    day: dayName,
    meal_type: mealName,
    recipe_id: recipeId // This will be null if the user clicked "Clear"
  };

  // 3. Send the POST request to the backend
  fetch('/mealplan/sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })
  .then(response => response.json())
  .then(data => {
    if (data.status === 'success') {
      // Only update the UI if the database successfully saved the change
      const plan = getMealPlan(pendingCell.weekOffset || 0);
      plan[pendingCell.dayIdx][pendingCell.mealIdx] = recipeId;
      
      document.getElementById('cell-picker').classList.remove('open');
      renderPlanGrid(pendingCell.gridId, pendingCell.weekOffset || 0);
      pendingCell = null;
    } else {
      alert('Database Error: ' + data.message);
    }
  })
  .catch(error => {
    console.error('Error saving to MealPlan:', error);
    alert('Failed to connect to the server.');
  });
}

// ══════════════════ RECIPES PAGE ══════════════════
function renderRecipesPage() {
  const q = document.getElementById('recipe-search').value.toLowerCase();
  renderRecipeGrids(q);
}

function filterRecipes() {
  const q = document.getElementById('recipe-search').value.toLowerCase();
  renderRecipeGrids(q);
}

function clearSearch() {
  document.getElementById('recipe-search').value = '';
  renderRecipeGrids('');
}

function renderRecipeGrids(query) {
  const favGrid = document.getElementById('fav-grid');
  const allGrid = document.getElementById('all-grid');
  favGrid.innerHTML = '';
  allGrid.innerHTML = '';

  const filtered = recipes.filter(r => {
    if (!query) return true;
    return r.name.toLowerCase().includes(query) ||
           r.tags.some(t => t.toLowerCase().includes(query)) ||
           r.ingredients.some(i => i.toLowerCase().includes(query));
  });

  const favs = filtered.filter(r => r.favourite);
  const all = filtered;

  if (favs.length === 0) {
    favGrid.innerHTML = '<span class="empty-recipes">No favourites yet.</span>';
  } else {
    favs.forEach(r => favGrid.appendChild(makeRecipeThumb(r)));
  }

  if (all.length === 0) {
    allGrid.innerHTML = '<span class="empty-recipes">No recipes found.</span>';
  } else {
    all.forEach(r => allGrid.appendChild(makeRecipeThumb(r)));
  }
}

function makeRecipeThumb(r) {
  const wrap = document.createElement('div');
  wrap.className = 'recipe-thumb-wrap';
  wrap.title = r.name;

  if (r.image) {
    const img = document.createElement('img');
    img.src = r.image;
    img.alt = r.name;
    wrap.appendChild(img);
  } else {
    const d = document.createElement('div');
    d.className = 'no-img-thumb';
    d.textContent = r.name;
    wrap.appendChild(d);
  }

  // Edit button overlay
  const editBtn = document.createElement('button');
  editBtn.className = 'thumb-edit-btn';
  editBtn.textContent = '✏️';
  editBtn.title = 'Edit ' + r.name;
  editBtn.onclick = (e) => { e.stopPropagation(); openEditRecipe(r.id); };
  wrap.appendChild(editBtn);

  wrap.onclick = () => openRecipeModal(r.id);
  return wrap;
}

// ══════════════════ RECIPE MODAL ══════════════════
function openRecipeModal(id) {
  const r = recipes.find(x => x.id === id);
  if (!r) return;
  currentModalRecipeId = id;

  document.getElementById('modal-recipe-name').textContent = r.name;
  document.getElementById('modal-name').textContent = r.name;
  document.getElementById('modal-time').textContent = r.time || 'N/A';
  document.getElementById('modal-instructions').textContent = r.instructions || '';

  const ul = document.getElementById('modal-ingredients');
  ul.innerHTML = '';
  r.ingredients.forEach(ing => {
    const li = document.createElement('li');
    li.textContent = ing;
    ul.appendChild(li);
  });

  const imgEl = document.getElementById('modal-img');
  if (r.image) {
    imgEl.src = r.image;
    imgEl.style.display = 'block';
  } else {
    imgEl.style.display = 'none';
  }

  const favBtn = document.getElementById('modal-fav-btn');
  if (r.favourite) {
    favBtn.textContent = '★ Favourited';
    favBtn.classList.add('is-fav');
  } else {
    favBtn.textContent = '⭐ Add to Favourites';
    favBtn.classList.remove('is-fav');
  }

  document.getElementById('recipe-modal').classList.add('open');
}

function closeRecipeModal() {
  document.getElementById('recipe-modal').classList.remove('open');
  currentModalRecipeId = null;
}

function closeModal(e) {
  if (e.target === document.getElementById('recipe-modal')) closeRecipeModal();
}

function toggleModalFavourite() {
  if (!currentModalRecipeId) return;
  const r = recipes.find(x => x.id === currentModalRecipeId);
  if (!r) return;
  r.favourite = !r.favourite;
  const favBtn = document.getElementById('modal-fav-btn');
  if (r.favourite) {
    favBtn.textContent = '★ Favourited';
    favBtn.classList.add('is-fav');
  } else {
    favBtn.textContent = '⭐ Add to Favourites';
    favBtn.classList.remove('is-fav');
  }
  syncStats();
}

function editCurrentRecipe() {
  const id = currentModalRecipeId;
  closeRecipeModal();
  openEditRecipe(id);
}

// ══════════════════ RECIPE FORM ══════════════════
function openNewRecipe() {
  document.getElementById('form-title').textContent = 'New Recipe';
  document.getElementById('f-name').value = '';
  document.getElementById('f-ingredients').value = '';
  document.getElementById('f-time').value = '';
  document.getElementById('f-tags').value = '';
  document.getElementById('f-instructions').value = '';
  document.getElementById('f-fav').checked = false;
  document.getElementById('f-editing-id').value = '';
  document.getElementById('f-delete-btn').style.display = 'none';
  document.getElementById('f-image-name').textContent = 'No file chosen';
  document.getElementById('f-image-preview').style.display = 'none';
  document.getElementById('f-image-preview').src = '';
  navigate('recipe-form');
}

function openEditRecipe(id) {
  const r = recipes.find(x => x.id === id);
  if (!r) return;

  document.getElementById('form-title').textContent = 'Edit Recipe';
  document.getElementById('f-name').value = r.name;
  document.getElementById('f-ingredients').value = r.ingredients.join('\n');
  document.getElementById('f-time').value = r.time || '';
  document.getElementById('f-tags').value = r.tags.join(', ');
  document.getElementById('f-instructions').value = r.instructions || '';
  document.getElementById('f-fav').checked = r.favourite;
  document.getElementById('f-editing-id').value = id;
  document.getElementById('f-delete-btn').style.display = 'inline-block';

  if (r.image) {
    document.getElementById('f-image-preview').src = r.image;
    document.getElementById('f-image-preview').style.display = 'inline-block';
    document.getElementById('f-image-name').textContent = 'Current image';
  } else {
    document.getElementById('f-image-name').textContent = 'No file chosen';
    document.getElementById('f-image-preview').style.display = 'none';
  }

  navigate('recipe-form');
}

function previewImage(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const preview = document.getElementById('f-image-preview');
    preview.src = e.target.result;
    preview.style.display = 'inline-block';
    document.getElementById('f-image-name').textContent = file.name;
  };
  reader.readAsDataURL(file);
}

function updateExistingRecipe(editingId, recipeData) {
  // Send the PUT request to update the database
  fetch(`/recipe/update/${editingId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(recipeData)
  })
  .then(response => response.json())
  .then(data => {
    if (data.status === 'success') {
      // Only update the local UI array if the database update succeeded
      // Find the old recipe and update it cleanly using Object.assign
      const r = recipes.find(x => x.id === parseInt(editingId));
      if (r) {
        Object.assign(r, recipeData); 
      }
      syncStats();
      navigate('recipes');
    } else {
      alert('Database Error: ' + data.message);
    }
  })
  .catch(error => {
    console.error('Error updating DB:', error);
    alert('Failed to connect to the server.');
  });
}

function createNewRecipe(recipeData) {
  // Send the POST request insert a new tuple
  fetch('/recipe/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(recipeData)
  })
  .then(response => response.json())
  .then(data => {
    if (data.status === 'success') {
      // Attach the new DB-generated ID to the object and push it to the UI array
      recipeData.id = data.recipeID;
      // Push to local array using the real ID generated by the database so UI updates instantly
      recipes.push(recipeData); 
      
      syncStats();
      navigate('recipes');
    } else {
      alert('Database Error: ' + data.message);
    }
  })
  .catch(error => {
    console.error('Error saving to DB:', error);
    alert('Failed to connect to the server.');
  });
}

function saveRecipe() {
  const name = document.getElementById('f-name').value.trim();
  const ingredientsRaw = document.getElementById('f-ingredients').value.trim();
  const time = document.getElementById('f-time').value.trim();
  const tagsRaw = document.getElementById('f-tags').value.trim();
  const instructions = document.getElementById('f-instructions').value.trim();
  const fav = document.getElementById('f-fav').checked;
  const editingId = document.getElementById('f-editing-id').value;
  const imagePreview = document.getElementById('f-image-preview');

  if (!name || !ingredientsRaw) {
    alert('Please fill in Recipe title and Ingredients.');
    return;
  }

  // ------------------- NEED REFACTORED For Recipe-save ----------------------------------------------------------//
  // We atcually don't want users to use '\n' and ',' to split the ingredients
  // Instead, we can use a table-like format to get the input
  // Also, for ingredients, we need two column -- one for amount, one for ingredient's name
  // So the UI may look like:
  //              ------------------------------
  // Ingredients: | (amount) | (ingredient)    | <-- A list of tuple: list{(amount, ingredient)}, where amount and ingr are both strings
  //              ------------------------------     In js, it's array of arrays [["1 cup", "rice"], ["2", "onions"]]
  //              |____________+_______________ | <- tap to add a new ingredient
  //
  //       __________________
  //  Tag: |_Tag_____|__+____| <-- A list of tags
  //
  // Once you done that in html, can you also fix the following code:
 const ingredients = ingredientsRaw.split('\n').map(s => { // No longer use split by '\n'
    const parts = s.trim().toLowerCase();
    const amount;
    const ingName;
    return { amount: amount || '', name: ingName || '' };
  }).filter(item => item.name !== ''); 

  const tags = tagsRaw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean); // No longer use split by ','
  const imageData = imagePreview.src && imagePreview.style.display !== 'none' ? imagePreview.src : '';

  const recipeData = {
    name: name,
    ingredients: ingredients,
    time: time,
    tags: tags,
    instructions: instructions,
    favourite: fav,
    image: imageData
  };

  if (editingId) {
    updateExistingRecipe(editingId, recipeData);
  } else {
    createNewRecipe(recipeData);
  }
}


// I'll revisit it later especially for meal plan part
function deleteRecipe() {
  const editingId = parseInt(document.getElementById('f-editing-id').value);
  if (!editingId) return;
  if (!confirm('Remove this recipe?')) return;

  // Send a DELETE request to the Flask backend
  fetch(`/recipe/delete/${editingId}`, {
    method: 'DELETE'
  })
  .then(response => response.json())
  .then(data => {
    if (data.status === 'success') {
      // If the database successfully deleted it, remove it from the UI array
      recipes = recipes.filter(r => r.id !== editingId);
      
      // Clear from all local meal plans so the UI updates instantly
      Object.values(mealPlans).forEach(week => {
        week.forEach(day => {
          day.forEach((v, i) => { if (v === editingId) day[i] = null; });
        });
      });
      
      syncStats();
      navigate('recipes');
    } else {
      alert('Database Error: ' + data.message);
    }
  })
  .catch(error => {
    console.error('Error deleting recipe:', error);
    alert('Failed to connect to the server.');
  });
}

// ══════════════════ PROFILE STATS ══════════════════
function syncStats() {
  localStorage.setItem('stat-recipes', recipes.length);
  localStorage.setItem('stat-favs', recipes.filter(r => r.favourite).length);
}

// ══════════════════ THEME TOGGLE ══════════════════
let isDark = true;

function toggleTheme() {
  isDark = !isDark;
  document.body.classList.toggle('light', !isDark);
  const label = isDark ? '🌙 Dark' : '☀️ Light';
  document.querySelectorAll('.theme-toggle').forEach(btn => btn.textContent = label);
}

// ════════════════════════════ INIT  ════════════════════════════
function loadRecipesFromDB(callback) {
  fetch('/recipe/get')
    .then(response => response.json())
    .then(data => {
      if (data.status === 'success') {
        recipes = data.recipes; // Populate the global recipes array with DB data
        if (callback) callback(); // Run the page render functions now that we have data
      } else {
        console.error('Failed to load recipes:', data.message);
      }
    })
    .catch(error => {
      console.error('Error fetching recipes:', error);
    });
}

function loadMealPlansFromDB(callback) {
  fetch('/mealplan/get')
    .then(response => response.json())
    .then(data => {
      if (data.status === 'success') {
        // Reset the local meal plans object
        mealPlans = {};
        
        data.mealplans.forEach(plan => {
          const weekKey = plan.week_date;
          // Translate "Monday" back to 0, "Breakfast" back to 0, etc.
          const dayIdx = DAYS.indexOf(plan.day);
          const mealIdx = MEALS.indexOf(plan.meal_type);
          
          // Ensure valid indexes were found before assigning
          if (dayIdx !== -1 && mealIdx !== -1) {
            // If this week doesn't exist in our local object yet, initialize it
            if (!mealPlans[weekKey]) {
              mealPlans[weekKey] = Array.from({length:7}, () => [null,null,null]);
            }
            // Slot the recipe ID into the exact grid coordinate
            mealPlans[weekKey][dayIdx][mealIdx] = plan.recipe_id;
          }
        });
        
        // Execute the next step (rendering the UI)
        if (callback) callback();
      } else {
        console.error('Failed to load meal plans:', data.message);
      }
    })
    .catch(error => {
      console.error('Error fetching meal plans:', error);
    });
}

document.addEventListener('DOMContentLoaded', function() {
  const path = window.location.pathname;

  // We wrap the page rendering in a function so we can pass it as a callback
  const initializePageUI = () => {
    if (path === '/dashboard') {
      renderMainPage();
    } else if (path === '/recipes') {
      renderRecipesPage();
    } else if (path === '/mealplan') {
      renderMealPlanPage();
    } else if (path === '/recipe/new') {
      const delBtn = document.getElementById('f-delete-btn');
      if (delBtn) delBtn.style.display = 'none';
    }
  };

  // 1. Fetch Recipes first
  loadRecipesFromDB(() => {
    // 2. Then fetch Meal Plans
    loadMealPlansFromDB(() => {
      // 3. Finally, render the UI with all the data ready
      initializePageUI();
    });
  });
});

// ══════════════════ RESIZE HANDLE ══════════════════
let dragging = false;
let startY = 0;
let startPlanHeight = 0;
let startRecipesHeight = 0;

document.addEventListener('DOMContentLoaded', function() {
  const handle = document.getElementById('resize-handle');

  handle.addEventListener('mousedown', function(e) {
    const planSection = document.querySelector('#page-main .plan-section');
    const recipesSection = document.querySelector('#page-main .recipes-section');
    dragging = true;
    startY = e.clientY;
    startPlanHeight = planSection.getBoundingClientRect().height;
    startRecipesHeight = recipesSection.getBoundingClientRect().height;
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  handle.addEventListener('touchstart', function(e) {
    const planSection = document.querySelector('#page-main .plan-section');
    const recipesSection = document.querySelector('#page-main .recipes-section');
    dragging = true;
    startY = e.touches[0].clientY;
    startPlanHeight = planSection.getBoundingClientRect().height;
    startRecipesHeight = recipesSection.getBoundingClientRect().height;
    e.preventDefault();
  }, { passive: false });
});

document.addEventListener('mousemove', function(e) {
  if (!dragging) return;
  const delta = e.clientY - startY;
  const planSection = document.querySelector('#page-main .plan-section');
  const recipesSection = document.querySelector('#page-main .recipes-section');
  planSection.style.flex = 'none';
  planSection.style.height = Math.max(80, startPlanHeight + delta) + 'px';
  recipesSection.style.flex = 'none';
  recipesSection.style.height = Math.max(80, startRecipesHeight - delta) + 'px';
});

document.addEventListener('mouseup', function() {
  if (!dragging) return;
  dragging = false;
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
});

document.addEventListener('touchmove', function(e) {
  if (!dragging) return;
  const delta = e.touches[0].clientY - startY;
  const planSection = document.querySelector('#page-main .plan-section');
  const recipesSection = document.querySelector('#page-main .recipes-section');
  planSection.style.flex = 'none';
  planSection.style.height = Math.max(80, startPlanHeight + delta) + 'px';
  recipesSection.style.flex = 'none';
  recipesSection.style.height = Math.max(80, startRecipesHeight - delta) + 'px';
});

document.addEventListener('touchend', function() { dragging = false; });