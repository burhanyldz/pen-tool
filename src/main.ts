import './style.css'
import { PenTool, PenToolOptions } from './pen-tool.ts'

// Create main app container
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div>
    
    <div class="drawing-container">
      <div id="drawing-area" class="drawing-area">
        <div class="content">
          <h3>Çizim bölgesi</h3>
        </div>
      </div>
    </div>
  </div>
`

// Initialize pen tool
const drawingArea = document.querySelector<HTMLDivElement>('#drawing-area')!;

const penToolOptions: PenToolOptions = {
  targetElement: drawingArea,
  lineWidth: 3,
  lineColor: '#000000',
  toolPosition: 'top', // 'left', 'right', 'bottom', 'top'
  zIndex: 10,
  eraserWidth: 50
};

new PenTool(penToolOptions);