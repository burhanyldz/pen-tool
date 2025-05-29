/**
 * PenTool - A vanilla JavaScript implementation of an SVG pen tool
 * Traditional (non-module) version for maximum compatibility
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

// Define PenTool as a global class (old school approach)
(function(window) {
  'use strict';

  function PenTool(options) {
    // Instance properties
    this.targetElement = null;
    this.svg = null;
    this.drawingContainer = null;
    this.isDrawing = false;
    this.currentPath = null;
    this.currentPathData = '';
    this.toolbar = null;
    this.eraserIndicator = null;
    this.strokes = [];
    this.temporaryEraserStroke = null;
    
    // Configuration options
    this.lineWidth = null;
    this.lineColor = null;
    this.toolPosition = null;
    this.zIndex = null;
    this.currentTool = 'pen';
    this.eraserWidth = null;
    this.themeToggle = null;
    this.themeSetting = null;
    this.isDarkMode = false;
    this.isEnabled = true; // Track whether the pen tool is enabled

    // Bound function references for proper event listener cleanup
    this.boundHandleDrawStart = null;
    this.boundHandleDrawMove = null;
    this.boundHandleMouseLeave = null;
    this.boundHandleDrawEnd = null;
    this.boundHandleTouchStart = null;
    this.boundHandleTouchMove = null;
    this.boundHandleTouchEnd = null;
    this.boundSystemThemeChange = null;
    this.systemThemeMediaQuery = null;

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
  PenTool.prototype.init = function() {
    if (this.svg || this.toolbar) {
      console.warn('PenTool is already initialized. Call destroy() first if you want to reinitialize.');
      return;
    }

    // Inject required CSS styles
    this.injectCSS();
    
    // Set position relative on target if not already
    var computedStyle = window.getComputedStyle(this.targetElement);
    if (computedStyle.position === 'static') {
      this.targetElement.style.position = 'relative';
    }
    
    // Add touch-specific CSS to prevent interference while allowing multi-touch gestures
    this.targetElement.style.touchAction = 'pan-x pan-y pinch-zoom';
    this.targetElement.style.userSelect = 'none';
    this.targetElement.style.webkitUserSelect = 'none';
    
    // Add system theme change listener if themeSetting is 'system'
    var self = this;
    if (this.themeSetting === 'system' && window.matchMedia) {
      this.boundSystemThemeChange = function(e) {
        if (self.themeSetting === 'system') { // Only respond if still using system setting
          self.isDarkMode = e.matches;
          self.applyTheme();
          
          // Update theme toggle button icon if it exists
          if (self.themeToggle) {
            var themeButton = self.toolbar.querySelector('[data-tool="theme"]');
            if (themeButton) {
              themeButton.innerHTML = self.getThemeToggleIcon();
              themeButton.title = self.isDarkMode ? 'Açık Tema' : 'Koyu Tema';
            }
          }
        }
      };
      
      this.systemThemeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      this.systemThemeMediaQuery.addEventListener('change', this.boundSystemThemeChange);
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
  };

  /**
   * Set toolbar position based on the toolPosition option
   */
  PenTool.prototype.setToolbarPosition = function() {
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
  };

  /**
   * Create toolbar with pen, eraser, and clear all buttons
   */
  PenTool.prototype.createToolbar = function() {
    var self = this;
    var tools = [
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
    
    for (var i = 0; i < tools.length; i++) {
      var tool = tools[i];
      var button = document.createElement('button');
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
        (function(toolName, buttonEl) {
          var handleToolSelect = function() {
            // Remove active class from all buttons
            var buttons = self.toolbar.querySelectorAll('.pen-tool-button');
            for (var j = 0; j < buttons.length; j++) {
              buttons[j].classList.remove('active');
            }
            
            // Add active class to clicked button
            buttonEl.classList.add('active');
            
            // Set current tool
            self.currentTool = toolName;
            
            // Configure SVG pointer events based on tool
            if (toolName === 'hand') {
              // For hand tool, allow normal touch events to pass through for pan/zoom
              self.svg.style.pointerEvents = 'none';
              // Enable default touch behaviors for the target element
              self.targetElement.style.touchAction = 'auto';
              // Add hand tool CSS class for visual feedback
              self.targetElement.classList.add('pen-tool-hand-mode');
            } else {
              // For drawing tools, capture events but allow multi-touch gestures
              self.svg.style.pointerEvents = 'auto';
              self.targetElement.style.touchAction = 'pan-x pan-y pinch-zoom';
              // Remove hand tool CSS class
              self.targetElement.classList.remove('pen-tool-hand-mode');
            }
            
            // Hide eraser indicator when switching tools
            if (toolName !== 'eraser') {
              self.hideEraserIndicator();
            }
          };
          
          buttonEl.addEventListener('click', handleToolSelect);
          buttonEl.addEventListener('touchend', function(e) {
            e.preventDefault();
            handleToolSelect();
          });
          
          // Set pen as active by default
          if (toolName === 'pen') {
            buttonEl.classList.add('active');
          }
        })(tool.name, button);
      } else if (tool.name === 'clear') {
        // Add clear functionality
        (function(buttonEl) {
          var handleClear = function() {
            self.clearAll();
          };
          buttonEl.addEventListener('click', handleClear);
          buttonEl.addEventListener('touchend', function(e) {
            e.preventDefault();
            handleClear();
          });
        })(button);
      } else if (tool.name === 'theme') {
        // Add theme toggle functionality
        (function(buttonEl) {
          var handleThemeToggle = function() {
            // Toggle dark mode
            self.isDarkMode = !self.isDarkMode;
            
            // When user manually toggles theme, we're no longer following system preference
            self.themeSetting = self.isDarkMode ? 'dark' : 'light';
            
            // Update button
            buttonEl.innerHTML = self.getThemeToggleIcon();
            buttonEl.title = self.isDarkMode ? 'Açık Tema' : 'Koyu Tema';
            
            // Apply the theme using our consistent theme method
            self.applyTheme();
          };
          
          buttonEl.addEventListener('click', handleThemeToggle);
          buttonEl.addEventListener('touchend', function(e) {
            e.preventDefault();
            handleThemeToggle();
          });
        })(button);
      }
      
      this.toolbar.appendChild(button);
    }
  };

  /**
   * Add event listeners for mouse and touch events
   */
  PenTool.prototype.addEventListeners = function() {
    var self = this;
    
    // Create bound function references for proper cleanup
    this.boundHandleDrawStart = function(e) { self.handleDrawStart(e); };
    this.boundHandleDrawMove = function(e) { self.handleDrawMove(e); };
    this.boundHandleMouseLeave = function(e) { self.handleMouseLeave(e); };
    this.boundHandleDrawEnd = function(e) { self.handleDrawEnd(e); };
    this.boundHandleTouchStart = function(e) { self.handleTouchStart(e); };
    this.boundHandleTouchMove = function(e) { self.handleTouchMove(e); };
    this.boundHandleTouchEnd = function(e) { self.handleTouchEnd(e); };
    
    // Mouse events
    this.svg.addEventListener('mousedown', this.boundHandleDrawStart);
    this.svg.addEventListener('mousemove', this.boundHandleDrawMove);
    this.svg.addEventListener('mouseleave', this.boundHandleMouseLeave);
    window.addEventListener('mouseup', this.boundHandleDrawEnd);
    
    // Touch events for mobile support - try multiple approaches
    this.svg.addEventListener('touchstart', this.boundHandleTouchStart, { passive: false });
    this.svg.addEventListener('touchmove', this.boundHandleTouchMove, { passive: false });
    
    // Add touch events to target element as fallback
    this.targetElement.addEventListener('touchstart', this.boundHandleTouchStart, { passive: false });
    this.targetElement.addEventListener('touchmove', this.boundHandleTouchMove, { passive: false });
    
    // Also add touchmove to document and window as fallback
    document.addEventListener('touchmove', this.boundHandleTouchMove, { passive: false });
    window.addEventListener('touchmove', this.boundHandleTouchMove, { passive: false });
    
    window.addEventListener('touchend', this.boundHandleTouchEnd);
    window.addEventListener('touchcancel', this.boundHandleTouchEnd);
  };

  /**
   * Handle start of drawing (mousedown)
   */
  PenTool.prototype.handleDrawStart = function(event) {
    // Don't draw if hand tool is active
    if (this.currentTool === 'hand') return;
    
    event.preventDefault();
    
    var rect = this.svg.getBoundingClientRect();
    var x = event.clientX - rect.left;
    var y = event.clientY - rect.top;
    
    this.isDrawing = true;
    
    if (this.currentTool === 'pen') {
      this.startDrawing(x, y);
    } else if (this.currentTool === 'eraser') {
      this.startErasing(x, y);
    }
  };

  /**
   * Handle movement during drawing (mousemove)
   */
  PenTool.prototype.handleDrawMove = function(event) {
    // Don't handle drawing for hand tool
    if (this.currentTool === 'hand') return;
    
    var rect = this.svg.getBoundingClientRect();
    var x = event.clientX - rect.left;
    var y = event.clientY - rect.top;
    
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
  };

  /**
   * Handle mouse leaving the SVG area
   */
  PenTool.prototype.handleMouseLeave = function() {
    if (this.currentTool === 'eraser' && !this.isDrawing) {
      this.hideEraserIndicator();
    }
  };

  /**
   * Handle end of drawing (mouseup)
   */
  PenTool.prototype.handleDrawEnd = function() {
    if (!this.isDrawing) return;
    
    if (this.currentPath) {
      // Remove any temporary stroke first
      if (this.temporaryEraserStroke) {
        this.strokes = this.strokes.filter(function(stroke) {
          return !stroke.isTemporary;
        });
        this.temporaryEraserStroke = null;
      }
      
      // Add the completed stroke to our strokes array with the current timestamp
      var timestamp = Date.now();
      this.strokes.push({
        type: this.currentTool,
        element: this.currentPath,
        timestamp: timestamp
      });
      
      // Apply the time-based masking
      this.renderStrokes();
    }
    
    this.isDrawing = false;
    this.currentPath = null;
    this.hideEraserIndicator();
  };

  /**
   * Handle touch start event
   */
  PenTool.prototype.handleTouchStart = function(event) {
    // Allow multi-touch for hand tool (pinch zoom)
    if (this.currentTool === 'hand') return;
    
    // Allow multi-touch gestures (pinch zoom, pan) even with pen/eraser tools
    if (event.touches.length !== 1) return;
    
    var touch = event.touches[0];
    var rect = this.svg.getBoundingClientRect();
    var x = touch.clientX - rect.left;
    var y = touch.clientY - rect.top;
    
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
  };

  /**
   * Handle touch move event
   */
  PenTool.prototype.handleTouchMove = function(event) {
    // Allow default touch behaviors for hand tool
    if (this.currentTool === 'hand') return;
    
    // Allow multi-touch gestures (pinch zoom, pan) even with pen/eraser tools
    if (event.touches.length !== 1) return;
    
    var touch = event.touches[0];
    var rect = this.svg.getBoundingClientRect();
    var x = touch.clientX - rect.left;
    var y = touch.clientY - rect.top;
    
    // Only prevent default if touch is within the SVG bounds and we're drawing
    var isWithinBounds = x >= 0 && y >= 0 && x <= rect.width && y <= rect.height;
    
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
  };

  /**
   * Handle touch end event
   */
  PenTool.prototype.handleTouchEnd = function() {
    // Don't handle draw end for hand tool
    if (this.currentTool === 'hand') return;
    
    this.handleDrawEnd();
  };

  /**
   * Start drawing at the specified coordinates
   */
  PenTool.prototype.startDrawing = function(x, y) {
    this.currentPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    this.currentPath.setAttribute('stroke', this.lineColor);
    this.currentPath.setAttribute('stroke-width', this.lineWidth.toString());
    this.currentPath.setAttribute('fill', 'none');
    this.currentPath.setAttribute('stroke-linecap', 'round');
    this.currentPath.setAttribute('stroke-linejoin', 'round');
    this.currentPath.style.pointerEvents = 'none'; // Prevent paths from blocking touch events
    this.currentPath.setAttribute('pointer-events', 'none');
    
    this.currentPathData = 'M ' + x + ' ' + y;
    this.currentPath.setAttribute('d', this.currentPathData);
    
    // Add to our drawing container
    this.drawingContainer.appendChild(this.currentPath);
  };

  /**
   * Continue drawing to the specified coordinates
   */
  PenTool.prototype.continueDrawing = function(x, y) {
    if (!this.currentPath) return;
    
    this.currentPathData += ' L ' + x + ' ' + y;
    this.currentPath.setAttribute('d', this.currentPathData);
  };

  /**
   * Start erasing at the specified coordinates
   */
  PenTool.prototype.startErasing = function(x, y) {
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
    
    this.currentPathData = 'M ' + x + ' ' + y;
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
  };

  /**
   * Continue erasing to the specified coordinates
   */
  PenTool.prototype.continueErasing = function(x, y) {
    if (!this.currentPath) {
      return;
    }
    
    this.showEraserIndicator(x, y);
    
    this.currentPathData += ' L ' + x + ' ' + y;
    this.currentPath.setAttribute('d', this.currentPathData);
    
    // Update the temporary eraser stroke in real-time
    if (this.temporaryEraserStroke) {
      this.temporaryEraserStroke.element.setAttribute('d', this.currentPathData);
      this.renderStrokes();
    }
  };

  /**
   * Render all strokes with proper masking
   */
  PenTool.prototype.renderStrokes = function() {
    var self = this;
    
    // Clear the container
    while (this.drawingContainer.firstChild) {
      this.drawingContainer.removeChild(this.drawingContainer.firstChild);
    }
    
    // Clear any previous defs
    var defs = this.svg.querySelector('defs');
    if (!defs) {
      defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      this.svg.appendChild(defs);
    } else {
      while (defs.firstChild) {
        defs.removeChild(defs.firstChild);
      }
    }
    
    // Sort strokes by timestamp (oldest first)
    this.strokes.sort(function(a, b) {
      return a.timestamp - b.timestamp;
    });
    
    // First, separate pen strokes and eraser strokes
    var penStrokes = [];
    var eraserStrokes = [];
    
    for (var i = 0; i < this.strokes.length; i++) {
      var stroke = this.strokes[i];
      if (stroke.type === 'pen') {
        penStrokes.push(stroke);
      } else {
        eraserStrokes.push(stroke);
      }
    }
    
    // For each pen stroke, create a mask that includes all eraser strokes
    // that came AFTER this pen stroke (newer erasers affect older pen strokes)
    for (var penIndex = 0; penIndex < penStrokes.length; penIndex++) {
      var penStroke = penStrokes[penIndex];
      
      // Clone the pen stroke
      var penElement = penStroke.element.cloneNode(true);
      // Ensure cloned elements don't block touch events
      penElement.style.pointerEvents = 'none';
      penElement.setAttribute('pointer-events', 'none');
      
      // Get all eraser strokes that came after this pen stroke
      var applicableErasers = eraserStrokes.filter(function(eraser) {
        return eraser.timestamp > penStroke.timestamp;
      });
      
      if (applicableErasers.length > 0) {
        // This pen stroke needs masking
        var maskId = 'pen-mask-' + penIndex;
        var mask = document.createElementNS('http://www.w3.org/2000/svg', 'mask');
        mask.id = maskId;
        
        // Add white background to mask (fully visible)
        var background = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        background.setAttribute('x', '0');
        background.setAttribute('y', '0');
        background.setAttribute('width', '100%');
        background.setAttribute('height', '100%');
        background.setAttribute('fill', 'white');
        mask.appendChild(background);
        
        // Add each applicable eraser to the mask as black (transparent) areas
        for (var j = 0; j < applicableErasers.length; j++) {
          var eraser = applicableErasers[j];
          var eraserPath = eraser.element.cloneNode(true);
          eraserPath.setAttribute('stroke', 'black'); // In masks, black means transparent
          eraserPath.setAttribute('stroke-width', self.eraserWidth.toString());
          eraserPath.style.pointerEvents = 'none';
          eraserPath.setAttribute('pointer-events', 'none');
          mask.appendChild(eraserPath);
        }
        
        // Add mask to defs
        defs.appendChild(mask);
        
        // Create a group with the mask and add the pen stroke to it
        var maskedGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        maskedGroup.setAttribute('mask', 'url(#' + maskId + ')');
        maskedGroup.style.pointerEvents = 'none';
        maskedGroup.appendChild(penElement);
        
        // Add the masked group to the drawing container
        this.drawingContainer.appendChild(maskedGroup);
      } else {
        // No applicable erasers, just add the pen stroke directly
        this.drawingContainer.appendChild(penElement);
      }
    }
  };

  /**
   * Hide eraser indicator
   */
  PenTool.prototype.hideEraserIndicator = function() {
    if (this.eraserIndicator && this.eraserIndicator.parentNode) {
      this.eraserIndicator.parentNode.removeChild(this.eraserIndicator);
      this.eraserIndicator = null;
    }
  };

  /**
   * Show a visual indicator for the eraser cursor
   */
  PenTool.prototype.showEraserIndicator = function(x, y) {
    var eraserRadius = this.eraserWidth / 2;
    
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
  };

  /**
   * Clear all drawings
   */
  PenTool.prototype.clearAll = function() {
    // Clear drawing container
    while (this.drawingContainer.firstChild) {
      this.drawingContainer.removeChild(this.drawingContainer.firstChild);
    }
    
    // Clear strokes array
    this.strokes = [];
    
    // Clear any defs/masks
    var defs = this.svg.querySelector('defs');
    if (defs) {
      while (defs.firstChild) {
        defs.removeChild(defs.firstChild);
      }
    }
    
    this.hideEraserIndicator();
  };

  /**
   * Update pen tool options
   */
  PenTool.prototype.updateOptions = function(options) {
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
  };

  /**
   * Inject required CSS styles into the document head
   */
  PenTool.prototype.injectCSS = function() {
    // Check if styles have already been injected to avoid duplicates
    if (document.getElementById('pen-tool-styles')) {
      return;
    }

    var style = document.createElement('style');
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
  };

  /**
   * Get SVG icon for pen tool
   */
  PenTool.prototype.getPenIcon = function() {
    return `
      <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 19l7-7 3 3-7 7-3-3z"></path>
        <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path>
        <path d="M2 2l7.586 7.586"></path>
        <circle cx="11" cy="11" r="2"></circle>
      </svg>
    `;
  };

  /**
   * Get SVG icon for eraser tool
   */
  PenTool.prototype.getEraserIcon = function() {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M17.5 20H21v2h-7l3.5-2z" fill="none" stroke="currentColor"/>
        <path d="M4.5 22l-2.1-2.1a3.5 3.5 0 0 1 .1-4.9l11.1-11.5a3.5 3.5 0 0 1 5 0l3.1 3.1a3.5 3.5 0 0 1 0 5L11.5 22h-7z" fill="none" stroke="currentColor"/>
      </svg>
    `;
  };

  /**
   * Get SVG icon for hand tool
   */
  PenTool.prototype.getHandIcon = function() {
    return `
      <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 11V6a2 2 0 0 0-4 0v5"/>
        <path d="M14 10V4a2 2 0 0 0-4 0v2"/>
        <path d="M10 10.5V6a2 2 0 0 0-4 0v8"/>
        <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L8 15"/>
      </svg>
    `;
  };

  /**
   * Get SVG icon for clear tool
   */
  PenTool.prototype.getClearIcon = function() {
    return `
      <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="8" y1="12" x2="16" y2="12"></line>
      </svg>
    `;
  };

  /**
   * Get SVG icon for theme toggle
   */
  PenTool.prototype.getThemeToggleIcon = function() {
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
  };

  /**
   * Apply the current theme based on isDarkMode state
   */
  PenTool.prototype.applyTheme = function() {
    if (this.isDarkMode) {
      // Apply dark mode
      this.targetElement.classList.add('pen-tool-dark-mode');
      document.body.classList.add('pen-tool-dark-mode');
      
      // Update toolbar styles
      if (this.toolbar) {
        this.toolbar.style.backgroundColor = 'rgba(50, 50, 50, 0.85)';
        var buttons = this.toolbar.querySelectorAll('.pen-tool-button');
        for (var i = 0; i < buttons.length; i++) {
          buttons[i].style.color = 'white';
        }
      }
    } else {
      // Apply light mode
      this.targetElement.classList.remove('pen-tool-dark-mode');
      document.body.classList.remove('pen-tool-dark-mode');
      
      // Update toolbar styles
      if (this.toolbar) {
        this.toolbar.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
        var buttons = this.toolbar.querySelectorAll('.pen-tool-button');
        for (var i = 0; i < buttons.length; i++) {
          buttons[i].style.color = '';
        }
      }
    }
  };

  /**
   * Enable the pen tool and toolbar
   * This makes the pen tool handle and toolbar visible and functional
   */
  PenTool.prototype.enable = function() {
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
  };

  /**
   * Disable the pen tool and toolbar
   * This hides the pen tool handle and toolbar making them non-functional
   */
  PenTool.prototype.disable = function() {
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
  };

  /**
   * Remove event listeners for mouse and touch events
   * Used when disabling the pen tool
   */
  PenTool.prototype.removeEventListeners = function() {
    // Remove SVG and window event listeners using bound references
    if (this.svg && this.boundHandleDrawStart) {
      this.svg.removeEventListener('mousedown', this.boundHandleDrawStart);
      this.svg.removeEventListener('mousemove', this.boundHandleDrawMove);
      this.svg.removeEventListener('mouseleave', this.boundHandleMouseLeave);
      this.svg.removeEventListener('touchstart', this.boundHandleTouchStart);
      this.svg.removeEventListener('touchmove', this.boundHandleTouchMove);
    }
    
    if (this.targetElement && this.boundHandleTouchStart) {
      this.targetElement.removeEventListener('touchstart', this.boundHandleTouchStart);
      this.targetElement.removeEventListener('touchmove', this.boundHandleTouchMove);
    }
    
    if (this.boundHandleDrawEnd) {
      window.removeEventListener('mouseup', this.boundHandleDrawEnd);
      window.removeEventListener('touchend', this.boundHandleTouchEnd);
      window.removeEventListener('touchcancel', this.boundHandleTouchEnd);
      window.removeEventListener('touchmove', this.boundHandleTouchMove);
    }
    
    if (this.boundHandleTouchMove) {
      document.removeEventListener('touchmove', this.boundHandleTouchMove);
    }
    
    // Remove system theme change listener
    if (this.systemThemeMediaQuery && this.boundSystemThemeChange) {
      this.systemThemeMediaQuery.removeEventListener('change', this.boundSystemThemeChange);
    }
    
    // Clear bound function references
    this.boundHandleDrawStart = null;
    this.boundHandleDrawMove = null;
    this.boundHandleMouseLeave = null;
    this.boundHandleDrawEnd = null;
    this.boundHandleTouchStart = null;
    this.boundHandleTouchMove = null;
    this.boundHandleTouchEnd = null;
    this.boundSystemThemeChange = null;
    this.systemThemeMediaQuery = null;
  };

  /**
   * Toggle the pen tool and toolbar visibility
   * @returns {boolean} The new state (true for enabled, false for disabled)
   */
  PenTool.prototype.toggle = function() {
    if (this.isEnabled) {
      this.disable();
    } else {
      this.enable();
    }
    return this.isEnabled;
  };

  /**
   * Programmatically switch to pen tool
   */
  PenTool.prototype.switchToPenTool = function() {
    this.setActiveTool('pen');
  };

  /**
   * Programmatically switch to eraser tool
   */
  PenTool.prototype.switchToEraserTool = function() {
    this.setActiveTool('eraser');
  };

  /**
   * Programmatically switch to hand tool
   */
  PenTool.prototype.switchToHandTool = function() {
    this.setActiveTool('hand');
  };

  /**
   * Helper method to set the active tool and update UI
   * @param {string} toolName - The name of the tool ('pen', 'eraser', 'hand')
   */
  PenTool.prototype.setActiveTool = function(toolName) {
    if (!this.isEnabled) {
      console.warn('PenTool is disabled. Enable it first before switching tools.');
      return;
    }

    var validTools = ['pen', 'eraser', 'hand'];
    if (validTools.indexOf(toolName) === -1) {
      console.error('Invalid tool name: ' + toolName + '. Valid tools are: ' + validTools.join(', '));
      return;
    }

    // Update current tool
    this.currentTool = toolName;

    // Remove active class from all tool buttons
    var buttons = this.toolbar.querySelectorAll('.pen-tool-button');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].classList.remove('active');
    }

    // Add active class to the selected tool button
    var targetButton = this.toolbar.querySelector('[data-tool="' + toolName + '"]');
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
  };

  /**
   * Destroy the pen tool and clean up all elements and event listeners
   * This completely removes the pen tool from the DOM and cleans up resources
   */
  PenTool.prototype.destroy = function() {
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
    
    // Clear bound function references
    this.boundHandleDrawStart = null;
    this.boundHandleDrawMove = null;
    this.boundHandleMouseLeave = null;
    this.boundHandleDrawEnd = null;
    this.boundHandleTouchStart = null;
    this.boundHandleTouchMove = null;
    this.boundHandleTouchEnd = null;
    this.boundSystemThemeChange = null;
    this.systemThemeMediaQuery = null;
    
    // Reset state
    this.isDrawing = false;
    this.currentPathData = '';
    this.isEnabled = false;
    this.currentTool = 'pen';
    
    console.log('PenTool destroyed successfully');
  };

  /**
   * Programmatically erase all drawings
   * This is an alias for clearAll() with a more descriptive name for programmatic use
   */
  PenTool.prototype.eraseAll = function() {
    this.clearAll();
  };

  /**
   * Get the currently active tool
   * @returns {string} The name of the currently active tool
   */
  PenTool.prototype.getCurrentTool = function() {
    return this.currentTool;
  };

  // Make PenTool available globally (old school approach)
  window.PenTool = PenTool;

})(window);
