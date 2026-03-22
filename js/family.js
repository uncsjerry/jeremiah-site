// ============================================
// Gallery — Public page JS (Google Drive + Firestore)
// ============================================

import { db } from './firebase-config.js';
import {
  collection,
  query,
  where,
  orderBy,
  getDocs
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// WHY: "jeremiah" visibility tag — this site shows only photos tagged for Jeremiah
const SITE_ID = 'jeremiah';

// -------------------------------------------
// DOM refs
// -------------------------------------------
const galleryGrid = document.getElementById('galleryGrid');
const feedEmpty = document.getElementById('feedEmpty');
const feedLoading = document.getElementById('feedLoading');
const categoryTabs = document.getElementById('categoryTabs');
const gallerySearch = document.getElementById('gallerySearch');
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightboxImg');
const lightboxMeta = document.getElementById('lightboxMeta');
const lightboxClose = document.getElementById('lightboxClose');
const lightboxPrev = document.getElementById('lightboxPrev');
const lightboxNext = document.getElementById('lightboxNext');

// -------------------------------------------
// State
// -------------------------------------------
let allPhotos = [];
let filteredPhotos = [];
let activeCategory = '';
let searchTerm = '';
let lightboxIndex = -1;
let galleryExpanded = false;

const galleryContainer = document.querySelector('.gallery-container');

// -------------------------------------------
// Load all photos from Firestore
// -------------------------------------------
async function loadPhotos() {
  try {
    // WHY: Only fetch approved photos tagged with this site's SITE_ID
    // WHY: Requires composite index on (status, visibility, publishedAt)
    const q = query(
      collection(db, 'photos'),
      where('status', '==', 'approved'),
      where('visibility', 'array-contains', SITE_ID),
      orderBy('publishedAt', 'desc')
    );
    const snapshot = await getDocs(q);

    feedLoading.style.display = 'none';

    if (snapshot.empty) {
      feedEmpty.style.display = 'block';
      return;
    }

    allPhotos = [];
    snapshot.forEach((doc) => {
      allPhotos.push({ id: doc.id, ...doc.data() });
    });

    // WHY: Don't render on load — gallery starts collapsed, photos load silently until user picks a category
  } catch (err) {
    console.error('Error loading photos:', err);
    feedLoading.style.display = 'none';

    // WHY: If Firebase isn't configured yet, show empty state gracefully instead of crashing
    if (err.code === 'auth/invalid-api-key' || (err.message && err.message.includes('YOUR_API_KEY'))) {
      feedEmpty.style.display = 'block';
      const sub = feedEmpty.querySelector('.empty-sub');
      if (sub) sub.textContent = 'Firebase not configured yet.';
    } else {
      feedEmpty.style.display = 'block';
    }
  }
}

// -------------------------------------------
// Filter logic
// -------------------------------------------
function applyFilters() {
  const term = searchTerm.toLowerCase();

  filteredPhotos = allPhotos.filter(photo => {
    // Category filter
    if (activeCategory && photo.category !== activeCategory) return false;

    // Text search across caption, tags, people, location
    if (term) {
      const searchable = [
        photo.caption,
        photo.location,
        photo.driveName,
        ...(photo.tags || []),
        ...(photo.people || [])
      ].join(' ').toLowerCase();

      if (!searchable.includes(term)) return false;
    }

    return true;
  });

  renderGallery();
}

// -------------------------------------------
// Expand / Collapse gallery
// -------------------------------------------
function expandGallery() {
  galleryExpanded = true;
  if (galleryContainer) galleryContainer.classList.add('gallery-expanded');
  if (gallerySearch) gallerySearch.style.display = '';
}

function collapseGallery() {
  galleryExpanded = false;
  if (galleryContainer) galleryContainer.classList.remove('gallery-expanded');
  if (galleryGrid) galleryGrid.innerHTML = '';
  if (feedEmpty) feedEmpty.style.display = 'none';
  if (gallerySearch) gallerySearch.style.display = 'none';
}

// -------------------------------------------
// Category tabs
// -------------------------------------------
if (categoryTabs) {
  categoryTabs.addEventListener('click', (e) => {
    const tab = e.target.closest('.category-tab');
    if (!tab) return;

    // WHY: Clicking the already-active tab collapses the gallery back to hidden state
    if (tab.classList.contains('active') && galleryExpanded) {
      categoryTabs.querySelectorAll('.category-tab').forEach(t => t.classList.remove('active'));
      activeCategory = '';
      collapseGallery();
      return;
    }

    categoryTabs.querySelectorAll('.category-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    activeCategory = tab.dataset.category;
    expandGallery();
    applyFilters();
  });
}

// -------------------------------------------
// Search input with debounce
// -------------------------------------------
if (gallerySearch) {
  let searchTimeout;
  gallerySearch.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    // WHY: 300ms debounce prevents jank from re-rendering on every keystroke
    searchTimeout = setTimeout(() => {
      searchTerm = gallerySearch.value.trim();
      applyFilters();
    }, 300);
  });

  // WHY: Gallery starts collapsed — hide search until a category is selected
  gallerySearch.style.display = 'none';
}

