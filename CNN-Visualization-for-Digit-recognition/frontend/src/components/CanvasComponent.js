import React, { useEffect, useRef } from 'react';

const CANVAS_SIZE = 300;

function CanvasComponent({ canvasRef, onPredict, onClear, isLoading }) {
  const drawCanvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const hasDrawingRef = useRef(false);
  const lastPointRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = drawCanvasRef.current;
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = '#000000';
    context.lineWidth = 18;
  }, []);

  useEffect(() => {
    if (!canvasRef) {
      return;
    }

    canvasRef.current = {
      clear: () => {
        const canvas = drawCanvasRef.current;
        const context = canvas.getContext('2d');
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
        hasDrawingRef.current = false;
      },
      getDataURL: () => drawCanvasRef.current.toDataURL('image/png'),
      getSaveData: () => JSON.stringify({ lines: hasDrawingRef.current ? [1] : [] }),
    };
  }, [canvasRef]);

  const getPointFromEvent = (event) => {
    const canvas = drawCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const touch = event.touches?.[0] || event.changedTouches?.[0];
    const clientX = touch ? touch.clientX : event.clientX;
    const clientY = touch ? touch.clientY : event.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const beginDrawing = (event) => {
    event.preventDefault();
    const point = getPointFromEvent(event);
    isDrawingRef.current = true;
    lastPointRef.current = point;
  };

  const draw = (event) => {
    if (!isDrawingRef.current) {
      return;
    }

    event.preventDefault();
    const canvas = drawCanvasRef.current;
    const context = canvas.getContext('2d');
    const point = getPointFromEvent(event);

    context.beginPath();
    context.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    context.lineTo(point.x, point.y);
    context.stroke();

    lastPointRef.current = point;
    hasDrawingRef.current = true;
  };

  const endDrawing = (event) => {
    event.preventDefault();
    isDrawingRef.current = false;
  };

  const handleClear = () => {
    canvasRef.current?.clear();
    onClear();
  };

  return (
    <section className="card draw-card">
      <h2>Draw a Digit</h2>
      <p className="hint">Draw a handwritten number from 0 to 9.</p>
      <div className="canvas-wrap">
        <canvas
          ref={drawCanvasRef}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          className="draw-surface"
          onMouseDown={beginDrawing}
          onMouseMove={draw}
          onMouseUp={endDrawing}
          onMouseLeave={endDrawing}
          onTouchStart={beginDrawing}
          onTouchMove={draw}
          onTouchEnd={endDrawing}
        />
      </div>
      <div className="actions">
        <button className="btn primary" type="button" onClick={onPredict} disabled={isLoading}>
          {isLoading ? 'Predicting...' : 'Predict'}
        </button>
        <button className="btn secondary" type="button" onClick={handleClear} disabled={isLoading}>
          Clear
        </button>
      </div>
    </section>
  );
}

export default CanvasComponent;
