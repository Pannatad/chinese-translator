// Selection Box Module
// Handles draggable and resizable selection box for OCR

export class SelectionBox {
    constructor(containerElement) {
        this.container = containerElement;
        this.box = document.getElementById('selectionBox');
        this.isDragging = false;
        this.isResizing = false;
        this.currentHandle = null;
        this.startX = 0;
        this.startY = 0;
        this.startWidth = 0;
        this.startHeight = 0;
        this.startLeft = 0;
        this.startTop = 0;

        this.minWidth = 100;
        this.minHeight = 80;

        this.initEventListeners();
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
        if (this.isDragging) {
            this.box.style.cursor = 'move';
        }

        this.isDragging = false;
        this.isResizing = false;
        this.currentHandle = null;
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
        this.hideStickyNote();
    }

    // STICKY NOTE MODE - Overlay translation on the selection box
    showStickyNote(text, isLoading = false) {
        // Remove existing sticky note if any
        this.hideStickyNote();

        // Create sticky note element
        const stickyNote = document.createElement('div');
        stickyNote.id = 'stickyNoteOverlay';
        stickyNote.className = 'sticky-note-overlay';

        if (isLoading) {
            stickyNote.innerHTML = `
                <div class="sticky-note-loading">
                    <span class="loading-spinner-small"></span>
                    <span>${text}</span>
                </div>
            `;
        } else {
            stickyNote.innerHTML = `
                <div class="sticky-note-content">
                    <button class="sticky-note-close">×</button>
                    <p>${text}</p>
                </div>
            `;
            // Attach event listener using Pointer Events for iPad
            const closeBtn = stickyNote.querySelector('.sticky-note-close');
            this.attachPointerHandler(closeBtn, () => this.hideStickyNote());
        }

        this.box.appendChild(stickyNote);
    }

    updateStickyNote(text) {
        const overlay = document.getElementById('stickyNoteOverlay');
        if (overlay) {
            overlay.innerHTML = `
                <div class="sticky-note-content">
                    <button class="sticky-note-close">×</button>
                    <p>${text}</p>
                    <button class="sticky-note-details-btn">
                        📚 View Word-by-Word
                    </button>
                </div>
            `;
            // Attach event listeners using Pointer Events for iPad
            const closeBtn = overlay.querySelector('.sticky-note-close');
            const detailsBtn = overlay.querySelector('.sticky-note-details-btn');
            this.attachPointerHandler(closeBtn, () => this.hideStickyNote());
            this.attachPointerHandler(detailsBtn, () => window.app.openTranslationModal());
        }
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
    }
}
