// src/firebase.js
// ⚠️ REPLACE these values with YOUR Firebase project config
// See setup guide Step 3 for how to get these values

import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAlnJxWebk1BIhMidyhT7LBZhRVDRyEgh4",
  authDomain: "icepro-6648b.firebaseapp.com",
  projectId: "icepro-6648b",
  storageBucket: "icepro-6648b.firebasestorage.app",
  messagingSenderId: "473339269736",
  appId: "1:473339269736:web:0b45a34ffad9b90eef21dd"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
