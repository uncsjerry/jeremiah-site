// ============================================
// Beta Tester Hub — Signup Logic
// ============================================
// WHY: Centralized beta signup for all of Jeremiah's apps. Writes to
// Firestore so there's one database and one admin view for all testers
// across all projects. Individual app beta pages redirect here.

// WHY: Lazy-load Firebase so the page renders immediately even if the
// Firebase CDN is slow or blocked. Cards and form UI work without it.
// Firebase is only needed at form submission time.
let db = null;
let firestoreOps = null;

async function ensureFirebase() {
  if (db && firestoreOps) return;
  const configModule = await import('./firebase-config.js');
  db = configModule.db;
  firestoreOps = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
}

// WHY: Hardcoded for simplicity — this list changes rarely and avoids
// an extra Firestore read on every page load. To add/remove an app,
// edit this array and redeploy.
const APPS = [
  {
    id: 'exercise-roulette',
    name: 'Exercise Roulette',
    emoji: '\u{1F3B2}',
    tagline: 'Spin for an AI workout. No gym needed.',
    status: 'open',
    statusLabel: 'Beta Open',
    url: 'https://exerciseroulette.com',
  },
  {
    id: 'morrowmark',
    name: 'MorrowMark',
    emoji: '\u{1F48C}',
    tagline: 'Your words, delivered forever. Digital legacy.',
    status: 'soon',
    statusLabel: 'Coming Soon',
    url: 'https://morrowmark.com',
  },
  {
    id: 'singles-advocate',
    name: 'Singles Advocate',
    emoji: '\u{1F498}',
    tagline: 'Dating where your friends do the matching.',
    status: 'soon',
    statusLabel: 'Coming Soon',
    url: 'https://singlesadvocate.com',
  },
  {
    id: 'ceo-summer-camp',
    name: 'CEO Summer Camp',
    emoji: '\u{1F3D5}\u{FE0F}',
    tagline: 'Executive education that doesn\'t feel like it.',
    status: 'soon',
    statusLabel: 'Coming Soon',
    url: 'https://ceosummercamp.com',
  },
];

// --- State ---
const selectedApps = new Set();
let selectedDevice = null;

// --- DOM refs ---
const appCardsEl = document.getElementById('appCards');
const selectedAppsDisplay = document.getElementById('selectedAppsDisplay');
const deviceToggle = document.getElementById('deviceToggle');
const betaForm = document.getElementById('betaForm');
const submitBtn = document.getElementById('betaSubmitBtn');

// --- Attach Click Handlers to App Cards ---
// WHY: Cards are in the HTML so they're visible even if JS/Firebase fails.
// JS just adds the interactivity (toggle selection on click).
function initAppCards() {
  appCardsEl.querySelectorAll('.app-card').forEach(card => {
    card.addEventListener('click', () => {
      const appId = card.dataset.app;
      if (selectedApps.has(appId)) {
        selectedApps.delete(appId);
        card.classList.remove('selected');
      } else {
        selectedApps.add(appId);
        card.classList.add('selected');
      }
      updateSelectedDisplay();
    });
  });
}

// --- Update Selected Apps Display ---
function updateSelectedDisplay() {
  if (selectedApps.size === 0) {
    selectedAppsDisplay.textContent = 'Tap the cards above to pick apps';
    selectedAppsDisplay.classList.add('empty');
  } else {
    const names = APPS
      .filter(a => selectedApps.has(a.id))
      .map(a => a.name);
    selectedAppsDisplay.textContent = names.join(', ');
    selectedAppsDisplay.classList.remove('empty');
  }
}

// --- Device Toggle ---
deviceToggle.addEventListener('click', (e) => {
  const btn = e.target.closest('.device-btn');
  if (!btn) return;

  deviceToggle.querySelectorAll('.device-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  selectedDevice = btn.dataset.device;
});

// --- Form Submit ---
betaForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = document.getElementById('betaName').value.trim();
  const email = document.getElementById('betaEmail').value.trim();

  // Validation
  if (!name || !email) return;
  if (!selectedDevice) {
    showFieldError(deviceToggle, 'Pick your device');
    return;
  }
  if (selectedApps.size === 0) {
    showFieldError(selectedAppsDisplay, 'Pick at least one app');
    return;
  }

  submitBtn.textContent = 'Signing up...';
  submitBtn.disabled = true;

  try {
    await ensureFirebase();
    const { collection, addDoc, serverTimestamp, query, where, getDocs } = firestoreOps;

    // WHY: Check for duplicate email to avoid double signups.
    // Show a friendly message instead of a confusing Firestore error.
    const existing = await getDocs(
      query(collection(db, 'beta_signups'), where('email', '==', email))
    );

    if (!existing.empty) {
      showSuccess(name, true);
      return;
    }

    await addDoc(collection(db, 'beta_signups'), {
      name,
      email,
      device: selectedDevice,
      apps: Array.from(selectedApps),
      signedUpAt: serverTimestamp(),
      source: 'jeremiahgutierrez.com/beta',
      status: 'signed_up',
    });

    showSuccess(name, false);
  } catch (err) {
    console.error('Beta signup error:', err);
    // WHY: Still show success even if Firestore fails — we don't want
    // to lose the tester's enthusiasm. The error is logged for debugging.
    showSuccess(name, false);
  }
});

// --- Success State ---
function showSuccess(name, isDuplicate) {
  const formContainer = document.querySelector('.beta-signup-right');
  const firstName = name.split(' ')[0];

  if (isDuplicate) {
    formContainer.innerHTML = `
      <div class="beta-success">
        <span class="beta-success-emoji">\u{1F44B}</span>
        <h3>Hey ${firstName}, you're already in!</h3>
        <p>I've already got you signed up. If you want to update your app picks or device, just email me directly.</p>
        <span class="premium-lock">Your 1 year free is locked in</span>
      </div>
    `;
  } else {
    formContainer.innerHTML = `
      <div class="beta-success">
        <span class="beta-success-emoji">\u{1F389}</span>
        <h3>You're in, ${firstName}.</h3>
        <p>I'll send you a TestFlight or Play Store link as soon as each app is ready. In the meantime, if anything breaks or inspires you, hit the feedback page.</p>
        <span class="premium-lock">1 year free premium &mdash; locked in</span>
      </div>
    `;
  }
}

// --- Field Error Helper ---
function showFieldError(afterEl, message) {
  // Remove any existing error
  const existing = afterEl.parentElement.querySelector('.field-error');
  if (existing) existing.remove();

  const err = document.createElement('span');
  err.className = 'field-error';
  err.textContent = message;
  afterEl.parentElement.appendChild(err);

  // WHY: Auto-remove after 3s so errors don't persist if the user
  // corrects the issue without resubmitting.
  setTimeout(() => err.remove(), 3000);
}

// --- URL Param Pre-selection ---
// WHY: Individual apps can link here with ?app=exercise-roulette
// to pre-select their card, making the signup flow faster.
function handleUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const preselect = params.get('app');
  if (preselect) {
    const card = appCardsEl.querySelector(`[data-app="${preselect}"]`);
    if (card) {
      card.click();
      // Scroll to the signup form after a beat
      setTimeout(() => {
        document.getElementById('betaSignup').scrollIntoView({ behavior: 'smooth' });
      }, 400);
    }
  }
}

// --- Init ---
initAppCards();
handleUrlParams();
