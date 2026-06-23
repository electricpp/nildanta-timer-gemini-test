import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, get, update, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// TODO: Replace with your Firebase project config
const firebaseConfig = {
    apiKey: "AIzaSyDybj4VNU6J4yeDOGB_2RwUPYbQ191mdKU",
    authDomain: "nildanta-timer.firebaseapp.com",
    databaseURL: "https://nildanta-timer-default-rtdb.firebaseio.com",
    projectId: "nildanta-timer",
    storageBucket: "nildanta-timer.firebasestorage.app",
    messagingSenderId: "970229669420",
    appId: "1:970229669420:web:b763c5365d11f1b8a47b89",
    measurementId: "G-25YDGNRW94"
  };
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export { db, ref, set, get, update, onValue };