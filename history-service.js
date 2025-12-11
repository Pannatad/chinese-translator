// History Service
// Stores and retrieves translation history in Firestore (logged in users only)

import { auth, db } from './firebase-config.js';
import { collection, doc, addDoc, getDocs, query, orderBy, limit, deleteDoc, serverTimestamp } from 'firebase/firestore';

const MAX_HISTORY_ITEMS = 50;

export class HistoryService {
    constructor() {
        this.cache = null;
    }

    /**
     * Check if user is logged in (history requires login)
     */
    isAvailable() {
        return !!auth.currentUser;
    }

    /**
     * Get user's translation history
     * @returns {Promise<Array>} Array of history items, newest first
     */
    async getHistory() {
        if (!auth.currentUser) {
            return [];
        }

        try {
            const historyRef = collection(db, 'users', auth.currentUser.uid, 'history');
            const q = query(historyRef, orderBy('timestamp', 'desc'), limit(MAX_HISTORY_ITEMS));
            const snapshot = await getDocs(q);

            this.cache = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            return this.cache;
        } catch (error) {
            console.error('Error fetching history:', error);
            return this.cache || [];
        }
    }

    /**
     * Save a translation to history
     * @param {Object} entry Translation entry to save
     */
    async saveTranslation(entry) {
        if (!auth.currentUser) {
            console.log('History requires login - skipping save');
            return null;
        }

        try {
            const historyRef = collection(db, 'users', auth.currentUser.uid, 'history');

            const historyEntry = {
                chinese: entry.chinese || '',
                translation: entry.translation || '',
                wordPairs: entry.wordPairs || [],
                language: entry.language || 'english',
                timestamp: serverTimestamp(),
                thumbnail: entry.thumbnail || null // Optional image preview
            };

            const docRef = await addDoc(historyRef, historyEntry);
            console.log('Translation saved to history:', docRef.id);

            // Invalidate cache
            this.cache = null;

            return docRef.id;
        } catch (error) {
            console.error('Error saving to history:', error);
            return null;
        }
    }

    /**
     * Delete a history entry
     * @param {string} entryId ID of entry to delete
     */
    async deleteEntry(entryId) {
        if (!auth.currentUser) return false;

        try {
            const docRef = doc(db, 'users', auth.currentUser.uid, 'history', entryId);
            await deleteDoc(docRef);

            // Update cache
            if (this.cache) {
                this.cache = this.cache.filter(item => item.id !== entryId);
            }

            return true;
        } catch (error) {
            console.error('Error deleting history entry:', error);
            return false;
        }
    }

    /**
     * Clear all history
     */
    async clearHistory() {
        if (!auth.currentUser) return false;

        try {
            const history = await this.getHistory();
            for (const entry of history) {
                await this.deleteEntry(entry.id);
            }
            this.cache = [];
            return true;
        } catch (error) {
            console.error('Error clearing history:', error);
            return false;
        }
    }

    /**
     * Get cached history (faster, may be stale)
     */
    getCached() {
        return this.cache || [];
    }
}
