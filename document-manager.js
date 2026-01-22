/**
 * ═══════════════════════════════════════════════════════════════
 * DOCUMENT MANAGER
 * ═══════════════════════════════════════════════════════════════
 * 
 * Manages multiple open documents (PDFs/images) with tab-based UI
 */

export class DocumentManager {
    constructor() {
        this.documents = new Map(); // id -> { type, name, data, pdfDoc, currentPage, scale }
        this.activeTabId = null;
        this.nextId = 1;

        this.tabsContainer = null;
        this.onTabChange = null; // Callback when active tab changes

        this.init();
    }

    init() {
        this.tabsContainer = document.getElementById('documentTabs');
        if (!this.tabsContainer) {
            console.warn('[DocumentManager] Tab container not found');
            return;
        }

        // Set up new tab button
        const newTabBtn = document.getElementById('newTabBtn');
        if (newTabBtn) {
            newTabBtn.addEventListener('click', () => this.triggerNewDocument());
        }
    }

    /**
     * Add a new document tab
     * @param {string} type - 'pdf' or 'image'
     * @param {string} name - Display name for the tab
     * @param {object} data - Document data (file, dataUrl, etc.)
     * @returns {string} - The new document ID
     */
    addDocument(type, name, data = {}) {
        const id = `doc-${this.nextId++}`;

        this.documents.set(id, {
            id,
            type,
            name: this.truncateName(name, 20),
            fullName: name,
            data,
            pdfDoc: null,
            currentPage: 1,
            scale: 1.0,
            createdAt: Date.now()
        });

        this.renderTabs();
        this.switchTab(id);

        return id;
    }

    /**
     * Remove a document tab
     */
    removeDocument(id) {
        if (!this.documents.has(id)) return;

        this.documents.delete(id);

        // If we removed the active tab, switch to another
        if (this.activeTabId === id) {
            const remaining = Array.from(this.documents.keys());
            if (remaining.length > 0) {
                this.switchTab(remaining[remaining.length - 1]);
            } else {
                this.activeTabId = null;
                this.onTabChange?.(null);
            }
        }

        this.renderTabs();
    }

    /**
     * Switch to a different tab
     */
    switchTab(id) {
        if (!this.documents.has(id)) return;

        this.activeTabId = id;
        this.renderTabs();

        const doc = this.documents.get(id);
        this.onTabChange?.(doc);
    }

    /**
     * Get the active document
     */
    getActiveDocument() {
        if (!this.activeTabId) return null;
        return this.documents.get(this.activeTabId);
    }

    /**
     * Update the active document's data
     */
    updateActiveDocument(updates) {
        if (!this.activeTabId) return;
        const doc = this.documents.get(this.activeTabId);
        Object.assign(doc, updates);
    }

    /**
     * Render the tabs UI
     */
    renderTabs() {
        if (!this.tabsContainer) return;

        const tabsWrapper = this.tabsContainer.querySelector('.tabs-wrapper');
        if (!tabsWrapper) return;

        // Clear existing tabs (except the new tab button)
        const existingTabs = tabsWrapper.querySelectorAll('.document-tab');
        existingTabs.forEach(tab => tab.remove());

        // Render each document as a tab
        const newTabBtn = tabsWrapper.querySelector('.new-tab-btn');

        this.documents.forEach((doc, id) => {
            const tab = document.createElement('div');
            tab.className = `document-tab ${id === this.activeTabId ? 'active' : ''}`;
            tab.dataset.id = id;

            const icon = doc.type === 'pdf' ? '📄' : '🖼️';

            tab.innerHTML = `
                <span class="tab-icon">${icon}</span>
                <span class="tab-name" title="${doc.fullName}">${doc.name}</span>
                <button class="tab-close" title="Close">×</button>
            `;

            // Tab click to switch
            tab.addEventListener('click', (e) => {
                if (!e.target.classList.contains('tab-close')) {
                    this.switchTab(id);
                }
            });

            // Close button
            tab.querySelector('.tab-close').addEventListener('click', (e) => {
                e.stopPropagation();
                this.removeDocument(id);
            });

            tabsWrapper.insertBefore(tab, newTabBtn);
        });

        // Show/hide tab bar based on document count
        this.tabsContainer.style.display = this.documents.size > 0 ? 'flex' : 'none';
    }

    /**
     * Trigger opening a new document (shows file picker)
     */
    triggerNewDocument() {
        // Dispatch custom event that app.js can listen to
        document.dispatchEvent(new CustomEvent('openNewDocument'));
    }

    /**
     * Get document count
     */
    getDocumentCount() {
        return this.documents.size;
    }

    /**
     * Truncate name for display
     */
    truncateName(name, maxLength) {
        if (name.length <= maxLength) return name;
        const ext = name.includes('.') ? '.' + name.split('.').pop() : '';
        const base = name.slice(0, maxLength - ext.length - 3);
        return base + '...' + ext;
    }
}
