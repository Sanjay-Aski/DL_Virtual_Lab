import React, { useEffect, useMemo, useRef } from 'react';
import { normalize2DArray } from '../utils/imageTransforms';

function HeatmapViewer({ originalImageUrl, heatmap }) {
  const originalCanvasRef = useRef(null);
  const heatmapCanvasRef = useRef(null);
  const normalizedHeatmap = useMemo(() => normalize2DArray(heatmap || []), [heatmap]);

  useEffect(() => {
    const canvas = originalCanvasRef.current;
    if (!canvas || !originalImageUrl) {
      return;
    }

    const context = canvas.getContext('2d');
    const image = new Image();
    image.onload = () => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
    };
    image.src = originalImageUrl;
  }, [originalImageUrl]);

  useEffect(() => {
    const canvas = heatmapCanvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);

    if (normalizedHeatmap.length === 0) {
      return;
    }

    const sourceHeight = normalizedHeatmap.length;
    const sourceWidth = normalizedHeatmap[0].length;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = sourceWidth;
    tempCanvas.height = sourceHeight;
    const tempContext = tempCanvas.getContext('2d');
    const imageData = tempContext.createImageData(sourceWidth, sourceHeight);

    for (let row = 0; row < sourceHeight; row += 1) {
      for (let col = 0; col < sourceWidth; col += 1) {
        const value = normalizedHeatmap[row][col];
        const idx = (row * sourceWidth + col) * 4;
        imageData.data[idx] = 255;
        imageData.data[idx + 1] = Math.round(180 * value);
        imageData.data[idx + 2] = 0;
        imageData.data[idx + 3] = Math.round(220 * value);
      }
    }

    tempContext.putImageData(imageData, 0, 0);
    context.imageSmoothingEnabled = false;
    context.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);
  }, [normalizedHeatmap]);

  return (
    <section className="card heatmap-card">
      <h2>Grad-CAM Attention Map</h2>
      <div className="heatmap-stack">
        <canvas ref={originalCanvasRef} width={280} height={280} className="base-image" />
        <canvas ref={heatmapCanvasRef} width={280} height={280} className="heatmap-overlay" />
      </div>
    </section>
  );
}

export default HeatmapViewer;
