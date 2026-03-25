// ============================================
// Admin Panel — Google Drive Gallery Manager
// ============================================

import { db, auth, GOOGLE_CLIENT_ID, GOOGLE_API_KEY, SCOPES, ADMIN_EMAILS, loadGoogleApis } from './firebase-config.js';
import {
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  getDocs,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// -------------------------------------------
// DOM refs
// -------------------------------------------
const loginGate = document.getElementById('loginGate');
const adminPanel = document.getElementById('adminPanel');
const logoutBtn = document.getElementById('logoutBtn');
const googleSignInBtn = document.getElementById('googleSignInBtn');
const loginError = document.getElementById('loginError');

const drivePickerBtn = document.getElementById('drivePickerBtn');
const publishQueue = document.getElementById('publishQueue');
const queueItems = document.getElementById('queueItems');
const publishAllBtn = document.getElementById('publishAllBtn');
const clearQueueBtn = document.getElementById('clearQueueBtn');

const adminPhotos = document.getElementById('adminPhotos');
const adminEmpty = document.getElementById('adminEmpty');
const adminSearch = document.getElementById('adminSearch');
const adminCategoryFilter = document.getElementById('adminCategoryFilter');

const editModalOverlay = document.getElementById('editModalOverlay');
const editForm = document.getElementById('editForm');
const editCancelBtn = document.getElementById('editCancelBtn');

// -------------------------------------------
// State
// -------------------------------------------
// WHY: Store the Google OAuth access token separately — Firebase auth token != Drive API token
let googleAccessToken = null;
// WHY: Track token expiry so we can re-auth proactively instead of hitting 401s
let tokenExpiresAt = 0;
let pendingQueue = [];
let allPhotos = [];

// -------------------------------------------
// Auth — Google sign-in via Firebase
// -------------------------------------------
const provider = new GoogleAuthProvider();
// WHY: drive.readonly lets us read file metadata and sharing settings; drive.file would be more restrictive but doesn't support Picker
provider.addScope(SCOPES);
// WHY: Force account selection every time so user can switch accounts if needed
provider.setCustomParameters({ prompt: 'select_account' });

onAuthStateChanged(auth, (user) => {
  if (user && ADMIN_EMAILS.includes(user.email)) {
    loginGate.style.display = 'none';
    adminPanel.style.display = 'block';
    logoutBtn.style.display = 'block';
    loadPublishedPhotos();
  } else if (user) {
    // WHY: Signed in but not an admin — sign them out and show error
    signOut(auth);
    loginError.textContent = 'Access denied. This account is not authorized.';
    loginError.style.display = 'block';
  } else {
    loginGate.style.display = 'flex';
    adminPanel.style.display = 'none';
    logoutBtn.style.display = 'none';
    googleAccessToken = null;
    tokenExpiresAt = 0;
  }
});

if (googleSignInBtn) {
  googleSignInBtn.addEventListener('click', async () => {
    loginError.style.display = 'none';
    try {
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      googleAccessToken = credential.accessToken;
      // WHY: Google OAuth tokens expire after 1 hour (3600s); subtract 60s buffer for safety
      tokenExpiresAt = Date.now() + (3540 * 1000);
    } catch (err) {
      console.error('Sign-in error:', err);
      loginError.textContent = err.code === 'auth/popup-closed-by-user'
        ? 'Sign-in cancelled.'
        : 'Sign-in failed. Try again.';
      loginError.style.display = 'block';
    }
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener('click', () => signOut(auth));
}

// -------------------------------------------
// Token management
// -------------------------------------------
async function ensureAccessToken() {
  if (googleAccessToken && Date.now() < tokenExpiresAt) {
    return googleAccessToken;
  }
  // WHY: Re-trigger sign-in to refresh the OAuth access token (Firebase doesn't auto-refresh it)
  const result = await signInWithPopup(auth, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  googleAccessToken = credential.accessToken;
  tokenExpiresAt = Date.now() + (3540 * 1000);
  return googleAccessToken;
}

// -------------------------------------------
// Google Picker — browse Drive and select photos
// -------------------------------------------
if (drivePickerBtn) {
  drivePickerBtn.addEventListener('click', async () => {
    drivePickerBtn.textContent = 'Loading...';
    drivePickerBtn.disabled = true;
    try {
      await loadGoogleApis();
      const token = await ensureAccessToken();
      openPicker(token);
    } catch (err) {
      console.error('Picker setup error:', err);
      alert('Could not open Google Drive: ' + (err.message || err));
    } finally {
      drivePickerBtn.textContent = 'Browse Google Drive';
      drivePickerBtn.disabled = false;
    }
  });
}

function openPicker(accessToken) {
  const view = new google.picker.DocsView(google.picker.ViewId.DOCS_IMAGES)
    .setIncludeFolders(true)
    .setSelectFolderEnabled(false);

  // WHY: AppId is the numeric GCP project number — extract just the digits before the dash in the Client ID
  const appId = GOOGLE_CLIENT_ID.split('-')[0];

  // WHY: MULTISELECT_ENABLED lets admin batch-select photos instead of picking one at a time
  const picker = new google.picker.PickerBuilder()
    .setDeveloperKey(GOOGLE_API_KEY)
    .setOAuthToken(accessToken)
    .setAppId(appId)
    .addView(view)
    .setOrigin(window.location.protocol + '//' + window.location.host)
    .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
    .setTitle('Select photos to publish')
    .setCallback(pickerCallback)
    .build();

  picker.setVisible(true);
}

function pickerCallback(data) {
  if (data.action !== google.picker.Action.PICKED) return;

  const newItems = data.docs.map(doc => ({
    driveFileId: doc.id,
    driveName: doc.name,
    driveMimeType: doc.mimeType,
    driveUrl: doc.url,
    // WHY: lh3.googleusercontent.com serves Drive images publicly with resize params — no auth needed for viewers
    thumbnailUrl: `https://lh3.googleusercontent.com/d/${doc.id}=w400`,
    fullUrl: `https://lh3.googleusercontent.com/d/${doc.id}=w1600`,
    caption: '',
    location: '',
    category: '',
    tags: [],
    people: []
  }));

  // WHY: Deduplicate by driveFileId so re-picking doesn't create duplicates in queue
  const existingIds = new Set(pendingQueue.map(p => p.driveFileId));
  const uniqueNew = newItems.filter(item => !existingIds.has(item.driveFileId));
  pendingQueue.push(...uniqueNew);
  renderQueue();
}

// -------------------------------------------
// Publish queue UI
// -------------------------------------------
function renderQueue() {
  if (pendingQueue.length === 0) {
    publishQueue.style.display = 'none';
    return;
  }

  publishQueue.style.display = 'block';
  queueItems.innerHTML = '';

  pendingQueue.forEach((item, index) => {
    const el = document.createElement('div');
    el.className = 'queue-item';
    el.innerHTML = `
      <img class="queue-thumb" src="${escapeHtml(item.thumbnailUrl)}" alt="" loading="lazy">
      <div class="queue-item-info">
        <span class="queue-item-name">${escapeHtml(item.driveName)}</span>
        <div class="queue-item-fields">
          <input type="text" class="queue-caption" data-index="${index}" placeholder="Caption" value="${escapeHtml(item.caption)}">
          <select class="queue-category" data-index="${index}">
            <option value="">Category</option>
            <option value="family" ${item.category === 'family' ? 'selected' : ''}>Family</option>
            <option value="events" ${item.category === 'events' ? 'selected' : ''}>Events</option>
            <option value="forum" ${item.category === 'forum' ? 'selected' : ''}>Forum</option>
            <option value="coaching" ${item.category === 'coaching' ? 'selected' : ''}>Coaching</option>
            <option value="speaking" ${item.category === 'speaking' ? 'selected' : ''}>Speaking</option>
            <option value="travel" ${item.category === 'travel' ? 'selected' : ''}>Travel</option>
          </select>
          <input type="text" class="queue-tags" data-index="${index}" placeholder="Tags (comma-separated)" value="${escapeHtml(item.tags.join(', '))}">
          <input type="text" class="queue-people" data-index="${index}" placeholder="People (comma-separated)" value="${escapeHtml(item.people.join(', '))}">
        </div>
      </div>
      <button class="queue-remove-btn" data-index="${index}">&times;</button>
    `;

    // Bind inline field changes back to the queue state
    el.querySelector('.queue-caption').addEventListener('input', (e) => {
      pendingQueue[e.target.dataset.index].caption = e.target.value;
    });
    el.querySelector('.queue-category').addEventListener('change', (e) => {
      pendingQueue[e.target.dataset.index].category = e.target.value;
    });
    el.querySelector('.queue-tags').addEventListener('input', (e) => {
      pendingQueue[e.target.dataset.index].tags = parseCommaSeparated(e.target.value);
    });
    el.querySelector('.queue-people').addEventListener('input', (e) => {
      pendingQueue[e.target.dataset.index].people = parseCommaSeparated(e.target.value);
    });
    el.querySelector('.queue-remove-btn').addEventListener('click', (e) => {
      pendingQueue.splice(parseInt(e.target.dataset.index), 1);
      renderQueue();
    });

    queueItems.appendChild(el);
  });
}

if (clearQueueBtn) {
  clearQueueBtn.addEventListener('click', () => {
    pendingQueue = [];
    renderQueue();
  });
}

// -------------------------------------------
// Publish flow
// -------------------------------------------
if (publishAllBtn) {
  publishAllBtn.addEventListener('click', async () => {
    if (pendingQueue.length === 0) return;

    publishAllBtn.textContent = 'Publishing...';
    publishAllBtn.disabled = true;

    try {
      const token = await ensureAccessToken();

      let published = 0;
      for (const item of pendingQueue) {
        // WHY: Share first so lh3 CDN URLs work, but don't block publish if it fails
        try {
          await shareDriveFile(token, item.driveFileId);
        } catch (shareErr) {
          console.warn('Share failed (continuing anyway):', item.driveName, shareErr);
        }

        await addDoc(collection(db, 'photos'), {
          driveFileId: item.driveFileId,
          driveUrl: item.driveUrl,
          driveName: item.driveName,
          driveMimeType: item.driveMimeType,
          caption: item.caption || '',
          location: item.location || '',
          category: item.category || '',
          tags: item.tags || [],
          people: item.people || [],
          publishedAt: serverTimestamp()
        });
        published++;
        publishAllBtn.textContent = `Publishing... ${published}/${pendingQueue.length}`;
      }

      pendingQueue = [];
      renderQueue();
      loadPublishedPhotos();
    } catch (err) {
      console.error('Publish error:', err);
      alert('Publish failed: ' + (err.message || err) + '\n\nIf this is a permissions error, make sure Firestore rules are deployed: firebase deploy --only firestore:rules');
    } finally {
      publishAllBtn.textContent = 'Publish all';
      publishAllBtn.disabled = false;
    }
  });
}

// WHY: Share the Drive file publicly so the lh3 CDN URL works without authentication
async function shareDriveFile(accessToken, fileId) {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        role: 'reader',
        type: 'anyone'
      })
    }
  );

  if (!response.ok) {
    const body = await response.text();
    // WHY: 409 = permission already exists, which is fine — only throw on real errors
    if (response.status !== 409) {
      console.warn(`Share failed for ${fileId}:`, response.status, body);
    }
  }
}

