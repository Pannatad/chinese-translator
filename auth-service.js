// Authentication Service
// Handles user signup, signin, signout using Firebase Auth

import { auth, db } from './firebase-config.js';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut as firebaseSignOut,
    onAuthStateChanged
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';

const DEFAULT_CREDITS = 20;

export class AuthService {
    constructor() {
        this.currentUser = null;
        this.authStateListeners = [];

        // Listen for auth state changes
        onAuthStateChanged(auth, (user) => {
            this.currentUser = user;
            this.authStateListeners.forEach(callback => callback(user));
        });
    }

    /**
     * Sign up a new user with email and password
     * Creates a user profile with default credits in Firestore
     */
    async signUp(email, password) {
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Create user profile in Firestore with default credits
            await setDoc(doc(db, 'users', user.uid), {
                email: user.email,
                credits: DEFAULT_CREDITS,
                createdAt: new Date().toISOString(),
                usedKeys: [] // Track which unlock keys have been used
            });

            return { success: true, user };
        } catch (error) {
            console.error('Signup error:', error);
            return { success: false, error: this._getErrorMessage(error.code) };
        }
    }

    /**
     * Sign in existing user
     */
    async signIn(email, password) {
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            return { success: true, user: userCredential.user };
        } catch (error) {
            console.error('Signin error:', error);
            return { success: false, error: this._getErrorMessage(error.code) };
        }
    }

    /**
     * Sign out current user
     */
    async signOut() {
        try {
            await firebaseSignOut(auth);
            return { success: true };
        } catch (error) {
            console.error('Signout error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get current authenticated user
     */
    getCurrentUser() {
        return auth.currentUser;
    }

    /**
     * Check if user is logged in
     */
    isLoggedIn() {
        return !!auth.currentUser;
    }

    /**
     * Register a callback for auth state changes
     */
    onAuthStateChange(callback) {
        this.authStateListeners.push(callback);
        // Immediately call with current state
        callback(auth.currentUser);

        // Return unsubscribe function
        return () => {
            this.authStateListeners = this.authStateListeners.filter(cb => cb !== callback);
        };
    }

    /**
     * Get user profile from Firestore
     */
    async getUserProfile() {
        const user = auth.currentUser;
        if (!user) return null;

        try {
            const docRef = doc(db, 'users', user.uid);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                return { id: user.uid, ...docSnap.data() };
            }
            return null;
        } catch (error) {
            console.error('Error getting user profile:', error);
            return null;
        }
    }

    /**
     * Convert Firebase error codes to user-friendly messages
     */
    _getErrorMessage(code) {
        const messages = {
            'auth/email-already-in-use': 'This email is already registered.',
            'auth/invalid-email': 'Please enter a valid email address.',
            'auth/weak-password': 'Password should be at least 6 characters.',
            'auth/user-not-found': 'No account found with this email.',
            'auth/wrong-password': 'Incorrect password.',
            'auth/invalid-credential': 'Invalid email or password.',
            'auth/too-many-requests': 'Too many attempts. Please try again later.'
        };
        return messages[code] || 'An error occurred. Please try again.';
    }
}
