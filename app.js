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
import { HistoryService } from './history-service.js';
import { CameraTranslator } from './camera-translator.js';
import { DocumentManager } from './document-manager.js';
import { AIAssistantService } from './ai-assistant-service.js';

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
        this.documentManager = null;

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
        this.historyService = new HistoryService();
        this.wordHighlighter = new WordHighlighter('wordHighlightContent');
        this.documentManager = new DocumentManager();
        this.aiAssistantService = new AIAssistantService();

        // Set up document manager callbacks
        this.documentManager.onTabChange = (doc) => this.handleTabChange(doc);

        // Listen for new document requests from tab bar
        document.addEventListener('openNewDocument', () => this.showUploadArea());

        this.translationService.setApiKey(this.settings.apiKey);
        this.aiAssistantService.setApiKey(this.settings.apiKey);

        // Initialize UI event listeners
        this.initEventListeners();

        // Initialize auth event listeners
        this.initAuthListeners();

        // Initialize word highlight listeners
        this.initWordHighlightListeners();

        // Initialize AI Assistant listeners
        this.initAIAssistantListeners();

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
     * Helper: Add touch-friendly click handling using Pointer Events API
     * This is the modern unified approach for mouse AND touch
     * @param {string} elementId - DOM element ID
     * @param {Function} handler - Event handler function
     */
    addTouchClick(elementId, handler) {
        const el = document.getElementById(elementId);
        if (!el) return;

        // Use pointerup for button-like behavior (fires for both mouse and touch)
        el.addEventListener('pointerup', (e) => {
            e.preventDefault();
            // Only respond to primary pointer (left mouse or first touch)
            if (e.isPrimary) {
                handler(e);
            }
        });

        // Prevent default touch behaviors that might interfere
        el.addEventListener('pointerdown', (e) => {
            e.preventDefault();
        });
    }

    initEventListeners() {
        // Start Page - Show upload area when Start is clicked
        this.addTouchClick('startBtn', () => this.showUploadFromStart());
        this.addTouchClick('backToStartBtn', () => this.showStartArea());

        // Language selector on start page
        const startLanguage = document.getElementById('startLanguage');
        if (startLanguage) {
            startLanguage.value = this.settings.targetLanguage;
            startLanguage.addEventListener('change', (e) => {
                this.settings.targetLanguage = e.target.value;
                this.saveSettings();
            });
        }

        // Ask buttons on selection boxes
        this.addTouchClick('askBtn', () => this.captureAndAsk());
        this.addTouchClick('imageAskBtn', () => this.captureAndAskImage());

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

        // Image/Camera upload
        const imageInput = document.getElementById('imageInput');
        const cameraInput = document.getElementById('cameraInput');

        this.addTouchClick('uploadImageBtn', () => imageInput.click());
        this.addTouchClick('cameraBtn', () => cameraInput.click());

        imageInput.addEventListener('change', (e) => this.handleImageSelect(e));
        cameraInput.addEventListener('change', (e) => this.handleImageSelect(e));

        // Image mode controls
        this.addTouchClick('newImageBtn', () => this.resetApp());
        this.addTouchClick('imageCaptureBtn', () => this.captureAndTranslateImage());

        // Live camera mode
        this.initLiveCamera();
        this.addTouchClick('liveCameraBtn', () => this.startLiveCamera());
        this.addTouchClick('closeLiveBtn', () => this.stopLiveCamera());
        this.addTouchClick('liveTranslateBtn', () => this.triggerLiveTranslation());

        // Live PDF mode toggle
        this.pdfLiveModeActive = false;
        this.pdfLiveModeInterval = null;
        this.addTouchClick('liveTranslateModeBtn', () => this.togglePdfLiveMode());

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

        // History modal
        this.addTouchClick('historyBtn', () => this.openHistory());
        this.addTouchClick('closeHistoryBtn', () => this.closeHistory());
        const historyModal = document.getElementById('historyModal');
        const handleHistoryBackdrop = (e) => {
            if (e.target.id === 'historyModal') this.closeHistory();
        };
        historyModal.addEventListener('click', handleHistoryBackdrop);
        historyModal.addEventListener('touchend', handleHistoryBackdrop);

        // Translation Bot modal
        this.initTranslatorBotListeners();
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

        // Guest no credits modal
        this.addTouchClick('closeGuestNoCreditsBtn', () => {
            document.getElementById('guestNoCreditsModal').style.display = 'none';
        });
        const guestNoCreditsModal = document.getElementById('guestNoCreditsModal');
        const handleGuestNoCreditsBackdrop = (e) => {
            if (e.target.id === 'guestNoCreditsModal') {
                document.getElementById('guestNoCreditsModal').style.display = 'none';
            }
        };
        guestNoCreditsModal.addEventListener('click', handleGuestNoCreditsBackdrop);
        guestNoCreditsModal.addEventListener('touchend', handleGuestNoCreditsBackdrop);
        this.addTouchClick('guestLoginBtn', () => {
            document.getElementById('guestNoCreditsModal').style.display = 'none';
            this.isLoginMode = false; // Start with signup
            this.openAuthModal();
        });
    }

    /**
     * Show modal prompting guests to sign up for more credits
     */
    showGuestNoCreditsModal() {
        document.getElementById('guestNoCreditsModal').style.display = 'flex';
    }

    /**
     * Open history modal and load history
     */
    async openHistory() {
        document.getElementById('historyModal').style.display = 'flex';

        const historyList = document.getElementById('historyList');
        const historyEmpty = document.getElementById('historyEmpty');

        historyList.innerHTML = '<p style="text-align: center; padding: 1rem;">Loading...</p>';
        historyEmpty.style.display = 'none';

        const history = await this.historyService.getHistory();

        if (history.length === 0) {
            historyList.innerHTML = '';
            historyEmpty.style.display = 'block';
        } else {
            this.renderHistory(history);
        }
    }

    /**
     * Close history modal
     */
    closeHistory() {
        document.getElementById('historyModal').style.display = 'none';
    }

    /**
     * Render history items
     */
    renderHistory(history) {
        const historyList = document.getElementById('historyList');

        historyList.innerHTML = history.map(item => `
            <div class="history-item" data-id="${item.id}">
                <div class="history-item-header">
                    <span class="history-chinese">${item.chinese || 'Translation'}</span>
                    <span class="history-time">${this.formatTimeAgo(item.timestamp)}</span>
                </div>
                <div class="history-translation">${item.translation || ''}</div>
            </div>
        `).join('');

        // Add click handlers to view details
        historyList.querySelectorAll('.history-item').forEach(item => {
            item.addEventListener('click', () => {
                const id = item.dataset.id;
                const entry = history.find(h => h.id === id);
                if (entry) {
                    this.showHistoryDetails(entry);
                }
            });
        });
    }

    /**
     * Show details of a history entry in the translation modal
     */
    showHistoryDetails(entry) {
        this.closeHistory();

        // Display in translation modal
        document.getElementById('translatedText').textContent = entry.translation;

        // Show word pairs if available
        if (entry.wordPairs && entry.wordPairs.length > 0) {
            this.wordHighlighter.setWordPairs(entry.wordPairs);
            this.wordHighlighter.render();
            document.getElementById('wordHighlightSection').style.display = 'block';
        } else {
            document.getElementById('wordHighlightSection').style.display = 'none';
        }

        document.getElementById('translationModal').style.display = 'flex';
    }

    /**
     * Format timestamp as relative time
     */
    formatTimeAgo(timestamp) {
        if (!timestamp) return '';

        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const now = new Date();
        const diff = now - date;

        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;

        return date.toLocaleDateString();
    }

    async handleAuthStateChange(user) {
        this.isLoggedIn = !!user;
        const authBtn = document.getElementById('authBtn');
        const authBtnText = document.getElementById('authBtnText');
        const creditDisplay = document.getElementById('creditDisplay');
        const redeemKeyBtn = document.getElementById('redeemKeyBtn');
        const historyBtn = document.getElementById('historyBtn');

        if (user) {
            // Logged in
            authBtn.classList.add('logged-in');
            authBtnText.textContent = 'Logout';
            creditDisplay.style.display = 'flex';
            redeemKeyBtn.style.display = 'flex'; // Show redeem button for logged in users
            historyBtn.style.display = 'flex'; // Show history button for logged in users

            // Load credits
            const credits = await this.creditService.getCredits();
            document.getElementById('creditCount').textContent = credits;
        } else {
            // Guest user - still show credits!
            authBtn.classList.remove('logged-in');
            authBtnText.textContent = 'Login';
            creditDisplay.style.display = 'flex'; // Show credits for guests too
            redeemKeyBtn.style.display = 'none'; // Hide redeem button for guests
            historyBtn.style.display = 'none'; // Hide history button for guests

            // Load guest credits
            const guestCredits = await this.creditService.getCredits();
            document.getElementById('creditCount').textContent = guestCredits;
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

        // Set up example sentence generation callback
        this.wordHighlighter.setExampleCallback(async (chinese, pinyin) => {
            await this.handleExampleGeneration(chinese, pinyin);
        });
    }

    /**
     * Handle example sentence generation for a word
     */
    async handleExampleGeneration(chinese, pinyin) {
        try {
            // Show loading state in popover
            this.wordHighlighter.showExamplePopover([
                { chinese: 'Loading...', pinyin: '', translation: '' }
            ], chinese);

            // Generate example sentences
            const sentences = await this.translationService.generateExampleSentences(
                chinese,
                pinyin,
                this.settings.targetLanguage
            );

            if (sentences && sentences.length > 0) {
                this.wordHighlighter.showExamplePopover(sentences, chinese);
            } else {
                this.wordHighlighter.showExamplePopover([
                    { chinese: 'No examples available', pinyin: '', translation: '' }
                ], chinese);
            }
        } catch (error) {
            console.error('Failed to generate examples:', error);
            this.wordHighlighter.showExamplePopover([
                { chinese: 'Error generating examples', pinyin: '', translation: 'Please try again' }
            ], chinese);
        }
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

            // Add to document manager for tab support
            const docId = this.documentManager.addDocument('pdf', file.name, { file });
            this.documentManager.updateActiveDocument({
                pdfDoc: this.pdfViewer.pdfDoc,
                currentPage: this.pdfViewer.currentPage,
                scale: this.pdfViewer.scale
            });

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

    /**
     * Handle image selection from camera or file picker
     */
    handleImageSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Check if it's an image
        if (!file.type.startsWith('image/')) {
            this.showError('Please select an image file');
            return;
        }

        this.showLoading('Loading image...');

        const reader = new FileReader();
        reader.onload = (e) => {
            this.displayImage(e.target.result);
        };
        reader.onerror = () => {
            this.hideLoading();
            this.showError('Failed to load image');
        };
        reader.readAsDataURL(file);

        // Store file name for document manager
        this._pendingImageName = file.name;

        // Reset input so same file can be selected again
        event.target.value = '';
    }

    /**
     * Display uploaded image and initialize selection box
     */
    displayImage(dataUrl) {
        this.currentImageMode = true;
        this.currentImageData = dataUrl;

        // Add to document manager for tab support
        const imageName = this._pendingImageName || 'Image';
        this.documentManager.addDocument('image', imageName, { dataUrl });
        this._pendingImageName = null;

        const uploadedImage = document.getElementById('uploadedImage');
        uploadedImage.src = dataUrl;

        uploadedImage.onload = () => {
            // Show image viewer, hide other areas
            document.getElementById('uploadArea').style.display = 'none';
            document.getElementById('pdfViewerArea').style.display = 'none';
            document.getElementById('imageViewerArea').style.display = 'flex';

            // Initialize selection box for image mode
            const imageContainer = document.getElementById('imageContainer');
            this.imageSelectionBox = new SelectionBox(imageContainer, 'imageSelectionBox');

            this.hideLoading();
        };
    }

    /**
     * Handle tab change in the document manager
     */
    async handleTabChange(doc) {
        if (!doc) {
            // No documents open, show upload area
            this.showUploadArea();
            return;
        }

        if (doc.type === 'pdf') {
            // Restore PDF state
            if (doc.data.file) {
                await this.pdfViewer.loadPDF(doc.data.file);
                if (doc.currentPage && doc.currentPage > 1) {
                    this.pdfViewer.currentPage = doc.currentPage;
                    await this.pdfViewer.renderPage(doc.currentPage);
                }
                if (doc.scale) {
                    this.pdfViewer.scale = doc.scale;
                }
                this.pdfViewer.updatePageInfo();
                this.pdfViewer.updateZoomLevel();
            }

            // Show PDF viewer
            document.getElementById('uploadArea').style.display = 'none';
            document.getElementById('pdfViewerArea').style.display = 'flex';
            document.getElementById('imageViewerArea').style.display = 'none';

            // Re-initialize selection box
            const pdfContainer = document.getElementById('pdfContainer');
            this.selectionBox = new SelectionBox(pdfContainer);

        } else if (doc.type === 'image') {
            // Restore image state
            this.currentImageMode = true;
            this.currentImageData = doc.data.dataUrl;
            document.getElementById('uploadedImage').src = doc.data.dataUrl;

            // Show image viewer
            document.getElementById('uploadArea').style.display = 'none';
            document.getElementById('pdfViewerArea').style.display = 'none';
            document.getElementById('imageViewerArea').style.display = 'flex';

            // Re-initialize selection box
            const imageContainer = document.getElementById('imageContainer');
            this.imageSelectionBox = new SelectionBox(imageContainer, 'imageSelectionBox');
        }
    }

    /**
     * Show upload area (for adding new documents from tab bar)
     */
    showUploadArea() {
        document.getElementById('startArea').style.display = 'none';
        document.getElementById('uploadArea').style.display = 'flex';
        document.getElementById('pdfViewerArea').style.display = 'none';
        document.getElementById('imageViewerArea').style.display = 'none';
    }

    /**
     * Show upload area from start page
     */
    showUploadFromStart() {
        document.getElementById('startArea').style.display = 'none';
        document.getElementById('pdfViewerArea').style.display = 'none';
        document.getElementById('imageViewerArea').style.display = 'none';
        document.getElementById('liveCameraArea').style.display = 'none';
        document.getElementById('documentTabs').style.display = 'none';
        document.getElementById('uploadArea').style.display = 'flex';
    }

    /**
     * Show start area (go back from upload)
     */
    showStartArea() {
        document.getElementById('uploadArea').style.display = 'none';
        document.getElementById('pdfViewerArea').style.display = 'none';
        document.getElementById('imageViewerArea').style.display = 'none';
        document.getElementById('liveCameraArea').style.display = 'none';
        document.getElementById('documentTabs').style.display = 'none';
        document.getElementById('startArea').style.display = 'flex';
    }

    /**
     * Capture selection and ask a question about it
     */
    async captureAndAsk() {
        try {
            if (!this.selectionBox) {
                this.showError('Please select an area first');
                return;
            }

            const canvasData = this.selectionBox.captureSelection();
            if (!canvasData) {
                this.showError('Please make a selection first');
                return;
            }

            // Store the captured image for the AI to analyze
            this.capturedImageForAsk = canvasData;

            // Open AI Assistant modal
            this.openAIAssistant();

            // Add a message showing the captured image
            this.addAIChatMessage('user', '📷 Captured selection - ask your question below');

            // Pre-fill with prompt
            const inputEl = document.getElementById('aiInputText');
            if (inputEl) {
                inputEl.placeholder = 'Ask a question about this image...';
                inputEl.focus();
            }
        } catch (error) {
            console.error('Error in captureAndAsk:', error);
            this.showError('Failed to capture selection');
        }
    }

    /**
     * Capture selection from image and ask a question
     */
    async captureAndAskImage() {
        try {
            if (!this.imageSelectionBox) {
                this.showError('Please select an area first');
                return;
            }

            const canvasData = this.imageSelectionBox.captureSelection();
            if (!canvasData) {
                this.showError('Please make a selection first');
                return;
            }

            // Store the captured image for the AI to analyze
            this.capturedImageForAsk = canvasData;

            // Open AI Assistant modal
            this.openAIAssistant();

            // Add a message showing the captured image
            this.addAIChatMessage('user', '📷 Captured selection - ask your question below');

            // Pre-fill with prompt
            const inputEl = document.getElementById('aiInputText');
            if (inputEl) {
                inputEl.placeholder = 'Ask a question about this image...';
                inputEl.focus();
            }
        } catch (error) {
            console.error('Error in captureAndAskImage:', error);
            this.showError('Failed to capture selection');
        }
    }

    /**
     * Translate selected area from uploaded image
     */
    async captureAndTranslateImage() {
        // Check credits (works for both guests and logged in users)
        const creditResult = await this.creditService.useCredit();
        if (!creditResult.success) {
            if (creditResult.promptLogin) {
                this.showGuestNoCreditsModal();
            } else {
                document.getElementById('noCreditsModal').style.display = 'flex';
            }
            return;
        }

        // Update credit display
        document.getElementById('creditCount').textContent = creditResult.remainingCredits;

        if (!this.settings.apiKey) {
            this.showError('Please configure your Gemini API key in settings first');
            return;
        }

        this.showLoading('Translating...');

        try {
            // Get selection box position relative to image
            const uploadedImage = document.getElementById('uploadedImage');
            const imageRect = uploadedImage.getBoundingClientRect();
            const boxElement = document.getElementById('imageSelectionBox');
            const boxRect = boxElement.getBoundingClientRect();

            // Calculate crop area
            const scaleX = uploadedImage.naturalWidth / imageRect.width;
            const scaleY = uploadedImage.naturalHeight / imageRect.height;

            const cropX = Math.max(0, (boxRect.left - imageRect.left) * scaleX);
            const cropY = Math.max(0, (boxRect.top - imageRect.top) * scaleY);
            const cropWidth = Math.min(boxRect.width * scaleX, uploadedImage.naturalWidth - cropX);
            const cropHeight = Math.min(boxRect.height * scaleY, uploadedImage.naturalHeight - cropY);

            // Create canvas and crop image
            const canvas = document.createElement('canvas');
            canvas.width = cropWidth;
            canvas.height = cropHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(uploadedImage, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

            const croppedDataUrl = canvas.toDataURL('image/png');
            const base64Data = croppedDataUrl.split(',')[1];

            // Show sticky note with loading
            const imageSelectionBox = {
                showStickyNote: (text, loading) => this.showImageStickyNote(text, loading),
                updateStickyNote: (text) => this.updateImageStickyNote(text),
                hideStickyNote: () => this.hideImageStickyNote()
            };
            imageSelectionBox.showStickyNote('Translating...', true);

            this.hideLoading();

            // Translate using Gemini Vision
            const result = await this.translationService.translateWithWordPairs(
                base64Data,
                this.settings.targetLanguage
            );

            const finalTranslation = result.fullTranslation || result.translation;
            if (finalTranslation) {
                imageSelectionBox.updateStickyNote(finalTranslation);

                // Update modal content for View Word-by-Word
                document.getElementById('originalText').textContent = result.originalText || '';
                document.getElementById('pinyinText').textContent = result.fullPinyin || '';
                document.getElementById('translatedText').textContent = finalTranslation;

                // Store for word highlight
                if (result.wordPairs && result.wordPairs.length > 0) {
                    this.lastTranslationResult = result;
                    this.wordHighlighter.setWordPairs(result.wordPairs);
                    this.showWordHighlight(result.wordPairs);
                }
            } else {
                imageSelectionBox.updateStickyNote('Could not translate. Try a different selection.');
            }
        } catch (error) {
            console.error('Translation error:', error);
            this.hideLoading();
            this.showError('Translation failed: ' + error.message);
        }
    }

    // Image sticky note helpers (similar to PDF selection box)
    showImageStickyNote(text, isLoading) {
        const boxElement = document.getElementById('imageSelectionBox');
        let overlay = boxElement.querySelector('.sticky-note-overlay');
        if (overlay) overlay.remove();

        overlay = document.createElement('div');
        overlay.className = 'sticky-note-overlay';

        if (isLoading) {
            overlay.innerHTML = `<div class="sticky-note-loading"><span class="loading-spinner-small"></span><span>${text}</span></div>`;
        } else {
            overlay.innerHTML = `<div class="sticky-note-content"><button class="sticky-note-close">×</button><p>${text}</p></div>`;
        }

        boxElement.appendChild(overlay);
    }

    updateImageStickyNote(text) {
        const boxElement = document.getElementById('imageSelectionBox');
        const overlay = boxElement.querySelector('.sticky-note-overlay');
        if (overlay) {
            overlay.innerHTML = `
                <div class="sticky-note-content">
                    <button class="sticky-note-close" id="closeImageStickyBtn">×</button>
                    <p>${text}</p>
                    <button class="sticky-note-details-btn" id="imageDetailsBtn">📚 View Word-by-Word</button>
                </div>
            `;
            // Attach handlers
            this.addTouchClick('closeImageStickyBtn', () => this.hideImageStickyNote());
            this.addTouchClick('imageDetailsBtn', () => this.openTranslationModal());
        }
    }

    hideImageStickyNote() {
        const boxElement = document.getElementById('imageSelectionBox');
        const overlay = boxElement.querySelector('.sticky-note-overlay');
        if (overlay) overlay.remove();
    }

    // ========== Live Camera Mode ==========

    /**
     * Initialize the camera translator service
     */
    initLiveCamera() {
        // Check if camera is supported
        if (!CameraTranslator.isSupported()) {
            const liveBtn = document.getElementById('liveCameraBtn');
            if (liveBtn) {
                liveBtn.style.display = 'none';
            }
            return;
        }

        this.cameraTranslator = new CameraTranslator(this.translationService);
    }

    /**
     * Start live camera translation mode
     */
    async startLiveCamera() {
        if (!this.cameraTranslator) {
            this.showError('Camera not supported on this device');
            return;
        }

        // Initialize with DOM elements
        const video = document.getElementById('liveVideo');
        const canvas = document.getElementById('liveCanvas');
        const overlay = document.getElementById('liveOverlay');

        this.cameraTranslator.init(video, canvas, overlay);
        this.cameraTranslator.setTargetLanguage(this.settings.targetLanguage);

        this.showLoading('Starting camera...');

        const result = await this.cameraTranslator.start();

        this.hideLoading();

        if (result.success) {
            // Show live camera area, hide upload area
            document.getElementById('uploadArea').style.display = 'none';
            document.getElementById('pdfViewerArea').style.display = 'none';
            document.getElementById('imageViewerArea').style.display = 'none';
            document.getElementById('liveCameraArea').style.display = 'flex';
        } else {
            this.showError(result.error);
        }
    }

    /**
     * Stop live camera mode
     */
    stopLiveCamera() {
        if (this.cameraTranslator) {
            this.cameraTranslator.stop();
        }

        // Hide live camera area, show upload area
        document.getElementById('liveCameraArea').style.display = 'none';
        document.getElementById('uploadArea').style.display = 'flex';
    }

    /**
     * Trigger immediate translation in live mode
     */
    async triggerLiveTranslation() {
        if (this.cameraTranslator) {
            await this.cameraTranslator.translateNow();
        }
    }

    // ========== PDF Live Translation Mode ==========

    /**
     * Toggle live translation mode for PDF
     */
    togglePdfLiveMode() {
        const btn = document.getElementById('liveTranslateModeBtn');

        if (this.pdfLiveModeActive) {
            // Deactivate
            this.pdfLiveModeActive = false;

            // Clear debounce timer
            if (this.liveTranslateDebounceTimer) {
                clearTimeout(this.liveTranslateDebounceTimer);
                this.liveTranslateDebounceTimer = null;
            }

            // Remove onMoveEnd callback
            if (this.selectionBox) {
                this.selectionBox.onMoveEnd = null;
                this.selectionBox.hideStickyNote();
            }

            btn.classList.remove('active');
        } else {
            // Activate
            this.pdfLiveModeActive = true;
            this.translationInProgress = false;
            btn.classList.add('active');

            // Set up debounced translation on box movement
            if (this.selectionBox) {
                this.selectionBox.onMoveEnd = () => {
                    this.scheduleDebounceTranslation();
                };
            }

            // Initial translation
            this.pdfLiveTranslate();
        }
    }

    /**
     * Schedule a debounced translation (800ms after box stops moving)
     */
    scheduleDebounceTranslation() {
        // Clear any existing timer
        if (this.liveTranslateDebounceTimer) {
            clearTimeout(this.liveTranslateDebounceTimer);
        }

        // Don't schedule if translation is already in progress
        // (wait for current one to finish, then onMoveEnd will retrigger)
        if (this.translationInProgress) {
            return;
        }

        // Schedule translation after 800ms of no movement
        this.liveTranslateDebounceTimer = setTimeout(() => {
            if (this.pdfLiveModeActive) {
                this.pdfLiveTranslate();
            }
        }, 800);
    }

    /**
     * Perform live translation of PDF selection box
     */
    async pdfLiveTranslate() {
        if (!this.pdfLiveModeActive || !this.pdfViewer?.pdfDoc || !this.selectionBox) {
            return;
        }

        // Prevent concurrent translations
        if (this.translationInProgress) {
            return;
        }

        this.translationInProgress = true;

        try {
            // Show loading state on sticky note
            this.selectionBox.showStickyNote('⏳ Translating...', true);

            // Capture selection area
            const position = this.selectionBox.getCanvasPosition(this.pdfViewer.canvas);
            if (!position) {
                this.selectionBox.updateStickyNote('Move selection to translate');
                this.translationInProgress = false;
                return;
            }

            const imageData = this.pdfViewer.getCanvasImageData(
                position.x,
                position.y,
                position.width,
                position.height
            );

            if (!imageData) {
                this.selectionBox.updateStickyNote('No image captured');
                this.translationInProgress = false;
                return;
            }

            // Convert to base64
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = imageData.width;
            tempCanvas.height = imageData.height;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.putImageData(imageData, 0, 0);
            const dataUrl = tempCanvas.toDataURL('image/png');
            const base64 = dataUrl.split(',')[1];

            const visionPayload = { mimeType: 'image/png', data: base64 };

            // Translate
            const translation = await this.translationService.translate(
                visionPayload,
                this.settings.targetLanguage,
                (partial) => this.selectionBox.updateStickyNote(partial)
            );

            // Show result
            if (translation) {
                this.selectionBox.updateStickyNote(translation);

                // Update modal content for View Word-by-Word
                document.getElementById('translatedText').textContent = translation;

                // Fetch word pairs in background for View Word-by-Word feature
                this.fetchWordPairs(visionPayload);
            } else {
                this.selectionBox.updateStickyNote('No Chinese text detected');
            }
        } catch (error) {
            console.error('Live translation error:', error);
            this.selectionBox.updateStickyNote('Error - try moving the box');
        } finally {
            this.translationInProgress = false;
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
        // Check credits before translating (works for both guests and logged in users)
        const creditResult = await this.creditService.useCredit();
        if (!creditResult.success) {
            // Check if guest ran out of credits
            if (creditResult.promptLogin) {
                this.showGuestNoCreditsModal();
            } else {
                // Show regular no credits modal for logged in users
                document.getElementById('noCreditsModal').style.display = 'flex';
            }
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

            // Clear previous modal content
            document.getElementById('originalText').textContent = '';
            document.getElementById('pinyinText').textContent = '';
            document.getElementById('translatedText').textContent = '';

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

            // Update modal with original text and pinyin if available
            if (result.originalText) {
                document.getElementById('originalText').textContent = result.originalText;
            }
            if (result.fullPinyin) {
                document.getElementById('pinyinText').textContent = result.fullPinyin;
            }

            if (result.wordPairs && result.wordPairs.length > 0) {
                console.log('Word pairs received:', result.wordPairs.length);
                this.showWordHighlight(result.wordPairs);

                // Save to history (for logged in users)
                if (this.historyService.isAvailable()) {
                    // Extract Chinese text from word pairs
                    const chineseText = result.originalText || result.wordPairs.map(p => p.chinese).join('');
                    await this.historyService.saveTranslation({
                        chinese: chineseText.substring(0, 100), // Limit for display
                        translation: result.fullTranslation || result.translation || '',
                        wordPairs: result.wordPairs,
                        language: this.settings.targetLanguage
                    });
                    console.log('Translation saved to history');
                }
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

        // Reset image mode
        this.currentImageMode = false;
        this.currentImageData = null;
        if (this.imageSelectionBox) {
            this.imageSelectionBox.reset();
        }
        document.getElementById('uploadedImage').src = '';
        this.hideImageStickyNote();

        // Reset file inputs
        document.getElementById('pdfInput').value = '';
        document.getElementById('imageInput').value = '';
        document.getElementById('cameraInput').value = '';

        // Stop live mode if active
        if (this.pdfLiveModeActive) {
            this.pdfLiveModeActive = false;
            if (this.liveTranslateDebounceTimer) {
                clearTimeout(this.liveTranslateDebounceTimer);
                this.liveTranslateDebounceTimer = null;
            }
            if (this.selectionBox) {
                this.selectionBox.onMoveEnd = null;
            }
            const liveBtn = document.getElementById('liveTranslateModeBtn');
            if (liveBtn) liveBtn.classList.remove('active');
        }

        // Show upload area, hide viewers
        document.getElementById('uploadArea').style.display = 'flex';
        document.getElementById('pdfViewerArea').style.display = 'none';
        document.getElementById('imageViewerArea').style.display = 'none';
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

    // ═══════════════════════════════════════════════════════════════
    // TRANSLATION BOT METHODS
    // ═══════════════════════════════════════════════════════════════

    initTranslatorBotListeners() {
        // Open translation bot modal
        this.addTouchClick('textTranslatorBtn', () => this.openTranslatorBot());
        this.addTouchClick('closeTranslatorBotBtn', () => this.closeTranslatorBot());

        // Backdrop close
        const botModal = document.getElementById('translatorBotModal');
        const handleBotBackdrop = (e) => {
            if (e.target.id === 'translatorBotModal') this.closeTranslatorBot();
        };
        botModal.addEventListener('click', handleBotBackdrop);
        botModal.addEventListener('touchend', handleBotBackdrop);

        // Swap languages button
        this.addTouchClick('swapLanguagesBtn', () => this.swapBotLanguages());

        // Clear input button
        this.addTouchClick('clearBotInputBtn', () => {
            document.getElementById('botInputText').value = '';
            document.getElementById('botCharCount').textContent = '0 characters';
        });

        // Character count update
        const inputText = document.getElementById('botInputText');
        inputText.addEventListener('input', () => {
            const len = inputText.value.length;
            document.getElementById('botCharCount').textContent = `${len} character${len !== 1 ? 's' : ''}`;
        });

        // Translate button
        this.addTouchClick('botTranslateBtn', () => this.handleBotTranslate());

        // Enter key to translate (Ctrl+Enter or Cmd+Enter)
        inputText.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                this.handleBotTranslate();
            }
        });

        // Copy translation button
        this.addTouchClick('copyTranslationBtn', () => this.copyBotTranslation());
    }

    openTranslatorBot() {
        document.getElementById('translatorBotModal').style.display = 'flex';
        document.getElementById('botInputText').focus();
    }

    closeTranslatorBot() {
        document.getElementById('translatorBotModal').style.display = 'none';
    }

    swapBotLanguages() {
        const sourceSelect = document.getElementById('botSourceLang');
        const targetSelect = document.getElementById('botTargetLang');

        // Don't swap if source is auto-detect
        if (sourceSelect.value === 'auto') return;

        const temp = sourceSelect.value;
        sourceSelect.value = targetSelect.value;
        targetSelect.value = temp;
    }

    async handleBotTranslate() {
        const inputText = document.getElementById('botInputText').value.trim();
        const sourceLang = document.getElementById('botSourceLang').value;
        const targetLang = document.getElementById('botTargetLang').value;
        const outputSection = document.getElementById('botOutputSection');
        const outputText = document.getElementById('botOutputText');
        const translateBtn = document.getElementById('botTranslateBtn');

        if (!inputText) {
            this.showError('Please enter some text to translate');
            return;
        }

        if (!this.settings.apiKey) {
            this.showError('Please configure your Gemini API key in settings first');
            return;
        }

        // Check credits
        const creditResult = await this.creditService.useCredit();
        if (!creditResult.success) {
            if (creditResult.promptLogin) {
                this.showGuestNoCreditsModal();
            } else {
                document.getElementById('noCreditsModal').style.display = 'flex';
            }
            return;
        }
        document.getElementById('creditCount').textContent = creditResult.remainingCredits;

        // Show output section and prepare for streaming
        outputSection.style.display = 'block';
        outputText.textContent = '';
        outputText.classList.add('streaming');
        translateBtn.disabled = true;
        translateBtn.textContent = '⏳ Translating...';

        try {
            // Use streaming translation
            await this.translationService.translateText(
                inputText,
                sourceLang,
                targetLang,
                (streamedText) => {
                    outputText.textContent = streamedText;
                }
            );

            outputText.classList.remove('streaming');
        } catch (error) {
            console.error('[TranslatorBot] Translation failed:', error);
            outputText.textContent = 'Translation failed: ' + error.message;
            outputText.classList.remove('streaming');
        } finally {
            translateBtn.disabled = false;
            translateBtn.textContent = '🚀 Translate';
        }
    }

    async copyBotTranslation() {
        const outputText = document.getElementById('botOutputText').textContent;
        if (!outputText) return;

        try {
            await navigator.clipboard.writeText(outputText);
            const copyBtn = document.getElementById('copyTranslationBtn');
            const originalText = copyBtn.textContent;
            copyBtn.textContent = '✓';
            setTimeout(() => {
                copyBtn.textContent = originalText;
            }, 1500);
        } catch (error) {
            console.error('Copy failed:', error);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // AI ASSISTANT METHODS
    // ═══════════════════════════════════════════════════════════════

    initAIAssistantListeners() {
        // Open AI Assistant modal
        this.addTouchClick('aiAssistantBtn', () => this.openAIAssistant());
        this.addTouchClick('closeAIAssistantBtn', () => this.closeAIAssistant());

        // Handle backdrop click
        const aiModal = document.getElementById('aiAssistantModal');
        const handleAIBackdrop = (e) => {
            if (e.target.id === 'aiAssistantModal') this.closeAIAssistant();
        };
        aiModal.addEventListener('click', handleAIBackdrop);
        aiModal.addEventListener('touchend', handleAIBackdrop);

        // Send button
        this.addTouchClick('aiSendBtn', () => this.handleAISend());

        // Enter key to send (but allow Shift+Enter for newlines)
        document.getElementById('aiInputText').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleAISend();
            }
        });

        // Quick action buttons
        this.addTouchClick('aiExplainBtn', () => this.handleAIQuickAction('explain'));
        this.addTouchClick('aiGrammarBtn', () => this.handleAIQuickAction('grammar'));
        this.addTouchClick('aiPracticeBtn', () => this.handleAIQuickAction('practice'));
        this.addTouchClick('aiClearBtn', () => this.clearAIChat());
    }

    openAIAssistant() {
        document.getElementById('aiAssistantModal').style.display = 'flex';
        document.getElementById('aiInputText').focus();
    }

    closeAIAssistant() {
        document.getElementById('aiAssistantModal').style.display = 'none';
    }

    async handleAISend() {
        const inputEl = document.getElementById('aiInputText');
        const question = inputEl.value.trim();

        if (!question) return;

        // Clear input
        inputEl.value = '';

        // Check credits
        const creditResult = await this.creditService.useCredit();
        if (!creditResult.success) {
            if (creditResult.promptLogin) {
                this.showGuestNoCreditsModal();
            } else {
                document.getElementById('noCreditsModal').style.display = 'flex';
            }
            return;
        }
        document.getElementById('creditCount').textContent = creditResult.remainingCredits;

        // Add user message
        this.addAIChatMessage('user', question);

        // Add assistant message placeholder for streaming
        const assistantMsgEl = this.addAIChatMessage('assistant', '', true);

        try {
            let response;

            // Check if we have a captured image to analyze
            if (this.capturedImageForAsk) {
                const imageData = this.capturedImageForAsk;
                // Clear the captured image after use
                this.capturedImageForAsk = null;

                response = await this.aiAssistantService.askQuestionWithImage(
                    question,
                    imageData,
                    this.settings.targetLanguage,
                    (streamedText) => {
                        assistantMsgEl.querySelector('.ai-message-content').textContent = streamedText;
                        this.scrollAIChat();
                    }
                );
            } else {
                response = await this.aiAssistantService.askQuestion(
                    question,
                    this.settings.targetLanguage,
                    (streamedText) => {
                        assistantMsgEl.querySelector('.ai-message-content').textContent = streamedText;
                        this.scrollAIChat();
                    }
                );
            }

            // Remove streaming class
            assistantMsgEl.classList.remove('streaming');
        } catch (error) {
            console.error('[AI Assistant] Error:', error);
            assistantMsgEl.querySelector('.ai-message-content').textContent = 'Sorry, an error occurred: ' + error.message;
            assistantMsgEl.classList.remove('streaming');
        }
    }

    async handleAIQuickAction(action) {
        const inputEl = document.getElementById('aiInputText');
        let inputText = inputEl.value.trim();

        // If no text provided, prompt user
        if (!inputText) {
            if (action === 'explain') {
                inputEl.placeholder = 'Enter Chinese text to explain...';
            } else if (action === 'grammar') {
                inputEl.placeholder = 'Enter Chinese text for grammar analysis...';
            } else if (action === 'practice') {
                inputEl.placeholder = 'Enter a topic or word to practice...';
            }
            inputEl.focus();
            return;
        }

        // Check credits
        const creditResult = await this.creditService.useCredit();
        if (!creditResult.success) {
            if (creditResult.promptLogin) {
                this.showGuestNoCreditsModal();
            } else {
                document.getElementById('noCreditsModal').style.display = 'flex';
            }
            return;
        }
        document.getElementById('creditCount').textContent = creditResult.remainingCredits;

        // Clear input
        inputEl.value = '';
        inputEl.placeholder = 'Ask a question about Chinese...';

        // Add user message
        const actionLabel = action === 'explain' ? '📖 Explain: ' :
            action === 'grammar' ? '📝 Grammar: ' :
                '🎯 Practice: ';
        this.addAIChatMessage('user', actionLabel + inputText);

        // Add assistant message placeholder for streaming
        const assistantMsgEl = this.addAIChatMessage('assistant', '', true);

        try {
            let response;
            if (action === 'explain') {
                response = await this.aiAssistantService.explainText(
                    inputText,
                    this.settings.targetLanguage,
                    (streamedText) => {
                        assistantMsgEl.querySelector('.ai-message-content').textContent = streamedText;
                        this.scrollAIChat();
                    }
                );
            } else if (action === 'grammar') {
                response = await this.aiAssistantService.analyzeGrammar(
                    inputText,
                    this.settings.targetLanguage,
                    (streamedText) => {
                        assistantMsgEl.querySelector('.ai-message-content').textContent = streamedText;
                        this.scrollAIChat();
                    }
                );
            } else if (action === 'practice') {
                // Practice doesn't support streaming
                response = await this.aiAssistantService.generatePractice(
                    inputText,
                    'beginner',
                    this.settings.targetLanguage
                );
                assistantMsgEl.querySelector('.ai-message-content').textContent = response;
                this.scrollAIChat();
            }

            // Remove streaming class
            assistantMsgEl.classList.remove('streaming');
        } catch (error) {
            console.error('[AI Assistant] Quick action error:', error);
            assistantMsgEl.querySelector('.ai-message-content').textContent = 'Sorry, an error occurred: ' + error.message;
            assistantMsgEl.classList.remove('streaming');
        }
    }

    addAIChatMessage(role, content, isStreaming = false) {
        const chatContainer = document.getElementById('aiChatMessages');

        // Remove welcome message if it exists
        const welcomeMsg = chatContainer.querySelector('.ai-welcome-message');
        if (welcomeMsg) {
            welcomeMsg.remove();
        }

        const messageDiv = document.createElement('div');
        messageDiv.className = `ai-message ${role}${isStreaming ? ' streaming' : ''}`;

        const label = role === 'user' ? 'You' : 'AI Assistant';
        messageDiv.innerHTML = `
            <span class="ai-message-label">${label}</span>
            <div class="ai-message-content">${content || ''}</div>
        `;

        chatContainer.appendChild(messageDiv);
        this.scrollAIChat();

        return messageDiv;
    }

    scrollAIChat() {
        const chatContainer = document.getElementById('aiChatMessages');
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    clearAIChat() {
        const chatContainer = document.getElementById('aiChatMessages');
        chatContainer.innerHTML = `
            <div class="ai-welcome-message">
                <p>👋 Hello! I'm your Chinese language assistant.</p>
                <p>Ask me anything about Chinese language, get explanations, grammar analysis, or practice exercises!</p>
            </div>
        `;
        this.aiAssistantService.clearHistory();
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
