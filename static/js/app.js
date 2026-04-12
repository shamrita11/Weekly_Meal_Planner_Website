// ══════════════════════════════════════════
//  WEEKLY MEAL PLANNER — app.js
// ══════════════════════════════════════════

// ── DATA FROM DATABASE ──
let recipes = [];

// mealPlans[weekKey][day][meal] = recipeId
// weekKey = ISO Monday date string e.g. "2026-03-16"
let mealPlans = {};

// Meal plan page week offset (0 = this week). Home dashboard always shows this week only.
let mpWeekOffset = 0;

let recipeShoppingList = []; // each element looks like {title, count, ingredients: [{itemID, ingredient, checked}, ...]}
let customShoppingList = []; // each element looks like {id: 1, name: "Eggs", checked: false}
let shoppingList = [];

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

function toLocalDateString(d) {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

function weekKey(offset) {
  const m = getMonday(offset);
  return toLocalDateString(m);
}

/** API sends ingredients as [amount, name] pairs. */
function ingredientLineText(ing) {
  if (!Array.isArray(ing)) return String(ing || '');
  const amount = ing[0] != null ? String(ing[0]).trim() : '';
  const name = ing[1] != null ? String(ing[1]).trim() : '';
  if (!name) return amount;
  return amount ? `${amount} ${name}` : name;
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
  renderPlanGrid('main-plan-grid', 0);
  renderShoppingList();
}

function updateMainWeekLabel() {
  const el = document.getElementById('main-week-label');
  if (el) el.textContent = getWeekLabel(0);
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
  if (!container) return;
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

/** Step matches thumb row height (80px thumb + gap) for the Your Recipes strip. */
const RECIPE_STRIP_SCROLL_STEP = 90;

function scrollRecipeStrip(dir) {
  const container = document.getElementById('main-recipe-list');
  if (!container) return;
  container.scrollBy({ top: dir * RECIPE_STRIP_SCROLL_STEP, behavior: 'smooth' });
}

// ══════════════════ SHOPPING LIST ══════════════════
function renderShoppingList() {
  const ul = document.getElementById('shopping-list');
  ul.innerHTML = '';
  
  const recipeTemplate = document.getElementById('recipe-box-template');
  const itemTemplate = document.getElementById('shop-item-template');

  // Render Grouped Recipe Items
  recipeShoppingList.forEach(recipe => {
    const boxClone = recipeTemplate.content.cloneNode(true);
    
    boxClone.querySelector('.recipe-title-text').textContent = recipe.title;
    if (recipe.count >= 2) {
      boxClone.querySelector('.recipe-multiplier').textContent = `x ${recipe.count}`;
    }

    const ingContainer = boxClone.querySelector('.ingredient-container');

    // Fill in the ingredients
    recipe.ingredients.forEach(item => {
      const itemClone = createItemFromTemplate(itemTemplate, item);
      ingContainer.appendChild(itemClone);
    });

    ul.appendChild(boxClone);
  });

  // Render Custom Input Items
  customShoppingList.forEach((item) => {
    const itemClone = createItemFromTemplate(itemTemplate, item);
    ul.appendChild(itemClone);
  });
}


function createItemFromTemplate(template, itemData) {
  const clone = template.content.cloneNode(true);
  
  const cb = clone.querySelector('.shop-cb');
  cb.id = 'shop-cb-' + itemData.id;
  cb.checked = itemData.checked;

  const label = clone.querySelector('.shop-label');
  label.htmlFor = 'shop-cb-' + itemData.id;
  label.textContent = itemData.name;

  const circle = clone.querySelector('.shop-circle');
  circle.addEventListener('click', () => {
    const newChecked = !cb.checked;
    cb.checked = newChecked;
    itemData.checked = newChecked;
    toggleShopItemDB(itemData.id, newChecked);
  });

  return clone;
}

function toggleShopItemDB(itemId, isChecked) {
  fetch(`/shop/toggle/${itemId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ checked: isChecked })
  }).catch(err => console.error('Error toggling item:', err));
}

function loadShoppingListFromDB(callback) {
  fetch('/shop/get')
    .then(response => response.json())
    .then(data => {
      if (data.status === 'success') {
        // Correctly assign the two new data arrays from the Python route
        recipeShoppingList = data.recipe_items || [];
        customShoppingList = data.custom_items || [];
        if (callback) callback();
      } else {
        console.error('Failed to load shopping list:', data.message);
      }
    })
    .catch(err => console.error('Error fetching shopping list:', err));
}

function addShopItem(e) {
  if (e.key === 'Enter') {
    const input = document.getElementById('shop-input');
    const val = input.value.trim();
    if (val) {
      // Save to database first
      fetch('/shop/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input_item: val })
      })
      .then(response => response.json())
      .then(data => {
        if (data.status === 'success') {
          // Push strictly to the custom list using the new DB itemID
          customShoppingList.push({ id: data.id, name: val, checked: false });
          input.value = '';
          renderShoppingList();
        } else {
          alert('Failed to add item: ' + data.message);
        }
      })
      .catch(err => console.error('Error adding item:', err));
    }
  }
}

function clearShoppingList() {
  // Check both new arrays to see if the list is already empty
  if (recipeShoppingList.length === 0 && customShoppingList.length === 0) return; 
  
  if (!confirm('Are you sure you want to clear your entire shopping list?')) {
    return;
  }

  fetch('/shop/clear', {
    method: 'DELETE'
  })
  .then(response => response.json())
  .then(data => {
    if (data.status === 'success') {
      // Empty both local arrays and re-render the UI
      recipeShoppingList = [];
      customShoppingList = [];
      renderShoppingList();
    } else {
      alert('Failed to clear list: ' + data.message);
    }
  })
  .catch(err => console.error('Error clearing shopping list:', err));
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
    const tags = r.tags || [];
    return r.name.toLowerCase().includes(query) ||
           tags.some(t => t.toLowerCase().includes(query));
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
      // Reload the page to automatically fetch the new grid and new shopping list
      window.location.reload();
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
    const tags = r.tags || [];
    const ings = r.ingredients || [];
    return r.name.toLowerCase().includes(query) ||
           tags.some(t => t.toLowerCase().includes(query)) ||
           ings.some(i => ingredientLineText(i).toLowerCase().includes(query));
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
  (r.ingredients || []).forEach(ing => {
    const li = document.createElement('li');
    li.textContent = ingredientLineText(ing);
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

  // Send a POST request to the backend to toggle the status
  fetch(`/recipe/toggle-fav/${currentModalRecipeId}`, {
    method: 'POST'
  })
  .then(response => response.json())
  .then(data => {
    if (data.status === 'success') {
      // Update the local array
      r.favourite = data.favourite;
      
      // Update the UI button inside the modal
      const favBtn = document.getElementById('modal-fav-btn');
      if (r.favourite) {
        favBtn.textContent = '★ Favourited';
        favBtn.classList.add('is-fav');
      } else {
        favBtn.textContent = '⭐ Add to Favourites';
        favBtn.classList.remove('is-fav');
      }
      
      // Sync stats to localStorage
      syncStats();

      // If we are on the Recipes page, re-render the grid so the recipe 
      // instantly appears/disappears from the "Favourites" section
      if (window.location.pathname === '/recipes') {
        filterRecipes();
      }
    } else {
      alert('Database Error: ' + data.message);
    }
  })
  .catch(error => {
    console.error('Error toggling favourite:', error);
    alert('Failed to connect to the server.');
  });
}

function editCurrentRecipe() {
  const id = currentModalRecipeId;
  closeRecipeModal();
  openEditRecipe(id);
}

// ══════════════════ RECIPE FORM ══════════════════
let recipeFormTags = [];

function buildIngredientRowElement(amount = '', name = '') {
  const row = document.createElement('div');
  row.className = 'ingredient-row';
  const line = document.createElement('div');
  line.className = 'ingredient-line';
  const inpA = document.createElement('input');
  inpA.type = 'text';
  inpA.className = 'form-input ing-amount';
  inpA.placeholder = '1 cup';
  inpA.value = amount;
  const wrap = document.createElement('div');
  wrap.className = 'ing-name-with-actions';
  const inpN = document.createElement('input');
  inpN.type = 'text';
  inpN.className = 'form-input ing-name';
  inpN.placeholder = 'rice';
  inpN.value = name;
  wrap.appendChild(inpN);
  line.appendChild(inpA);
  line.appendChild(wrap);
  row.appendChild(line);
  return row;
}

/** Last row gets +; other rows get ×. Same name column width as tags row (1fr + 44px). */
function refreshIngredientRowControls() {
  const container = document.getElementById('ingredients-rows');
  if (!container) return;
  const rows = container.querySelectorAll('.ingredient-row');
  rows.forEach((row, index) => {
    const wrap = row.querySelector('.ing-name-with-actions');
    if (!wrap) return;
    const old = wrap.querySelector('.ing-add-row-btn, .ing-row-remove');
    if (old) old.remove();
    const isLast = index === rows.length - 1;
    if (isLast) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ing-add-row-btn';
      btn.id = 'ing-add-row';
      btn.setAttribute('aria-label', 'Add ingredient row');
      btn.textContent = '+';
      btn.addEventListener('click', () => addIngredientRow('', ''));
      wrap.appendChild(btn);
    } else {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ing-row-remove';
      btn.setAttribute('aria-label', 'Remove row');
      btn.textContent = '×';
      btn.addEventListener('click', () => removeIngredientRow(btn));
      wrap.appendChild(btn);
    }
  });
}

function addIngredientRow(amount = '', name = '') {
  const container = document.getElementById('ingredients-rows');
  if (!container) return;
  container.appendChild(buildIngredientRowElement(amount, name));
  refreshIngredientRowControls();
}

function removeIngredientRow(btn) {
  const row = btn.closest('.ingredient-row');
  const container = document.getElementById('ingredients-rows');
  if (!row || !container) return;
  if (container.querySelectorAll('.ingredient-row').length <= 1) return;
  row.remove();
  refreshIngredientRowControls();
}

function clearIngredientRows() {
  const container = document.getElementById('ingredients-rows');
  if (!container) return;
  container.innerHTML = '';
  addIngredientRow('', '');
}

function gatherIngredientsFromForm() {
  const container = document.getElementById('ingredients-rows');
  if (!container) return [];
  const out = [];
  container.querySelectorAll('.ingredient-row').forEach((row) => {
    const amount = row.querySelector('.ing-amount')?.value.trim() ?? '';
    const name = row.querySelector('.ing-name')?.value.trim() ?? '';
    if (name) out.push([amount, name]);
  });
  return out;
}

function renderTagChips() {
  const el = document.getElementById('tag-chips');
  if (!el) return;
  el.innerHTML = '';
  recipeFormTags.forEach((tag) => {
    const chip = document.createElement('span');
    chip.className = 'tag-chip';
    chip.appendChild(document.createTextNode(tag));
    const x = document.createElement('button');
    x.type = 'button';
    x.textContent = '×';
    x.onclick = () => removeFormTag(tag);
    chip.appendChild(x);
    el.appendChild(chip);
  });
}

function addTagFromInput() {
  const inp = document.getElementById('tag-input');
  if (!inp) return;
  const raw = inp.value.trim().toLowerCase();
  if (!raw) return;
  if (!recipeFormTags.includes(raw)) recipeFormTags.push(raw);
  inp.value = '';
  renderTagChips();
}

function removeFormTag(tag) {
  recipeFormTags = recipeFormTags.filter((t) => t !== tag);
  renderTagChips();
}

function setTagsFromArray(tags) {
  recipeFormTags = [
    ...new Set(
      (tags || [])
        .map((t) => String(t).trim().toLowerCase())
        .filter(Boolean)
    ),
  ];
  renderTagChips();
}

function setRecipeFormFavourite(isFav) {
  const btn = document.getElementById('f-fav-btn');
  if (!btn) return;
  btn.classList.toggle('is-fav', !!isFav);
  btn.setAttribute('aria-pressed', isFav ? 'true' : 'false');
}

function toggleRecipeFormFavourite() {
  const btn = document.getElementById('f-fav-btn');
  if (!btn) return;
  btn.classList.toggle('is-fav');
  btn.setAttribute('aria-pressed', btn.classList.contains('is-fav') ? 'true' : 'false');
}

function resetRecipeForm() {
  const title = document.getElementById('form-title');
  if (title) title.textContent = 'New Recipe';
  const name = document.getElementById('f-name');
  if (name) name.value = '';
  const time = document.getElementById('f-time');
  if (time) time.value = '';
  const instr = document.getElementById('f-instructions');
  if (instr) instr.value = '';
  setRecipeFormFavourite(false);
  const eid = document.getElementById('f-editing-id');
  if (eid) eid.value = '';
  const fn = document.getElementById('f-image-name');
  if (fn) fn.textContent = 'No file chosen';
  const prev = document.getElementById('f-image-preview');
  if (prev) {
    prev.style.display = 'none';
    prev.src = '';
  }
  const fi = document.getElementById('f-image-file');
  if (fi) fi.value = '';
  clearIngredientRows();
  recipeFormTags = [];
  renderTagChips();
  const ti = document.getElementById('tag-input');
  if (ti) ti.value = '';
}

function populateRecipeFormFromRecipe(r) {
  const title = document.getElementById('form-title');
  if (title) title.textContent = 'Edit Recipe';
  const name = document.getElementById('f-name');
  if (name) name.value = r.name || '';
  const time = document.getElementById('f-time');
  if (time) time.value = r.time || '';
  const instr = document.getElementById('f-instructions');
  if (instr) instr.value = r.instructions || '';
  setRecipeFormFavourite(!!r.favourite);
  const eid = document.getElementById('f-editing-id');
  if (eid) eid.value = r.id;

  const container = document.getElementById('ingredients-rows');
  if (container) {
    container.innerHTML = '';
    const pairs = (r.ingredients || []).filter(
      (ing) => Array.isArray(ing) && ing[1] && String(ing[1]).trim()
    );
    if (pairs.length === 0) addIngredientRow('', '');
    else pairs.forEach((ing) => addIngredientRow(ing[0] || '', ing[1] || ''));
  }
  setTagsFromArray(r.tags);

  const imgPrev = document.getElementById('f-image-preview');
  const imgName = document.getElementById('f-image-name');
  if (r.image && imgPrev) {
    imgPrev.src = r.image;
    imgPrev.style.display = 'inline-block';
    if (imgName) imgName.textContent = 'Current image';
  } else {
    if (imgPrev) {
      imgPrev.src = '';
      imgPrev.style.display = 'none';
    }
    if (imgName) imgName.textContent = 'No file chosen';
  }
}

function openNewRecipe() {
  window.location.href = '/recipe/new';
}

function openEditRecipe(id) {
  window.location.href = '/recipe/new?edit=' + encodeURIComponent(id);
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
  const ingredients = gatherIngredientsFromForm();
  const time = document.getElementById('f-time').value.trim();
  const tags = [...recipeFormTags];
  const instructions = document.getElementById('f-instructions').value.trim();
  const favBtn = document.getElementById('f-fav-btn');
  const fav = favBtn ? favBtn.classList.contains('is-fav') : false;
  const editingId = document.getElementById('f-editing-id').value;
  const imagePreview = document.getElementById('f-image-preview');

  if (!name) {
    alert('Please enter a recipe name.');
    return;
  }
  if (ingredients.length === 0) {
    alert('Add at least one ingredient with a name (amount is optional).');
    return;
  }

  const imageData =
    imagePreview && imagePreview.src && imagePreview.style.display !== 'none'
      ? imagePreview.src
      : '';

  const recipeData = {
    name: name,
    ingredients: ingredients,
    time: time,
    tags: tags,
    instructions: instructions,
    favourite: fav,
    image: imageData,
  };

  if (editingId) {
    updateExistingRecipe(editingId, recipeData);
  } else {
    createNewRecipe(recipeData);
  }
}


function deleteRecipe() {
  const editingId = parseInt(document.getElementById('f-editing-id').value);
  if (!editingId) return;
  if (!confirm('Remove this recipe?')) return;

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
let isDark = localStorage.getItem('theme') !== 'light';

function applyTheme() {
  document.body.classList.toggle('light', !isDark);
  const label = isDark ? '🌙 Dark' : '☀️ Light';
  document.querySelectorAll('.theme-toggle').forEach(btn => btn.textContent = label);
}

function toggleTheme() {
  isDark = !isDark;
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  applyTheme();
}
// Apply the saved theme as soon as the script loads
applyTheme();

// ════════════════════════════ INIT  ════════════════════════════
function loadRecipesFromDB(callback) {
  fetch('/recipe/get')
    .then(response => response.json())
    .then(data => {
      if (data.status === 'success') {
        recipes = (data.recipes || []).map((r) => ({
          ...r,
          tags: Array.isArray(r.tags) ? r.tags : [],
          ingredients: Array.isArray(r.ingredients) ? r.ingredients : [],
        }));
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
            const rid = plan.recipe_id;
            mealPlans[weekKey][dayIdx][mealIdx] =
              rid != null && rid !== '' ? Number(rid) : null;
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
      const tagInput = document.getElementById('tag-input');
      if (tagInput) {
        tagInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            addTagFromInput();
          }
        });
      }
      const params = new URLSearchParams(window.location.search);
      const editId = params.get('edit');
      const delBtn = document.getElementById('f-delete-btn');
      if (editId) {
        const id = parseInt(editId, 10);
        const r = recipes.find((x) => x.id === id);
        if (r) {
          populateRecipeFormFromRecipe(r);
          if (delBtn) delBtn.style.display = 'inline-block';
        } else {
          resetRecipeForm();
          if (delBtn) delBtn.style.display = 'none';
        }
      } else {
        resetRecipeForm();
        if (delBtn) delBtn.style.display = 'none';
      }
    }
  };

  // 1. Fetch Recipes first
  loadRecipesFromDB(() => {
    // 2. Then fetch Meal Plans
    loadMealPlansFromDB(() => {
      // 3. Then fetch Shopping List
      loadShoppingListFromDB(() => {
        // 4. Finally, render the UI with all the data ready
        initializePageUI();
      });
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
  if (!handle) return;

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
  if (!planSection || !recipesSection) return;
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
  if (!planSection || !recipesSection) return;
  planSection.style.flex = 'none';
  planSection.style.height = Math.max(80, startPlanHeight + delta) + 'px';
  recipesSection.style.flex = 'none';
  recipesSection.style.height = Math.max(80, startRecipesHeight - delta) + 'px';
});

document.addEventListener('touchend', function() { dragging = false; });