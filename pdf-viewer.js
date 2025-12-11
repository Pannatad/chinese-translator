// PDF Viewer Module
// Handles PDF loading, rendering, and navigation

import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker for Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.mjs',
    import.meta.url
).toString();

export class PDFViewer {
    constructor() {
        this.pdfDoc = null;
        this.currentPage = 1;
        this.totalPages = 0;
        this.scale = 1.0;
        this.canvas = document.getElementById('pdfCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.renderTask = null;
    }

    async loadPDF(file) {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
            this.pdfDoc = await loadingTask.promise;
            this.totalPages = this.pdfDoc.numPages;
            this.currentPage = 1;

            await this.renderPage(this.currentPage);
            this.updatePageInfo();

            return true;
        } catch (error) {
            console.error('Error loading PDF:', error);
            throw new Error('Failed to load PDF file');
        }
    }

    async renderPage(pageNum) {
        if (!this.pdfDoc || pageNum < 1 || pageNum > this.totalPages) {
            return;
        }

        // Cancel any ongoing rendering
        if (this.renderTask) {
            this.renderTask.cancel();
        }

        try {
            const page = await this.pdfDoc.getPage(pageNum);
            const viewport = page.getViewport({ scale: this.scale });

            // Set canvas dimensions for high DPI displays
            const outputScale = window.devicePixelRatio || 1;
            this.canvas.width = Math.floor(viewport.width * outputScale);
            this.canvas.height = Math.floor(viewport.height * outputScale);
            this.canvas.style.width = Math.floor(viewport.width) + 'px';
            this.canvas.style.height = Math.floor(viewport.height) + 'px';

            const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;

            const renderContext = {
                canvasContext: this.ctx,
                viewport: viewport,
                transform: transform
            };

            this.renderTask = page.render(renderContext);
            await this.renderTask.promise;
            this.renderTask = null;

            this.currentPage = pageNum;
            this.updatePageInfo();
        } catch (error) {
            if (error.name === 'RenderingCancelledException') {
                // Ignore cancellation errors
                return;
            }
            console.error('Error rendering page:', error);
            throw error;
        }
    }

    async nextPage() {
        if (this.currentPage < this.totalPages) {
            await this.renderPage(this.currentPage + 1);
        }
    }

    async previousPage() {
        if (this.currentPage > 1) {
            await this.renderPage(this.currentPage - 1);
        }
    }

    async zoomIn() {
        this.scale = Math.min(this.scale + 0.2, 3.0);
        await this.renderPage(this.currentPage);
        this.updateZoomLevel();
    }

    async zoomOut() {
        this.scale = Math.max(this.scale - 0.2, 0.5);
        await this.renderPage(this.currentPage);
        this.updateZoomLevel();
    }

    updatePageInfo() {
        const pageInfo = document.getElementById('pageInfo');
        if (pageInfo) {
            pageInfo.textContent = `Page ${this.currentPage} of ${this.totalPages}`;
        }
    }

    updateZoomLevel() {
        const zoomLevel = document.getElementById('zoomLevel');
        if (zoomLevel) {
            zoomLevel.textContent = `${Math.round(this.scale * 100)}%`;
        }
    }

    getCanvasImageData(x, y, width, height) {
        // Ensure coordinates are within canvas bounds
        const canvasRect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / canvasRect.width;
        const scaleY = this.canvas.height / canvasRect.height;

        const scaledX = Math.max(0, Math.floor(x * scaleX));
        const scaledY = Math.max(0, Math.floor(y * scaleY));
        const scaledWidth = Math.min(Math.floor(width * scaleX), this.canvas.width - scaledX);
        const scaledHeight = Math.min(Math.floor(height * scaleY), this.canvas.height - scaledY);

        if (scaledWidth <= 0 || scaledHeight <= 0) {
            return null;
        }

        return this.ctx.getImageData(scaledX, scaledY, scaledWidth, scaledHeight);
    }

    reset() {
        this.pdfDoc = null;
        this.currentPage = 1;
        this.totalPages = 0;
        this.scale = 1.0;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
}
