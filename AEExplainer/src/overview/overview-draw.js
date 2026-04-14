/* global d3, SmoothScroll */

import {
  svgStore, vSpaceAroundGapStore, hSpaceAroundGapStore, cnnStore,
  nodeCoordinateStore, selectedScaleLevelStore, cnnLayerRangesStore,
  detailedModeStore, cnnLayerMinMaxStore, hoverInfoStore
} from '../stores.js';
import {
  getExtent, getLinkData
} from './draw-utils.js';
import { overviewConfig } from '../config.js';

// Configs
const layerColorScales = overviewConfig.layerColorScales;
const nodeLength = overviewConfig.nodeLength;
const numLayers = overviewConfig.numLayers;
const edgeOpacity = overviewConfig.edgeOpacity;
const edgeInitColor = overviewConfig.edgeInitColor;
const edgeStrokeWidth = overviewConfig.edgeStrokeWidth;
const svgPaddings = overviewConfig.svgPaddings;
const gapRatio = overviewConfig.gapRatio;
const classLists = overviewConfig.classLists;
const formater = d3.format('.4f');
const headingMainFontSize = 15;
const headingDimFontSize = 15;
const headingCompactFontSize = 14;
const bottleneckMainFontSize = 17;
const bottleneckDimFontSize = 17;
const bottleneckCompactFontSize = 16;
const detailedHeadingToModelGap = 35;
const compactHeadingToModelGap = 25;
const bottleneckFeatureGapScale = 0.35;
const bottleneckLabelToBoxGap = 7;
const defaultBarTopOffset = 8;
const bottleneckBarHeightRatio = 0.46;
const bottleneckValueBoxWidthRatio = 1.45;
const defaultBarHeightRatio = 1 / 4;
const bottleneckValueGap = 6;
const defaultValueGap = 10;
const bottleneckOutputValueFontSize = 15;
const defaultOutputValueFontSize = 9;
const bottleneckOutputTextFontSize = 13;
const defaultOutputTextFontSize = 11;
const clampNonNegative = (value) => Math.max(0, Number(value) || 0);
const toUnitValue = (value) => {
  let normalized = Number(value);
  if (!Number.isFinite(normalized)) return 0;
  if (normalized > 1 || normalized < 0) {
    normalized = normalized / 255;
  }
  return Math.max(0, Math.min(1, normalized));
};

// Shared variables
let svg = undefined;
svgStore.subscribe( value => {svg = value;} )

let vSpaceAroundGap = undefined;
vSpaceAroundGapStore.subscribe( value => {vSpaceAroundGap = value;} )

let hSpaceAroundGap = undefined;
hSpaceAroundGapStore.subscribe( value => {hSpaceAroundGap = value;} )

let cnn = undefined;
cnnStore.subscribe( value => {cnn = value;} )

let nodeCoordinate = undefined;
nodeCoordinateStore.subscribe( value => {nodeCoordinate = value;} )

let selectedScaleLevel = undefined;
selectedScaleLevelStore.subscribe( value => {selectedScaleLevel = value;} )

let cnnLayerRanges = undefined;
cnnLayerRangesStore.subscribe( value => {cnnLayerRanges = value;} )

let cnnLayerMinMax = undefined;
cnnLayerMinMaxStore.subscribe( value => {cnnLayerMinMax = value;} )

let detailedMode = undefined;
detailedModeStore.subscribe( value => {detailedMode = value;} )

/**
 * Use bounded d3 data to draw one canvas
 * @param {object} d d3 data
 * @param {index} i d3 data index
 * @param {[object]} g d3 group
 * @param {number} range color range map (max - min)
 */
export const drawOutput = (d, i, g, range) => {
  let image = g[i];
  let colorScale = layerColorScales[d.type];
  let curLayerIndex = cnn.findIndex(layer =>
    layer[0] && layer[0].layerName === d.layerName);

  if (d.type === 'input') {
    colorScale = colorScale[d.index];
  } else if (colorScale === undefined) {
    colorScale = layerColorScales.conv;
  }

  // Set up a second convas in order to resize image
  let imageLength = d.output.length === undefined ? 1 : d.output.length;
  let bufferCanvas = document.createElement("canvas");
  let bufferContext = bufferCanvas.getContext("2d");
  bufferCanvas.width = imageLength;
  bufferCanvas.height = imageLength;

  // Fill image pixel array
  let imageSingle = bufferContext.getImageData(0, 0, imageLength, imageLength);
  let imageSingleArray = imageSingle.data;

  if (imageLength === 1) {
    imageSingleArray[0] = d.output;
  } else {
    for (let i = 0; i < imageSingleArray.length; i+=4) {
      let pixeIndex = Math.floor(i / 4);
      let row = Math.floor(pixeIndex / imageLength);
      let column = pixeIndex % imageLength;
      let color = undefined;
      if (d.type === 'input' || d.type === 'fc' ) {
        color = d3.rgb(colorScale(1 - toUnitValue(d.output[row][column])));
      } else if (d.type === 'output') {
        let normalized = Number(d.output[row][column]);
        normalized = Number.isFinite(normalized) ? normalized : 0;
        normalized = Math.max(0, Math.min(1, normalized));
        color = d3.rgb(colorScale(1 - normalized));
      } else if (d.type === 'sigmoid') {
        let layerMinMax = (cnnLayerMinMax || [])[curLayerIndex] || {};
        let minVal = Number(layerMinMax.min);
        let maxVal = Number(layerMinMax.max);
        if (!Number.isFinite(minVal) || !Number.isFinite(maxVal)) {
          let safeRange = Math.abs(Number(range)) || 1;
          minVal = -safeRange / 2;
          maxVal = safeRange / 2;
        }
        let maxAbs = Math.max(Math.abs(minVal), Math.abs(maxVal), 1e-6);
        let normalized = (d.output[row][column] + maxAbs) / (2 * maxAbs);
        normalized = Math.max(0, Math.min(1, normalized));
        color = d3.rgb(colorScale(normalized));
      } else {
        let safeRange = Math.abs(Number(range)) || 1;
        let normalized = (d.output[row][column] + safeRange / 2) / safeRange;
        normalized = Math.max(0, Math.min(1, normalized));
        color = d3.rgb(colorScale(normalized));
      }

      imageSingleArray[i] = color.r;
      imageSingleArray[i + 1] = color.g;
      imageSingleArray[i + 2] = color.b;
      imageSingleArray[i + 3] = 255;
    }
  }

  // canvas.toDataURL() only exports image in 96 DPI, so we can hack it to have
  // higher DPI by rescaling the image using canvas magic
  let largeCanvas = document.createElement('canvas');
  largeCanvas.width = nodeLength * 3;
  largeCanvas.height = nodeLength * 3;
  let largeCanvasContext = largeCanvas.getContext('2d');

  // Use drawImage to resize the original pixel array, and put the new image
  // (canvas) into corresponding canvas
  bufferContext.putImageData(imageSingle, 0, 0);
  largeCanvasContext.drawImage(bufferCanvas, 0, 0, imageLength, imageLength,
    0, 0, nodeLength * 3, nodeLength * 3);
  
  let imageDataURL = largeCanvas.toDataURL();
  d3.select(image).attr('xlink:href', imageDataURL);

  // Destory the buffer canvas
  bufferCanvas.remove();
  largeCanvas.remove();
}

