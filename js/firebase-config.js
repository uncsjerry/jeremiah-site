// ============================================
// Firebase Configuration + Google APIs
// ============================================
// HOW TO SET UP:
// 1. Go to https://console.firebase.google.com
// 2. Create a new project (or use existing)
// 3. Enable Authentication > Google sign-in provider
// 4. Enable Firestore Database (production mode)
// 5. Go to console.cloud.google.com > APIs & Services
// 6. Enable Google Drive API and Google Picker API
// 7. Create OAuth 2.0 Client ID (Web app, add your domain as origin)
// 8. Create API key (restrict to Picker API + your domain)
// 9. Fill in GOOGLE_CLIENT_ID and GOOGLE_API_KEY below
// 10. Deploy Firestore rules (see firestore.rules in this repo)
// ============================================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

// WHY: Config is safe to expose client-side — security is enforced by Firestore rules, not by hiding these keys
// WHY: Points to the shared gutierrez-rose-family Firebase project so all 5 family sites
// share the same Firestore database. Photos published from the family admin panel appear here.
const firebaseConfig = {
  apiKey: "AIzaSyCRbyzjnKcCv_VZKd8xWUHDWu7rmK943uQ",
  authDomain: "gutierrez-rose-family.firebaseapp.com",
  projectId: "gutierrez-rose-family",
  storageBucket: "gutierrez-rose-family.firebasestorage.app",
  messagingSenderId: "240062290004",
  appId: "1:240062290004:web:7342cdbb92e05c38c9f5c1"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// WHY: Placeholder values — Jeremiah fills these in after Google Cloud Console setup (Step 7-8 above)
const GOOGLE_CLIENT_ID = '124337678790-cl5mg7dm79isvt6ohfehsglkgea77bd1.apps.googleusercontent.com';
const GOOGLE_API_KEY = 'AIzaSyD8BLXINiZUagh0Ia5jzJ0NlLo95Ki8ndY';

// WHY: Full drive scope needed to modify sharing permissions (make files public for lh3 CDN URLs)
const SCOPES = 'https://www.googleapis.com/auth/drive';

/**
 * Dynamically loads the Google API (gapi) and Google Identity Services (gis) libraries.
 * Returns a promise that resolves when both are ready.
 * WHY: Load on demand rather than on every page — only admin.html needs these.
 */
function loadGoogleApis() {
  return Promise.all([
    // Load gapi (for Picker)
    new Promise((resolve, reject) => {
      if (window.gapi) { resolve(); return; }
      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.onload = () => {
        window.gapi.load('picker', resolve);
      };
      script.onerror = reject;
      document.head.appendChild(script);
    }),
    // Load Google Identity Services (for OAuth token)
    new Promise((resolve, reject) => {
      if (window.google?.accounts?.oauth2) { resolve(); return; }
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    })
  ]);
}

// WHY: Defense-in-depth — even if Firestore rules are misconfigured, the client
// rejects non-admin users immediately. Real enforcement is in firestore.rules.
const ADMIN_EMAILS = ['jeremiah@uncs.com', 'fiveacts@gmail.com'];

export { app, db, auth, GOOGLE_CLIENT_ID, GOOGLE_API_KEY, SCOPES, ADMIN_EMAILS, loadGoogleApis };
