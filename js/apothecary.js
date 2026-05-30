// ============================================
// Apothecary + Alchemy — Behind The Apron
// Recipe vault powered by Firestore
// ============================================

import { db } from './firebase-config.js';
import {
  collection, query, where, orderBy, getDocs
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

(function () {
  'use strict';

  const grid = document.getElementById('recipeGrid');
  const emptyState = document.getElementById('emptyState');
  const searchInput = document.getElementById('recipeSearch');
  const filterButtons = document.querySelectorAll('.apothecary-filter');

  let allRecipes = [];
  let activeFilter = 'all';

  // -------------------------------------------
  // Load recipes from Firestore
  // -------------------------------------------
  async function loadRecipes() {
    try {
      const q = query(
        collection(db, 'recipes'),
        where('status', '==', 'published'),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);

      allRecipes = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      renderRecipes(allRecipes);
    } catch (err) {
      // WHY: Firestore collection may not exist yet — show empty state gracefully
      console.info('Recipes collection not loaded:', err.message);
      showEmptyState();
    }
  }

  // -------------------------------------------
  // Render recipe cards
  // -------------------------------------------
  function renderRecipes(recipes) {
    // Clear existing cards (keep empty state hidden)
    grid.querySelectorAll('.recipe-card').forEach(card => card.remove());

    const filtered = recipes.filter(r => {
      const matchesFilter = activeFilter === 'all' || r.category === activeFilter;
      const searchTerm = (searchInput?.value || '').toLowerCase();
      const matchesSearch = !searchTerm ||
        (r.title || '').toLowerCase().includes(searchTerm) ||
        (r.description || '').toLowerCase().includes(searchTerm) ||
        (r.story || '').toLowerCase().includes(searchTerm) ||
        (r.ingredients || []).some(i => i.toLowerCase().includes(searchTerm));
      return matchesFilter && matchesSearch;
    });

    if (filtered.length === 0) {
      showEmptyState();
      return;
    }

    emptyState.style.display = 'none';

    filtered.forEach(recipe => {
      const card = createRecipeCard(recipe);
      grid.appendChild(card);
    });
  }

  // -------------------------------------------
  // Create a single recipe card
  // -------------------------------------------
  function createRecipeCard(recipe) {
    const card = document.createElement('article');
    card.className = `recipe-card${recipe.category === 'dinner-party' ? ' dinner-party' : ''}`;
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');

    const imgHtml = recipe.imageUrl
      ? `<img class="recipe-card-img" src="${escapeHtml(recipe.imageUrl)}" alt="${escapeHtml(recipe.title)}" loading="lazy">`
      : `<div class="recipe-card-no-img">+</div>`;

    const categoryLabels = {
      'dinner-party': 'Dinner Party',
      'appetizer': 'Appetizer',
      'entree': 'Entr\u00e9e',
      'side': 'Side',
      'dessert': 'Dessert',
      'cocktail': 'Cocktail',
      'sauce': 'Sauce & Staple'
    };

    const metaParts = [];
    if (recipe.prepTime) metaParts.push(`Prep: ${recipe.prepTime}`);
    if (recipe.cookTime) metaParts.push(`Cook: ${recipe.cookTime}`);
    if (recipe.serves) metaParts.push(`Serves: ${recipe.serves}`);

    card.innerHTML = `
      ${imgHtml}
      <div class="recipe-card-body">
        <span class="recipe-card-category">${categoryLabels[recipe.category] || recipe.category || ''}</span>
        <h3 class="recipe-card-title">${escapeHtml(recipe.title || 'Untitled')}</h3>
        <p class="recipe-card-desc">${escapeHtml(recipe.description || '')}</p>
        ${metaParts.length ? `<div class="recipe-card-meta">${metaParts.map(m => `<span>${m}</span>`).join('')}</div>` : ''}
      </div>
    `;

    card.addEventListener('click', () => openRecipeModal(recipe));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openRecipeModal(recipe);
      }
    });

    return card;
  }

  // -------------------------------------------
  // Recipe Detail Modal
  // -------------------------------------------
  function openRecipeModal(recipe) {
    // Remove any existing modal
    document.querySelector('.recipe-modal-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.className = 'recipe-modal-overlay open';

    const imgHtml = recipe.imageUrl
      ? `<img class="recipe-modal-img" src="${escapeHtml(recipe.imageUrl)}" alt="${escapeHtml(recipe.title)}">`
      : '';

    const categoryLabels = {
      'dinner-party': 'Dinner Party',
      'appetizer': 'Appetizer',
      'entree': 'Entr\u00e9e',
      'side': 'Side',
      'dessert': 'Dessert',
      'cocktail': 'Cocktail',
      'sauce': 'Sauce & Staple'
    };

    // Build meta section
    let metaHtml = '';
    const metaItems = [];
    if (recipe.prepTime) metaItems.push({ label: 'Prep', value: recipe.prepTime });
    if (recipe.cookTime) metaItems.push({ label: 'Cook', value: recipe.cookTime });
    if (recipe.serves) metaItems.push({ label: 'Serves', value: recipe.serves });
    if (recipe.occasion) metaItems.push({ label: 'Occasion', value: recipe.occasion });
    if (metaItems.length) {
      metaHtml = `<div class="recipe-modal-meta">${metaItems.map(m =>
        `<div class="recipe-modal-meta-item">
          <span class="recipe-modal-meta-label">${m.label}</span>
          <span class="recipe-modal-meta-value">${escapeHtml(m.value)}</span>
        </div>`
      ).join('')}</div>`;
    }

    // Build story section
    const storyHtml = recipe.story
      ? `<div class="recipe-modal-story">${escapeHtml(recipe.story)}</div>`
      : '';

    // Build content based on type
    let contentHtml = '';
    if (recipe.category === 'dinner-party' && recipe.menu) {
      // Dinner party: show menu as course list
      contentHtml = `
        <h4 class="recipe-modal-section-title">The Menu</h4>
        <ul class="recipe-modal-menu">
          ${recipe.menu.map(item =>
            `<li>
              <span class="recipe-modal-menu-dish">${escapeHtml(item.dish)}</span>
              <span class="recipe-modal-menu-course">${escapeHtml(item.course || '')}</span>
            </li>`
          ).join('')}
        </ul>
      `;
    } else {
      // Regular recipe: ingredients + steps
      if (recipe.ingredients && recipe.ingredients.length) {
        contentHtml += `
          <h4 class="recipe-modal-section-title">Ingredients</h4>
          <ul class="recipe-modal-ingredients">
            ${recipe.ingredients.map(i => `<li>${escapeHtml(i)}</li>`).join('')}
          </ul>
        `;
      }
      if (recipe.steps && recipe.steps.length) {
        contentHtml += `
          <h4 class="recipe-modal-section-title">Method</h4>
          <ol class="recipe-modal-steps">
            ${recipe.steps.map(s => `<li>${escapeHtml(s)}</li>`).join('')}
          </ol>
        `;
      }
    }

    overlay.innerHTML = `
      <div class="recipe-modal">
        <button class="recipe-modal-close" aria-label="Close">&times;</button>
        ${imgHtml}
        <div class="recipe-modal-body">
          <span class="recipe-modal-category">${categoryLabels[recipe.category] || recipe.category || ''}</span>
          <h2 class="recipe-modal-title">${escapeHtml(recipe.title || 'Untitled')}</h2>
          ${metaHtml}
          ${storyHtml}
          ${contentHtml}
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    // Close handlers
    const closeModal = () => {
      overlay.classList.remove('open');
      document.body.style.overflow = '';
      setTimeout(() => overlay.remove(), 300);
    };

    overlay.querySelector('.recipe-modal-close').addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });
    document.addEventListener('keydown', function escHandler(e) {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', escHandler);
      }
    });
  }

  // -------------------------------------------
  // Filter handling
  // -------------------------------------------
  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      filterButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.filter;
      renderRecipes(allRecipes);
    });
  });

  // -------------------------------------------
  // Search handling
  // -------------------------------------------
  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => renderRecipes(allRecipes), 250);
    });
  }

  // -------------------------------------------
  // Helpers
  // -------------------------------------------
  function showEmptyState() {
    emptyState.style.display = '';
  }

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // -------------------------------------------
  // Init
  // -------------------------------------------
  loadRecipes();

})();
