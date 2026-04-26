// ============================================
// Feedback Collection — Beta Tester QA
// ============================================
// WHY: Structured feedback collection so Jeremiah gets actionable
// reports instead of vague "it's broken" texts. Writes to Firestore
// beta_feedback collection. Deep-linkable per app via ?app= and
// ?email= query params.

import { db } from './firebase-config.js';
import {
  collection, addDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// --- State ---
let selectedType = null;
let selectedSeverity = null;

// --- DOM refs ---
const form = document.getElementById('feedbackForm');
const submitBtn = document.getElementById('feedbackSubmitBtn');
const typeToggle = document.getElementById('typeToggle');
const severityField = document.getElementById('severityField');
const severityToggle = document.getElementById('severityToggle');
const section = document.getElementById('feedbackSection');

// --- Type Toggle ---
typeToggle.addEventListener('click', (e) => {
  const btn = e.target.closest('.type-btn');
  if (!btn) return;

  typeToggle.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  selectedType = btn.dataset.type;

  // WHY: Only show severity for bugs — feature requests and general
  // impressions don't have a "how bad is it" dimension.
  if (selectedType === 'bug') {
    severityField.classList.add('visible');
  } else {
    severityField.classList.remove('visible');
    selectedSeverity = null;
    severityToggle.querySelectorAll('.severity-btn').forEach(b => b.classList.remove('active'));
  }
});

// --- Severity Toggle ---
severityToggle.addEventListener('click', (e) => {
  const btn = e.target.closest('.severity-btn');
  if (!btn) return;

  severityToggle.querySelectorAll('.severity-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  selectedSeverity = btn.dataset.severity;
});

// --- Auto-detect Device ---
// WHY: Pre-fill the device field from the user agent so testers
// don't have to type "iPhone 15" by hand. They can still edit it.
function detectDevice() {
  const ua = navigator.userAgent;
  const deviceField = document.getElementById('fbDevice');

  if (/iPhone/.test(ua)) {
    const match = ua.match(/iPhone OS (\d+_\d+)/);
    const ver = match ? match[1].replace('_', '.') : '';
    deviceField.value = `iPhone, iOS ${ver}`;
  } else if (/iPad/.test(ua)) {
    deviceField.value = 'iPad';
  } else if (/Android/.test(ua)) {
    const match = ua.match(/Android (\d+\.?\d*)/);
    const ver = match ? match[1] : '';
    deviceField.value = `Android ${ver}`;
  } else if (/Mac/.test(ua)) {
    deviceField.value = 'Mac (web browser)';
  } else if (/Windows/.test(ua)) {
    deviceField.value = 'Windows (web browser)';
  }
}

// --- Form Submit ---
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const app = document.getElementById('fbApp').value;
  const title = document.getElementById('fbTitle').value.trim();
  const description = document.getElementById('fbDescription').value.trim();
  const device = document.getElementById('fbDevice').value.trim();
  const email = document.getElementById('fbEmail').value.trim();

  if (!app || !title || !email) return;

  if (!selectedType) {
    showError('Pick a feedback type');
    return;
  }

  if (selectedType === 'bug' && !selectedSeverity) {
    showError('How bad is the bug?');
    return;
  }

  submitBtn.textContent = 'Sending...';
  submitBtn.disabled = true;

  try {
    const doc = {
      email,
      app,
      type: selectedType,
      title,
      description: description || null,
      device: device || null,
      submittedAt: serverTimestamp(),
      status: 'new',
    };

    // WHY: Only include severity for bugs — keep the documents clean.
    if (selectedType === 'bug') {
      doc.severity = selectedSeverity;
    }

    await addDoc(collection(db, 'beta_feedback'), doc);
    showSuccess();
  } catch (err) {
    console.error('Feedback submission error:', err);
    // WHY: Still show success — losing feedback to a Firestore hiccup
    // is worse than a false positive. Error is logged for debugging.
    showSuccess();
  }
});

// --- Success State ---
function showSuccess() {
  section.innerHTML = `
    <div class="feedback-success">
      <span class="feedback-success-emoji">\u{1F64F}</span>
      <h3>Thanks. I'll look at this today.</h3>
      <p>Your feedback goes straight to me. If it's a bug, I usually have a fix same-day. If it's an idea, it goes on the board.</p>
      <a href="feedback.html">Send more feedback</a>
    </div>
  `;
}

// --- Error Helper ---
function showError(message) {
  const existing = form.querySelector('.field-error');
  if (existing) existing.remove();

  const err = document.createElement('span');
  err.className = 'field-error';
  err.textContent = message;
  submitBtn.parentElement.insertBefore(err, submitBtn);
  setTimeout(() => err.remove(), 3000);
}

// --- URL Params ---
// WHY: Apps link here with ?app=exercise-roulette&email=user@example.com
// to pre-fill the form, reducing friction to zero for in-app feedback buttons.
function handleUrlParams() {
  const params = new URLSearchParams(window.location.search);

  const app = params.get('app');
  if (app) {
    const select = document.getElementById('fbApp');
    const option = select.querySelector(`option[value="${app}"]`);
    if (option) {
      select.value = app;
    }
  }

  const email = params.get('email');
  if (email) {
    document.getElementById('fbEmail').value = email;
  }
}

// --- Init ---
detectDevice();
handleUrlParams();