/**
 * Draw bar chart to encode the output value
 * @param {object} d d3 data
 * @param {index} i d3 data index
 * @param {[object]} g d3 group
 * @param {function} scale map value to length
 */
const drawOutputScore = (d, i, g, scale) => {
  let group = d3.select(g[i]);
  let layerName = d.layerName;
  if (layerName === 'bottleneck') {
    let bottleneckLayer = cnn.find(layer => layer[0] && layer[0].layerName === 'bottleneck') || [];
    let values = bottleneckLayer.map(node => Number(node.output) || 0);
    let minVal = d3.min(values);
    let maxVal = d3.max(values);
    let maxAbs = Math.max(Math.abs(minVal || 0), Math.abs(maxVal || 0), 1e-6);
    let value = Number(d.output) || 0;
    let zeroX = +group.select('text.output-text').attr('x');
    let boxWidth = nodeLength * bottleneckValueBoxWidthRatio;
    let normalized = (value + maxAbs) / (2 * maxAbs);
    normalized = Math.max(0, Math.min(1, normalized));
    let fillColor = d3.rgb(layerColorScales.conv(normalized));
    let luminance = (0.299 * fillColor.r + 0.587 * fillColor.g + 0.114 * fillColor.b) / 255;
    let valueColor = luminance < 0.58 ? '#F7F7F7' : '#1F1F1F';

    group.select('line.output-zero-line')
      .style('opacity', 0);

    group.select('rect.output-rect')
      .transition('output')
      .delay(300)
      .duration(700)
      .ease(d3.easeCubicInOut)
      .attr('x', zeroX - boxWidth / 2)
      .attr('width', boxWidth)
      .style('fill', fillColor.formatRgb());

    group.select('text.output-value')
      .style('fill', valueColor)
      .text(d3.format('.3f')(value));
    return;
  }

  group.select('rect.output-rect')
    .transition('output')
    .delay(500)
    .duration(800)
    .ease(d3.easeCubicIn)
    .attr('x', +group.select('text.output-text').attr('x'))
    .attr('width', clampNonNegative(scale(d.output)));

  group.select('line.output-zero-line')
    .style('opacity', 0);

  group.select('text.output-value')
    .text(d3.format('.3f')(Number(d.output) || 0));
}

export const drawCustomImage = (image, inputLayer) => {

  let imageWidth = image.width;
  // Set up a second convas in order to resize image
  let imageLength = inputLayer[0].output.length;
  let bufferCanvas = document.createElement("canvas");
  let bufferContext = bufferCanvas.getContext("2d");
  bufferCanvas.width = imageLength;
  bufferCanvas.height = imageLength;

  // Fill image pixel array
  let imageSingle = bufferContext.getImageData(0, 0, imageLength, imageLength);
  let imageSingleArray = imageSingle.data;

  let hasSingleChannel = inputLayer.length === 1;

  for (let i = 0; i < imageSingleArray.length; i+=4) {
    let pixeIndex = Math.floor(i / 4);
    let row = Math.floor(pixeIndex / imageLength);
    let column = pixeIndex % imageLength;

    let red = inputLayer[0].output[row][column];
    let green = hasSingleChannel ? red : inputLayer[1].output[row][column];
    let blue = hasSingleChannel ? red : inputLayer[2].output[row][column];

    imageSingleArray[i] = red * 255;
    imageSingleArray[i + 1] = green * 255;
    imageSingleArray[i + 2] = blue * 255;
    imageSingleArray[i + 3] = 255;
  }

  // canvas.toDataURL() only exports image in 96 DPI, so we can hack it to have
  // higher DPI by rescaling the image using canvas magic
  let largeCanvas = document.createElement('canvas');
  largeCanvas.width = imageWidth * 3;
  largeCanvas.height = imageWidth * 3;
  let largeCanvasContext = largeCanvas.getContext('2d');

  // Use drawImage to resize the original pixel array, and put the new image
  // (canvas) into corresponding canvas
  bufferContext.putImageData(imageSingle, 0, 0);
  largeCanvasContext.drawImage(bufferCanvas, 0, 0, imageLength, imageLength,
    0, 0, imageWidth * 3, imageWidth * 3);
  
  let imageDataURL = largeCanvas.toDataURL();
  // d3.select(image).attr('xlink:href', imageDataURL);
  image.src = imageDataURL;

  // Destory the buffer canvas
  bufferCanvas.remove();
  largeCanvas.remove();
}

