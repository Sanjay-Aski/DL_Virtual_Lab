/* global tf */

// Default network input image size (can be overridden by model input shape)
const defaultInputSize = 28;

// Enum of node types
const nodeType = {
  INPUT: 'input',
  CONV: 'conv',
  POOL: 'pool',
  RELU: 'relu',
  FC: 'fc',
  FLATTEN: 'flatten',
  BOTTLENECK: 'bottleneck',
  UPSAMPLE: 'upsample',
  RESHAPE: 'reshape',
  SIGMOID: 'sigmoid',
  OUTPUT: 'output'
}

class Node {
  /**
   * Class structure for each neuron node.
   * 
   * @param {string} layerName Name of the node's layer.
   * @param {int} index Index of this node in its layer.
   * @param {string} type Node type {input, conv, pool, relu, fc}. 
   * @param {number} bias The bias assocated to this node.
   * @param {number[]} output Output of this node.
   */
  constructor(layerName, index, type, bias, output) {
    this.layerName = layerName;
    this.index = index;
    this.type = type;
    this.bias = bias;
    this.output = output;

    // Weights are stored in the links
    this.inputLinks = [];
    this.outputLinks = [];
  }
}

class Link {
  /**
   * Class structure for each link between two nodes.
   * 
   * @param {Node} source Source node.
   * @param {Node} dest Target node.
   * @param {number} weight Weight associated to this link. It can be a number,
   *  1D array, or 2D array.
   */
  constructor(source, dest, weight) {
    this.source = source;
    this.dest = dest;
    this.weight = weight;
  }
}

const scaleMatrixBy = (matrix, scaleFactor) => {
  if (!Array.isArray(matrix)) {
    return matrix * scaleFactor;
  }
  return matrix.map(entry => scaleMatrixBy(entry, scaleFactor));
}

const isInputLayer = (layer) => {
  if (!layer) return false;
  if (layer.name === 'input_layer') return true;
  if (typeof layer.getClassName === 'function') {
    return layer.getClassName() === 'InputLayer';
  }
  return false;
}

const getConvWeightsByOutputInput = (layer, outputCount, inputCount) => {
  const kernel = layer.kernel.val;
  const shape = kernel.shape || [];
  if (shape.length !== 4) {
    return kernel.arraySync();
  }

  // Find axes dynamically so we can handle runtime-specific layouts
  // (e.g. HWIO, OHWI, OIHW) and always normalize to [out, in, h, w].
  const allAxes = [0, 1, 2, 3];
  let outAxis = allAxes.find(axis => shape[axis] === outputCount);
  if (outAxis === undefined) {
    outAxis = 3;
  }

  let inAxis = allAxes.find(axis => axis !== outAxis && shape[axis] === inputCount);
  if (inAxis === undefined) {
    inAxis = allAxes.find(axis => axis !== outAxis) || 2;
  }

  const spatialAxes = allAxes.filter(axis => axis !== outAxis && axis !== inAxis);
  return kernel.transpose([outAxis, inAxis, ...spatialAxes]).arraySync();
}

const getDenseWeightsByOutputInput = (layer, outputCount, inputCount) => {
  const kernel = layer.kernel.val;
  const shape = kernel.shape || [];

  // Case A: already [out, in]
  if (shape.length === 2 && shape[0] === outputCount && shape[1] === inputCount) {
    return kernel.arraySync();
  }

  // Case B: [in, out] -> [out, in]
  if (shape.length === 2 && shape[0] === inputCount && shape[1] === outputCount) {
    return kernel.transpose([1, 0]).arraySync();
  }

  // Fallback: preserve previous behavior.
  return kernel.transpose([1, 0]).arraySync();
}

const tensorToLayerArray = (tensor) => {
  let normalized = tensor;

  // Remove only the batch axis; keep singleton channel axes for grayscale outputs.
  if (normalized.shape.length > 0 && normalized.shape[0] === 1) {
    normalized = normalized.squeeze([0]);
  }

  // Convert HWC tensors to CHW so channel count maps to node count.
  if (normalized.shape.length === 3) {
    normalized = normalized.transpose([2, 0, 1]);
  }

  return normalized.arraySync();
}

/**
 * Construct a CNN with given extracted outputs from every layer.
 * 
 * @param {number[][]} allOutputs Array of outputs for each layer.
 *  allOutputs[i][j] is the output for layer i node j.
 * @param {Model} model Loaded tf.js model.
 * @param {Tensor} inputImageTensor Loaded input image tensor.
 */
