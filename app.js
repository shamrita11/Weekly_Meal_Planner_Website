// ══════════════════════════════════════════
//  WEEKLY MEAL PLANNER — app.js
// ══════════════════════════════════════════

// ── SAMPLE STARTER DATA ──
let recipes = [
  {
    id: 1,
    name: "French Toast",
    ingredients: ["2 slices bread", "1 egg", "¼ cup milk", "1 tsp sugar", "Berries to serve"],
    instructions: "1. Whisk egg, milk, and sugar. 2. Dip bread. 3. Fry in butter 2 min per side. 4. Serve with berries.",
    time: "15 minutes",
    tags: ["breakfast", "sweet", "bread", "egg"],
    favourite: true,
  },
  {
    id: 2,
    name: "Garden Salad",
    ingredients: ["2 cups lettuce", "½ cup cherry tomatoes", "¼ cucumber", "Dressing"],
    instructions: "1. Wash and chop veggies. 2. Toss together. 3. Drizzle dressing.",
    time: "10 minutes",
    tags: ["lunch", "salad", "healthy", "vegetarian"],
    favourite: true,
    image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=300&q=80"
  }
];

// mealPlans[weekKey][day][meal] = recipeId
// weekKey = ISO Monday date string e.g. "2026-03-16"
let mealPlans = {};

// Current week offsets (0 = this week, -1 = last week, +1 = next week, etc.)
let mainWeekOffset = 0;
let mpWeekOffset = 0;

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

let shoppingList = ["Eggs", "Bread", "Blueberries", "Lettuce"];

let nextId = 3;
let currentModalRecipeId = null;
let pendingCell = null; // { dayIdx, mealIdx, gridId, weekOffset }

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const MEALS = ["Breakfast","Lunch","Dinner"];

// ══════════════════ NAVIGATION ══════════════════
function navigate(target) {
  document.querySelectorAll('.page').forEach(p => {
    p.classList.remove('active');
    p.style.display = 'none';
  });
  const el = document.getElementById('page-' + target);
  if (el) {
    el.style.display = 'flex';
    el.classList.add('active');
  }

  if (target === 'main')     { renderMainPage(); }
  if (target === 'recipes')  { renderRecipesPage(); }
  if (target === 'mealplan') { renderMealPlanPage(); }
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
    grid.appendChild(makeCell(meal, 'row-label plan-cell'));
    DAYS.forEach((_, dayIdx) => {
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
  const plan = getMealPlan(pendingCell.weekOffset || 0);
  plan[pendingCell.dayIdx][pendingCell.mealIdx] = recipeId;
  document.getElementById('cell-picker').classList.remove('open');
  renderPlanGrid(pendingCell.gridId, pendingCell.weekOffset || 0);
  pendingCell = null;
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

function saveRecipe() {
  const name = document.getElementById('f-name').value.trim();
  const ingredientsRaw = document.getElementById('f-ingredients').value.trim();
  const time = document.getElementById('f-time').value.trim();
  const tagsRaw = document.getElementById('f-tags').value.trim();
  const instructions = document.getElementById('f-instructions').value.trim();
  const fav = document.getElementById('f-fav').checked;
  const editingId = document.getElementById('f-editing-id').value;
  const imagePreview = document.getElementById('f-image-preview');

  if (!name || !ingredientsRaw || !instructions) {
    alert('Please fill in Recipe Name, Ingredients, and Instructions.');
    return;
  }

  const ingredients = ingredientsRaw.split('\n').map(s => s.trim()).filter(Boolean);
  const tags = tagsRaw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const imageData = imagePreview.src && imagePreview.style.display !== 'none' ? imagePreview.src : '';

  if (editingId) {
    const r = recipes.find(x => x.id === parseInt(editingId));
    if (r) {
      r.name = name;
      r.ingredients = ingredients;
      r.time = time;
      r.tags = tags;
      r.instructions = instructions;
      r.favourite = fav;
      if (imageData) r.image = imageData;
    }
  } else {
    recipes.push({ id: nextId++, name, ingredients, time, tags, instructions, favourite: fav, image: imageData });
  }

  syncStats();
  navigate('recipes');
}

function deleteRecipe() {
  const editingId = parseInt(document.getElementById('f-editing-id').value);
  if (!editingId) return;
  if (!confirm('Remove this recipe?')) return;
  recipes = recipes.filter(r => r.id !== editingId);
  // Clear from all meal plans
  Object.values(mealPlans).forEach(week => {
    week.forEach(day => {
      day.forEach((v, i) => { if (v === editingId) day[i] = null; });
    });
  });
  syncStats();
  navigate('recipes');
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
// ══════════════════ INIT ══════════════════
const startPage = window.location.hash.replace('#', '') || 'home';
navigate(startPage);

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