// -------------------------------------------
// Render gallery grid
// -------------------------------------------
function renderGallery() {
  galleryGrid.innerHTML = '';

  if (filteredPhotos.length === 0 && allPhotos.length > 0) {
    galleryGrid.innerHTML = '<p class="gallery-no-results">No photos match your search.</p>';
    return;
  }

  if (filteredPhotos.length === 0) {
    feedEmpty.style.display = 'block';
    return;
  }

  feedEmpty.style.display = 'none';

  filteredPhotos.forEach((photo, index) => {
    // WHY: w600 is a good balance between quality and load time for grid thumbnails
    const thumbUrl = `https://lh3.googleusercontent.com/d/${photo.driveFileId}=w600`;

    const card = document.createElement('article');
    card.className = 'gallery-card';
    // WHY: Stagger animation delay for visual cascade effect on load
    card.style.animationDelay = `${Math.min(index * 0.05, 0.5)}s`;

    const categoryBadge = photo.category
      ? `<span class="gallery-card-category">${escapeHtml(photo.category)}</span>`
      : '';

    const tagPills = (photo.tags || []).slice(0, 3).map(tag =>
      `<span class="gallery-card-tag">${escapeHtml(tag)}</span>`
    ).join('');

    card.innerHTML = `
      <div class="gallery-card-image">
        <img src="${escapeHtml(thumbUrl)}" alt="${escapeHtml(photo.caption || photo.driveName || 'Photo')}" loading="lazy">
        ${categoryBadge}
      </div>
      ${photo.caption ? `<p class="gallery-card-caption">${escapeHtml(photo.caption)}</p>` : ''}
      ${tagPills ? `<div class="gallery-card-tags">${tagPills}</div>` : ''}
    `;

    card.addEventListener('click', () => openLightbox(index));
    galleryGrid.appendChild(card);
  });
}

// -------------------------------------------
// Lightbox
// -------------------------------------------
function openLightbox(index) {
  lightboxIndex = index;
  updateLightbox();
  lightbox.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  lightbox.style.display = 'none';
  document.body.style.overflow = '';
  lightboxIndex = -1;
}

function updateLightbox() {
  if (lightboxIndex < 0 || lightboxIndex >= filteredPhotos.length) return;
  const photo = filteredPhotos[lightboxIndex];
  // WHY: w1600 for lightbox — high-res viewing without downloading the full original
  lightboxImg.src = `https://lh3.googleusercontent.com/d/${photo.driveFileId}=w1600`;
  lightboxImg.alt = photo.caption || photo.driveName || 'Photo';

  const date = photo.publishedAt
    ? photo.publishedAt.toDate().toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
      })
    : '';

  const peopleLine = (photo.people || []).length > 0
    ? `<span class="lightbox-people">${photo.people.map(p => escapeHtml(p)).join(', ')}</span>`
    : '';

  lightboxMeta.innerHTML = `
    ${photo.caption ? `<p class="lightbox-caption">${escapeHtml(photo.caption)}</p>` : ''}
    <div class="lightbox-details">
      ${photo.location ? `<span class="lightbox-location">${escapeHtml(photo.location)}</span>` : ''}
      ${date ? `<span class="lightbox-date">${date}</span>` : ''}
      ${photo.category ? `<span class="lightbox-category">${escapeHtml(photo.category)}</span>` : ''}
      ${peopleLine}
    </div>
  `;

  // WHY: Hide prev/next at boundaries instead of wrapping — clearer UX
  lightboxPrev.style.visibility = lightboxIndex > 0 ? 'visible' : 'hidden';
  lightboxNext.style.visibility = lightboxIndex < filteredPhotos.length - 1 ? 'visible' : 'hidden';
}

if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
if (lightboxPrev) lightboxPrev.addEventListener('click', () => {
  if (lightboxIndex > 0) { lightboxIndex--; updateLightbox(); }
});
if (lightboxNext) lightboxNext.addEventListener('click', () => {
  if (lightboxIndex < filteredPhotos.length - 1) { lightboxIndex++; updateLightbox(); }
});

// WHY: Close lightbox on overlay click (not on image click)
if (lightbox) {
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
  });
}

// Keyboard navigation
document.addEventListener('keydown', (e) => {
  if (lightbox.style.display === 'none') return;
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowLeft' && lightboxIndex > 0) { lightboxIndex--; updateLightbox(); }
  if (e.key === 'ArrowRight' && lightboxIndex < filteredPhotos.length - 1) { lightboxIndex++; updateLightbox(); }
});

// -------------------------------------------
// Escape HTML to prevent XSS
// -------------------------------------------
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// -------------------------------------------
// Init
// -------------------------------------------
loadPhotos();