const constructCNNFromOutputs = (allOutputs, model, inputImageTensor) => {
  let cnn = [];

  // Add the first layer (input layer)
  let inputLayer = [];
  let inputShape = model.layers[0].batchInputShape.slice(1);
  let inputImageArray = inputImageTensor.transpose([2, 0, 1]).arraySync();

  // First layer's three nodes' outputs are the channels of inputImageArray
  for (let i = 0; i < inputShape[2]; i++) {
    let node = new Node('input', i, nodeType.INPUT, 0, inputImageArray[i]);
    inputLayer.push(node);
  }
                                                                                                                   
  cnn.push(inputLayer);
  let curLayerIndex = 1;

  let outputLayerIndex = 0;
  for (let l = 0; l < model.layers.length; l++) {
    let layer = model.layers[l];
    if (isInputLayer(layer)) {
      continue;
    }
    // Get the current output
    let outputs = tensorToLayerArray(allOutputs[outputLayerIndex]);
    outputLayerIndex += 1;

    let curLayerNodes = [];
    let curLayerType;

    // Identify layer type based on the layer name
    if (layer.name.includes('conv')) {
      curLayerType = nodeType.CONV;
    } else if (layer.name.includes('max_pool') || layer.name.includes('pool')) {
      curLayerType = nodeType.POOL;
    } else if (layer.name.includes('relu')) {
      curLayerType = nodeType.RELU;
    } else if (layer.name === 'flatten') {
      curLayerType = nodeType.FLATTEN;
    } else if (layer.name === 'bottleneck') {
      curLayerType = nodeType.BOTTLENECK;
    } else if (layer.name === 'fc_layer' || layer.name.includes('dense')) {
      curLayerType = nodeType.FC;
    } else if (layer.name === 'unflatten' || layer.name.includes('reshape')) {
      curLayerType = nodeType.RESHAPE;
    } else if (layer.name.includes('upsample')) {
      curLayerType = nodeType.UPSAMPLE;
    } else if (layer.name.includes('sigmoid')) {
      curLayerType = nodeType.SIGMOID;
    } else if (layer.name === 'output') {
      curLayerType = nodeType.OUTPUT;
    } else {
      // Default to point-wise pass-through so unknown activation layers still render.
      curLayerType = nodeType.OUTPUT;
    }

    // Construct this layer based on its layer type
    switch (curLayerType) {
      case nodeType.CONV: {
        let biases = layer.bias.val.arraySync();
        let weights = getConvWeightsByOutputInput(
          layer,
          outputs.length,
          cnn[curLayerIndex - 1].length
        );

        // Add nodes into this layer
        for (let i = 0; i < outputs.length; i++) {
          let node = new Node(layer.name, i, curLayerType, biases[i],
            outputs[i]);

          // Connect this node to all previous nodes (create links)
          // CONV layers have weights in links. Links are one-to-multiple.
          let prevNodeCount = cnn[curLayerIndex - 1].length;
          let availableInputs = (weights[i] || []).length;
          let linkCount = Math.min(prevNodeCount, availableInputs);
          for (let j = 0; j < linkCount; j++) {
            let preNode = cnn[curLayerIndex - 1][j];
            let curLink = new Link(preNode, node, weights[i][j]);
            preNode.outputLinks.push(curLink);
            node.inputLinks.push(curLink);
          }
          curLayerNodes.push(node);
        }
        break;
      }
      case nodeType.BOTTLENECK:
      case nodeType.FC: {
        let biases = layer.bias.val.arraySync();
        let weights = getDenseWeightsByOutputInput(
          layer,
          outputs.length,
          cnn[curLayerIndex - 1].length
        );

        // Add nodes into this layer
        for (let i = 0; i < outputs.length; i++) {
          let node = new Node(layer.name, i, curLayerType, biases[i],
            outputs[i]);

          // Connect this node to all previous nodes (create links)
          // FC layers have weights in links. Links are one-to-multiple.

          // Track weighted input before bias-add for dense contribution views.
          let curWeightedInput = 0;
          let prevNodeCount = cnn[curLayerIndex - 1].length;
          let availableInputs = (weights[i] || []).length;
          let linkCount = Math.min(prevNodeCount, availableInputs);
          for (let j = 0; j < linkCount; j++) {
            let preNode = cnn[curLayerIndex - 1][j];
            let curLink = new Link(preNode, node, weights[i][j]);
            preNode.outputLinks.push(curLink);
            node.inputLinks.push(curLink);
            curWeightedInput += preNode.output * weights[i][j];
          }
          node.weightedInput = curWeightedInput;
          node.afterBias = curWeightedInput + biases[i];
          curLayerNodes.push(node);
        }

        // Sort flatten layer based on the node TF index
        cnn[curLayerIndex - 1].sort((a, b) => a.realIndex - b.realIndex);
        break;
      }
      case nodeType.RELU:
      case nodeType.POOL:
      case nodeType.SIGMOID:
      case nodeType.UPSAMPLE:
      case nodeType.OUTPUT: {
        // RELU and POOL have no bias nor weight
        let bias = 0;
        let weight = null;

        // Add nodes into this layer
        for (let i = 0; i < outputs.length; i++) {
          let curOutput = outputs[i];

          let node = new Node(layer.name, i, curLayerType, bias, curOutput);

          // RELU and POOL layers have no weights. Links are one-to-one
          let preNode = cnn[curLayerIndex - 1][i];
          let link = new Link(preNode, node, weight);
          preNode.outputLinks.push(link);
          node.inputLinks.push(link);

          curLayerNodes.push(node);
        }
        break;
      }
      case nodeType.RESHAPE: {
        // Unflatten converts a vector into channel feature maps.
        let bias = 0;
        let preLayer = cnn[curLayerIndex - 1];

        for (let i = 0; i < outputs.length; i++) {
          let node = new Node(layer.name, i, curLayerType, bias, outputs[i]);
          let mapHeight = outputs[i].length;
          let mapWidth = outputs[i][0].length;
          let mapSize = mapHeight * mapWidth;
          let vectorStart = i * mapSize;

          // Each reshape channel gets exactly mapSize predecessors from fc_layer.
          for (let j = 0; j < mapSize; j++) {
            let preNodeIndex = vectorStart + j;
            let row = Math.floor(j / mapWidth);
            let col = j % mapWidth;
            let preNode = preLayer[preNodeIndex];
            let link = new Link(preNode, node, [row, col, preNodeIndex]);
            preNode.outputLinks.push(link);
            node.inputLinks.push(link);
          }
          curLayerNodes.push(node);
        }
        break;
      }
      case nodeType.FLATTEN: {
        // Flatten layer has no bias nor weights.
        let bias = 0;

        for (let i = 0; i < outputs.length; i++) {
          // Flatten layer has no weights. Links are multiple-to-one.
          // Use dummy weights to store the corresponding entry in the previsou
          // node as (row, column)
          // The flatten() in tf2.keras has order: channel -> row -> column
          let preNodeWidth = cnn[curLayerIndex - 1][0].output.length,
            preNodeNum = cnn[curLayerIndex - 1].length,
            preNodeIndex = i % preNodeNum,
            preNodeRow = Math.floor(Math.floor(i / preNodeNum) / preNodeWidth),
            preNodeCol = Math.floor(i / preNodeNum) % preNodeWidth,
            // Use channel, row, colume to compute the real index with order
            // row -> column -> channel
            curNodeRealIndex = preNodeIndex * (preNodeWidth * preNodeWidth) +
              preNodeRow * preNodeWidth + preNodeCol;
          
          let node = new Node(layer.name, i, curLayerType,
              bias, outputs[i]);
          
          // TF uses the (i) index for computation, but the real order should
          // be (curNodeRealIndex). We will sort the nodes using the real order
          // after we compute the logits in the output layer.
          node.realIndex = curNodeRealIndex;

          let link = new Link(cnn[curLayerIndex - 1][preNodeIndex],
              node, [preNodeRow, preNodeCol]);

          cnn[curLayerIndex - 1][preNodeIndex].outputLinks.push(link);
          node.inputLinks.push(link);

          curLayerNodes.push(node);
        }

        // Sort flatten layer based on the node TF index
        curLayerNodes.sort((a, b) => a.index - b.index);
        break;
      }
      default:
        console.error('Encounter unknown layer type');
        break;
    }

    // Add current layer to the NN
    cnn.push(curLayerNodes);
    curLayerIndex++;
  }

  return cnn;
}