/**
 * Create color gradient for the legend
 * @param {[object]} g d3 group
 * @param {function} colorScale Colormap
 * @param {string} gradientName Label for gradient def
 * @param {number} min Min of legend value
 * @param {number} max Max of legend value
 */
const getLegendGradient = (g, colorScale, gradientName, min, max) => {
  if (min === undefined) { min = 0; }
  if (max === undefined) { max = 1; }
  let gradient = g.append('defs')
    .append('svg:linearGradient')
    .attr('id', `${gradientName}`)
    .attr('x1', '0%')
    .attr('y1', '100%')
    .attr('x2', '100%')
    .attr('y2', '100%')
    .attr('spreadMethod', 'pad');
  let interpolation = 10
  for (let i = 0; i < interpolation; i++) {
    let curProgress = i / (interpolation - 1);
    let curColor = colorScale(curProgress * (max - min) + min);
    gradient.append('stop')
      .attr('offset', `${curProgress * 100}%`)
      .attr('stop-color', curColor)
      .attr('stop-opacity', 1);
  }
}

/**
 * Draw all legends
 * @param {object} legends Parent group
 * @param {number} legendHeight Height of the legend element
 */
const drawLegends = (legends, legendHeight) => {
  // Add local legends
  for (let i = 0; i < 2; i++){
    let start = 1 + i * 5;
    let range1 = cnnLayerRanges.local[start];
    let range2 = cnnLayerRanges.local[start + 2];

    let localLegendScale1 = d3.scaleLinear()
      .range([0, 2 * nodeLength + hSpaceAroundGap - 1.2])
      .domain([-range1 / 2, range1 / 2]);
    
    let localLegendScale2 = d3.scaleLinear()
      .range([0, 3 * nodeLength + 2 * hSpaceAroundGap - 1.2])
      .domain([-range2 / 2, range2 / 2]);

    let localLegendAxis1 = d3.axisBottom()
      .scale(localLegendScale1)
      .tickFormat(d3.format('.2f'))
      .tickValues([-range1 / 2, 0, range1 / 2]);
    
    let localLegendAxis2 = d3.axisBottom()
      .scale(localLegendScale2)
      .tickFormat(d3.format('.2f'))
      .tickValues([-range2 / 2, 0, range2 / 2]);

    let localLegend1 = legends.append('g')
      .attr('class', 'legend local-legend')
      .attr('id', `local-legend-${i}-1`)
      .classed('hidden', !detailedMode || selectedScaleLevel !== 'local')
      .attr('transform', `translate(${nodeCoordinate[start][0].x}, ${0})`);

    localLegend1.append('g')
      .attr('transform', `translate(0, ${legendHeight - 3})`)
      .call(localLegendAxis1)

    localLegend1.append('rect')
      .attr('width', 2 * nodeLength + hSpaceAroundGap)
      .attr('height', legendHeight)
      .style('fill', 'url(#convGradient)');

    let localLegend2 = legends.append('g')
      .attr('class', 'legend local-legend')
      .attr('id', `local-legend-${i}-2`)
      .classed('hidden', !detailedMode || selectedScaleLevel !== 'local')
      .attr('transform', `translate(${nodeCoordinate[start + 2][0].x}, ${0})`);

    localLegend2.append('g')
      .attr('transform', `translate(0, ${legendHeight - 3})`)
      .call(localLegendAxis2)

    localLegend2.append('rect')
      .attr('width', 3 * nodeLength + 2 * hSpaceAroundGap)
      .attr('height', legendHeight)
      .style('fill', 'url(#convGradient)');
  }

  // Add module legends
  for (let i = 0; i < 2; i++){
    let start = 1 + i * 5;
    let range = cnnLayerRanges.module[start];

    let moduleLegendScale = d3.scaleLinear()
      .range([0, 5 * nodeLength + 3 * hSpaceAroundGap +
        1 * hSpaceAroundGap * gapRatio - 1.2])
      .domain([-range / 2, range / 2]);

    let moduleLegendAxis = d3.axisBottom()
      .scale(moduleLegendScale)
      .tickFormat(d3.format('.2f'))
      .tickValues([-range / 2, -(range / 4), 0, range / 4, range / 2]);

    let moduleLegend = legends.append('g')
      .attr('class', 'legend module-legend')
      .attr('id', `module-legend-${i}`)
      .classed('hidden', !detailedMode || selectedScaleLevel !== 'module')
      .attr('transform', `translate(${nodeCoordinate[start][0].x}, ${0})`);
    
    moduleLegend.append('g')
      .attr('transform', `translate(0, ${legendHeight - 3})`)
      .call(moduleLegendAxis)

    moduleLegend.append('rect')
      .attr('width', 5 * nodeLength + 3 * hSpaceAroundGap +
        1 * hSpaceAroundGap * gapRatio)
      .attr('height', legendHeight)
      .style('fill', 'url(#convGradient)');
  }

  // Add global legends
  let start = 1;
  let range = cnnLayerRanges.global[start];

  let globalLegendScale = d3.scaleLinear()
    .range([0, 10 * nodeLength + 6 * hSpaceAroundGap +
      3 * hSpaceAroundGap * gapRatio - 1.2])
    .domain([-range / 2, range / 2]);

  let globalLegendAxis = d3.axisBottom()
    .scale(globalLegendScale)
    .tickFormat(d3.format('.2f'))
    .tickValues([-range / 2, -(range / 4), 0, range / 4, range / 2]);

  let globalLegend = legends.append('g')
    .attr('class', 'legend global-legend')
    .attr('id', 'global-legend')
    .classed('hidden', !detailedMode || selectedScaleLevel !== 'global')
    .attr('transform', `translate(${nodeCoordinate[start][0].x}, ${0})`);

  globalLegend.append('g')
    .attr('transform', `translate(0, ${legendHeight - 3})`)
    .call(globalLegendAxis)

  globalLegend.append('rect')
    .attr('width', 10 * nodeLength + 6 * hSpaceAroundGap +
      3 * hSpaceAroundGap * gapRatio)
    .attr('height', legendHeight)
    .style('fill', 'url(#convGradient)');


  // Add output legend
  let outputRectScale = d3.scaleLinear()
        .domain(cnnLayerRanges.output)
        .range([0, nodeLength - 1.2]);

  let outputLegendAxis = d3.axisBottom()
    .scale(outputRectScale)
    .tickFormat(d3.format('.1f'))
    .tickValues([0, cnnLayerRanges.output[1]])
  
  let outputLegend = legends.append('g')
    .attr('class', 'legend output-legend')
    .attr('id', 'output-legend')
    .classed('hidden', !detailedMode)
    .attr('transform', `translate(${nodeCoordinate[cnn.length - 1][0].x}, ${0})`);
  
  outputLegend.append('g')
    .attr('transform', `translate(0, ${legendHeight - 3})`)
    .call(outputLegendAxis);

  outputLegend.append('rect')
    .attr('width', nodeLength)
    .attr('height', legendHeight)
    .style('fill', 'gray');
  
  // Add input image legend
  let inputScale = d3.scaleLinear()
    .range([0, nodeLength - 1.2])
    .domain([0, 1]);

  let inputLegendAxis = d3.axisBottom()
    .scale(inputScale)
    .tickFormat(d3.format('.1f'))
    .tickValues([0, 0.5, 1]);

  let inputLegend = legends.append('g')
    .attr('class', 'legend input-legend')
    .classed('hidden', !detailedMode)
    .attr('transform', `translate(${nodeCoordinate[0][0].x}, ${0})`);
  
  inputLegend.append('g')
    .attr('transform', `translate(0, ${legendHeight - 3})`)
    .call(inputLegendAxis);

  inputLegend.append('rect')
    .attr('x', 0.3)
    .attr('width', nodeLength - 0.3)
    .attr('height', legendHeight)
    .attr('transform', `rotate(180, ${nodeLength/2}, ${legendHeight/2})`)
    .style('stroke', 'rgb(20, 20, 20)')
    .style('stroke-width', 0.3)
    .style('fill', 'url(#inputGradient)');
}

