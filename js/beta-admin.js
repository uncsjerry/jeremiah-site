// ============================================
// Beta Admin — Signup & Feedback Management
// ============================================
// WHY: Gives Jeremiah a clean view of all beta signups and feedback
// without digging through the Firebase console. Google auth gated
// to the same admin emails as the photo gallery admin.

import { db, auth, ADMIN_EMAILS } from './firebase-config.js';
import {
  collection, getDocs, doc, updateDoc, query, orderBy, Timestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import {
  GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

// --- DOM refs ---
const loginGate = document.getElementById('loginGate');
const adminPanel = document.getElementById('adminPanel');
const logoutBtn = document.getElementById('logoutBtn');
const signInBtn = document.getElementById('googleSignInBtn');
const loginError = document.getElementById('loginError');

// --- App name map ---
const APP_NAMES = {
  'exercise-roulette': 'Exercise Roulette',
  'morrowmark': 'MorrowMark',
  'singles-advocate': 'Singles Advocate',
  'ceo-summer-camp': 'CEO Summer Camp',
};

// --- Data cache ---
let signups = [];
let feedback = [];

// ==========================================
// Auth
// ==========================================
signInBtn.addEventListener('click', async () => {
  try {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  } catch (err) {
    loginError.textContent = err.message;
    loginError.style.display = 'block';
  }
});

logoutBtn.addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, (user) => {
  if (user && ADMIN_EMAILS.includes(user.email)) {
    loginGate.style.display = 'none';
    adminPanel.style.display = 'block';
    logoutBtn.style.display = 'inline-block';
    loadData();
  } else {
    loginGate.style.display = 'flex';
    adminPanel.style.display = 'none';
    logoutBtn.style.display = 'none';
    if (user && !ADMIN_EMAILS.includes(user.email)) {
      loginError.textContent = `${user.email} is not an admin account.`;
      loginError.style.display = 'block';
      signOut(auth);
    }
  }
});

// ==========================================
// Data Loading
// ==========================================
async function loadData() {
  const [signupSnap, feedbackSnap] = await Promise.all([
    getDocs(query(collection(db, 'beta_signups'), orderBy('signedUpAt', 'desc'))),
    getDocs(query(collection(db, 'beta_feedback'), orderBy('submittedAt', 'desc'))),
  ]);

  signups = signupSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  feedback = feedbackSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  updateStats();
  renderSignups();
  renderFeedback();
}

function updateStats() {
  document.getElementById('totalSignups').textContent = signups.length;
  document.getElementById('totalFeedback').textContent = feedback.length;

  // Total app picks (sum of all apps arrays)
  const totalPicks = signups.reduce((sum, s) => sum + (s.apps?.length || 0), 0);
  document.getElementById('totalApps').textContent = totalPicks;
}

// ==========================================
// Tabs
// ==========================================
document.querySelector('.admin-tabs').addEventListener('click', (e) => {
  const tab = e.target.closest('.admin-tab');
  if (!tab) return;

  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  tab.classList.add('active');

  const target = tab.dataset.tab;
  document.getElementById('signupsTab').style.display = target === 'signups' ? 'block' : 'none';
  document.getElementById('feedbackTab').style.display = target === 'feedback' ? 'block' : 'none';
});

// ==========================================
// Signups
// ==========================================
function renderSignups() {
  const statusFilter = document.getElementById('signupStatusFilter').value;
  const appFilter = document.getElementById('signupAppFilter').value;

  let filtered = signups;
  if (statusFilter !== 'all') {
    filtered = filtered.filter(s => s.status === statusFilter);
  }
  if (appFilter !== 'all') {
    filtered = filtered.filter(s => s.apps?.includes(appFilter));
  }

  const list = document.getElementById('signupsList');

  if (filtered.length === 0) {
    list.innerHTML = '<p class="admin-empty">No signups match these filters.</p>';
    return;
  }

  list.innerHTML = filtered.map(s => {
    const date = formatDate(s.signedUpAt);
    const appTags = (s.apps || []).map(a =>
      `<span class="signup-app-tag">${APP_NAMES[a] || a}</span>`
    ).join('');

    return `
      <div class="signup-row">
        <div>
          <span class="signup-name">${esc(s.name)}</span><br>
          <span class="signup-email">${esc(s.email)}</span>
          <div class="signup-apps" style="margin-top:6px">${appTags}</div>
        </div>
        <span class="signup-device">${esc(s.device || '—')}</span>
        <span class="signup-date">${date}</span>
        <select class="status-select" data-id="${s.id}" data-collection="beta_signups">
          <option value="signed_up" ${s.status === 'signed_up' ? 'selected' : ''}>Signed Up</option>
          <option value="invited" ${s.status === 'invited' ? 'selected' : ''}>Invited</option>
          <option value="active" ${s.status === 'active' ? 'selected' : ''}>Active</option>
          <option value="ghosted" ${s.status === 'ghosted' ? 'selected' : ''}>Ghosted</option>
        </select>
      </div>
    `;
  }).join('');
}

// Signup filters
document.getElementById('signupStatusFilter').addEventListener('change', renderSignups);
document.getElementById('signupAppFilter').addEventListener('change', renderSignups);

// ==========================================
// Feedback
// ==========================================
function renderFeedback() {
  const appFilter = document.getElementById('feedbackAppFilter').value;
  const typeFilter = document.getElementById('feedbackTypeFilter').value;
  const statusFilter = document.getElementById('feedbackStatusFilter').value;

  let filtered = feedback;
  if (appFilter !== 'all') filtered = filtered.filter(f => f.app === appFilter);
  if (typeFilter !== 'all') filtered = filtered.filter(f => f.type === typeFilter);
  if (statusFilter !== 'all') filtered = filtered.filter(f => f.status === statusFilter);

  const list = document.getElementById('feedbackList');

  if (filtered.length === 0) {
    list.innerHTML = '<p class="admin-empty">No feedback matches these filters.</p>';
    return;
  }

  list.innerHTML = filtered.map(f => {
    const date = formatDate(f.submittedAt);
    const severity = f.type === 'bug' && f.severity
      ? `<span class="feedback-severity">${f.severity}</span>` : '';

    return `
      <div class="feedback-row">
        <div class="feedback-row-header">
          <span class="feedback-type-badge ${f.type}">${f.type}</span>
          ${severity}
          <span class="signup-app-tag">${APP_NAMES[f.app] || f.app}</span>
        </div>
        <div class="feedback-title">${esc(f.title)}</div>
        ${f.description ? `<p class="feedback-desc">${esc(f.description)}</p>` : ''}
        <div class="feedback-meta">
          <span>${esc(f.email)}</span>
          ${f.device ? `<span>${esc(f.device)}</span>` : ''}
          <span>${date}</span>
          <select class="feedback-status-select" data-id="${f.id}" data-collection="beta_feedback">
            <option value="new" ${f.status === 'new' ? 'selected' : ''}>New</option>
            <option value="reviewed" ${f.status === 'reviewed' ? 'selected' : ''}>Reviewed</option>
            <option value="fixed" ${f.status === 'fixed' ? 'selected' : ''}>Fixed</option>
            <option value="wontfix" ${f.status === 'wontfix' ? 'selected' : ''}>Won't Fix</option>
          </select>
        </div>
      </div>
    `;
  }).join('');
}

// Feedback filters
document.getElementById('feedbackAppFilter').addEventListener('change', renderFeedback);
document.getElementById('feedbackTypeFilter').addEventListener('change', renderFeedback);
document.getElementById('feedbackStatusFilter').addEventListener('change', renderFeedback);

// ==========================================
// Status Updates (inline dropdowns)
// ==========================================
// WHY: Clicking a status dropdown on any row updates Firestore immediately.
// Uses event delegation on the admin panel to catch all select changes.
document.getElementById('adminPanel').addEventListener('change', async (e) => {
  const select = e.target.closest('[data-collection]');
  if (!select) return;

  const docId = select.dataset.id;
  const coll = select.dataset.collection;
  const newStatus = select.value;

  try {
    await updateDoc(doc(db, coll, docId), { status: newStatus });

    // Update local cache
    if (coll === 'beta_signups') {
      const item = signups.find(s => s.id === docId);
      if (item) item.status = newStatus;
    } else {
      const item = feedback.find(f => f.id === docId);
      if (item) item.status = newStatus;
    }
  } catch (err) {
    console.error('Failed to update status:', err);
    alert('Failed to update — check the console.');
  }
});

// ==========================================
// Helpers
// ==========================================
function formatDate(ts) {
  if (!ts) return '—';
  const d = ts instanceof Timestamp ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function esc(str) {
  if (!str) return '';
  const el = document.createElement('span');
  el.textContent = str;
  return el.innerHTML;
}