// -------------------------------------------
// Published photos management
// -------------------------------------------
async function loadPublishedPhotos() {
  try {
    const q = query(collection(db, 'photos'), orderBy('publishedAt', 'desc'));
    const snapshot = await getDocs(q);

    allPhotos = [];
    snapshot.forEach((docSnap) => {
      allPhotos.push({ id: docSnap.id, ...docSnap.data() });
    });

    renderPublishedPhotos(allPhotos);
  } catch (err) {
    console.error('Error loading published photos:', err);
  }
}

function renderPublishedPhotos(photos) {
  adminPhotos.innerHTML = '';

  if (photos.length === 0) {
    adminEmpty.style.display = 'block';
    return;
  }

  adminEmpty.style.display = 'none';

  photos.forEach((photo) => {
    const thumbUrl = `https://lh3.googleusercontent.com/d/${photo.driveFileId}=w200`;
    const date = photo.publishedAt
      ? photo.publishedAt.toDate().toLocaleDateString('en-US', {
          year: 'numeric', month: 'short', day: 'numeric'
        })
      : 'Pending...';

    const categoryLabel = photo.category
      ? `<span class="admin-photo-category">${escapeHtml(photo.category)}</span>`
      : '';

    const el = document.createElement('div');
    el.className = 'admin-post';
    el.innerHTML = `
      <img class="admin-post-thumb" src="${escapeHtml(thumbUrl)}" alt="" loading="lazy">
      <div class="admin-post-info">
        <p class="admin-post-caption">${escapeHtml(photo.caption || photo.driveName)}</p>
        <span class="admin-post-date">${date}${photo.location ? ' — ' + escapeHtml(photo.location) : ''} ${categoryLabel}</span>
      </div>
      <div class="admin-post-actions">
        <button class="edit-btn" data-id="${photo.id}">Edit</button>
        <button class="delete-btn" data-id="${photo.id}">Remove</button>
      </div>
    `;

    el.querySelector('.edit-btn').addEventListener('click', () => openEditModal(photo));
    el.querySelector('.delete-btn').addEventListener('click', async () => {
      if (!confirm('Remove this photo from the gallery? (It stays in Google Drive.)')) return;
      const btn = el.querySelector('.delete-btn');
      btn.textContent = '...';
      btn.disabled = true;
      try {
        // WHY: Only delete from Firestore — never touch the Drive file
        await deleteDoc(doc(db, 'photos', photo.id));
        loadPublishedPhotos();
      } catch (err) {
        console.error('Remove error:', err);
        btn.textContent = 'Error';
        btn.disabled = false;
      }
    });

    adminPhotos.appendChild(el);
  });
}

