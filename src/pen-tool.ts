/**
 * PenTool - A vanilla TypeScript implementation of an SVG pen tool
 * 
 * Features:
 * - SVG-based drawing for resolution independence
 * - Drawing on target div with support for zoom and pan
 * - Eraser functionality with temporal hierarchy
 * - Clean all option
 * - Simple tool buttons with icons
 * - Developer customization options
 */

export interface PenToolOptions {
  /** Target element to attach the pen tool to */
  targetElement: HTMLElement;
  /** Width of the drawing line */
  lineWidth?: number;
  /** Color of the drawing line */
  lineColor?: string;
  /** Position of the tool buttons ('top', 'bottom', 'left', 'right') */
  toolPosition?: 'top' | 'bottom' | 'left' | 'right';
  /** Z-index of the SVG drawing layer */
  zIndex?: number;
  /** Width of the eraser tool */
  eraserWidth?: number;
}

type StrokeType = 'pen' | 'eraser';

interface Stroke {
  type: StrokeType;
  element: SVGPathElement;
  timestamp: number;
  isTemporary?: boolean;
}

export class PenTool {
  private targetElement: HTMLElement;
  private svg: SVGSVGElement;
  private drawingContainer: SVGGElement;
  private isDrawing: boolean = false;
  private currentPath: SVGPathElement | null = null;
  private currentPathData: string = '';
  private toolbar: HTMLDivElement;
  private eraserIndicator: SVGCircleElement | null = null;
  private strokes: Stroke[] = [];
  private temporaryEraserStroke: Stroke | null = null;
  
  // Configuration options
  private lineWidth: number;
  private lineColor: string;
  private toolPosition: 'top' | 'bottom' | 'left' | 'right';
  private zIndex: number;
  private currentTool: StrokeType = 'pen';
  private eraserWidth: number;

  constructor(options: PenToolOptions) {
    // Initialize with default values or provided options
    this.targetElement = options.targetElement;
    this.lineWidth = options.lineWidth || 3;
    this.lineColor = options.lineColor || '#000000';
    this.toolPosition = options.toolPosition || 'top';
    this.zIndex = options.zIndex || 10;
    this.eraserWidth = options.eraserWidth || 15;

    this.initialize();
  }

  /**
   * Initialize the pen tool with SVG canvas and toolbar
   */
  private initialize(): void {
    // Set position relative on target if not already
    const computedStyle = window.getComputedStyle(this.targetElement);
    if (computedStyle.position === 'static') {
      this.targetElement.style.position = 'relative';
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
  }

  /**
   * Set toolbar position based on the toolPosition option
   */
  private setToolbarPosition(): void {
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
  private createToolbar(): void {
    const tools = [
      { name: 'pen', icon: this.getPenIcon(), title: 'Kalem Aracı' },
      { name: 'eraser', icon: this.getEraserIcon(), title: 'Silgi Aracı' },
      { name: 'clear', icon: this.getClearIcon(), title: 'Tümünü Temizle' }
    ];
    
    tools.forEach(tool => {
      const button = document.createElement('button');
      button.innerHTML = tool.icon;
      button.title = tool.title;
      button.className = 'pen-tool-button';
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
          this.currentTool = tool.name as StrokeType;
          
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
    `;
    document.head.appendChild(style);
  }

  /**
   * Add event listeners for mouse and touch events
   */
  private addEventListeners(): void {
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
  private handleDrawStart(event: MouseEvent): void {
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
  private handleDrawMove(event: MouseEvent): void {
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
  private handleDrawEnd(): void {
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
  private handleTouchStart(event: TouchEvent): void {
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
  private handleTouchMove(event: TouchEvent): void {
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
  private handleTouchEnd(): void {
    this.handleDrawEnd();
  }

  /**
   * Start drawing at the specified coordinates
   */
  private startDrawing(x: number, y: number): void {
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
  private continueDrawing(x: number, y: number): void {
    if (!this.currentPath) return;
    
    this.currentPathData += ` L ${x} ${y}`;
    this.currentPath.setAttribute('d', this.currentPathData);
  }

  /**
   * Start erasing at the specified coordinates
   */
  private startErasing(x: number, y: number): void {
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
  private continueErasing(x: number, y: number): void {
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
  private renderStrokes(): void {
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
    const penStrokes: Stroke[] = [];
    const eraserStrokes: Stroke[] = [];
    
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
      const penElement = penStroke.element.cloneNode(true) as SVGPathElement;
      
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
          const eraserPath = eraser.element.cloneNode(true) as SVGPathElement;
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
  private hideEraserIndicator(): void {
    if (this.eraserIndicator && this.eraserIndicator.parentNode) {
      this.eraserIndicator.parentNode.removeChild(this.eraserIndicator);
      this.eraserIndicator = null;
    }
  }

  /**
   * Show a visual indicator for the eraser cursor
   */
  private showEraserIndicator(x: number, y: number): void {
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
  public clearAll(): void {
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
  public updateOptions(options: Partial<PenToolOptions>): void {
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
  private getPenIcon(): string {
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
  private getEraserIcon(): string {
    return `
      <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
        <path d="M15.5 2H18a2 2 0 0 1 2 2v2.5"></path>
        <path d="M22 14L10 2"></path>
        <path d="M14 18l-4-4"></path>
      </svg>
    `;
  }

  /**
   * Get SVG icon for clear tool
   */
  private getClearIcon(): string {
    return `
      <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="8" y1="12" x2="16" y2="12"></line>
      </svg>
    `;
  }
}