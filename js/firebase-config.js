// ============================================
// Firebase Configuration
// ============================================
// HOW TO SET UP:
// 1. Go to https://console.firebase.google.com
// 2. Create a new project (or use existing)
// 3. Enable Authentication > Email/Password
// 4. Enable Firestore Database (production mode)
// 5. Enable Storage (default bucket)
// 6. Go to Project Settings > General > Your apps > Add web app
// 7. Copy your config values below
// 8. Create an admin user in Authentication > Users > Add User
// 9. Deploy Firestore rules (see firestore.rules in this repo)
// 10. Deploy Storage rules (see storage.rules in this repo)
// ============================================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

// WHY: Config is safe to expose client-side — security is enforced by Firestore/Storage rules, not by hiding these keys
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);

export { app, db, storage, auth };