// -------------------------------------------
// Search & filter published photos
// -------------------------------------------
if (adminSearch) {
  let searchTimeout;
  adminSearch.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    // WHY: 300ms debounce prevents excessive re-renders while typing
    searchTimeout = setTimeout(filterPublishedPhotos, 300);
  });
}

if (adminCategoryFilter) {
  adminCategoryFilter.addEventListener('change', filterPublishedPhotos);
}

function filterPublishedPhotos() {
  const searchTerm = (adminSearch.value || '').toLowerCase().trim();
  const categoryVal = adminCategoryFilter.value;

  const filtered = allPhotos.filter(photo => {
    if (categoryVal && photo.category !== categoryVal) return false;
    if (!searchTerm) return true;

    const searchable = [
      photo.caption,
      photo.location,
      photo.driveName,
      ...(photo.tags || []),
      ...(photo.people || [])
    ].join(' ').toLowerCase();

    return searchable.includes(searchTerm);
  });

  renderPublishedPhotos(filtered);
}

// -------------------------------------------
// Edit modal
// -------------------------------------------
function openEditModal(photo) {
  document.getElementById('editPhotoId').value = photo.id;
  document.getElementById('editCaption').value = photo.caption || '';
  document.getElementById('editLocation').value = photo.location || '';
  document.getElementById('editCategory').value = photo.category || '';
  document.getElementById('editTags').value = (photo.tags || []).join(', ');
  document.getElementById('editPeople').value = (photo.people || []).join(', ');
  editModalOverlay.style.display = 'flex';
}

