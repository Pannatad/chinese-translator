// Firebase Configuration
// Initialize Firebase app and export auth/db instances

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyBr7o1aqSBwgn7wlRHe_PuIaLb9QQFk7mo",
    authDomain: "chinese-translator-a4d88.firebaseapp.com",
    projectId: "chinese-translator-a4d88",
    storageBucket: "chinese-translator-a4d88.firebasestorage.app",
    messagingSenderId: "779173859036",
    appId: "1:779173859036:web:c60af0ebddb73b052eee19",
    measurementId: "G-H6H9EWBP0Y"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export Auth and Firestore instances
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
