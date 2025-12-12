// Word Highlight Component
// Renders translation with interactive word highlighting

export class WordHighlighter {
    constructor(containerId) {
        this.containerId = containerId; // Store ID instead of element
        this.wordPairs = [];
        this.mode = 'click'; // 'click' or 'sidebyside'
        this.activeWordIndex = null;
    }

    /**
     * Get the container element (fetch fresh each time to handle DOM changes)
     */
    getContainer() {
        return document.getElementById(this.containerId);
    }

    /**
     * Set the word pairs data and render
     * @param {Array} wordPairs - Array of {chinese, pinyin, translation}
     */
    setWordPairs(wordPairs) {
        this.wordPairs = wordPairs || [];
        console.log('WordHighlighter: Setting', this.wordPairs.length, 'word pairs');
    }

    /**
     * Get current highlight mode
     */
    getMode() {
        return this.mode;
    }

    /**
     * Set highlight mode
     * @param {string} mode - 'click' or 'sidebyside'
     */
    setMode(mode) {
        this.mode = mode;
        this.render();
    }

    /**
     * Render the highlighting UI based on current mode
     */
    render() {
        const container = this.getContainer();
        if (!container) {
            console.warn('WordHighlighter: Container not found:', this.containerId);
            return;
        }

        console.log('WordHighlighter: Rendering', this.wordPairs.length, 'pairs in', this.mode, 'mode');

        if (this.mode === 'click') {
            this.renderClickMode(container);
        } else {
            this.renderSideBySideMode(container);
        }
    }