if (editCancelBtn) {
  editCancelBtn.addEventListener('click', () => {
    editModalOverlay.style.display = 'none';
  });
}

if (editModalOverlay) {
  editModalOverlay.addEventListener('click', (e) => {
    if (e.target === editModalOverlay) {
      editModalOverlay.style.display = 'none';
    }
  });
}

if (editForm) {
  editForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const photoId = document.getElementById('editPhotoId').value;
    const submitBtn = editForm.querySelector('.submit-btn');
    submitBtn.textContent = 'Saving...';
    submitBtn.disabled = true;

    try {
      await updateDoc(doc(db, 'photos', photoId), {
        caption: document.getElementById('editCaption').value.trim(),
        location: document.getElementById('editLocation').value.trim(),
        category: document.getElementById('editCategory').value,
        tags: parseCommaSeparated(document.getElementById('editTags').value),
        people: parseCommaSeparated(document.getElementById('editPeople').value)
      });

      editModalOverlay.style.display = 'none';
      loadPublishedPhotos();
    } catch (err) {
      console.error('Update error:', err);
      alert('Failed to save changes.');
    } finally {
      submitBtn.textContent = 'Save';
      submitBtn.disabled = false;
    }
  });
}

// -------------------------------------------
// Utilities
// -------------------------------------------
function parseCommaSeparated(str) {
  if (!str) return [];
  return str.split(',').map(s => s.trim()).filter(Boolean);
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
