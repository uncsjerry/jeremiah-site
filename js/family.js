// ============================================
// Family Feed — Public page JS
// ============================================

import { db } from './firebase-config.js';
import {
  collection,
  query,
  orderBy,
  limit,
  startAfter,
  getDocs
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const BATCH_SIZE = 12; // WHY: 12 posts per load balances scroll depth vs. request count
let lastDoc = null;
let allLoaded = false;

const feed = document.getElementById('feed');
const feedEmpty = document.getElementById('feedEmpty');
const feedLoading = document.getElementById('feedLoading');
const loadMoreBtn = document.getElementById('loadMoreBtn');

// -------------------------------------------
// Render a single post card
// -------------------------------------------
function renderPost(doc) {
  const data = doc.data();
  const card = document.createElement('article');
  card.className = 'post-card';

  // WHY: Firestore timestamps can be null on pending writes — fallback to current date
  const date = data.createdAt
    ? data.createdAt.toDate().toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
      })
    : 'Just now';

  let locationBadge = '';
  if (data.location) {
    locationBadge = `<span class="post-location-badge">${escapeHtml(data.location)}</span>`;
  }

  card.innerHTML = `
    <div class="post-image-wrapper">
      <img class="post-image" src="${escapeHtml(data.imageUrl)}" alt="${escapeHtml(data.caption || 'Family photo')}" loading="lazy">
      ${locationBadge}
    </div>
    ${data.caption ? `<p class="post-caption">${escapeHtml(data.caption)}</p>` : ''}
    <span class="post-meta">${date}</span>
    <div class="post-divider"></div>
  `;

  return card;
}

// -------------------------------------------
// Fetch posts from Firestore
// -------------------------------------------
async function loadPosts() {
  try {
    let q;
    if (lastDoc) {
      q = query(
        collection(db, 'posts'),
        orderBy('createdAt', 'desc'),
        startAfter(lastDoc),
        limit(BATCH_SIZE)
      );
    } else {
      q = query(
        collection(db, 'posts'),
        orderBy('createdAt', 'desc'),
        limit(BATCH_SIZE)
      );
    }

    const snapshot = await getDocs(q);

    feedLoading.style.display = 'none';

    if (snapshot.empty && !lastDoc) {
      feedEmpty.style.display = 'block';
      return;
    }

    snapshot.forEach((doc) => {
      feed.appendChild(renderPost(doc));
    });

    if (snapshot.docs.length > 0) {
      lastDoc = snapshot.docs[snapshot.docs.length - 1];
    }

    if (snapshot.docs.length < BATCH_SIZE) {
      allLoaded = true;
      loadMoreBtn.style.display = 'none';
    } else {
      loadMoreBtn.style.display = 'block';
    }
  } catch (err) {
    console.error('Error loading posts:', err);
    feedLoading.style.display = 'none';

    // WHY: If Firebase isn't configured yet, show empty state gracefully instead of crashing
    if (err.code === 'auth/invalid-api-key' || err.message.includes('YOUR_API_KEY')) {
      feedEmpty.style.display = 'block';
      const sub = feedEmpty.querySelector('.empty-sub');
      if (sub) sub.textContent = 'Firebase not configured yet.';
    } else {
      feedEmpty.style.display = 'block';
    }
  }
}

// -------------------------------------------
// Escape HTML to prevent XSS
// -------------------------------------------
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// -------------------------------------------
// Init
// -------------------------------------------
if (loadMoreBtn) {
  loadMoreBtn.addEventListener('click', () => {
    if (!allLoaded) loadPosts();
  });
}

loadPosts();
