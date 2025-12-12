// Selection Box Module
// Handles draggable and resizable selection box for OCR

export class SelectionBox {
    constructor(containerElement, boxId = 'selectionBox') {
        this.container = containerElement;
        this.box = document.getElementById(boxId);
        this.isDragging = false;
        this.isResizing = false;
        this.currentHandle = null;
        this.startX = 0;
        this.startY = 0;
        this.startWidth = 0;
        this.startHeight = 0;
        this.startLeft = 0;
        this.startTop = 0;

        // Reduced minimum size for small text selections
        this.minWidth = 50;
        this.minHeight = 40;

        // Callback when drag/resize ends (for debounced translation)
        this.onMoveEnd = null;

        // Store position as percentage of container for zoom resilience
        this.positionPercent = { left: 50, top: 50 };
        this.sizePercent = { width: 30, height: 25 };

        this.initEventListeners();
        this.initResizeObserver();
    }

    /**
     * Initialize ResizeObserver to handle container size changes (zoom)
     */
    initResizeObserver() {
        if (typeof ResizeObserver !== 'undefined') {
            this.resizeObserver = new ResizeObserver(() => {
                this.syncPositionFromPercent();
            });
            this.resizeObserver.observe(this.container);
        }
    }

    /**
     * Convert current pixel position to percentage
     */
    updatePercentFromPixels() {
        const containerRect = this.container.getBoundingClientRect();
        const boxRect = this.box.getBoundingClientRect();

        const left = boxRect.left - containerRect.left;
        const top = boxRect.top - containerRect.top;

        this.positionPercent = {
            left: (left / containerRect.width) * 100,
            top: (top / containerRect.height) * 100
        };
        this.sizePercent = {
            width: (boxRect.width / containerRect.width) * 100,
            height: (boxRect.height / containerRect.height) * 100
        };
    }

    /**
     * Apply percentage position to pixels (called on container resize)
     */
    syncPositionFromPercent() {
        if (this.isDragging || this.isResizing) return; // Don't interfere during interaction

        const containerRect = this.container.getBoundingClientRect();

        const left = (this.positionPercent.left / 100) * containerRect.width;
        const top = (this.positionPercent.top / 100) * containerRect.height;
        const width = Math.max(this.minWidth, (this.sizePercent.width / 100) * containerRect.width);
        const height = Math.max(this.minHeight, (this.sizePercent.height / 100) * containerRect.height);

        this.box.style.left = left + 'px';
        this.box.style.top = top + 'px';
        this.box.style.width = width + 'px';
        this.box.style.height = height + 'px';
        this.box.style.transform = 'none';
    }

    initEventListeners() {
        // Dragging the box
        this.box.addEventListener('mousedown', this.handleDragStart.bind(this));
        this.box.addEventListener('touchstart', this.handleDragStart.bind(this), { passive: false });

        // Resizing via handles
        const handles = this.box.querySelectorAll('.resize-handle');
        handles.forEach(handle => {
            handle.addEventListener('mousedown', this.handleResizeStart.bind(this));
            handle.addEventListener('touchstart', this.handleResizeStart.bind(this), { passive: false });
        });

        // Global move and end events
        document.addEventListener('mousemove', this.handleMove.bind(this));
        document.addEventListener('touchmove', this.handleMove.bind(this), { passive: false });
        document.addEventListener('mouseup', this.handleEnd.bind(this));
        document.addEventListener('touchend', this.handleEnd.bind(this));
    }

    handleDragStart(e) {
        // Only start dragging if clicking on the box itself, not handles or button
        if (e.target.classList.contains('resize-handle') ||
            e.target.classList.contains('capture-btn') ||
            e.target.closest('.capture-btn')) {
            return;
        }

        e.preventDefault();
        this.isDragging = true;

        const touch = e.touches ? e.touches[0] : e;
        this.startX = touch.clientX;
        this.startY = touch.clientY;

        const rect = this.box.getBoundingClientRect();
        this.startLeft = rect.left;
        this.startTop = rect.top;

        this.box.style.cursor = 'grabbing';
    }

    handleResizeStart(e) {
        e.preventDefault();
        e.stopPropagation();

        this.isResizing = true;
        this.currentHandle = e.target;

        const touch = e.touches ? e.touches[0] : e;
        this.startX = touch.clientX;
        this.startY = touch.clientY;

        const rect = this.box.getBoundingClientRect();
        this.startWidth = rect.width;
        this.startHeight = rect.height;
        this.startLeft = rect.left;
        this.startTop = rect.top;
    }

    handleMove(e) {
        if (!this.isDragging && !this.isResizing) return;

        e.preventDefault();
        const touch = e.touches ? e.touches[0] : e;

        if (this.isDragging) {
            this.drag(touch.clientX, touch.clientY);
        } else if (this.isResizing) {
            this.resize(touch.clientX, touch.clientY);
        }
    }