/**
 * Construct a CNN with given model and input.
 * 
 * @param {string} inputImageFile filename of input image.
 * @param {Model} model Loaded tf.js model.
 */
export const constructCNN = async (inputImageFile, model) => {
  let inputShape = model.layers[0].batchInputShape.slice(1);
  let inputSize = inputShape[0] || defaultInputSize;
  let inputChannels = inputShape[2] || 1;

  // Load the image file
  let inputImageTensor = await getInputImageArray(inputImageFile, inputSize,
    inputChannels, true);

  // Need to feed the model with a batch
  let inputImageTensorBatch = tf.stack([inputImageTensor]);

  // To get intermediate layer outputs, we will iterate through all layers in
  // the model, and sequencially apply transformations.
  let preTensor = inputImageTensorBatch;
  let outputs = [];

  // Iterate through all layers, and build one model with that layer as output
  for (let l = 0; l < model.layers.length; l++) {
    if (isInputLayer(model.layers[l])) {
      continue;
    }
    let curTensor = model.layers[l].apply(preTensor);

    // Keep raw layer tensors and normalize shape in one place.
    outputs.push(curTensor);

    // Update preTensor for next nesting iteration
    preTensor = curTensor;
  }

  let cnn = constructCNNFromOutputs(outputs, model, inputImageTensor);
  return cnn;
}

