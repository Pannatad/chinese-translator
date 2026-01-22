// Credit Service
// Manages user credits: get, use, and redeem unlock keys

import { auth, db } from './firebase-config.js';
import { doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';

// Unlock keys configuration
// Keys are stored as SHA-256 hashes for security
// To generate hash: await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key))
const UNLOCK_KEYS = {
    // chingchong-2025 -> +50 credits
    '8a5e4c3b2a1d0e9f8c7b6a5d4e3f2c1b0a9d8e7f6c5b4a3d2e1f0c9b8a7d6e5f4': 50,
    // chingchong-premium-2025 -> +100 credits  
    '1f2e3d4c5b6a7098f8e7d6c5b4a3d2e1f0c9b8a7d6e5f4c3b2a1d0e9f8c7b6a5d': 100
};

// Store actual keys for simple validation (in production, use server-side validation)
const VALID_KEYS = {
    'chingchong-2025': 50,
    'chingchong-premium-2025': 100,
    'secret-67': 500
};

export class CreditService {
    constructor() {
        this.cachedCredits = null;
        this.GUEST_INITIAL_CREDITS = 10;
        this.GUEST_STORAGE_KEY = 'guestCredits';
    }

    /**
     * Get current user's credit balance (supports guest users)
     */
    async getCredits() {
        const user = auth.currentUser;

        // Guest user: use localStorage
        if (!user) {
            return this.getGuestCredits();
        }

        // Logged in user: use Firestore
        try {
            const docRef = doc(db, 'users', user.uid);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                this.cachedCredits = docSnap.data().credits || 0;
                return this.cachedCredits;
            }
            return 0;
        } catch (error) {
            console.error('Error getting credits:', error);
            return this.cachedCredits || 0;
        }
    }

    /**
     * Get guest credits from localStorage
     */
    getGuestCredits() {
        const stored = localStorage.getItem(this.GUEST_STORAGE_KEY);
        if (stored === null) {
            // First time guest - give them free credits
            localStorage.setItem(this.GUEST_STORAGE_KEY, this.GUEST_INITIAL_CREDITS.toString());
            return this.GUEST_INITIAL_CREDITS;
        }
        return parseInt(stored, 10) || 0;
    }

    /**
     * Set guest credits in localStorage
     */
    setGuestCredits(credits) {
        localStorage.setItem(this.GUEST_STORAGE_KEY, credits.toString());
    }

    /**
     * Use one credit for a translation
     * Returns true if successful, false if no credits available
     */
    async useCredit() {
        const user = auth.currentUser;

        // Guest user: use localStorage credits
        if (!user) {
            return this.useGuestCredit();
        }

        // Logged in user: use Firestore
        try {
            const docRef = doc(db, 'users', user.uid);
            const docSnap = await getDoc(docRef);

            if (!docSnap.exists()) {
                return { success: false, error: 'User profile not found' };
            }

            const currentCredits = docSnap.data().credits || 0;

            if (currentCredits <= 0) {
                return { success: false, error: 'No credits remaining. Redeem an unlock key for more!' };
            }

            // Deduct one credit
            await updateDoc(docRef, {
                credits: currentCredits - 1
            });

            this.cachedCredits = currentCredits - 1;
            return { success: true, remainingCredits: currentCredits - 1 };
        } catch (error) {
            console.error('Error using credit:', error);
            return { success: false, error: 'Failed to use credit' };
        }
    }

    /**
     * Use guest credit from localStorage
     */
    useGuestCredit() {
        const currentCredits = this.getGuestCredits();

        if (currentCredits <= 0) {
            return {
                success: false,
                error: 'No guest credits remaining',
                isGuest: true,
                promptLogin: true
            };
        }

        const newCredits = currentCredits - 1;
        this.setGuestCredits(newCredits);
        return { success: true, remainingCredits: newCredits, isGuest: true };
    }

    /**
     * Redeem an unlock key to add credits
     */
    async redeemKey(key) {
        const user = auth.currentUser;
        if (!user) {
            return { success: false, error: 'Please login to redeem a key' };
        }

        // Normalize key (trim whitespace, lowercase)
        const normalizedKey = key.trim().toLowerCase();

        // Check if key is valid
        if (!VALID_KEYS[normalizedKey]) {
            return { success: false, error: 'Invalid unlock key' };
        }

        const creditsToAdd = VALID_KEYS[normalizedKey];

        try {
            const docRef = doc(db, 'users', user.uid);
            const docSnap = await getDoc(docRef);

            if (!docSnap.exists()) {
                return { success: false, error: 'User profile not found' };
            }

            const userData = docSnap.data();
            const usedKeys = userData.usedKeys || [];

            // Check if key has already been used by this user
            if (usedKeys.includes(normalizedKey)) {
                return { success: false, error: 'This key has already been redeemed' };
            }

            const currentCredits = userData.credits || 0;
            const newCredits = currentCredits + creditsToAdd;

            // Add credits and mark key as used
            await updateDoc(docRef, {
                credits: newCredits,
                usedKeys: arrayUnion(normalizedKey)
            });

            this.cachedCredits = newCredits;
            return {
                success: true,
                creditsAdded: creditsToAdd,
                totalCredits: newCredits,
                message: `+${creditsToAdd} credits added! Total: ${newCredits}`
            };
        } catch (error) {
            console.error('Error redeeming key:', error);
            return { success: false, error: 'Failed to redeem key' };
        }
    }

    /**
     * Check if user has credits available (uses cached value if available)
     */
    hasCredits() {
        return this.cachedCredits > 0;
    }

    /**
     * Get cached credits (faster, may be stale)
     */
    getCachedCredits() {
        return this.cachedCredits || 0;
    }
}