/**
 * Draw the overview
 * @param {number} width Width of the cnn group
 * @param {number} height Height of the cnn group
 * @param {object} cnnGroup Group to appen cnn elements to
 * @param {function} nodeMouseOverHandler Callback func for mouseOver
 * @param {function} nodeMouseLeaveHandler Callback func for mouseLeave
 * @param {function} nodeClickHandler Callback func for click
 */
export const drawCNN = (width, height, cnnGroup, nodeMouseOverHandler,
  nodeMouseLeaveHandler, nodeClickHandler) => {
  // Draw the CNN with dynamic spacing based on current visible layers.
  let gapUnits = 0;
  for (let l = 0; l < cnn.length; l++) {
    let curType = cnn[l][0].type;
    let isLongGap = curType === 'conv' || curType === 'bottleneck' ||
      cnn[l][0].layerName === 'unflatten' || curType === 'reshape';
    gapUnits += isLongGap ? gapRatio : 1;
  }
  hSpaceAroundGap = (width - nodeLength * cnn.length) / gapUnits;
  hSpaceAroundGapStore.set(hSpaceAroundGap);
  let leftAccuumulatedSpace = 0;

  // Iterate through the cnn to draw nodes in each layer
  for (let l = 0; l < cnn.length; l++) {
    let curLayer = cnn[l];
    let isScalarLayer = curLayer[0].output.length === undefined;

    nodeCoordinate.push([]);

    // Compute the x coordinate of the whole layer
    // Output layer and conv layer has long gaps
    if (curLayer[0].type === 'conv' || curLayer[0].type === 'bottleneck' ||
      curLayer[0].layerName === 'unflatten' || curLayer[0].type === 'reshape') {
      leftAccuumulatedSpace += hSpaceAroundGap * gapRatio;
    } else {
      leftAccuumulatedSpace += hSpaceAroundGap;
    }

    // All nodes share the same x coordiante (left in div style)
    let left = leftAccuumulatedSpace;

    let layerGroup = cnnGroup.append('g')
      .attr('class', 'cnn-layer-group')
      .attr('id', `cnn-layer-group-${l}`);

    vSpaceAroundGap = (height - nodeLength * curLayer.length) /
      (curLayer.length + 1);
    vSpaceAroundGapStore.set(vSpaceAroundGap);

    let layerGap = vSpaceAroundGap;
    if (curLayer[0].layerName === 'bottleneck') {
      layerGap *= bottleneckFeatureGapScale;
    }
    let packedLayerHeight = curLayer.length * nodeLength +
      (curLayer.length + 1) * layerGap;
    let layerTopOffset = (height - packedLayerHeight) / 2;

    let nodeGroups = layerGroup.selectAll('g.node-group')
      .data(curLayer, d => d.index)
      .enter()
      .append('g')
      .attr('class', 'node-group')
      .style('cursor', 'pointer')
      .style('pointer-events', 'all')
      .on('click', nodeClickHandler)
      .on('mouseover', nodeMouseOverHandler)
      .on('mouseleave', nodeMouseLeaveHandler)
      .classed('node-output', isScalarLayer)
      .attr('id', (d, i) => {
        // Compute the coordinate
        // Not using transform on the group object because of a decade old
        // bug on webkit (safari)
        // https://bugs.webkit.org/show_bug.cgi?id=23113
        let top = i * nodeLength + (i + 1) * layerGap + layerTopOffset;
        top += svgPaddings.top;
        nodeCoordinate[l].push({x: left, y: top});
        return `layer-${l}-node-${i}`
      });
    
    // Overwrite the mouseover and mouseleave function for output nodes to show
    // hover info in the UI
    layerGroup.selectAll('g.node-output')
      .on('mouseover', (d, i, g) => {
        nodeMouseOverHandler(d, i, g);
        hoverInfoStore.set( {show: true, text: `Output value: ${formater(d.output)}`} );
      })
      .on('mouseleave', (d, i, g) => {
        nodeMouseLeaveHandler(d, i, g);
        hoverInfoStore.set( {show: false, text: `Output value: ${formater(d.output)}`} );
      });
    
    if (!isScalarLayer) {
      // Embed raster image in these groups
      nodeGroups.append('image')
        .attr('class', 'node-image')
        .attr('width', nodeLength)
        .attr('height', nodeLength)
        .attr('x', left)
        .attr('y', (d, i) => nodeCoordinate[l][i].y);

      // Always-visible map border for all feature maps.
      nodeGroups.append('rect')
        .attr('class', 'map-border')
        .attr('width', nodeLength)
        .attr('height', nodeLength)
        .attr('x', left)
        .attr('y', (d, i) => nodeCoordinate[l][i].y)
        .style('fill', 'none')
        .style('stroke', edgeInitColor)
        .style('stroke-width', 0.9)
        .style('pointer-events', 'none');
      
      // Add a rectangle to show the border
      nodeGroups.append('rect')
        .attr('class', 'bounding')
        .attr('width', nodeLength)
        .attr('height', nodeLength)
        .attr('x', left)
        .attr('y', (d, i) => nodeCoordinate[l][i].y)
        .style('fill', 'none')
        .style('stroke', edgeInitColor)
        .style('stroke-width', 1)
        .classed('hidden', true);
    } else {
      nodeGroups.append('line')
        .attr('class', 'output-zero-line')
        .attr('x1', left + nodeLength / 2)
        .attr('x2', left + nodeLength / 2)
        .attr('y1', (d, i) => {
          let nodeCenterY = nodeCoordinate[l][i].y + nodeLength / 2;
          let barHeight = d.layerName === 'bottleneck'
            ? nodeLength * bottleneckBarHeightRatio
            : nodeLength * defaultBarHeightRatio;
          let barTop = d.layerName === 'bottleneck'
            ? nodeCenterY - barHeight / 2
            : nodeCenterY + defaultBarTopOffset;
          return barTop;
        })
        .attr('y2', (d, i) => {
          let nodeCenterY = nodeCoordinate[l][i].y + nodeLength / 2;
          let barHeight = d.layerName === 'bottleneck'
            ? nodeLength * bottleneckBarHeightRatio
            : nodeLength * defaultBarHeightRatio;
          let barTop = d.layerName === 'bottleneck'
            ? nodeCenterY - barHeight / 2
            : nodeCenterY + defaultBarTopOffset;
          return barTop + barHeight;
        })
        .style('stroke', '#9E9E9E')
        .style('stroke-width', d => d.layerName === 'bottleneck' ? 1.1 : 0.7)
        .style('opacity', 0);

      nodeGroups.append('rect')
        .attr('class', 'output-rect')
        .attr('x', left + nodeLength / 2)
        .attr('y', (d, i) => {
          let nodeCenterY = nodeCoordinate[l][i].y + nodeLength / 2;
          let barHeight = d.layerName === 'bottleneck'
            ? nodeLength * bottleneckBarHeightRatio
            : nodeLength * defaultBarHeightRatio;
          return d.layerName === 'bottleneck'
            ? nodeCenterY - barHeight / 2
            : nodeCenterY + defaultBarTopOffset;
        })
        .attr('height', d => d.layerName === 'bottleneck'
          ? nodeLength * bottleneckBarHeightRatio
          : nodeLength * defaultBarHeightRatio)
        .attr('width', 0)
        .style('fill', d => d.layerName === 'bottleneck' ? '#5E5E5E' : 'gray');
      nodeGroups.append('text')
        .attr('class', 'output-text')
        .attr('x', d => d.layerName === 'bottleneck' ? left + nodeLength / 2 : left)
        .attr('y', (d, i) => {
          if (d.layerName !== 'bottleneck') {
            return nodeCoordinate[l][i].y + nodeLength / 2;
          }
          let nodeCenterY = nodeCoordinate[l][i].y + nodeLength / 2;
          let barHeight = nodeLength * bottleneckBarHeightRatio;
          let barTop = nodeCenterY - barHeight / 2;
          return barTop - bottleneckLabelToBoxGap;
        })
        .style('text-anchor', d => d.layerName === 'bottleneck' ? 'middle' : 'start')
        .style('dominant-baseline', 'middle')
        .style('font-size', d => `${d.layerName === 'bottleneck' ? bottleneckOutputTextFontSize : defaultOutputTextFontSize}px`)
        .style('font-weight', '400')
        .style('fill', 'black')
        .style('opacity', d => d.layerName === 'bottleneck' ? 0.72 : 0.5)
        .text((d, i) => classLists[i] === undefined ? `z${i}` : classLists[i]);

      nodeGroups.append('text')
        .attr('class', 'output-value')
        .attr('x', left + nodeLength / 2)
        .attr('y', (d, i) => {
          let nodeCenterY = nodeCoordinate[l][i].y + nodeLength / 2;
          let barHeight = d.layerName === 'bottleneck'
            ? nodeLength * bottleneckBarHeightRatio
            : nodeLength * defaultBarHeightRatio;
          let barTop = d.layerName === 'bottleneck'
            ? nodeCenterY - barHeight / 2
            : nodeCenterY + defaultBarTopOffset;
          let valueGap = d.layerName === 'bottleneck' ? bottleneckValueGap : defaultValueGap;
          return d.layerName === 'bottleneck'
            ? barTop + barHeight / 2
            : barTop + barHeight + valueGap;
        })
        .style('text-anchor', 'middle')
        .style('dominant-baseline', d => d.layerName === 'bottleneck' ? 'middle' : 'hanging')
        .style('font-size', d => `${d.layerName === 'bottleneck' ? bottleneckOutputValueFontSize : defaultOutputValueFontSize}px`)
        .style('font-weight', d => d.layerName === 'bottleneck' ? '700' : '400')
        .style('fill', d => d.layerName === 'bottleneck' ? '#1F1F1F' : '#444')
        .text(d => d3.format('.3f')(Number(d.output) || 0));
      
      // Add annotation text to tell readers the exact output probability
      // nodeGroups.append('text')
      //   .attr('class', 'annotation-text')
      //   .attr('id', (d, i) => `output-prob-${i}`)
      //   .attr('x', left)
      //   .attr('y', (d, i) => nodeCoordinate[l][i].y + 10)
      //   .text(d => `(${d3.format('.4f')(d.output)})`);
    }
    leftAccuumulatedSpace += nodeLength;
  }

  // Share the nodeCoordinate
  nodeCoordinateStore.set(nodeCoordinate)

  // Compute the scale of the output score width (mapping the the node
  // width to the max output score)
  let outputRectScale = d3.scaleLinear()
        .domain(cnnLayerRanges.output)
        .range([0, nodeLength]);

  // Draw the canvas
  for (let l = 0; l < cnn.length; l++) {
    let range = cnnLayerRanges[selectedScaleLevel][l];
    svg.select(`g#cnn-layer-group-${l}`)
      .selectAll('image.node-image')
      .each((d, i, g) => drawOutput(d, i, g, range));
  }

  svg.selectAll('g.node-output').each(
    (d, i, g) => drawOutputScore(d, i, g, outputRectScale)
  );

  // Add layer label
  let layerNames = cnn.map(d => {
    if (d[0].output.length === undefined) {
      return {
        name: d[0].layerName,
        dimension: `(${d.length})`
      }
    } else {
      return {
        name: d[0].layerName,
        dimension: `(${d[0].output.length}, ${d[0].output.length}, ${d.length})`
      }
    }
  });

  let svgHeight = Number(d3.select('#cnn-svg').style('height').replace('px', '')) + 150;
  let scroll = new SmoothScroll('a[href*="#"]', {offset: -svgHeight});
  let modelTopY = d3.min(nodeCoordinate
    .filter(layer => layer && layer[0])
    .map(layer => layer[0].y));
  if (!Number.isFinite(modelTopY)) {
    modelTopY = svgPaddings.top;
  }
  
  let detailedLabels = svg.selectAll('g.layer-detailed-label')
    .data(layerNames)
    .enter()
    .append('g')
    .attr('class', 'layer-detailed-label')
    .attr('id', (d, i) => `layer-detailed-label-${i}`)
    .classed('hidden', !detailedMode)
    .attr('transform', (d, i) => {
      let x = nodeCoordinate[i][0].x + nodeLength / 2;
      let y = modelTopY - detailedHeadingToModelGap;
      return `translate(${x}, ${y})`;
    })
    .style('cursor', d => d.name.includes('output') ? 'default' : 'help')
    .on('click', (d) => {
      let target = '';
      if (d.name.includes('conv')) { target = 'convolution' }
      if (d.name.includes('relu')) { target = 'relu' }
      if (d.name.includes('max_pool')) { target = 'pooling'}
      if (d.name.includes('input')) { target = 'input'}

      // Scroll to a article element
      let anchor = document.querySelector(`#article-${target}`);
      scroll.animateScroll(anchor);
    });
  
  detailedLabels.append('title')
    .text('Move to article section');
    
  detailedLabels.append('text')
    .style('opacity', 0.7)
    .style('dominant-baseline', 'middle')
    .append('tspan')
    .style('font-size', d => `${d.name === 'bottleneck' ? bottleneckMainFontSize : headingMainFontSize}px`)
    .style('font-weight', d => d.name === 'bottleneck' ? '800' : '700')
    .text(d => d.name)
    .append('tspan')
    .style('font-size', d => `${d.name === 'bottleneck' ? bottleneckDimFontSize : headingDimFontSize}px`)
    .style('font-weight', 'normal')
    .attr('x', 0)
    .attr('dy', '1.2em')
    .text(d => d.dimension);
  
  let labels = svg.selectAll('g.layer-label')
    .data(layerNames)
    .enter()
    .append('g')
    .attr('class', 'layer-label')
    .attr('id', (d, i) => `layer-label-${i}`)
    .classed('hidden', detailedMode)
    .attr('transform', (d, i) => {
      let x = nodeCoordinate[i][0].x + nodeLength / 2;
      let y = modelTopY - compactHeadingToModelGap;
      return `translate(${x}, ${y})`;
    })
    .style('cursor', d => d.name.includes('output') ? 'default' : 'help')
    .on('click', (d) => {
      let target = '';
      if (d.name.includes('conv')) { target = 'convolution' }
      if (d.name.includes('relu')) { target = 'relu' }
      if (d.name.includes('max_pool')) { target = 'pooling'}
      if (d.name.includes('input')) { target = 'input'}

      // Scroll to a article element
      let anchor = document.querySelector(`#article-${target}`);
      scroll.animateScroll(anchor);
    });
  
  labels.append('title')
    .text('Move to article section');
  
  labels.append('text')
    .style('dominant-baseline', 'middle')
    .style('opacity', 0.8)
    .style('font-size', d => `${d.name === 'bottleneck' ? bottleneckCompactFontSize : headingCompactFontSize}px`)
    .style('font-weight', d => d.name === 'bottleneck' ? '800' : '700')
    .text(d => {
      if (d.name.includes('conv')) { return 'conv' }
      if (d.name.includes('relu')) { return 'relu' }
      if (d.name.includes('max_pool')) { return 'max_pool'}
      return d.name
    });

  // Add layer color scale legends
  getLegendGradient(svg, layerColorScales.conv, 'convGradient');
  getLegendGradient(svg, layerColorScales.input[0], 'inputGradient');

  let legendHeight = 5;
  let legends = svg.append('g')
      .attr('class', 'color-legend')
      .attr('transform', `translate(${0}, ${
        svgPaddings.top + vSpaceAroundGap * (10) + vSpaceAroundGap +
        nodeLength * 10
      })`);
  
  drawLegends(legends, legendHeight);

  // Add edges between nodes
  let linkGen = d3.linkHorizontal()
    .x(d => d.x)
    .y(d => d.y);
  
  let linkData = getLinkData(nodeCoordinate, cnn);

  let edgeGroup = cnnGroup.append('g')
    .attr('class', 'edge-group');
  
  edgeGroup.selectAll('path.edge')
    .data(linkData)
    .enter()
    .append('path')
    .attr('class', d =>
      `edge edge-${d.targetLayerIndex} edge-${d.targetLayerIndex}-${d.targetNodeIndex}`)
    .attr('id', d => 
      `edge-${d.targetLayerIndex}-${d.targetNodeIndex}-${d.sourceNodeIndex}`)
    .attr('d', d => linkGen({source: d.source, target: d.target}))
    .style('fill', 'none')
    .style('stroke-width', edgeStrokeWidth)
    .style('opacity', edgeOpacity)
    .style('stroke', edgeInitColor);

  // Add input channel annotations
  let inputAnnotation = cnnGroup.append('g')
    .attr('class', 'input-annotation');

  if (cnn[0].length === 1) {
    inputAnnotation.append('text')
      .attr('x', nodeCoordinate[0][0].x + nodeLength / 2)
      .attr('y', nodeCoordinate[0][0].y + nodeLength + 5)
      .attr('class', 'annotation-text')
      .style('dominant-baseline', 'hanging')
      .style('text-anchor', 'middle')
      .style('fill', '#666')
      .text('Grayscale channel');
  } else {
    let redChannel = inputAnnotation.append('text')
      .attr('x', nodeCoordinate[0][0].x + nodeLength / 2)
      .attr('y', nodeCoordinate[0][0].y + nodeLength + 5)
      .attr('class', 'annotation-text')
      .style('dominant-baseline', 'hanging')
      .style('text-anchor', 'middle');
    
    redChannel.append('tspan')
      .style('dominant-baseline', 'hanging')
      .style('fill', '#C95E67')
      .text('Red');
    
    redChannel.append('tspan')
      .style('dominant-baseline', 'hanging')
      .text(' channel');

    inputAnnotation.append('text')
      .attr('x', nodeCoordinate[0][1].x + nodeLength / 2)
      .attr('y', nodeCoordinate[0][1].y + nodeLength + 5)
      .attr('class', 'annotation-text')
      .style('dominant-baseline', 'hanging')
      .style('text-anchor', 'middle')
      .style('fill', '#3DB665')
      .text('Green');

    inputAnnotation.append('text')
      .attr('x', nodeCoordinate[0][2].x + nodeLength / 2)
      .attr('y', nodeCoordinate[0][2].y + nodeLength + 5)
      .attr('class', 'annotation-text')
      .style('dominant-baseline', 'hanging')
      .style('text-anchor', 'middle')
      .style('fill', '#3F7FBC')
      .text('Blue');
  }
}