    drag(clientX, clientY) {
        const deltaX = clientX - this.startX;
        const deltaY = clientY - this.startY;

        const containerRect = this.container.getBoundingClientRect();
        const boxRect = this.box.getBoundingClientRect();

        let newLeft = this.startLeft + deltaX - containerRect.left;
        let newTop = this.startTop + deltaY - containerRect.top;

        // Keep within container bounds
        newLeft = Math.max(0, Math.min(newLeft, containerRect.width - boxRect.width));
        newTop = Math.max(0, Math.min(newTop, containerRect.height - boxRect.height));

        this.box.style.left = newLeft + 'px';
        this.box.style.top = newTop + 'px';
        this.box.style.transform = 'none';
    }

    resize(clientX, clientY) {
        const deltaX = clientX - this.startX;
        const deltaY = clientY - this.startY;

        const containerRect = this.container.getBoundingClientRect();
        let newWidth = this.startWidth;
        let newHeight = this.startHeight;
        let newLeft = this.startLeft - containerRect.left;
        let newTop = this.startTop - containerRect.top;

        const handleClass = this.currentHandle.className;

        if (handleClass.includes('top-left')) {
            newWidth = Math.max(this.minWidth, this.startWidth - deltaX);
            newHeight = Math.max(this.minHeight, this.startHeight - deltaY);
            newLeft = this.startLeft + (this.startWidth - newWidth) - containerRect.left;
            newTop = this.startTop + (this.startHeight - newHeight) - containerRect.top;
        } else if (handleClass.includes('top-right')) {
            newWidth = Math.max(this.minWidth, this.startWidth + deltaX);
            newHeight = Math.max(this.minHeight, this.startHeight - deltaY);
            newTop = this.startTop + (this.startHeight - newHeight) - containerRect.top;
        } else if (handleClass.includes('bottom-left')) {
            newWidth = Math.max(this.minWidth, this.startWidth - deltaX);
            newHeight = Math.max(this.minHeight, this.startHeight + deltaY);
            newLeft = this.startLeft + (this.startWidth - newWidth) - containerRect.left;
        } else if (handleClass.includes('bottom-right')) {
            newWidth = Math.max(this.minWidth, this.startWidth + deltaX);
            newHeight = Math.max(this.minHeight, this.startHeight + deltaY);
        }

        // Keep within container bounds
        newLeft = Math.max(0, Math.min(newLeft, containerRect.width - newWidth));
        newTop = Math.max(0, Math.min(newTop, containerRect.height - newHeight));

        this.box.style.width = newWidth + 'px';
        this.box.style.height = newHeight + 'px';
        this.box.style.left = newLeft + 'px';
        this.box.style.top = newTop + 'px';
        this.box.style.transform = 'none';
    }

    handleEnd(e) {
        const wasMoving = this.isDragging || this.isResizing;

        if (this.isDragging) {
            this.box.style.cursor = 'move';
        }

        this.isDragging = false;
        this.isResizing = false;
        this.currentHandle = null;

        // Save position as percentage for zoom resilience
        if (wasMoving) {
            this.updatePercentFromPixels();

            // Trigger callback for debounced translation
            if (this.onMoveEnd && typeof this.onMoveEnd === 'function') {
                this.onMoveEnd();
            }
        }
    }

    getPosition() {
        const containerRect = this.container.getBoundingClientRect();
        const boxRect = this.box.getBoundingClientRect();

        return {
            x: boxRect.left - containerRect.left,
            y: boxRect.top - containerRect.top,
            width: boxRect.width,
            height: boxRect.height
        };
    }

    getCanvasPosition(canvas) {
        const canvasRect = canvas.getBoundingClientRect();
        const boxRect = this.box.getBoundingClientRect();

        // Calculate the overlap between selection box and canvas
        const overlapLeft = Math.max(boxRect.left, canvasRect.left);
        const overlapTop = Math.max(boxRect.top, canvasRect.top);
        const overlapRight = Math.min(boxRect.right, canvasRect.right);
        const overlapBottom = Math.min(boxRect.bottom, canvasRect.bottom);

        if (overlapLeft >= overlapRight || overlapTop >= overlapBottom) {
            return null; // No overlap
        }

        return {
            x: overlapLeft - canvasRect.left,
            y: overlapTop - canvasRect.top,
            width: overlapRight - overlapLeft,
            height: overlapBottom - overlapTop
        };
    }

    reset() {
        this.box.style.width = '300px';
        this.box.style.height = '200px';
        this.box.style.left = '50%';
        this.box.style.top = '50%';
        this.box.style.transform = 'translate(-50%, -50%)';

        // Reset percentage position
        this.positionPercent = { left: 50, top: 50 };
        this.sizePercent = { width: 30, height: 25 };

        this.hideStickyNote();
    }

