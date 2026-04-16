export function dataUrlToBlob(dataUrl) {
  const [prefix, base64] = dataUrl.split(',');
  const mimeMatch = prefix.match(/data:(.*?);base64/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeType });
}

export function normalize2DArray(matrix) {
  if (!Array.isArray(matrix) || matrix.length === 0 || !Array.isArray(matrix[0])) {
    return [];
  }

  let minValue = Number.POSITIVE_INFINITY;
  let maxValue = Number.NEGATIVE_INFINITY;

  matrix.forEach((row) => {
    row.forEach((value) => {
      if (value < minValue) minValue = value;
      if (value > maxValue) maxValue = value;
    });
  });

  if (!Number.isFinite(minValue) || !Number.isFinite(maxValue)) {
    return matrix.map((row) => row.map(() => 0));
  }

  const range = maxValue - minValue;
  if (range === 0) {
    return matrix.map((row) => row.map(() => 0));
  }

  return matrix.map((row) => row.map((value) => (value - minValue) / range));
}

export function getChannelMaps(featureTensor, maxMaps = 8) {
  if (!Array.isArray(featureTensor) || featureTensor.length === 0) {
    return [];
  }

  const d0 = featureTensor.length;
  const d1 = Array.isArray(featureTensor[0]) ? featureTensor[0].length : 0;
  const d2 = Array.isArray(featureTensor[0]?.[0]) ? featureTensor[0][0].length : 0;

  if (d1 === 0 || d2 === 0) {
    return [];
  }

  let channelMaps = [];

  if (d2 >= d0 && d2 >= d1) {
    for (let channel = 0; channel < d2; channel += 1) {
      const map2D = featureTensor.map((row) => row.map((pixel) => pixel[channel]));
      channelMaps.push(map2D);
    }
  } else {
    channelMaps = featureTensor;
  }

  return channelMaps.slice(0, maxMaps);
}

export function matrixToDataUrl(matrix, outputSize = 96) {
  const normalized = normalize2DArray(matrix);
  if (normalized.length === 0) {
    return '';
  }

  const height = normalized.length;
  const width = normalized[0].length;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  const imageData = context.createImageData(width, height);

  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      const intensity = Math.round(normalized[row][column] * 255);
      const pixelIndex = (row * width + column) * 4;
      imageData.data[pixelIndex] = intensity;
      imageData.data[pixelIndex + 1] = intensity;
      imageData.data[pixelIndex + 2] = intensity;
      imageData.data[pixelIndex + 3] = 255;
    }
  }

  context.putImageData(imageData, 0, 0);

  if (outputSize === width) {
    return canvas.toDataURL('image/png');
  }

  const resizedCanvas = document.createElement('canvas');
  resizedCanvas.width = outputSize;
  resizedCanvas.height = outputSize;
  const resizedContext = resizedCanvas.getContext('2d');
  resizedContext.imageSmoothingEnabled = false;
  resizedContext.drawImage(canvas, 0, 0, outputSize, outputSize);

  return resizedCanvas.toDataURL('image/png');
}