/**
 * Update canvas values when user changes input image
 */
export const updateCNN = () => {
  // Compute the scale of the output score width (mapping the the node
  // width to the max output score)
  let outputRectScale = d3.scaleLinear()
      .domain(cnnLayerRanges.output)
      .range([0, nodeLength]);

  // Rebind the cnn data to layer groups layer by layer
  for (let l = 0; l < cnn.length; l++) {
    let curLayer = cnn[l];
    let range = cnnLayerRanges[selectedScaleLevel][l];
    let layerGroup = svg.select(`g#cnn-layer-group-${l}`);
    let isScalarLayer = curLayer[0].output.length === undefined;

    let nodeGroups = layerGroup.selectAll('g.node-group')
      .data(curLayer);

    if (!isScalarLayer) {
      // Redraw the canvas and output node
      nodeGroups.transition('disappear')
        .duration(300)
        .ease(d3.easeCubicOut)
        .style('opacity', 0)
        .on('end', function() {
          d3.select(this)
            .select('image.node-image')
            .each((d, i, g) => drawOutput(d, i, g, range));
          d3.select(this).transition('appear')
            .duration(700)
            .ease(d3.easeCubicIn)
            .style('opacity', 1);
        });
    } else {
      nodeGroups.each(
        (d, i, g) => drawOutputScore(d, i, g, outputRectScale)
      );
    }
  }

  // Update the color scale legend
  // Local legends
  for (let i = 0; i < 2; i++){
    let start = 1 + i * 5;
    let range1 = cnnLayerRanges.local[start];
    let range2 = cnnLayerRanges.local[start + 2];

    let localLegendScale1 = d3.scaleLinear()
      .range([0, 2 * nodeLength + hSpaceAroundGap])
      .domain([-range1 / 2, range1 / 2]);
    
    let localLegendScale2 = d3.scaleLinear()
      .range([0, 3 * nodeLength + 2 * hSpaceAroundGap])
      .domain([-range2 / 2, range2 / 2]);

    let localLegendAxis1 = d3.axisBottom()
      .scale(localLegendScale1)
      .tickFormat(d3.format('.2f'))
      .tickValues([-range1 / 2, 0, range1 / 2]);
    
    let localLegendAxis2 = d3.axisBottom()
      .scale(localLegendScale2)
      .tickFormat(d3.format('.2f'))
      .tickValues([-range2 / 2, 0, range2 / 2]);
    
    svg.select(`g#local-legend-${i}-1`).select('g').call(localLegendAxis1);
    svg.select(`g#local-legend-${i}-2`).select('g').call(localLegendAxis2);
  }

  // Module legend
  for (let i = 0; i < 2; i++){
    let start = 1 + i * 5;
    let range = cnnLayerRanges.local[start];

    let moduleLegendScale = d3.scaleLinear()
      .range([0, 5 * nodeLength + 3 * hSpaceAroundGap +
        1 * hSpaceAroundGap * gapRatio - 1.2])
      .domain([-range, range]);

    let moduleLegendAxis = d3.axisBottom()
      .scale(moduleLegendScale)
      .tickFormat(d3.format('.2f'))
      .tickValues([-range, -(range / 2), 0, range/2, range]);
    
    svg.select(`g#module-legend-${i}`).select('g').call(moduleLegendAxis);
  }

  // Global legend
  let start = 1;
  let range = cnnLayerRanges.global[start];

  let globalLegendScale = d3.scaleLinear()
    .range([0, 10 * nodeLength + 6 * hSpaceAroundGap +
      3 * hSpaceAroundGap * gapRatio - 1.2])
    .domain([-range, range]);

  let globalLegendAxis = d3.axisBottom()
    .scale(globalLegendScale)
    .tickFormat(d3.format('.2f'))
    .tickValues([-range, -(range / 2), 0, range/2, range]);

  svg.select(`g#global-legend`).select('g').call(globalLegendAxis);

  // Output legend
  let outputLegendAxis = d3.axisBottom()
    .scale(outputRectScale)
    .tickFormat(d3.format('.1f'))
    .tickValues([0, cnnLayerRanges.output[1]]);
  
  svg.select('g#output-legend').select('g').call(outputLegendAxis);
}

