// ============================================
// Admin Panel — Auth, Upload, Manage Posts
// ============================================

import { db, storage, auth } from './firebase-config.js';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  getDocs,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js';

// -------------------------------------------
// DOM refs
// -------------------------------------------
const loginGate = document.getElementById('loginGate');
const adminPanel = document.getElementById('adminPanel');
const logoutBtn = document.getElementById('logoutBtn');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');

const uploadForm = document.getElementById('uploadForm');
const photoInput = document.getElementById('photoInput');
const dropzone = document.getElementById('dropzone');
const dropzoneContent = document.getElementById('dropzoneContent');
const previewImg = document.getElementById('previewImg');
const uploadBtn = document.getElementById('uploadBtn');
const uploadProgress = document.getElementById('uploadProgress');
const progressBar = document.getElementById('progressBar');

const adminPosts = document.getElementById('adminPosts');
const adminEmpty = document.getElementById('adminEmpty');

// -------------------------------------------
// Auth state
// -------------------------------------------
onAuthStateChanged(auth, (user) => {
  if (user) {
    loginGate.style.display = 'none';
    adminPanel.style.display = 'block';
    logoutBtn.style.display = 'block';
    loadAdminPosts();
  } else {
    loginGate.style.display = 'flex';
    adminPanel.style.display = 'none';
    logoutBtn.style.display = 'none';
  }
});

// -------------------------------------------
// Login
// -------------------------------------------
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.style.display = 'none';

    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      loginError.textContent = 'Invalid email or password.';
      loginError.style.display = 'block';
    }
  });
}

// -------------------------------------------
// Logout
// -------------------------------------------
if (logoutBtn) {
  logoutBtn.addEventListener('click', () => signOut(auth));
}

// -------------------------------------------
// Dropzone interactions
// -------------------------------------------
if (dropzone) {
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      photoInput.files = e.dataTransfer.files;
      showPreview(e.dataTransfer.files[0]);
    }
  });

  photoInput.addEventListener('change', () => {
    if (photoInput.files.length > 0) {
      showPreview(photoInput.files[0]);
    }
  });
}

function showPreview(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    previewImg.src = e.target.result;
    previewImg.style.display = 'block';
    dropzoneContent.style.display = 'none';
  };
  reader.readAsDataURL(file);
}

function resetUploadForm() {
  uploadForm.reset();
  previewImg.style.display = 'none';
  previewImg.src = '';
  dropzoneContent.style.display = 'flex';
  uploadProgress.style.display = 'none';
  progressBar.style.width = '0%';
  uploadBtn.textContent = 'Post it →';
  uploadBtn.disabled = false;
}

// -------------------------------------------
// Upload post
// -------------------------------------------
if (uploadForm) {
  uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const file = photoInput.files[0];
    if (!file) {
      alert('Please select a photo.');
      return;
    }

    uploadBtn.textContent = 'Uploading...';
    uploadBtn.disabled = true;
    uploadProgress.style.display = 'block';

    try {
      // WHY: Timestamp prefix ensures unique filenames and chronological ordering in storage
      const fileName = `${Date.now()}_${file.name}`;
      const storageRef = ref(storage, `family-photos/${fileName}`);

      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on('state_changed',
        (snapshot) => {
          const pct = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          progressBar.style.width = pct + '%';
          uploadBtn.textContent = `Uploading... ${Math.round(pct)}%`;
        },
        (error) => {
          console.error('Upload error:', error);
          console.error('Error code:', error.code);
          console.error('Error message:', error.message);
          uploadBtn.textContent = 'Upload failed: ' + (error.code || error.message);
          uploadBtn.disabled = false;
        },
        async () => {
          const imageUrl = await getDownloadURL(uploadTask.snapshot.ref);

          const caption = document.getElementById('caption').value.trim();
          const location = document.getElementById('location').value.trim();

          await addDoc(collection(db, 'posts'), {
            imageUrl,
            caption,
            location: location || null,
            // WHY: Store the storage path so we can delete the file later
            storagePath: `family-photos/${fileName}`,
            createdAt: serverTimestamp()
          });

          resetUploadForm();
          loadAdminPosts();
        }
      );
    } catch (err) {
      console.error('Post creation error:', err);
      uploadBtn.textContent = 'Error — try again';
      uploadBtn.disabled = false;
    }
  });
}

// -------------------------------------------
// Load posts in admin list
// -------------------------------------------
async function loadAdminPosts() {
  try {
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);

    adminPosts.innerHTML = '';

    if (snapshot.empty) {
      adminEmpty.style.display = 'block';
      return;
    }

    adminEmpty.style.display = 'none';

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const date = data.createdAt
        ? data.createdAt.toDate().toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric'
          })
        : 'Pending...';

      const el = document.createElement('div');
      el.className = 'admin-post';
      el.innerHTML = `
        <img class="admin-post-thumb" src="${escapeHtml(data.imageUrl)}" alt="" loading="lazy">
        <div class="admin-post-info">
          <p class="admin-post-caption">${escapeHtml(data.caption || 'No caption')}</p>
          <span class="admin-post-date">${date}${data.location ? ' — ' + escapeHtml(data.location) : ''}</span>
        </div>
        <button class="delete-btn" data-id="${docSnap.id}" data-path="${escapeHtml(data.storagePath || '')}">Delete</button>
      `;

      el.querySelector('.delete-btn').addEventListener('click', async (e) => {
        if (!confirm('Delete this post?')) return;

        const btn = e.target;
        const postId = btn.dataset.id;
        const storagePath = btn.dataset.path;

        btn.textContent = '...';
        btn.disabled = true;

        try {
          await deleteDoc(doc(db, 'posts', postId));

          if (storagePath) {
            try {
              await deleteObject(ref(storage, storagePath));
            } catch (storageErr) {
              // WHY: Storage delete can fail if file was already removed — don't block post deletion
              console.warn('Storage delete failed:', storageErr);
            }
          }

          loadAdminPosts();
        } catch (err) {
          console.error('Delete error:', err);
          btn.textContent = 'Error';
          btn.disabled = false;
        }
      });

      adminPosts.appendChild(el);
    });
  } catch (err) {
    console.error('Error loading admin posts:', err);
  }
}

// -------------------------------------------
// Escape HTML
// -------------------------------------------
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
