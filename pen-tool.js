/**
 * PenTool - A vanilla JavaScript implementation of an SVG pen tool
 * 
 * Features:
 * - SVG-based drawing for resolution independence
 * - Drawing on target div with support for zoom and pan
 * - Eraser functionality with temporal hierarchy
 * - Clean all option
 * - Simple tool buttons with icons
 * - Developer customization options
 */

export class PenTool {
  targetElement;
  svg;
  drawingContainer;
  isDrawing = false;
  currentPath = null;
  currentPathData = '';
  toolbar;
  eraserIndicator = null;
  strokes = [];
  temporaryEraserStroke = null;
  
  // Configuration options
  lineWidth;
  lineColor;
  toolPosition;
  zIndex;
  currentTool = 'pen';
  eraserWidth;
  themeToggle;
  themeSetting;
  isDarkMode = false;

  constructor(options) {
    // Initialize with default values or provided options
    this.targetElement = options.targetElement;
    this.lineWidth = options.lineWidth || 3;
    this.lineColor = options.lineColor || '#000000';
    this.toolPosition = options.toolPosition || 'top';
    this.zIndex = options.zIndex || 10;
    this.eraserWidth = options.eraserWidth || 15;
    this.themeToggle = options.themeToggle !== undefined ? options.themeToggle : false;
    this.themeSetting = options.themeSetting || 'system';
    
    // Set initial dark mode state based on themeSetting
    if (this.themeSetting === 'dark') {
      this.isDarkMode = true;
    } else if (this.themeSetting === 'light') {
      this.isDarkMode = false;
    } else if (this.themeSetting === 'system') {
      // Check system preference
      this.isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    this.initialize();
  }

  /**
   * Initialize the pen tool with SVG canvas and toolbar
   */
  initialize() {
    // Set position relative on target if not already
    const computedStyle = window.getComputedStyle(this.targetElement);
    if (computedStyle.position === 'static') {
      this.targetElement.style.position = 'relative';
    }
    
    // Add system theme change listener if themeSetting is 'system'
    if (this.themeSetting === 'system' && window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (this.themeSetting === 'system') { // Only respond if still using system setting
          this.isDarkMode = e.matches;
          this.applyTheme();
          
          // Update theme toggle button icon if it exists
          if (this.themeToggle) {
            const themeButton = this.toolbar.querySelector('[data-tool="theme"]');
            if (themeButton) {
              themeButton.innerHTML = this.getThemeToggleIcon();
              themeButton.title = this.isDarkMode ? 'Açık Tema' : 'Koyu Tema';
            }
          }
        }
      });
    }

    // Create SVG element that will contain all drawings
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('width', '100%');
    this.svg.setAttribute('height', '100%');
    this.svg.style.position = 'absolute';
    this.svg.style.top = '0';
    this.svg.style.left = '0';
    this.svg.style.pointerEvents = 'none'; // Allow clicks to pass through when not drawing
    this.svg.style.zIndex = this.zIndex.toString();
    
    // Create a container group for all drawings and erasers
    this.drawingContainer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.svg.appendChild(this.drawingContainer);
    
    // Create toolbar
    this.toolbar = document.createElement('div');
    this.toolbar.className = 'pen-tool-toolbar';
    this.setToolbarPosition();
    
    // Add tools to toolbar
    this.createToolbar();
    
    // Append elements to DOM
    this.targetElement.appendChild(this.svg);
    this.targetElement.appendChild(this.toolbar);
    
    // Add event listeners
    this.addEventListeners();

    // Set pointer events to auto since pen is selected by default
    this.svg.style.pointerEvents = 'auto';
    
