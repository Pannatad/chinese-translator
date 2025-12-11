// OCR Service Module
// Handles text extraction using Tesseract.js

export class OCRService {
    constructor() {
        this.worker = null;
        this.isInitialized = false;
    }

    async initialize() {
        if (this.isInitialized) {
            return;
        }

        try {
            // Create Tesseract worker
            this.worker = await Tesseract.createWorker('chi_sim+chi_tra', 1, {
                logger: (m) => {
                    // Log progress for debugging (optional)
                    if (m.status === 'recognizing text') {
                        console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
                    }
                }
            });

            this.isInitialized = true;
            console.log('OCR Worker initialized successfully');
        } catch (error) {
            console.error('Error initializing OCR:', error);
            throw new Error('Failed to initialize OCR service');
        }
    }

    async recognizeText(imageData) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        try {
            // Convert ImageData to canvas for Tesseract
            const canvas = document.createElement('canvas');
            canvas.width = imageData.width;
            canvas.height = imageData.height;
            const ctx = canvas.getContext('2d');
            ctx.putImageData(imageData, 0, 0);

            // Perform OCR
            const result = await this.worker.recognize(canvas);

            return {
                text: result.data.text.trim(),
                confidence: result.data.confidence
            };
        } catch (error) {
            console.error('Error during OCR:', error);
            throw new Error('Failed to extract text from image');
        }
    }

    async terminate() {
        if (this.worker) {
            await this.worker.terminate();
            this.worker = null;
            this.isInitialized = false;
        }
    }
}
