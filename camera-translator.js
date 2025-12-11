// Camera Translator Module
// Real-time camera feed with live translation overlay

import { TranslationService } from './translation-service.js';

export class CameraTranslator {
    constructor(translationService) {
        this.translationService = translationService;
        this.stream = null;
        this.video = null;
        this.canvas = null;
        this.ctx = null;
        this.overlayCanvas = null;
        this.overlayCtx = null;
        this.isActive = false;
        this.isTranslating = false;
        this.lastTranslation = '';
        this.translationInterval = null;
        this.targetLanguage = 'english';

        // Throttle translation requests (every 3 seconds)
        this.TRANSLATION_DELAY = 3000;
    }

    /**
     * Initialize the camera translator with DOM elements
     */
    init(videoElement, canvasElement, overlayElement) {
        this.video = videoElement;
        this.canvas = canvasElement;
        this.ctx = this.canvas.getContext('2d');
        this.overlayCanvas = overlayElement;
        this.overlayCtx = this.overlayCanvas.getContext('2d');
    }

    /**
     * Set target language for translation
     */
    setTargetLanguage(language) {
        this.targetLanguage = language;
    }

    /**
     * Start the camera stream
     */
    async start() {
        try {
            // Request camera access (prefer back camera on mobile)
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: { ideal: 'environment' },
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: false
            });

            this.video.srcObject = this.stream;
            await this.video.play();

            // Set canvas size to match video
            this.canvas.width = this.video.videoWidth;
            this.canvas.height = this.video.videoHeight;
            this.overlayCanvas.width = this.video.videoWidth;
            this.overlayCanvas.height = this.video.videoHeight;

            this.isActive = true;
            this.startTranslationLoop();

            return { success: true };
        } catch (error) {
            console.error('Failed to start camera:', error);
            return {
                success: false,
                error: this._getCameraErrorMessage(error)
            };
        }
    }

    /**
     * Stop the camera stream
     */
    stop() {
        this.isActive = false;

        // Stop translation loop
        if (this.translationInterval) {
            clearInterval(this.translationInterval);
            this.translationInterval = null;
        }

        // Stop all video tracks
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }

        // Clear video
        if (this.video) {
            this.video.srcObject = null;
        }

        // Clear overlays
        if (this.overlayCtx) {
            this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
        }

        this.lastTranslation = '';
    }

    /**
     * Start the translation loop
     */
    startTranslationLoop() {
        // Initial translation after stream starts
        setTimeout(() => this.captureAndTranslate(), 1000);

        // Periodic translation
        this.translationInterval = setInterval(() => {
            if (this.isActive && !this.isTranslating) {
                this.captureAndTranslate();
            }
        }, this.TRANSLATION_DELAY);
    }

    /**
     * Capture current frame and translate
     */
    async captureAndTranslate() {
        if (!this.isActive || this.isTranslating) return;

        this.isTranslating = true;
        this.showLoadingOverlay();

        try {
            // Capture frame from video
            this.ctx.drawImage(this.video, 0, 0);

            // Convert to base64
            const imageData = this.canvas.toDataURL('image/jpeg', 0.8);
            const base64Data = imageData.split(',')[1];

            // Translate using Gemini Vision
            const result = await this.translationService.translate(
                { mimeType: 'image/jpeg', data: base64Data },
                this.targetLanguage
            );

            if (result && result.trim()) {
                this.lastTranslation = result;
                this.showTranslationOverlay(result);
            } else {
                this.showTranslationOverlay('(No Chinese text detected)');
            }
        } catch (error) {
            console.error('Translation error:', error);
            this.showTranslationOverlay('Translation failed - retrying...');
        } finally {
            this.isTranslating = false;
        }
    }

    /**
     * Show loading indicator on overlay
     */
    showLoadingOverlay() {
        if (!this.overlayCtx) return;

        this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);

        // Draw loading indicator
        const centerX = this.overlayCanvas.width / 2;
        const centerY = this.overlayCanvas.height - 80;

        // Background pill
        this.overlayCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this._drawRoundedRect(centerX - 80, centerY - 20, 160, 40, 20);
        this.overlayCtx.fill();

        // Loading text
        this.overlayCtx.fillStyle = '#ffffff';
        this.overlayCtx.font = '16px -apple-system, BlinkMacSystemFont, sans-serif';
        this.overlayCtx.textAlign = 'center';
        this.overlayCtx.textBaseline = 'middle';
        this.overlayCtx.fillText('⏳ Translating...', centerX, centerY);
    }

    /**
     * Show translation result on overlay
     */
    showTranslationOverlay(text) {
        if (!this.overlayCtx) return;

        this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);

        // Calculate text dimensions
        const padding = 20;
        const maxWidth = this.overlayCanvas.width - padding * 2;
        const lineHeight = 28;
        const fontSize = 18;

        this.overlayCtx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;

        // Word wrap text
        const lines = this._wrapText(text, maxWidth);
        const boxHeight = lines.length * lineHeight + padding * 2;
        const boxY = this.overlayCanvas.height - boxHeight - 20;

        // Background with blur effect simulation
        this.overlayCtx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this._drawRoundedRect(padding, boxY, maxWidth, boxHeight, 16);
        this.overlayCtx.fill();

        // Border
        this.overlayCtx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        this.overlayCtx.lineWidth = 1;
        this._drawRoundedRect(padding, boxY, maxWidth, boxHeight, 16);
        this.overlayCtx.stroke();

        // Text
        this.overlayCtx.fillStyle = '#ffffff';
        this.overlayCtx.textAlign = 'left';
        this.overlayCtx.textBaseline = 'top';

        lines.forEach((line, index) => {
            this.overlayCtx.fillText(
                line,
                padding + 16,
                boxY + padding + index * lineHeight
            );
        });
    }

    /**
     * Word wrap text to fit within maxWidth
     */
    _wrapText(text, maxWidth) {
        const words = text.split(' ');
        const lines = [];
        let currentLine = '';

        words.forEach(word => {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            const metrics = this.overlayCtx.measureText(testLine);

            if (metrics.width > maxWidth - 32 && currentLine) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        });

        if (currentLine) {
            lines.push(currentLine);
        }

        return lines;
    }

    /**
     * Draw a rounded rectangle path
     */
    _drawRoundedRect(x, y, width, height, radius) {
        this.overlayCtx.beginPath();
        this.overlayCtx.moveTo(x + radius, y);
        this.overlayCtx.lineTo(x + width - radius, y);
        this.overlayCtx.quadraticCurveTo(x + width, y, x + width, y + radius);
        this.overlayCtx.lineTo(x + width, y + height - radius);
        this.overlayCtx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        this.overlayCtx.lineTo(x + radius, y + height);
        this.overlayCtx.quadraticCurveTo(x, y + height, x, y + height - radius);
        this.overlayCtx.lineTo(x, y + radius);
        this.overlayCtx.quadraticCurveTo(x, y, x + radius, y);
        this.overlayCtx.closePath();
    }

    /**
     * Get user-friendly camera error message
     */
    _getCameraErrorMessage(error) {
        if (error.name === 'NotAllowedError') {
            return 'Camera access denied. Please allow camera access in your browser settings.';
        }
        if (error.name === 'NotFoundError') {
            return 'No camera found on this device.';
        }
        if (error.name === 'NotReadableError') {
            return 'Camera is in use by another application.';
        }
        return 'Failed to access camera. Please try again.';
    }

    /**
     * Check if camera is supported
     */
    static isSupported() {
        return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    }

    /**
     * Trigger manual translation (for button press)
     */
    async translateNow() {
        if (!this.isActive) return;
        await this.captureAndTranslate();
    }
}
