// Main Application Module
// Coordinates all components and handles user interactions

import { config } from './config.js';
import { PDFViewer } from './pdf-viewer.js';
import { SelectionBox } from './selection-box.js';
import { OCRService } from './ocr-service.js';
import { TranslationService } from './translation-service.js';
import { StorageService } from './storage-service.js';
import { AuthService } from './auth-service.js';
import { CreditService } from './credit-service.js';
import { WordHighlighter } from './word-highlight.js';

class ChineseTranslatorApp {
    constructor() {
        this.pdfViewer = null;
        this.selectionBox = null;
        this.ocrService = null;
        this.translationService = null;
        this.storageService = null;
        this.authService = null;
        this.creditService = null;
        this.wordHighlighter = null;

        // Auth state
        this.isLoggedIn = false;
        this.isLoginMode = true; // true = login, false = signup

        this.settings = {
            apiKey: (config.GEMINI_API_KEY || '').trim(),
            targetLanguage: config.DEFAULT_LANGUAGE || 'english'
        };

        this.initializeApp();
    }

    async initializeApp() {
        // Load settings from localStorage
        this.loadSettings();

        // Initialize services
        this.pdfViewer = new PDFViewer();
        this.ocrService = new OCRService();
        this.translationService = new TranslationService();
        this.storageService = new StorageService();
        this.authService = new AuthService();
        this.creditService = new CreditService();
        this.wordHighlighter = new WordHighlighter('wordHighlightContent');

        this.translationService.setApiKey(this.settings.apiKey);

        // Initialize UI event listeners
        this.initEventListeners();

        // Initialize auth event listeners
        this.initAuthListeners();

        // Initialize word highlight listeners
        this.initWordHighlightListeners();

        // Listen for auth state changes
        this.authService.onAuthStateChange((user) => {
            this.handleAuthStateChange(user);
        });

        // Auto-load last session
        await this.restoreSession();

        console.log('App initialized successfully');
    }

    async restoreSession() {
        try {
            // Restore PDF
            const savedFile = await this.storageService.getFile('currentPDF');
            if (savedFile) {
                console.log('Restoring previous PDF session...');
                await this.loadPDF(savedFile, false); // false = don't overwrite saved file

                // Restore Page Number
                const savedPage = localStorage.getItem('lastPage');
                if (savedPage) {
                    const pageNum = parseInt(savedPage, 10);
                    if (pageNum && pageNum > 1 && pageNum <= this.pdfViewer.totalPages) {
                        // Go to saved page
                        this.pdfViewer.currentPage = pageNum;
                        await this.pdfViewer.renderPage(pageNum);
                        this.pdfViewer.updatePageInfo();
                    }
                }
            }
        } catch (e) {
            console.error('Failed to restore session:', e);
        }
    }

    /**
     * Helper: Add both click and touchend for iPad/touch support
     * @param {string} elementId - DOM element ID
     * @param {Function} handler - Event handler function
     */
    addTouchClick(elementId, handler) {
        const el = document.getElementById(elementId);
        if (!el) return;

        const wrappedHandler = (e) => {
            e.preventDefault();
            handler(e);
        };

        el.addEventListener('click', wrappedHandler);
        el.addEventListener('touchend', wrappedHandler);
    }

