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
  apiKey: "AIzaSyDg19UEz1dY4xi3XoFsgvbnbFO0eMWurx8",
  authDomain: "jeremiah-site.firebaseapp.com",
  projectId: "jeremiah-site",
  storageBucket: "jeremiah-site.firebasestorage.app",
  messagingSenderId: "65615528096",
  appId: "1:65615528096:web:e4196c7dd2508e5f4849c5"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);

export { app, db, storage, auth };