// Helper functions

/**
 * Crop the largest central square of size 64x64x3 of a 3d array.
 * 
 * @param {[int8]} arr array that requires cropping and padding (if a 64x64 crop
 * is not present)
 * @returns 64x64x3 array
 */
const cropCentralSquare = (arr, targetSize) => {
  let width = arr.length;
  let height = arr[0].length;
  let croppedArray;

  // Crop largest square from image if the image is smaller than 64x64 and pad the
  // cropped image.
  if (width < targetSize || height < targetSize) {
    // TODO(robert): Finish the padding logic.  Pushing now for Omar to work on when he is ready.
    let cropDimensions = Math.min(width, height);
    let startXIdx = Math.floor(width / 2) - (cropDimensions / 2);
    let startYIdx = Math.floor(height / 2) - (cropDimensions / 2);
    let unpaddedSubarray = arr.slice(startXIdx, startXIdx + cropDimensions).map(i => i.slice(startYIdx, startYIdx + cropDimensions));
  } else {
    let startXIdx = Math.floor(width / 2) - Math.floor(targetSize / 2);
    let startYIdx = Math.floor(height / 2) - Math.floor(targetSize / 2);
    croppedArray = arr.slice(startXIdx, startXIdx + targetSize).map(i => i.slice(startYIdx, startYIdx + targetSize));
  }
  return croppedArray;
}

/**
 * Convert canvas image data into a 3D tensor with dimension [height, width, 3].
 * Recall that tensorflow uses NHWC order (batch, height, width, channel).
 * Each pixel is in 0-255 scale.
 * 
 * @param {[int8]} imageData Canvas image data
 * @param {int} width Canvas image width
 * @param {int} height Canvas image height
 */
const imageDataTo3DTensor = (imageData, width, height, channels = 1,
  normalize = true) => {
  // Create array placeholder for the 3d array
  let imageArray = tf.fill([height, width, channels], 0).arraySync();

  // Iterate through the data to fill out channel arrays above
  for (let i = 0; i < imageData.length; i++) {
    let pixelIndex = Math.floor(i / 4),
      channelIndex = i % 4,
      row = Math.floor(pixelIndex / width),
      column = pixelIndex % width;
    
    if (channels === 1 && channelIndex === 0) {
      // Grayscale conversion for MNIST-like models.
      let r = imageData[i];
      let g = imageData[i + 1];
      let b = imageData[i + 2];
      let gray = (r + g + b) / 3;
      if (normalize) {
        gray /= 255;
      }
      imageArray[row][column][0] = gray;
    } else if (channels > 1 && channelIndex < channels) {
      let curEntry = imageData[i];
      if (normalize) {
        curEntry /= 255;
      }
      imageArray[row][column][channelIndex] = curEntry;
    }
  }

  let tensor = tf.tensor3d(imageArray);
  return tensor;
}

/**
 * Get the 3D pixel value array of the given image file.
 * 
 * @param {string} imgFile File path to the image file
 * @returns A promise with the corresponding 3D array
 */
const getInputImageArray = (imgFile, targetSize, channels = 1,
  normalize = true) => {
  let canvas = document.createElement('canvas');
  canvas.style.cssText = 'display:none;';
  document.getElementsByTagName('body')[0].appendChild(canvas);
  let context = canvas.getContext('2d');

  return new Promise((resolve, reject) => {
    let inputImage = new Image();
    inputImage.crossOrigin = "Anonymous";
    inputImage.src = imgFile;
    let canvasImage;
    inputImage.onload = () => {
      canvas.width = targetSize;
      canvas.height = targetSize;
      context.drawImage(inputImage, 0, 0, targetSize, targetSize);
      canvasImage = context.getImageData(0, 0, targetSize, targetSize);
      // Get image data and convert it to a 3D array
      let imageData = canvasImage.data;
      let imageWidth = canvasImage.width;
      let imageHeight = canvasImage.height;

      // Remove this newly created canvas element
      canvas.parentNode.removeChild(canvas);

      resolve(imageDataTo3DTensor(imageData, imageWidth, imageHeight,
        channels, normalize));
    }
    inputImage.onerror = reject;
  })
}

/**
 * Wrapper to load a model.
 * 
 * @param {string} modelFile Filename of converted (through tensorflowjs.py)
 *  model json file.
 */
export const loadTrainedModel = (modelFile) => {
  return tf.loadLayersModel(modelFile);
}