/**
 * Update the ranges for current CNN layers
 */
export const updateCNNLayerRanges = () => {
  let cnnLayerRangesLocal = [];
  cnnLayerMinMax = [];

  for (let l = 0; l < cnn.length; l++) {
    let curLayer = cnn[l];
    let outputExtents = curLayer.map(node => getExtent(node.output));
    let aggregatedExtent = outputExtents.reduce((acc, cur) => {
      return [Math.min(acc[0], cur[0]), Math.max(acc[1], cur[1])];
    });

    cnnLayerMinMax.push({min: aggregatedExtent[0], max: aggregatedExtent[1]});
    let maxAbs = Math.max(Math.abs(aggregatedExtent[0]), Math.abs(aggregatedExtent[1]));
    let range = 2 * (0.1 + Math.round(maxAbs * 1000) / 1000);
    if (curLayer[0].type === 'input' || curLayer[0].type === 'sigmoid' ||
      curLayer[0].type === 'output') {
      range = 1;
    }
    cnnLayerRangesLocal.push(range);
  }

  let maxHiddenRange = Math.max(...cnnLayerRangesLocal.slice(1, cnnLayerRangesLocal.length - 1));
  let cnnLayerRangesGlobal = cnnLayerRangesLocal.map((range, i) => {
    if (i === 0 || i === cnnLayerRangesLocal.length - 1) return 1;
    return maxHiddenRange;
  });

  // Module scale follows local scale in AE mode.
  let cnnLayerRangesComponent = [...cnnLayerRangesLocal];

  cnnLayerRanges.local = cnnLayerRangesLocal;
  cnnLayerRanges.module = cnnLayerRangesComponent;
  cnnLayerRanges.global = cnnLayerRangesGlobal;
  cnnLayerRanges.output = [0, 1];

  cnnLayerRangesStore.set(cnnLayerRanges);
  cnnLayerMinMaxStore.set(cnnLayerMinMax);
}