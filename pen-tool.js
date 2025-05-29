/**
 * PenTool - A vanilla JavaScript implementation of an SVG pen tool
 * 
 * Features:
 * - SVG-based drawing for resolution independence
 * - Drawing on target div with support for zoom and pan
 * - Eraser functionality with temporal hierarchy
 * - Hand tool for touch gestures (pinch zoom, pan) without drawing
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
  isEnabled = true; // Track whether the pen tool is enabled

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

    // Don't auto-initialize anymore - user must call init() manually
  }

  /**
   * Initialize the pen tool with SVG canvas and toolbar
   * This method must be called manually after creating the PenTool instance
   */
  init() {
    if (this.svg || this.toolbar) {
      console.warn('PenTool is already initialized. Call destroy() first if you want to reinitialize.');
      return;
    }

    // Inject required CSS styles
    this.injectCSS();
    
    // Set position relative on target if not already
    const computedStyle = window.getComputedStyle(this.targetElement);
    if (computedStyle.position === 'static') {
      this.targetElement.style.position = 'relative';
    }
    
    // Add touch-specific CSS to prevent interference while allowing multi-touch gestures
    this.targetElement.style.touchAction = 'pan-x pan-y pinch-zoom';
    this.targetElement.style.userSelect = 'none';
    this.targetElement.style.webkitUserSelect = 'none';
    
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
    
    // Add touch-specific CSS properties
    this.svg.style.touchAction = 'none'; // Prevent default touch behaviors
    this.svg.style.userSelect = 'none'; // Prevent text selection
    this.svg.style.webkitUserSelect = 'none';
    this.svg.style.mozUserSelect = 'none';
    this.svg.style.msUserSelect = 'none';
    
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
      { name: 'hand', icon: this.getHandIcon(), title: 'El Aracı - Dokunmatik Hareketler İçin (Pinch/Pan)' },
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
      button.style.touchAction = 'manipulation'; // Improve touch responsiveness
      button.style.userSelect = 'none'; // Prevent text selection on touch
      
      // Add active state for pen, eraser, and hand tools
      if (tool.name === 'pen' || tool.name === 'eraser' || tool.name === 'hand') {
        const handleToolSelect = () => {
          // Remove active class from all buttons
          const buttons = this.toolbar.querySelectorAll('.pen-tool-button');
          buttons.forEach(btn => btn.classList.remove('active'));
          
          // Add active class to clicked button
          button.classList.add('active');
          
          // Set current tool
          this.currentTool = tool.name;
          
          // Configure SVG pointer events based on tool
          if (tool.name === 'hand') {
            // For hand tool, allow normal touch events to pass through for pan/zoom
            this.svg.style.pointerEvents = 'none';
            // Enable default touch behaviors for the target element
            this.targetElement.style.touchAction = 'auto';
            // Add hand tool CSS class for visual feedback
            this.targetElement.classList.add('pen-tool-hand-mode');
          } else {
            // For drawing tools, capture events but allow multi-touch gestures
            this.svg.style.pointerEvents = 'auto';
            this.targetElement.style.touchAction = 'pan-x pan-y pinch-zoom';
            // Remove hand tool CSS class
            this.targetElement.classList.remove('pen-tool-hand-mode');
          }
          
          // Hide eraser indicator when switching tools
          if (tool.name !== 'eraser') {
            this.hideEraserIndicator();
          }
        };
        
        button.addEventListener('click', handleToolSelect);
        button.addEventListener('touchend', (e) => {
          e.preventDefault();
          handleToolSelect();
        });
        
        // Set pen as active by default
        if (tool.name === 'pen') {
          button.classList.add('active');
        }
      } else if (tool.name === 'clear') {
        // Add clear functionality
        const handleClear = () => this.clearAll();
        button.addEventListener('click', handleClear);
        button.addEventListener('touchend', (e) => {
          e.preventDefault();
          handleClear();
        });
      } else if (tool.name === 'theme') {
        // Add theme toggle functionality
        const handleThemeToggle = () => {
          // Toggle dark mode
          this.isDarkMode = !this.isDarkMode;
          
          // When user manually toggles theme, we're no longer following system preference
          this.themeSetting = this.isDarkMode ? 'dark' : 'light';
          
          // Update button
          button.innerHTML = this.getThemeToggleIcon();
          button.title = this.isDarkMode ? 'Açık Tema' : 'Koyu Tema';
          
          // Apply the theme using our consistent theme method
          this.applyTheme();
        };
        
        button.addEventListener('click', handleThemeToggle);
        button.addEventListener('touchend', (e) => {
          e.preventDefault();
          handleThemeToggle();
        });
      }
      
      this.toolbar.appendChild(button);
    });
  }

  /**
   * Add event listeners for mouse and touch events
   */
  addEventListeners() {
    // Mouse events
    this.svg.addEventListener('mousedown', this.handleDrawStart.bind(this));
    this.svg.addEventListener('mousemove', this.handleDrawMove.bind(this));
    this.svg.addEventListener('mouseleave', this.handleMouseLeave.bind(this));
    window.addEventListener('mouseup', this.handleDrawEnd.bind(this));
    
    // Touch events for mobile support - try multiple approaches
    this.svg.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
    this.svg.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
    
    // Add touch events to target element as fallback
    this.targetElement.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
    this.targetElement.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
    
    // Also add touchmove to document and window as fallback
    document.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
    window.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
    
    window.addEventListener('touchend', this.handleTouchEnd.bind(this));
    window.addEventListener('touchcancel', this.handleTouchEnd.bind(this));
  }

  /**
   * Handle start of drawing (mousedown)
   */
  handleDrawStart(event) {
    // Don't draw if hand tool is active
    if (this.currentTool === 'hand') return;
    
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
    // Don't handle drawing for hand tool
    if (this.currentTool === 'hand') return;
    
    const rect = this.svg.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Show eraser indicator when eraser tool is active, even when not drawing
    if (this.currentTool === 'eraser') {
      this.showEraserIndicator(x, y);
    }
    
    if (!this.isDrawing) return;
    
    if (this.currentTool === 'pen') {
      this.continueDrawing(x, y);
    } else if (this.currentTool === 'eraser') {
      this.continueErasing(x, y);
    }
  }

  /**
   * Handle mouse leaving the SVG area
   */
  handleMouseLeave() {
    if (this.currentTool === 'eraser' && !this.isDrawing) {
      this.hideEraserIndicator();
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
    // Allow multi-touch for hand tool (pinch zoom)
    if (this.currentTool === 'hand') return;
    
    // Allow multi-touch gestures (pinch zoom, pan) even with pen/eraser tools
    if (event.touches.length !== 1) return;
    
    const touch = event.touches[0];
    const rect = this.svg.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    
    // Only prevent default if touch is within the SVG bounds
    if (x >= 0 && y >= 0 && x <= rect.width && y <= rect.height) {
      event.preventDefault();
      event.stopPropagation();
      
      this.isDrawing = true;
      
      if (this.currentTool === 'pen') {
        this.startDrawing(x, y);
      } else if (this.currentTool === 'eraser') {
        this.startErasing(x, y);
      }
    }
  }

  /**
   * Handle touch move event
   */
  handleTouchMove(event) {
    // Allow default touch behaviors for hand tool
    if (this.currentTool === 'hand') return;
    
    // Allow multi-touch gestures (pinch zoom, pan) even with pen/eraser tools
    if (event.touches.length !== 1) return;
    
    const touch = event.touches[0];
    const rect = this.svg.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    
    // Only prevent default if touch is within the SVG bounds and we're drawing
    const isWithinBounds = x >= 0 && y >= 0 && x <= rect.width && y <= rect.height;
    
    // Show eraser indicator when eraser tool is active, even when not drawing
    if (this.currentTool === 'eraser' && isWithinBounds) {
      this.showEraserIndicator(x, y);
    }
    
    if (!this.isDrawing) return;
    
    // Only prevent default for drawing operations within bounds
    if (isWithinBounds) {
      event.preventDefault();
      event.stopPropagation();
      
      if (this.currentTool === 'pen') {
        this.continueDrawing(x, y);
      } else if (this.currentTool === 'eraser') {
        this.continueErasing(x, y);
      }
    }
  }

  /**
   * Handle touch end event
   */
  handleTouchEnd() {
    // Don't handle draw end for hand tool
    if (this.currentTool === 'hand') return;
    
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
    this.currentPath.style.pointerEvents = 'none'; // Prevent paths from blocking touch events
    this.currentPath.setAttribute('pointer-events', 'none');
    
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
    this.currentPath.style.pointerEvents = 'none'; // Prevent eraser paths from blocking touch events
    this.currentPath.setAttribute('pointer-events', 'none');
    
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
    if (!this.currentPath) {
      return;
    }
    
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
      // Ensure cloned elements don't block touch events
      penElement.style.pointerEvents = 'none';
      penElement.setAttribute('pointer-events', 'none');
      
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
          eraserPath.style.pointerEvents = 'none';
          eraserPath.setAttribute('pointer-events', 'none');
          mask.appendChild(eraserPath);
        });
        
        // Add mask to defs
        defs.appendChild(mask);
        
        // Create a group with the mask and add the pen stroke to it
        const maskedGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        maskedGroup.setAttribute('mask', `url(#${maskId})`);
        maskedGroup.style.pointerEvents = 'none';
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
      this.eraserIndicator.setAttribute('pointer-events', 'none');
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
   * Inject required CSS styles into the document head
   */
  injectCSS() {
    // Check if styles have already been injected to avoid duplicates
    if (document.getElementById('pen-tool-styles')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'pen-tool-styles';
    style.textContent = `
      /* Essential Pen Tool Styles Only */
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

      /* Hand tool specific styles */
      .pen-tool-hand-mode {
        cursor: grab !important;
        touch-action: auto !important;
        user-select: auto !important;
      }

      .pen-tool-hand-mode:active {
        cursor: grabbing !important;
      }

      /* Ensure the drawing area shows the proper cursor when hand tool is active */
      .pen-tool-hand-mode * {
        cursor: grab !important;
      }

      .pen-tool-hand-mode:active * {
        cursor: grabbing !important;
      }
    `;
    
    document.head.appendChild(style);
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
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M17.5 20H21v2h-7l3.5-2z" fill="none" stroke="currentColor"/>
        <path d="M4.5 22l-2.1-2.1a3.5 3.5 0 0 1 .1-4.9l11.1-11.5a3.5 3.5 0 0 1 5 0l3.1 3.1a3.5 3.5 0 0 1 0 5L11.5 22h-7z" fill="none" stroke="currentColor"/>
      </svg>
    `;
  }

  /**
   * Get SVG icon for hand tool
   */
  getHandIcon() {
    return `
      <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 11V6a2 2 0 0 0-4 0v5"/>
        <path d="M14 10V4a2 2 0 0 0-4 0v2"/>
        <path d="M10 10.5V6a2 2 0 0 0-4 0v8"/>
        <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L8 15"/>
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

  /**
   * Enable the pen tool and toolbar
   * This makes the pen tool handle and toolbar visible and functional
   */
  enable() {
    if (!this.svg || !this.toolbar) {
      console.warn('PenTool is not initialized. Call init() first before enabling.');
      return;
    }
    
    this.isEnabled = true;
    
    // Make SVG element active again
    if (this.svg) {
      this.svg.style.display = 'block';
      this.svg.style.pointerEvents = this.currentTool === 'hand' ? 'none' : 'auto';
    }
    
    // Make toolbar visible
    if (this.toolbar) {
      this.toolbar.style.display = 'flex';
    }
    
    // Re-add event listeners if they were removed
    this.addEventListeners();
  }

  /**
   * Disable the pen tool and toolbar
   * This hides the pen tool handle and toolbar making them non-functional
   */
  disable() {
    if (!this.svg || !this.toolbar) {
      console.warn('PenTool is not initialized.');
      return;
    }
    
    this.isEnabled = false;
    
    // Make SVG element inactive
    if (this.svg) {
      this.svg.style.display = 'none';
      this.svg.style.pointerEvents = 'none';
    }
    
    // Hide toolbar
    if (this.toolbar) {
      this.toolbar.style.display = 'none';
    }
    
    // End any ongoing drawing operation
    this.isDrawing = false;
    this.currentPath = null;
    this.hideEraserIndicator();
    
    // Remove event listeners to prevent any drawing
    this.removeEventListeners();
  }

  /**
   * Remove event listeners for mouse and touch events
   * Used when disabling the pen tool
   */
  removeEventListeners() {
    if (!this.svg || !this.targetElement) return;
    
    // Mouse events
    this.svg.removeEventListener('mousedown', this.handleDrawStart.bind(this));
    this.svg.removeEventListener('mousemove', this.handleDrawMove.bind(this));
    this.svg.removeEventListener('mouseleave', this.handleMouseLeave.bind(this));
    window.removeEventListener('mouseup', this.handleDrawEnd.bind(this));
    
    // Touch events
    this.svg.removeEventListener('touchstart', this.handleTouchStart.bind(this));
    this.svg.removeEventListener('touchmove', this.handleTouchMove.bind(this));
    this.targetElement.removeEventListener('touchstart', this.handleTouchStart.bind(this));
    this.targetElement.removeEventListener('touchmove', this.handleTouchMove.bind(this));
    document.removeEventListener('touchmove', this.handleTouchMove.bind(this));
    window.removeEventListener('touchmove', this.handleTouchMove.bind(this));
    window.removeEventListener('touchend', this.handleTouchEnd.bind(this));
    window.removeEventListener('touchcancel', this.handleTouchEnd.bind(this));
  }

  /**
   * Toggle the pen tool and toolbar visibility
   * @returns {boolean} The new state (true for enabled, false for disabled)
   */
  toggle() {
    if (this.isEnabled) {
      this.disable();
    } else {
      this.enable();
    }
    return this.isEnabled;
  }

  /**
   * Programmatically switch to pen tool
   */
  switchToPenTool() {
    this.setActiveTool('pen');
  }

  /**
   * Programmatically switch to eraser tool
   */
  switchToEraserTool() {
    this.setActiveTool('eraser');
  }

  /**
   * Programmatically switch to hand tool
   */
  switchToHandTool() {
    this.setActiveTool('hand');
  }

  /**
   * Helper method to set the active tool and update UI
   * @param {string} toolName - The name of the tool ('pen', 'eraser', 'hand')
   */
  setActiveTool(toolName) {
    if (!this.isEnabled) {
      console.warn('PenTool is disabled. Enable it first before switching tools.');
      return;
    }

    const validTools = ['pen', 'eraser', 'hand'];
    if (!validTools.includes(toolName)) {
      console.error(`Invalid tool name: ${toolName}. Valid tools are: ${validTools.join(', ')}`);
      return;
    }

    // Update current tool
    this.currentTool = toolName;

    // Remove active class from all tool buttons
    const buttons = this.toolbar.querySelectorAll('.pen-tool-button');
    buttons.forEach(btn => btn.classList.remove('active'));

    // Add active class to the selected tool button
    const targetButton = this.toolbar.querySelector(`[data-tool="${toolName}"]`);
    if (targetButton) {
      targetButton.classList.add('active');
    }

    // Configure SVG pointer events based on tool
    if (toolName === 'hand') {
      // For hand tool, allow normal touch events to pass through for pan/zoom
      this.svg.style.pointerEvents = 'none';
      // Enable default touch behaviors for the target element
      this.targetElement.style.touchAction = 'auto';
      // Add hand tool CSS class for visual feedback
      this.targetElement.classList.add('pen-tool-hand-mode');
    } else {
      // For drawing tools, capture events but allow multi-touch gestures
      this.svg.style.pointerEvents = 'auto';
      this.targetElement.style.touchAction = 'pan-x pan-y pinch-zoom';
      // Remove hand tool CSS class
      this.targetElement.classList.remove('pen-tool-hand-mode');
    }

    // Hide eraser indicator when switching away from eraser
    if (toolName !== 'eraser') {
      this.hideEraserIndicator();
    }
  }

  /**
   * Destroy the pen tool and clean up all elements and event listeners
   * This completely removes the pen tool from the DOM and cleans up resources
   */
  destroy() {
    // Remove event listeners first
    this.removeEventListeners();
    
    // Remove SVG element from DOM
    if (this.svg && this.svg.parentNode) {
      this.svg.parentNode.removeChild(this.svg);
    }
    
    // Remove toolbar from DOM
    if (this.toolbar && this.toolbar.parentNode) {
      this.toolbar.parentNode.removeChild(this.toolbar);
    }
    
    // Remove hand tool mode class from target element
    if (this.targetElement) {
      this.targetElement.classList.remove('pen-tool-hand-mode');
      // Reset target element styles
      this.targetElement.style.touchAction = '';
      this.targetElement.style.userSelect = '';
      this.targetElement.style.webkitUserSelect = '';
    }
    
    // Remove dark mode classes
    if (this.targetElement) {
      this.targetElement.classList.remove('pen-tool-dark-mode');
    }
    document.body.classList.remove('pen-tool-dark-mode');
    
    // Clear all references
    this.svg = null;
    this.toolbar = null;
    this.drawingContainer = null;
    this.eraserIndicator = null;
    this.currentPath = null;
    this.strokes = [];
    this.temporaryEraserStroke = null;
    
    // Reset state
    this.isDrawing = false;
    this.currentPathData = '';
    this.isEnabled = false;
    this.currentTool = 'pen';
    
    console.log('PenTool destroyed successfully');
  }

  /**
   * Programmatically erase all drawings
   * This is an alias for clearAll() with a more descriptive name for programmatic use
   */
  eraseAll() {
    this.clearAll();
  }

  /**
   * Get the currently active tool
   * @returns {string} The name of the currently active tool
   */
  getCurrentTool() {
    return this.currentTool;
  }
}