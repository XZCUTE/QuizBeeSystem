// Firebase configuration
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA8DPWqf2NPA9baAonfnMA9AvvKtqtE6kU",
  authDomain: "icctquizbeesystem.firebaseapp.com",
  databaseURL: "https://icctquizbeesystem-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "icctquizbeesystem",
  storageBucket: "icctquizbeesystem.firebasestorage.app",
  messagingSenderId: "864990587552",
  appId: "1:864990587552:web:df611eb19455e4c58677c5",
  measurementId: "G-P19DDBDZ8Q"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

export { db, auth };
export default app; 