    initEventListeners() {
        // Upload area
        const uploadBtn = document.getElementById('uploadBtn');
        const pdfInput = document.getElementById('pdfInput');
        const uploadArea = document.getElementById('uploadArea');

        if (uploadBtn && pdfInput) {
            uploadBtn.addEventListener('click', () => pdfInput.click());
            pdfInput.addEventListener('change', (e) => this.handleFileSelect(e));
        }

        // Drag and drop for upload area
        if (uploadArea) {
            uploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadArea.style.opacity = '0.8';
            });
            uploadArea.addEventListener('dragleave', () => {
                uploadArea.style.opacity = '1';
            });
            uploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadArea.style.opacity = '1';
                if (e.dataTransfer.files.length > 0) {
                    this.loadPDF(e.dataTransfer.files[0]);
                }
            });
        }

        // PDF controls (using touch-friendly helper)
        this.addTouchClick('prevPageBtn', () => this.previousPage());
        this.addTouchClick('nextPageBtn', () => this.nextPage());
        this.addTouchClick('zoomInBtn', () => this.zoomIn());
        this.addTouchClick('zoomOutBtn', () => this.zoomOut());
        this.addTouchClick('newPdfBtn', () => this.resetApp());

        // Settings modal
        this.addTouchClick('settingsBtn', () => this.openSettings());
        this.addTouchClick('closeSettingsBtn', () => this.closeSettings());
        this.addTouchClick('saveSettingsBtn', () => this.saveSettings());

        // Translation modal
        this.addTouchClick('closeTranslationBtn', () => this.closeTranslation());

        // Capture button
        this.addTouchClick('captureBtn', () => this.captureAndTranslate());

        // Close modals on backdrop click/touch
        const settingsModal = document.getElementById('settingsModal');
        const translationModal = document.getElementById('translationModal');

        const handleSettingsBackdrop = (e) => {
            if (e.target.id === 'settingsModal') this.closeSettings();
        };
        const handleTranslationBackdrop = (e) => {
            if (e.target.id === 'translationModal') this.closeTranslation();
        };

        settingsModal.addEventListener('click', handleSettingsBackdrop);
        settingsModal.addEventListener('touchend', handleSettingsBackdrop);
        translationModal.addEventListener('click', handleTranslationBackdrop);
        translationModal.addEventListener('touchend', handleTranslationBackdrop);
    }

    initAuthListeners() {
        // Auth button (login/logout) - touch-friendly
        const authHandler = () => {
            if (this.isLoggedIn) {
                this.handleLogout();
            } else {
                this.openAuthModal();
            }
        };
        const authBtn = document.getElementById('authBtn');
        authBtn.addEventListener('click', authHandler);
        authBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            authHandler();
        });

        // Close auth modal
        this.addTouchClick('closeAuthBtn', () => this.closeAuthModal());
        const authModal = document.getElementById('authModal');
        const handleAuthBackdrop = (e) => {
            if (e.target.id === 'authModal') this.closeAuthModal();
        };
        authModal.addEventListener('click', handleAuthBackdrop);
        authModal.addEventListener('touchend', handleAuthBackdrop);

        // Switch between login/signup
        this.addTouchClick('authSwitchBtn', () => {
            this.isLoginMode = !this.isLoginMode;
            this.updateAuthModalUI();
        });

        // Submit auth form
        this.addTouchClick('authSubmitBtn', () => this.handleAuthSubmit());

        // Enter key to submit
        document.getElementById('authPassword').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleAuthSubmit();
        });

        // Redeem key button
        this.addTouchClick('redeemKeyBtn', () => this.openRedeemModal());
        this.addTouchClick('closeRedeemBtn', () => this.closeRedeemModal());
        const redeemModal = document.getElementById('redeemModal');
        const handleRedeemBackdrop = (e) => {
            if (e.target.id === 'redeemModal') this.closeRedeemModal();
        };
        redeemModal.addEventListener('click', handleRedeemBackdrop);
        redeemModal.addEventListener('touchend', handleRedeemBackdrop);
        this.addTouchClick('redeemSubmitBtn', () => this.handleRedeemKey());
        document.getElementById('unlockKeyInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleRedeemKey();
        });

        // No credits modal
        this.addTouchClick('closeNoCreditsBtn', () => {
            document.getElementById('noCreditsModal').style.display = 'none';
        });
        const noCreditsModal = document.getElementById('noCreditsModal');
        const handleNoCreditsBackdrop = (e) => {
            if (e.target.id === 'noCreditsModal') {
                document.getElementById('noCreditsModal').style.display = 'none';
            }
        };
        noCreditsModal.addEventListener('click', handleNoCreditsBackdrop);
        noCreditsModal.addEventListener('touchend', handleNoCreditsBackdrop);
        this.addTouchClick('openRedeemFromNoCredits', () => {
            document.getElementById('noCreditsModal').style.display = 'none';
            this.openRedeemModal();
        });
    }

    async handleAuthStateChange(user) {
        this.isLoggedIn = !!user;
        const authBtn = document.getElementById('authBtn');
        const authBtnText = document.getElementById('authBtnText');
        const creditDisplay = document.getElementById('creditDisplay');

        if (user) {
            // Logged in
            authBtn.classList.add('logged-in');
            authBtnText.textContent = 'Logout';
            creditDisplay.style.display = 'flex';

            // Load credits
            const credits = await this.creditService.getCredits();
            document.getElementById('creditCount').textContent = credits;
        } else {
            // Logged out
            authBtn.classList.remove('logged-in');
            authBtnText.textContent = 'Login';
            creditDisplay.style.display = 'none';
        }
    }

    openAuthModal() {
        this.isLoginMode = true;
        this.updateAuthModalUI();
        document.getElementById('authEmail').value = '';
        document.getElementById('authPassword').value = '';
        document.getElementById('authError').style.display = 'none';
        document.getElementById('authModal').style.display = 'flex';
    }

    closeAuthModal() {
        document.getElementById('authModal').style.display = 'none';
    }

    updateAuthModalUI() {
        const title = document.getElementById('authModalTitle');
        const submitBtn = document.getElementById('authSubmitBtn');
        const switchText = document.getElementById('authSwitchText');
        const switchBtn = document.getElementById('authSwitchBtn');

        if (this.isLoginMode) {
            title.textContent = 'Login';
            submitBtn.textContent = 'Login';
            switchText.textContent = "Don't have an account?";
            switchBtn.textContent = 'Sign up';
        } else {
            title.textContent = 'Sign Up';
            submitBtn.textContent = 'Create Account';
            switchText.textContent = 'Already have an account?';
            switchBtn.textContent = 'Login';
        }
    }

    async handleAuthSubmit() {
        const email = document.getElementById('authEmail').value.trim();
        const password = document.getElementById('authPassword').value;
        const errorEl = document.getElementById('authError');

        if (!email || !password) {
            errorEl.textContent = 'Please enter email and password';
            errorEl.style.display = 'block';
            return;
        }

        errorEl.style.display = 'none';
        this.showLoading(this.isLoginMode ? 'Logging in...' : 'Creating account...');

        let result;
        if (this.isLoginMode) {
            result = await this.authService.signIn(email, password);
        } else {
            result = await this.authService.signUp(email, password);
        }

        this.hideLoading();

        if (result.success) {
            this.closeAuthModal();
        } else {
            errorEl.textContent = result.error;
            errorEl.style.display = 'block';
        }
    }

    async handleLogout() {
        this.showLoading('Logging out...');
        await this.authService.signOut();
        this.hideLoading();
    }

    openRedeemModal() {
        document.getElementById('unlockKeyInput').value = '';
        document.getElementById('redeemError').style.display = 'none';
        document.getElementById('redeemSuccess').style.display = 'none';
        document.getElementById('redeemModal').style.display = 'flex';
    }

    closeRedeemModal() {
        document.getElementById('redeemModal').style.display = 'none';
    }

    async handleRedeemKey() {
        const key = document.getElementById('unlockKeyInput').value.trim();
        const errorEl = document.getElementById('redeemError');
        const successEl = document.getElementById('redeemSuccess');

        if (!key) {
            errorEl.textContent = 'Please enter an unlock key';
            errorEl.style.display = 'block';
            successEl.style.display = 'none';
            return;
        }

        this.showLoading('Redeeming key...');
        const result = await this.creditService.redeemKey(key);
        this.hideLoading();

        if (result.success) {
            successEl.textContent = result.message;
            successEl.style.display = 'block';
            errorEl.style.display = 'none';
            document.getElementById('creditCount').textContent = result.totalCredits;
            document.getElementById('unlockKeyInput').value = '';
        } else {
            errorEl.textContent = result.error;
            errorEl.style.display = 'block';
            successEl.style.display = 'none';
        }
    }

    async updateCreditDisplay() {
        if (this.isLoggedIn) {
            const credits = await this.creditService.getCredits();
            document.getElementById('creditCount').textContent = credits;
        }
    }

    initWordHighlightListeners() {
        // Mode toggle buttons - touch-friendly
        const clickModeBtn = document.getElementById('clickModeBtn');
        const sideBySideModeBtn = document.getElementById('sideBySideModeBtn');

        const handleClickMode = (e) => {
            e.preventDefault();
            clickModeBtn.classList.add('active');
            sideBySideModeBtn.classList.remove('active');
            this.wordHighlighter.setMode('click');
        };

        const handleSideBySideMode = (e) => {
            e.preventDefault();
            sideBySideModeBtn.classList.add('active');
            clickModeBtn.classList.remove('active');
            this.wordHighlighter.setMode('sidebyside');
        };

        clickModeBtn.addEventListener('click', handleClickMode);
        clickModeBtn.addEventListener('touchend', handleClickMode);
        sideBySideModeBtn.addEventListener('click', handleSideBySideMode);
        sideBySideModeBtn.addEventListener('touchend', handleSideBySideMode);
    }

    showWordHighlight(wordPairs) {
        const section = document.getElementById('wordHighlightSection');

        if (wordPairs && wordPairs.length > 0) {
            this.wordHighlighter.setWordPairs(wordPairs);
            this.wordHighlighter.setMode('click'); // Default to click mode

            // Reset mode buttons
            document.getElementById('clickModeBtn').classList.add('active');
            document.getElementById('sideBySideModeBtn').classList.remove('active');

            section.style.display = 'block';
        } else {
            section.style.display = 'none';
        }
    }

    async handleFileSelect(event) {
        const file = event.target.files[0];
        if (file && file.type === 'application/pdf') {
            await this.loadPDF(file, true);
        } else {
            this.showError('Please select a valid PDF file');
        }
    }

    async loadPDF(file, saveToStorage = true) {
        this.showLoading('Loading PDF...');

        try {
            await this.pdfViewer.loadPDF(file);

            if (saveToStorage) {
                // Save file to IndexedDB
                await this.storageService.saveFile('currentPDF', file);
                // Reset page number for new file
                localStorage.setItem('lastPage', '1');
            }

            // Initialize selection box after PDF is loaded
            const pdfContainer = document.getElementById('pdfContainer');
            // Ensure container is visible for sizing
            document.getElementById('uploadArea').style.display = 'none';
            document.getElementById('pdfViewerArea').style.display = 'flex';

            this.selectionBox = new SelectionBox(pdfContainer);

            this.hideLoading();
        } catch (error) {
            this.hideLoading();
            this.showError('Failed to load PDF: ' + error.message);
        }
    }

    async previousPage() {
        this.showLoading('Loading page...');
        try {
            await this.pdfViewer.previousPage();
            localStorage.setItem('lastPage', this.pdfViewer.currentPage.toString());
        } catch (error) {
            this.showError('Failed to load page');
        }
        this.hideLoading();
    }

    async nextPage() {
        this.showLoading('Loading page...');
        try {
            await this.pdfViewer.nextPage();
            localStorage.setItem('lastPage', this.pdfViewer.currentPage.toString());
        } catch (error) {
            this.showError('Failed to load page');
        }
        this.hideLoading();
    }

    async zoomIn() {
        this.showLoading('Zooming in...');
        try {
            await this.pdfViewer.zoomIn();
        } catch (error) {
            this.showError('Failed to zoom');
        }
        this.hideLoading();
    }

    async zoomOut() {
        this.showLoading('Zooming out...');
        try {
            await this.pdfViewer.zoomOut();
        } catch (error) {
            this.showError('Failed to zoom');
        }
        this.hideLoading();
    }

    async captureAndTranslate() {
        // Check if user is logged in
        if (!this.isLoggedIn) {
            this.showError('Please login to translate');
            this.openAuthModal();
            return;
        }

        // Check credits before translating
        const creditResult = await this.creditService.useCredit();
        if (!creditResult.success) {
            // Show no credits modal
            document.getElementById('noCreditsModal').style.display = 'flex';
            return;
        }

        // Update credit display
        document.getElementById('creditCount').textContent = creditResult.remainingCredits;

        if (!this.settings.apiKey) {
            this.showError('Please configure your Gemini API key in settings first');
            return;
        }

        this.showLoading('Capturing image...');

        try {

            // Get selection box position relative to canvas
            const canvas = document.getElementById('pdfCanvas');
            const position = this.selectionBox.getCanvasPosition(canvas);

            if (!position) {
                throw new Error('Selection box must overlap with the PDF');
            }

            // Extract image data from canvas
            // Extract image data from canvas
            const gatheredImageData = this.pdfViewer.getCanvasImageData(
                position.x,
                position.y,
                position.width,
                position.height
            );

            if (!gatheredImageData) {
                throw new Error('Failed to capture image data');
            }

            // 4. VISION UPGRADE: Convert Canvas to Base64
            // We must use a temporary canvas to convert ImageData -> Base64
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = gatheredImageData.width;
            tempCanvas.height = gatheredImageData.height;
            const ctx = tempCanvas.getContext('2d');
            ctx.putImageData(gatheredImageData, 0, 0);

            const base64Data = tempCanvas.toDataURL('image/jpeg').split(',')[1];
            const visionPayload = {
                mimeType: "image/jpeg",
                data: base64Data
            };

            console.log('Image captured, sending to Gemini Vision...');

            // Hide spinner
            this.hideLoading();

            // STICKY NOTE MODE: Show loading overlay on selection box
            this.selectionBox.showStickyNote('Translating...', true);

            const translation = await this.translationService.translate(
                visionPayload,
                this.settings.targetLanguage,
                (streamedText) => {
                    // Update sticky note with streaming text
                    this.selectionBox.updateStickyNote(streamedText);
                }
            );

            // Final update - show complete translation in sticky note
            this.selectionBox.updateStickyNote(translation);

            // Update modal content for reference (user can still open it)
            document.getElementById('translatedText').textContent = translation;

            // Asynchronously fetch word pairs for highlighting feature
            // This runs in background after main translation is done
            this.fetchWordPairs(visionPayload);

        } catch (error) {
            this.hideLoading();
            this.selectionBox.hideStickyNote();
            console.error('Process failed:', error);
            alert('Error: ' + error.message);
        }
    }

    async fetchWordPairs(visionPayload) {
        try {
            console.log('Fetching word pairs for highlighting...');
            const result = await this.translationService.translateWithWordPairs(
                visionPayload,
                this.settings.targetLanguage
            );

            if (result.wordPairs && result.wordPairs.length > 0) {
                console.log('Word pairs received:', result.wordPairs.length);
                this.showWordHighlight(result.wordPairs);
            }
        } catch (error) {
            console.warn('Word pair fetch failed (non-critical):', error);
            // Don't show error to user - word pairs are optional enhancement
        }
    }

    showTranslation(originalText, translatedText) {
        document.getElementById('originalText').textContent = originalText;
        document.getElementById('translatedText').textContent = translatedText;

        const languageLabel = this.settings.targetLanguage === 'thai' ?
            'Translation (ภาษาไทย)' : 'Translation (English)';
        document.getElementById('translationLabel').textContent = languageLabel;

        document.getElementById('translationModal').style.display = 'flex';
    }

    closeTranslation() {
        document.getElementById('translationModal').style.display = 'none';
    }

    openTranslationModal() {
        document.getElementById('translationModal').style.display = 'flex';
    }

    openSettings() {
        document.getElementById('targetLanguage').value = this.settings.targetLanguage;
        document.getElementById('settingsModal').style.display = 'flex';
    }

    closeSettings() {
        document.getElementById('settingsModal').style.display = 'none';
    }

    saveSettings() {
        const targetLanguage = document.getElementById('targetLanguage').value;
        this.settings.targetLanguage = targetLanguage;

        // Save to localStorage (only language preference)
        localStorage.setItem('chineseTranslator_settings', JSON.stringify(this.settings));

        this.closeSettings();

        // Show confirmation
        this.showLoading('Settings saved!');
        setTimeout(() => this.hideLoading(), 1000);
    }

    loadSettings() {
        // API key always comes from config (not editable by user)
        this.settings.apiKey = (config.GEMINI_API_KEY || '').trim();

        // Load language preference from localStorage
        const savedSettings = localStorage.getItem('chineseTranslator_settings');
        if (savedSettings) {
            try {
                const parsed = JSON.parse(savedSettings);
                if (parsed.targetLanguage) {
                    this.settings.targetLanguage = parsed.targetLanguage;
                }
            } catch (error) {
                console.error('Failed to load settings:', error);
            }
        }
    }

    resetApp() {
        // Reset PDF viewer
        this.pdfViewer.reset();

        // Reset selection box
        if (this.selectionBox) {
            this.selectionBox.reset();
        }

        // Reset file input
        document.getElementById('pdfInput').value = '';

        // Show upload area, hide PDF viewer
        document.getElementById('uploadArea').style.display = 'flex';
        document.getElementById('pdfViewerArea').style.display = 'none';
    }

    showLoading(message = 'Processing...') {
        document.getElementById('loadingText').textContent = message;
        document.getElementById('loadingOverlay').style.display = 'flex';
    }

    hideLoading() {
        document.getElementById('loadingOverlay').style.display = 'none';
    }

    showError(message) {
        alert('⚠️ ' + message);
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    try {
        window.app = new ChineseTranslatorApp();
    } catch (error) {
        console.error('App initialization failed:', error);
        alert('Failed to start app: ' + error.message);
    }
});