    /**
     * Click Mode: Click on a word to highlight its translation pair
     */
    renderClickMode(container) {
        const html = `
            <div class="word-highlight-container click-mode">
                <div class="highlight-section">
                    <h4>中文 (Chinese)</h4>
                    <div class="word-row chinese-row">
                        ${this.wordPairs.map((pair, index) => `
                            <span class="word-chip chinese-chip" data-index="${index}">
                                <span class="word-text">${pair.chinese}</span>
                                <span class="word-pinyin">${pair.pinyin}</span>
                            </span>
                        `).join('')}
                    </div>
                </div>
                <div class="highlight-section">
                    <h4>Translation</h4>
                    <div class="word-row translation-row">
                        ${this.wordPairs.map((pair, index) => `
                            <span class="word-chip translation-chip" data-index="${index}">
                                ${pair.translation}
                            </span>
                        `).join('')}
                    </div>
                </div>
                <div class="word-action-bar" id="wordActionBar" style="display: none;">
                    <span class="selected-word-label" id="selectedWordLabel"></span>
                    <button class="example-action-btn" id="generateExampleBtn">📝 Generate Examples</button>
                </div>
                <div id="exampleSentencePopover" class="example-popover" style="display: none;">
                    <div class="example-popover-content">
                        <button class="example-popover-close">×</button>
                        <div id="exampleSentenceContent"></div>
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = html;
        this.attachClickHandlers(container);
    }

    /**
     * Side-by-Side Mode: Show words with connecting lines
     */
    renderSideBySideMode(container) {
        const html = `
            <div class="word-highlight-container sidebyside-mode">
                <div class="sidebyside-wrapper">
                    <div class="sidebyside-column chinese-column">
                        <h4>中文 (Chinese)</h4>
                        ${this.wordPairs.map((pair, index) => `
                            <div class="sidebyside-item" data-index="${index}">
                                <span class="chinese-text">${pair.chinese}</span>
                                <span class="pinyin-text">${pair.pinyin}</span>
                            </div>
                        `).join('')}
                    </div>
                    <div class="sidebyside-lines">
                        <svg class="connection-lines" width="40" height="${this.wordPairs.length * 70}">
                            ${this.wordPairs.map((_, index) => `
                                <line 
                                    x1="0" y1="${index * 70 + 30}" 
                                    x2="40" y2="${index * 70 + 30}" 
                                    class="connection-line" 
                                    data-index="${index}"
                                    stroke="rgba(102, 126, 234, 0.3)" 
                                    stroke-width="2"
                                />
                            `).join('')}
                        </svg>
                    </div>
                    <div class="sidebyside-column translation-column">
                        <h4>Translation</h4>
                        ${this.wordPairs.map((pair, index) => `
                            <div class="sidebyside-item" data-index="${index}">
                                <span class="translation-text">${pair.translation}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = html;
        this.attachSideBySideHandlers(container);
    }

    /**
     * Attach click event handlers for click mode
     */
    attachClickHandlers(container) {
        const chips = container.querySelectorAll('.word-chip');

        chips.forEach(chip => {
            // Prevent default on pointerdown
            chip.addEventListener('pointerdown', (e) => {
                e.preventDefault();
            });

            // Use pointerup for the action (works for both mouse and touch)
            chip.addEventListener('pointerup', (e) => {
                e.preventDefault();
                if (e.isPrimary) {
                    const index = parseInt(chip.dataset.index);
                    this.highlightPair(index);
                    this.showActionBar(index);
                }
            });
        });

        // Handle Generate Examples button click
        const generateBtn = container.querySelector('#generateExampleBtn');
        if (generateBtn) {
            generateBtn.addEventListener('pointerdown', (e) => {
                e.stopPropagation();
                e.preventDefault();
            });
            generateBtn.addEventListener('pointerup', (e) => {
                e.stopPropagation();
                e.preventDefault();
                if (e.isPrimary && this.activeWordIndex !== null) {
                    const pair = this.wordPairs[this.activeWordIndex];
                    if (pair && this.onGenerateExample) {
                        this.onGenerateExample(pair.chinese, pair.pinyin);
                    }
                }
            });
        }

        // Handle popover close button
        const closeBtn = container.querySelector('.example-popover-close');
        if (closeBtn) {
            closeBtn.addEventListener('pointerup', (e) => {
                e.stopPropagation();
                this.hideExamplePopover();
            });
        }
    }

    /**
     * Show action bar with selected word info
     */
    showActionBar(index) {
        const actionBar = document.getElementById('wordActionBar');
        const label = document.getElementById('selectedWordLabel');

        if (actionBar && label && this.wordPairs[index]) {
            const pair = this.wordPairs[index];
            label.textContent = `${pair.chinese} (${pair.pinyin})`;
            actionBar.style.display = 'flex';
        }
    }

    /**
     * Hide action bar
     */
    hideActionBar() {
        const actionBar = document.getElementById('wordActionBar');
        if (actionBar) {
            actionBar.style.display = 'none';
        }
    }

    /**
     * Set callback for generating example sentences
     */
    setExampleCallback(callback) {
        this.onGenerateExample = callback;
    }

    /**
     * Show example sentences in popover
     */
    showExamplePopover(sentences, word) {
        const popover = document.getElementById('exampleSentencePopover');
        const content = document.getElementById('exampleSentenceContent');

        if (!popover || !content) return;

        const html = `
            <h4>📝 Examples for: ${word}</h4>
            ${sentences.map(s => `
                <div class="example-sentence">
                    <div class="example-chinese">${s.chinese}</div>
                    <div class="example-pinyin">${s.pinyin}</div>
                    <div class="example-translation">${s.translation}</div>
                </div>
            `).join('')}
        `;

        content.innerHTML = html;
        popover.style.display = 'block';
    }

    /**
     * Hide example popover
     */
    hideExamplePopover() {
        const popover = document.getElementById('exampleSentencePopover');
        if (popover) popover.style.display = 'none';
    }

    /**
     * Attach handlers for side-by-side mode (touch-friendly)
     */
    attachSideBySideHandlers(container) {
        const items = container.querySelectorAll('.sidebyside-item');
        let activeIndex = null;

        items.forEach(item => {
            // Desktop: hover
            item.addEventListener('mouseenter', (e) => {
                const index = parseInt(item.dataset.index);
                this.highlightSideBySide(index, true);
            });

            item.addEventListener('mouseleave', (e) => {
                const index = parseInt(item.dataset.index);
                this.highlightSideBySide(index, false);
            });

            // iPad/Touch: Use Pointer Events (unified approach)
            item.addEventListener('pointerdown', (e) => {
                e.preventDefault();
            });

            item.addEventListener('pointerup', (e) => {
                e.preventDefault();
                if (!e.isPrimary) return;

                const index = parseInt(item.dataset.index);

                if (activeIndex === index) {
                    // Tap again to deselect
                    this.highlightSideBySide(index, false);
                    activeIndex = null;
                } else {
                    // Clear previous and highlight new
                    if (activeIndex !== null) {
                        this.highlightSideBySide(activeIndex, false);
                    }
                    this.highlightSideBySide(index, true);
                    activeIndex = index;
                }
            });
        });
    }

    /**
     * Highlight a word pair in click mode
     */
    highlightPair(index) {
        const container = this.getContainer();
        if (!container) return;

        // Remove previous highlights
        const allChips = container.querySelectorAll('.word-chip');
        allChips.forEach(chip => chip.classList.remove('highlighted'));

        // Add highlight to matching pair
        const chineseChip = container.querySelector(`.chinese-chip[data-index="${index}"]`);
        const translationChip = container.querySelector(`.translation-chip[data-index="${index}"]`);

        if (chineseChip) chineseChip.classList.add('highlighted');
        if (translationChip) translationChip.classList.add('highlighted');

        this.activeWordIndex = index;
    }

    /**
     * Highlight in side-by-side mode
     */
    highlightSideBySide(index, isHover) {
        const container = this.getContainer();
        if (!container) return;

        const chineseItem = container.querySelector(`.chinese-column .sidebyside-item[data-index="${index}"]`);
        const translationItem = container.querySelector(`.translation-column .sidebyside-item[data-index="${index}"]`);
        const line = container.querySelector(`.connection-line[data-index="${index}"]`);

        if (isHover) {
            if (chineseItem) chineseItem.classList.add('highlighted');
            if (translationItem) translationItem.classList.add('highlighted');
            if (line) {
                line.setAttribute('stroke', '#667eea');
                line.setAttribute('stroke-width', '3');
            }
        } else {
            if (chineseItem) chineseItem.classList.remove('highlighted');
            if (translationItem) translationItem.classList.remove('highlighted');
            if (line) {
                line.setAttribute('stroke', 'rgba(102, 126, 234, 0.3)');
                line.setAttribute('stroke-width', '2');
            }
        }
    }

    /**
     * Clear all highlights
     */
    clearHighlights() {
        const container = this.getContainer();
        if (!container) return;

        const highlighted = container.querySelectorAll('.highlighted');
        highlighted.forEach(el => el.classList.remove('highlighted'));
        this.activeWordIndex = null;
    }

    /**
     * Check if there are word pairs to display
     */
    hasWordPairs() {
        return this.wordPairs && this.wordPairs.length > 0;
    }
}