    // Apply the theme based on the isDarkMode setting
    this.applyTheme();
  }

  /**
   * Set toolbar position based on the toolPosition option
   */
  setToolbarPosition() {
    // Reset all positioning styles first
    this.toolbar.style.top = '';
    this.toolbar.style.right = '';
    this.toolbar.style.bottom = '';
    this.toolbar.style.left = '';
    this.toolbar.style.transform = '';
    this.toolbar.style.display = 'flex';
    this.toolbar.style.flexDirection = 'row'; // Default to row
    
    // Set common styles
    this.toolbar.style.position = 'absolute';
    this.toolbar.style.zIndex = (this.zIndex + 1).toString();
    this.toolbar.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
    this.toolbar.style.borderRadius = '5px';
    this.toolbar.style.padding = '5px';
    this.toolbar.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.2)';
    
    // Apply position-specific styles
    switch (this.toolPosition) {
      case 'top':
        this.toolbar.style.top = '10px';
        this.toolbar.style.left = '50%';
        this.toolbar.style.transform = 'translateX(-50%)';
        break;
      case 'bottom':
        this.toolbar.style.bottom = '10px';
        this.toolbar.style.left = '50%';
        this.toolbar.style.transform = 'translateX(-50%)';
        break;
      case 'left':
        this.toolbar.style.left = '10px';
        this.toolbar.style.top = '50%';
        this.toolbar.style.transform = 'translateY(-50%)';
        this.toolbar.style.flexDirection = 'column';
        break;
      case 'right':
        this.toolbar.style.right = '10px';
        this.toolbar.style.top = '50%';
        this.toolbar.style.transform = 'translateY(-50%)';
        this.toolbar.style.flexDirection = 'column';
        break;
    }
  }

  /**
   * Create toolbar with pen, eraser, and clear all buttons
   */
  createToolbar() {
    const tools = [
      { name: 'pen', icon: this.getPenIcon(), title: 'Kalem Aracı' },
      { name: 'eraser', icon: this.getEraserIcon(), title: 'Silgi Aracı' },
      { name: 'clear', icon: this.getClearIcon(), title: 'Tümünü Temizle' }
    ];
    
    // Add theme toggle if enabled
    if (this.themeToggle) {
      tools.push({
        name: 'theme', 
        icon: this.getThemeToggleIcon(), 
        title: this.isDarkMode ? 'Açık Tema' : 'Koyu Tema'
      });
    }
    
    tools.forEach(tool => {
      const button = document.createElement('button');
      button.innerHTML = tool.icon;
      button.title = tool.title;
      button.className = 'pen-tool-button';
      button.dataset.tool = tool.name; // Add data-tool attribute for easier selection
      button.style.background = 'none';
      button.style.border = 'none';
      button.style.cursor = 'pointer';
      button.style.width = '30px';
      button.style.height = '30px';
      button.style.margin = '3px';
      button.style.padding = '5px';
      button.style.borderRadius = '3px';
      
      // Add active state for pen and eraser
      if (tool.name === 'pen' || tool.name === 'eraser') {
        button.addEventListener('click', () => {
          // Remove active class from all buttons
          const buttons = this.toolbar.querySelectorAll('.pen-tool-button');
          buttons.forEach(btn => btn.classList.remove('active'));
          
          // Add active class to clicked button
          button.classList.add('active');
          
          // Set current tool
          this.currentTool = tool.name;
          
          // Enable pointer events on SVG when a drawing tool is selected
          this.svg.style.pointerEvents = 'auto';
          
          // Hide eraser indicator if switching tools
          this.hideEraserIndicator();
        });
        
        // Set pen as active by default
        if (tool.name === 'pen') {
          button.classList.add('active');
        }
      } else if (tool.name === 'clear') {
        // Add clear functionality
        button.addEventListener('click', () => this.clearAll());
      } else if (tool.name === 'theme') {
        // Add theme toggle functionality
        button.addEventListener('click', () => {
          // Toggle dark mode
          this.isDarkMode = !this.isDarkMode;
          
          // When user manually toggles theme, we're no longer following system preference
          this.themeSetting = this.isDarkMode ? 'dark' : 'light';
          
          // Update button
          button.innerHTML = this.getThemeToggleIcon();
          button.title = this.isDarkMode ? 'Açık Tema' : 'Koyu Tema';
          
          // Apply the theme using our consistent theme method
          this.applyTheme();
        });
      }
      
      this.toolbar.appendChild(button);
    });
    
    // Add CSS for active state
    const style = document.createElement('style');
    style.textContent = `
      .pen-tool-button.active {
        background-color: rgba(0, 0, 0, 0.2) !important;
        box-shadow: inset 0 0 5px rgba(0, 0, 0, 0.3);
        transform: scale(0.95);
      }
      
      .pen-tool-dark-mode .pen-tool-toolbar {
        background-color: rgba(50, 50, 50, 0.85) !important;
      }
      
      .pen-tool-dark-mode .pen-tool-button {
        color: white !important;
      }
      
      .pen-tool-dark-mode .pen-tool-button.active {
        background-color: rgba(255, 255, 255, 0.2) !important;
        box-shadow: inset 0 0 5px rgba(255, 255, 255, 0.3);
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Add event listeners for mouse and touch events
   */
  addEventListeners() {
    // Mouse events
    this.svg.addEventListener('mousedown', this.handleDrawStart.bind(this));
    this.svg.addEventListener('mousemove', this.handleDrawMove.bind(this));
    window.addEventListener('mouseup', this.handleDrawEnd.bind(this));
    
    // Touch events for mobile support
    this.svg.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
    this.svg.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
    window.addEventListener('touchend', this.handleTouchEnd.bind(this));
    window.addEventListener('touchcancel', this.handleTouchEnd.bind(this));
  }

  /**
   * Handle start of drawing (mousedown)
   */
  handleDrawStart(event) {
    event.preventDefault();
    
    const rect = this.svg.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    this.isDrawing = true;
    
    if (this.currentTool === 'pen') {
      this.startDrawing(x, y);
    } else if (this.currentTool === 'eraser') {
      this.startErasing(x, y);
    }
  }

  /**
   * Handle movement during drawing (mousemove)
   */
  handleDrawMove(event) {
    if (!this.isDrawing) return;
    
    const rect = this.svg.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    if (this.currentTool === 'pen') {
      this.continueDrawing(x, y);
    } else if (this.currentTool === 'eraser') {
      this.continueErasing(x, y);
    }
  }

  /**
   * Handle end of drawing (mouseup)
   */
  handleDrawEnd() {
    if (!this.isDrawing) return;
    
    if (this.currentPath) {
      // Remove any temporary stroke first
      if (this.temporaryEraserStroke) {
        this.strokes = this.strokes.filter(stroke => !stroke.isTemporary);
        this.temporaryEraserStroke = null;
      }
      
      // Add the completed stroke to our strokes array with the current timestamp
      const timestamp = Date.now();
      this.strokes.push({
        type: this.currentTool,
        element: this.currentPath,
        timestamp
      });
      
      // Apply the time-based masking
      this.renderStrokes();
    }
    
    this.isDrawing = false;
    this.currentPath = null;
    this.hideEraserIndicator();
  }

  /**
   * Handle touch start event
   */
  handleTouchStart(event) {
    if (event.touches.length !== 1) return;
    
    event.preventDefault();
    
    const touch = event.touches[0];
    const rect = this.svg.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    
    this.isDrawing = true;
    
    if (this.currentTool === 'pen') {
      this.startDrawing(x, y);
    } else if (this.currentTool === 'eraser') {
      this.startErasing(x, y);
    }
  }

  /**
   * Handle touch move event
   */
  handleTouchMove(event) {
    if (!this.isDrawing || event.touches.length !== 1) return;
    
    event.preventDefault();
    
    const touch = event.touches[0];
    const rect = this.svg.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    
    if (this.currentTool === 'pen') {
      this.continueDrawing(x, y);
    } else if (this.currentTool === 'eraser') {
      this.continueErasing(x, y);
    }
  }

  /**
   * Handle touch end event
   */
  handleTouchEnd() {
    this.handleDrawEnd();
  }

  /**
   * Start drawing at the specified coordinates
   */
  startDrawing(x, y) {
    this.currentPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    this.currentPath.setAttribute('stroke', this.lineColor);
    this.currentPath.setAttribute('stroke-width', this.lineWidth.toString());
    this.currentPath.setAttribute('fill', 'none');
    this.currentPath.setAttribute('stroke-linecap', 'round');
    this.currentPath.setAttribute('stroke-linejoin', 'round');
    
    this.currentPathData = `M ${x} ${y}`;
    this.currentPath.setAttribute('d', this.currentPathData);
    
    // Add to our drawing container
    this.drawingContainer.appendChild(this.currentPath);
  }

  /**
   * Continue drawing to the specified coordinates
   */
  continueDrawing(x, y) {
    if (!this.currentPath) return;
    
    this.currentPathData += ` L ${x} ${y}`;
    this.currentPath.setAttribute('d', this.currentPathData);
  }

  /**
   * Start erasing at the specified coordinates
   */
  startErasing(x, y) {
    this.showEraserIndicator(x, y);
    
    // Create a new eraser path (invisible, just for tracking)
    this.currentPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    this.currentPath.setAttribute('class', 'eraser-path');
    this.currentPath.setAttribute('stroke-width', this.eraserWidth.toString());
    this.currentPath.setAttribute('fill', 'none');
    this.currentPath.setAttribute('stroke-linecap', 'round');
    this.currentPath.setAttribute('stroke-linejoin', 'round');
    
    this.currentPathData = `M ${x} ${y}`;
    this.currentPath.setAttribute('d', this.currentPathData);
    
    // Create a temporary eraser stroke for live erasing
    this.temporaryEraserStroke = {
      type: 'eraser',
      element: this.currentPath,
      timestamp: Date.now(),
      isTemporary: true
    };
    
    // Add to strokes for real-time erasing effect
    this.strokes.push(this.temporaryEraserStroke);
    
    // Render the strokes to show immediate erasing effect
    this.renderStrokes();
  }

  /**
   * Continue erasing to the specified coordinates
   */
  continueErasing(x, y) {
    if (!this.currentPath) return;
    
    this.showEraserIndicator(x, y);
    
    this.currentPathData += ` L ${x} ${y}`;
    this.currentPath.setAttribute('d', this.currentPathData);
    
    // Update the temporary eraser stroke in real-time
    if (this.temporaryEraserStroke) {
      this.temporaryEraserStroke.element.setAttribute('d', this.currentPathData);
      this.renderStrokes();
    }
  }

  /**
   * Render all strokes with proper masking
   */
  renderStrokes() {
    // Clear the container
    while (this.drawingContainer.firstChild) {
      this.drawingContainer.removeChild(this.drawingContainer.firstChild);
    }
    
    // Clear any previous defs
    let defs = this.svg.querySelector('defs');
    if (!defs) {
      defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      this.svg.appendChild(defs);
    } else {
      while (defs.firstChild) {
        defs.removeChild(defs.firstChild);
      }
    }
    
    // Sort strokes by timestamp (oldest first)
    this.strokes.sort((a, b) => a.timestamp - b.timestamp);
    
    // First, separate pen strokes and eraser strokes
    const penStrokes = [];
    const eraserStrokes = [];
    
    this.strokes.forEach(stroke => {
      if (stroke.type === 'pen') {
        penStrokes.push(stroke);
      } else {
        eraserStrokes.push(stroke);
      }
    });
    
    // For each pen stroke, create a mask that includes all eraser strokes
    // that came AFTER this pen stroke (newer erasers affect older pen strokes)
    penStrokes.forEach((penStroke, penIndex) => {
      // Clone the pen stroke
      const penElement = penStroke.element.cloneNode(true);
      
      // Get all eraser strokes that came after this pen stroke
      const applicableErasers = eraserStrokes.filter(
        eraser => eraser.timestamp > penStroke.timestamp
      );
      
      if (applicableErasers.length > 0) {
        // This pen stroke needs masking
        const maskId = `pen-mask-${penIndex}`;
        const mask = document.createElementNS('http://www.w3.org/2000/svg', 'mask');
        mask.id = maskId;
        
        // Add white background to mask (fully visible)
        const background = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        background.setAttribute('x', '0');
        background.setAttribute('y', '0');
        background.setAttribute('width', '100%');
        background.setAttribute('height', '100%');
        background.setAttribute('fill', 'white');
        mask.appendChild(background);
        
        // Add each applicable eraser to the mask as black (transparent) areas
        applicableErasers.forEach(eraser => {
          const eraserPath = eraser.element.cloneNode(true);
          eraserPath.setAttribute('stroke', 'black'); // In masks, black means transparent
          eraserPath.setAttribute('stroke-width', this.eraserWidth.toString());
          mask.appendChild(eraserPath);
        });
        
        // Add mask to defs
        defs.appendChild(mask);
        
        // Create a group with the mask and add the pen stroke to it
        const maskedGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        maskedGroup.setAttribute('mask', `url(#${maskId})`);
        maskedGroup.appendChild(penElement);
        
        // Add the masked group to the drawing container
        this.drawingContainer.appendChild(maskedGroup);
      } else {
        // No applicable erasers, just add the pen stroke directly
        this.drawingContainer.appendChild(penElement);
      }
    });
  }

  /**
   * Hide eraser indicator
   */
  hideEraserIndicator() {
    if (this.eraserIndicator && this.eraserIndicator.parentNode) {
      this.eraserIndicator.parentNode.removeChild(this.eraserIndicator);
      this.eraserIndicator = null;
    }
  }

  /**
   * Show a visual indicator for the eraser cursor
   */
  showEraserIndicator(x, y) {
    const eraserRadius = this.eraserWidth / 2;
    
    if (!this.eraserIndicator) {
      this.eraserIndicator = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      this.eraserIndicator.setAttribute('fill', 'rgba(255, 0, 0, 0.1)');
      this.eraserIndicator.setAttribute('stroke', 'rgba(255, 0, 0, 0.5)');
      this.eraserIndicator.setAttribute('stroke-width', '1');
      this.eraserIndicator.style.pointerEvents = 'none';
      this.svg.appendChild(this.eraserIndicator);
    }
    
    this.eraserIndicator.setAttribute('cx', x.toString());
    this.eraserIndicator.setAttribute('cy', y.toString());
    this.eraserIndicator.setAttribute('r', eraserRadius.toString());
  }

  /**
   * Clear all drawings
   */
  clearAll() {
    // Clear drawing container
    while (this.drawingContainer.firstChild) {
      this.drawingContainer.removeChild(this.drawingContainer.firstChild);
    }
    
    // Clear strokes array
    this.strokes = [];
    
    // Clear any defs/masks
    const defs = this.svg.querySelector('defs');
    if (defs) {
      while (defs.firstChild) {
        defs.removeChild(defs.firstChild);
      }
    }
    
    this.hideEraserIndicator();
  }

  /**
   * Update pen tool options
   */
  updateOptions(options) {
    if (options.lineWidth !== undefined) {
      this.lineWidth = options.lineWidth;
    }
    
    if (options.lineColor !== undefined) {
      this.lineColor = options.lineColor;
    }
    
    if (options.toolPosition !== undefined) {
      this.toolPosition = options.toolPosition;
      this.setToolbarPosition();
    }
    
    if (options.zIndex !== undefined) {
      this.zIndex = options.zIndex;
      this.svg.style.zIndex = this.zIndex.toString();
      this.toolbar.style.zIndex = (this.zIndex + 1).toString();
    }

    if (options.eraserWidth !== undefined) {
      this.eraserWidth = options.eraserWidth;
    }
  }

  /**
   * Get SVG icon for pen tool
   */
  getPenIcon() {
    return `
      <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 19l7-7 3 3-7 7-3-3z"></path>
        <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path>
        <path d="M2 2l7.586 7.586"></path>
        <circle cx="11" cy="11" r="2"></circle>
      </svg>
    `;
  }

  /**
   * Get SVG icon for eraser tool
   */
  getEraserIcon() {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M17.5 20H21v2h-7l3.5-2z" fill="none" stroke="currentColor"/>
        <path d="M4.5 22l-2.1-2.1a3.5 3.5 0 0 1 .1-4.9l11.1-11.5a3.5 3.5 0 0 1 5 0l3.1 3.1a3.5 3.5 0 0 1 0 5L11.5 22h-7z" fill="none" stroke="currentColor"/>
      </svg>
    `;
  }

  /**
   * Get SVG icon for clear tool
   */
  getClearIcon() {
    return `
      <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="8" y1="12" x2="16" y2="12"></line>
      </svg>
    `;
  }

  /**
   * Get SVG icon for theme toggle
   */
  getThemeToggleIcon() {
    // Different icon based on current theme
    if (this.isDarkMode) {
      // Sun icon for light mode
      return `
        <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="5"></circle>
          <line x1="12" y1="1" x2="12" y2="3"></line>
          <line x1="12" y1="21" x2="12" y2="23"></line>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
          <line x1="1" y1="12" x2="3" y2="12"></line>
          <line x1="21" y1="12" x2="23" y2="12"></line>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        </svg>
      `;
    } else {
      // Moon icon for dark mode
      return `
        <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        </svg>
      `;
    }
  }

  /**
   * Apply the current theme based on isDarkMode state
   */
  applyTheme() {
    if (this.isDarkMode) {
      // Apply dark mode
      this.targetElement.classList.add('pen-tool-dark-mode');
      document.body.classList.add('pen-tool-dark-mode');
      
      // Update toolbar styles
      if (this.toolbar) {
        this.toolbar.style.backgroundColor = 'rgba(50, 50, 50, 0.85)';
        const buttons = this.toolbar.querySelectorAll('.pen-tool-button');
        buttons.forEach(btn => {
          btn.style.color = 'white';
        });
      }
    } else {
      // Apply light mode
      this.targetElement.classList.remove('pen-tool-dark-mode');
      document.body.classList.remove('pen-tool-dark-mode');
      
      // Update toolbar styles
      if (this.toolbar) {
        this.toolbar.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
        const buttons = this.toolbar.querySelectorAll('.pen-tool-button');
        buttons.forEach(btn => {
          btn.style.color = '';
        });
      }
    }
  }
}