    // STICKY NOTE MODE - Floating translation card BELOW the selection box
    showStickyNote(text, isLoading = false) {
        // Remove existing sticky note if any
        this.hideStickyNote();

        // Create sticky note container
        const stickyNote = document.createElement('div');
        stickyNote.id = 'stickyNoteOverlay';
        stickyNote.className = 'sticky-note-floating';

        if (isLoading) {
            stickyNote.innerHTML = `
                <div class="sticky-note-card loading">
                    <span class="loading-spinner-small"></span>
                    <span class="loading-text">${text}</span>
                </div>
            `;
        } else {
            stickyNote.innerHTML = `
                <div class="sticky-note-card">
                    <button class="sticky-note-close-v2">×</button>
                    <p class="sticky-note-text">${text}</p>
                </div>
            `;
            // Attach event listener using Pointer Events for iPad
            const closeBtn = stickyNote.querySelector('.sticky-note-close-v2');
            this.attachPointerHandler(closeBtn, () => this.hideStickyNote());
        }

        // Position below the selection box
        this.positionStickyNote(stickyNote);
        this.container.appendChild(stickyNote);
    }

    /**
     * Position the sticky note below the selection box
     */
    positionStickyNote(stickyNote) {
        const boxRect = this.box.getBoundingClientRect();
        const containerRect = this.container.getBoundingClientRect();

        stickyNote.style.position = 'absolute';
        stickyNote.style.left = (boxRect.left - containerRect.left) + 'px';
        stickyNote.style.top = (boxRect.bottom - containerRect.top + 80) + 'px'; // 80px below for buttons with spacing
        stickyNote.style.width = boxRect.width + 'px';
        stickyNote.style.maxWidth = '400px';
    }

    updateStickyNote(text) {
        let overlay = document.getElementById('stickyNoteOverlay');

        if (!overlay) {
            // Create new one if doesn't exist
            this.showStickyNote(text, false);
            overlay = document.getElementById('stickyNoteOverlay');
        }

        if (overlay) {
            overlay.innerHTML = `
                <div class="sticky-note-card">
                    <button class="sticky-note-close-v2">×</button>
                    <p class="sticky-note-text">${text}</p>
                </div>
            `;
            // Reposition in case box moved
            this.positionStickyNote(overlay);

            // Attach close button handler
            const closeBtn = overlay.querySelector('.sticky-note-close-v2');
            this.attachPointerHandler(closeBtn, () => this.hideStickyNote());
        }

        // Create/update floating word-by-word button OUTSIDE the box
        this.showFloatingDetailsButton();
    }

    /**
     * Show floating "View Word-by-Word" button BESIDE the Translate button
     */
    showFloatingDetailsButton() {
        // Remove existing button if any
        let floatingBtn = document.getElementById('floatingDetailsBtn');
        if (floatingBtn) floatingBtn.remove();

        // Create floating button
        floatingBtn = document.createElement('button');
        floatingBtn.id = 'floatingDetailsBtn';
        floatingBtn.className = 'floating-details-btn';
        floatingBtn.innerHTML = '📚 Word-by-Word';

        // Position beside the capture button (to the right of it)
        const captureBtn = this.box.querySelector('.capture-btn');
        const boxRect = this.box.getBoundingClientRect();
        const containerRect = this.container.getBoundingClientRect();

        floatingBtn.style.position = 'absolute';

        if (captureBtn) {
            // Position to the right of the capture button with more gap
            const captureBtnRect = captureBtn.getBoundingClientRect();
            floatingBtn.style.left = (captureBtnRect.right - containerRect.left + 20) + 'px'; // 20px gap
            floatingBtn.style.top = (captureBtnRect.top - containerRect.top) + 'px';
            floatingBtn.style.transform = 'none';
        } else {
            // Fallback: position below the box to the right of center
            floatingBtn.style.left = (boxRect.left - containerRect.left + boxRect.width / 2 + 80) + 'px';
            floatingBtn.style.top = (boxRect.bottom - containerRect.top + 10) + 'px';
            floatingBtn.style.transform = 'translateX(-50%)';
        }

        this.container.appendChild(floatingBtn);

        // Attach handler
        this.attachPointerHandler(floatingBtn, () => window.app.openTranslationModal());
    }

    /**
     * Hide floating details button
     */
    hideFloatingDetailsButton() {
        const floatingBtn = document.getElementById('floatingDetailsBtn');
        if (floatingBtn) floatingBtn.remove();
    }

    // Helper for iPad-compatible pointer events
    attachPointerHandler(element, handler) {
        if (!element) return;
        element.addEventListener('pointerdown', (e) => e.preventDefault());
        element.addEventListener('pointerup', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.isPrimary) handler();
        });
    }

    hideStickyNote() {
        const existing = document.getElementById('stickyNoteOverlay');
        if (existing) {
            existing.remove();
        }
        this.hideFloatingDetailsButton();
    }
}

