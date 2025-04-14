# SVG Pen Tool for Vanilla TypeScript

A lightweight, customizable SVG-based pen tool implementation that allows drawing on any target HTML element.

## Features

- SVG-based drawing for resolution-independent lines
- Supports zooming and panning with the target element
- Eraser functionality that only affects drawings
- Clean all button to remove all drawings
- Simple toolbar with intuitive icons
- Developer customization options
- Touch-friendly for mobile devices

## Installation

Simply copy the `pen-tool.ts` file into your project.

## Usage

```typescript
import { PenTool, PenToolOptions } from './pen-tool';

// Get the target element
const drawingArea = document.getElementById('drawing-area');

// Configure the pen tool
const options: PenToolOptions = {
  targetElement: drawingArea,
  lineWidth: 3,
  lineColor: '#000000',
  toolPosition: 'top',
  zIndex: 10
};

// Initialize the pen tool
const penTool = new PenTool(options);
```

## API Documentation

### PenToolOptions Interface

```typescript
interface PenToolOptions {
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
}
```

### PenTool Class

#### Constructor

```typescript
constructor(options: PenToolOptions)
```

Creates a new PenTool instance with the provided options.

#### Methods

##### clearAll()

```typescript
public clearAll(): void
```

Clears all drawings from the canvas.

##### updateOptions()

```typescript
public updateOptions(options: Partial<PenToolOptions>): void
```

Updates the pen tool configuration with new options.

## Developer Controls Example

```typescript
// Get developer control elements
const lineColorInput = document.querySelector('#line-color');
const lineWidthInput = document.querySelector('#line-width');
const toolPositionSelect = document.querySelector('#tool-position');

// Update pen tool when developer controls change
lineColorInput.addEventListener('change', () => {
  penTool.updateOptions({ lineColor: lineColorInput.value });
});

lineWidthInput.addEventListener('input', () => {
  penTool.updateOptions({ lineWidth: parseInt(lineWidthInput.value) });
});

toolPositionSelect.addEventListener('change', () => {
  penTool.updateOptions({ 
    toolPosition: toolPositionSelect.value as 'top' | 'bottom' | 'left' | 'right' 
  });
});
```

## Implementation Details

The pen tool works by creating an SVG element that overlays the target element. When drawing:

1. SVG paths are created for each stroke
2. Mouse/touch events track the drawing motion
3. The eraser tool uses path intersection detection to remove paths
4. All drawings are contained within the boundaries of the target element
5. The toolbar provides intuitive controls for drawing, erasing, and clearing

## Browser Compatibility

This tool is compatible with all modern browsers that support SVG and ES6+.