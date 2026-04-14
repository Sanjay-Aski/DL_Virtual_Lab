/* global d3, SmoothScroll */

import {
  svgStore, vSpaceAroundGapStore, hSpaceAroundGapStore, cnnStore,
  nodeCoordinateStore, selectedScaleLevelStore, cnnLayerRangesStore,
  cnnLayerMinMaxStore, isInSoftmaxStore, softmaxDetailViewStore,
  hoverInfoStore, allowsSoftmaxAnimationStore, detailedModeStore
} from '../stores.js';
import {
  getOutputKnot, getInputKnot, gappedColorScale, getMidCoords
} from './draw-utils.js';
import {
  drawIntermediateLayerLegend, moveLayerX, addOverlayGradient,
  drawArrow
} from './intermediate-utils.js';
import { overviewConfig } from '../config.js';

// Configs
const layerColorScales = overviewConfig.layerColorScales;
const nodeLength = overviewConfig.nodeLength;
const plusSymbolRadius = overviewConfig.plusSymbolRadius;
const intermediateColor = overviewConfig.intermediateColor;
const edgeInitColor = overviewConfig.edgeInitColor;
const kernelRectLength = overviewConfig.kernelRectLength;
const svgPaddings = overviewConfig.svgPaddings;
const gapRatio = overviewConfig.gapRatio;
const classList = overviewConfig.classLists;
const formater = d3.format('.4f');
const fadedLayerOpacity = 0.15;

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

let isInSoftmax = undefined;
isInSoftmaxStore.subscribe( value => {isInSoftmax = value;} )

let allowsSoftmaxAnimation = undefined;
allowsSoftmaxAnimationStore.subscribe( value => {allowsSoftmaxAnimation = value;} )

let softmaxDetailViewInfo = undefined;
softmaxDetailViewStore.subscribe( value => {softmaxDetailViewInfo = value;} )

let hoverInfo = undefined;
hoverInfoStore.subscribe( value => {hoverInfo = value;} )

let detailedMode = undefined;
detailedModeStore.subscribe( value => {detailedMode = value;} )

let layerIndexDict = {
  'input': 0,
  'conv_1_1': 1,
  'relu_1_1': 2,
  'conv_1_2': 3,
  'relu_1_2': 4,
  'max_pool_1': 5,
  'conv_2_1': 6,
  'relu_2_1': 7,
  'conv_2_2': 8,
  'relu_2_2': 9,
  'max_pool_2': 10,
  'output': 11
}

let hasInitialized = false;
let logits = [];
let flattenFactoredFDict = {};

const moveLegend = (d, i, g, moveX, duration, restore) => {
  let legend = d3.select(g[i]);

  if (!restore) {
    let previousTransform = legend.attr('transform');
    let previousLegendX = +previousTransform.replace(/.*\(([\d\.]+),.*/, '$1');
    let previousLegendY = +previousTransform.replace(/.*,\s([\d\.]+)\)/, '$1');
  
    legend.transition('softmax')
      .duration(duration)
      .ease(d3.easeCubicInOut)
      .attr('transform', `translate(${previousLegendX - moveX}, ${previousLegendY})`);
    
    // If not in restore mode, we register the previous location to the DOM element
    legend.attr('data-preX', previousLegendX);
    legend.attr('data-preY', previousLegendY);
  } else {
    // Restore the recorded location
    let previousLegendX = +legend.attr('data-preX');
    let previousLegendY = +legend.attr('data-preY');

    legend.transition('softmax')
      .duration(duration)
      .ease(d3.easeCubicInOut)
      .attr('transform', `translate(${previousLegendX}, ${previousLegendY})`);
  }
}

const logitCircleMouseOverHandler = (i) => {
  // Update the hover info UI
  hoverInfoStore.set({
    show: true,
    text: `Logit: ${formater(logits[i])}`
  })

  // Highlight the text in the detail view
  softmaxDetailViewInfo.highlightI = i;
  softmaxDetailViewStore.set(softmaxDetailViewInfo);

  let logitLayer = svg.select('.logit-layer');
  let logitLayerLower = svg.select('.underneath');
  let intermediateLayer = svg.select('.intermediate-layer');

  // Highlight the circle
  logitLayer.select(`#logit-circle-${i}`)
    .style('stroke-width', 2);

  // Highlight the associated plus symbol
  intermediateLayer.select(`#plus-symbol-clone-${i}`)
    .style('opacity', 1)
    .select('circle')
    .style('fill', d => d.fill);
  
  // Raise the associated edge group
  logitLayerLower.select(`#logit-lower-${i}`).raise();

  // Highlight the associated edges
  logitLayerLower.selectAll(`.softmax-abstract-edge-${i}`)
    .style('stroke-width', 0.8)
    .style('stroke', edgeInitColor);

  logitLayerLower.selectAll(`.softmax-edge-${i}`)
    .style('stroke-width', 1)
    .style('stroke', edgeInitColor);
  
  logitLayerLower.selectAll(`.logit-output-edge-${i}`)
    .style('stroke-width', 3)
    .style('stroke', edgeInitColor);

  logitLayer.selectAll(`.logit-output-edge-${i}`)
    .style('stroke-width', 3)
    .style('stroke', edgeInitColor);
}

const logitCircleMouseLeaveHandler = (i) => {
  // screenshot
  // return;

  // Update the hover info UI
  hoverInfoStore.set({
    show: false,
    text: `Logit: ${formater(logits[i])}`
  })

  // Dehighlight the text in the detail view
  softmaxDetailViewInfo.highlightI = -1;
  softmaxDetailViewStore.set(softmaxDetailViewInfo);

  let logitLayer = svg.select('.logit-layer');
  let logitLayerLower = svg.select('.underneath');
  let intermediateLayer = svg.select('.intermediate-layer');

  // Restore the circle
  logitLayer.select(`#logit-circle-${i}`)
    .style('stroke-width', 1);

  // Restore the associated plus symbol
  intermediateLayer.select(`#plus-symbol-clone-${i}`)
    .style('opacity', 0.2);

  // Restore the associated edges
  logitLayerLower.selectAll(`.softmax-abstract-edge-${i}`)
    .style('stroke-width', 0.2)
    .style('stroke', edgeInitColor);

  logitLayerLower.selectAll(`.softmax-edge-${i}`)
    .style('stroke-width', 0.2)
    .style('stroke', edgeInitColor);

  logitLayerLower.selectAll(`.logit-output-edge-${i}`)
    .style('stroke-width', 1.2)
    .style('stroke', edgeInitColor);
  
  logitLayer.selectAll(`.logit-output-edge-${i}`)
    .style('stroke-width', 1.2)
    .style('stroke', edgeInitColor);
}

// This function is binded to the detail view in Overview.svelte
export const softmaxDetailViewMouseOverHandler = (event) => {
  logitCircleMouseOverHandler(event.detail.curI);
}

// This function is binded to the detail view in Overview.svelte
export const softmaxDetailViewMouseLeaveHandler = (event) => {
  logitCircleMouseLeaveHandler(event.detail.curI);
}

const drawLogitLayer = (arg) => {
  let curLayerIndex = arg.curLayerIndex,
    moveX = arg.moveX,
    softmaxLeftMid = arg.softmaxLeftMid,
    selectedI = arg.selectedI,
    intermediateX1 = arg.intermediateX1,
    intermediateX2 = arg.intermediateX2,
    pixelWidth = arg.pixelWidth,
    pixelHeight = arg.pixelHeight,
    topY = arg.topY,
    bottomY = arg.bottomY,
    softmaxX = arg.softmaxX,
    middleGap = arg.middleGap,
    middleRectHeight = arg.middleRectHeight,
    symbolGroup = arg.symbolGroup,
    symbolX = arg.symbolX,
    flattenRange = arg.flattenRange;

  let logitLayer = svg.select('.intermediate-layer')
    .append('g')
    .attr('class', 'logit-layer')
    .raise();
  
  // Minotr layer ordering change
  let tempClone = svg.select('.intermediate-layer')
    .select('.flatten-layer')
    .select('.plus-symbol')
    .clone(true)
    .attr('class', 'temp-clone-plus-symbol')
    .attr('transform', `translate(${symbolX - moveX},
      ${nodeCoordinate[curLayerIndex][selectedI].y + nodeLength / 2})`)
    // Cool hack -> d3 clone doesnt clone events, make the front object pointer
    // event transparent so users can trigger the underlying object's event!
    .style('pointer-events', 'none')
    .remove();

  let tempPlusSymbol = logitLayer.append(() => tempClone.node());
  
  svg.select('.softmax-symbol').raise();

  let logitLayerLower = svg.select('.underneath')
    .append('g')
    .attr('class', 'logit-layer-lower')
    .lower();
  
  // Use circles to encode logit values
  let centerX = softmaxLeftMid - moveX * 4 / 5;

  // Get all logits
  logits = [];
  for (let i = 0; i < cnn[layerIndexDict['output']].length; i++) {
    logits.push(cnn[layerIndexDict['output']][i].logit);
  }

  // Construct a color scale for the logit values
  let logitColorScale = d3.scaleLinear()
    .domain(d3.extent(logits))
    .range([0.2, 1]);
  
  // Draw the current logit circle before animation
  let logitRadius = 8;
  logitLayer.append('circle')
    .attr('class', 'logit-circle')
    .attr('id', `logit-circle-${selectedI}`)
    .attr('cx', centerX)
    .attr('cy', nodeCoordinate[curLayerIndex - 1][selectedI].y + nodeLength / 2)
    .attr('r', logitRadius)
    .style('fill', layerColorScales.logit(logitColorScale(logits[selectedI])))
    .style('cursor', 'crosshair')
    .style('pointer-events', 'all')
    .style('stroke', intermediateColor)
    .on('mouseover', () => logitCircleMouseOverHandler(selectedI))
    .on('mouseleave', () => logitCircleMouseLeaveHandler(selectedI))
    .on('click', () => { d3.event.stopPropagation() });
  
  // Show the logit circle corresponding label
  let softmaxDetailAnnotation = svg.select('.intermediate-layer-annotation')
    .select('.softmax-detail-annoataion');

  softmaxDetailAnnotation.select(`#logit-text-${selectedI}`)
    .style('opacity', 1);

  tempPlusSymbol.raise();

  // Draw another line from plus symbol to softmax symbol
  logitLayer.append('line')
    .attr('class', `logit-output-edge-${selectedI}`)
    .attr('x1', intermediateX2 - moveX + plusSymbolRadius * 2)
    .attr('x2', softmaxX)
    .attr('y1', nodeCoordinate[curLayerIndex - 1][selectedI].y + nodeLength / 2)
    .attr('y2', nodeCoordinate[curLayerIndex - 1][selectedI].y + nodeLength / 2)
    .style('fill', 'none')
    .style('stroke', edgeInitColor)
    .style('stroke-width', '1.2')
    .lower();

  // Add the flatten to logit links
  let linkData = [];
  let flattenLength = cnn.flatten.length / cnn[1].length;
  let underneathIs = [...Array(cnn[layerIndexDict['output']].length).keys()]
    .filter(d => d != selectedI);
  let curIIndex = 0;
  let linkGen = d3.linkHorizontal()
    .x(d => d.x)
    .y(d => d.y);

  const drawOneEdgeGroup = () => {
    // Only draw the new group if it is in the softmax mode
    if (!allowsSoftmaxAnimation) {
      svg.select('.underneath')
        .selectAll(`.logit-lower`)
        .remove();
      return;
    }

    let curI = underneathIs[curIIndex];

    let curEdgeGroup = svg.select('.underneath')
      .select(`#logit-lower-${curI}`);
    
    if (curEdgeGroup.empty()) {
      curEdgeGroup = svg.select('.underneath')
        .append('g')
        .attr('class', 'logit-lower')
        .attr('id', `logit-lower-${curI}`)
        .style('opacity', 0);

      // Hack: now show all edges, only draw 1/3 of the actual edges
      for (let f = 0; f < flattenLength; f += 3) {
        let loopFactors = [0, 9];
        loopFactors.forEach(l => {
          let factoredF = f + l * flattenLength;
    
          // Flatten -> output
          linkData.push({
            source: {x: intermediateX1 + pixelWidth + 3 - moveX,
              y:  l === 0 ? topY + f * pixelHeight : bottomY + f * pixelHeight},
            target: {x: intermediateX2 - moveX,
              y: nodeCoordinate[curLayerIndex][curI].y + nodeLength / 2},
            index: factoredF,
            weight: cnn.flatten[factoredF].outputLinks[curI].weight,
            color: edgeInitColor,
            width: 0.5,
            opacity: 1,
            class: `softmax-edge-${curI}`
          });
        });
      }

      // Draw middle rect to logits
      for (let vi = 0; vi < cnn[layerIndexDict['output']].length - 2; vi++) {
        linkData.push({
          source: {x: intermediateX1 + pixelWidth + 3 - moveX,
            y: topY + flattenLength * pixelHeight + middleGap * (vi + 1) +
            middleRectHeight * (vi + 0.5)},
          target: {x: intermediateX2 - moveX,
            y: nodeCoordinate[curLayerIndex][curI].y + nodeLength / 2},
          index: -1,
          color: edgeInitColor,
          width: 0.5,
          opacity: 1,
          class: `softmax-abstract-edge-${curI}`
        });
      }

      // Render the edges on the underneath layer
      curEdgeGroup.selectAll(`path.softmax-edge-${curI}`)
        .data(linkData)
        .enter()
        .append('path')
        .attr('class', d => d.class)
        .attr('id', d => `edge-${d.name}`)
        .attr('d', d => linkGen({source: d.source, target: d.target}))
        .style('fill', 'none')
        .style('stroke-width', d => d.width)
        .style('stroke', d => d.color === undefined ? intermediateColor : d.color)
        .style('opacity', d => d.opacity)
        .style('pointer-events', 'none');
    }
    
    let curNodeGroup = logitLayer.append('g')
      .attr('class', `logit-layer-${curI}`)
      .style('opacity', 0);
    
    // Draw the plus symbol
    let symbolClone = symbolGroup.clone(true)
      .style('opacity', 0);

    // Change the style of the clone
    symbolClone.attr('class', 'plus-symbol-clone')
      .attr('id', `plus-symbol-clone-${curI}`)
      .select('circle')
      .datum({fill: gappedColorScale(layerColorScales.weight,
        flattenRange, cnn[layerIndexDict['output']][curI].bias, 0.35)})
      .style('pointer-events', 'none')
      .style('fill', edgeInitColor);

    symbolClone.attr('transform', `translate(${symbolX},
      ${nodeCoordinate[curLayerIndex][curI].y + nodeLength / 2})`);
    
    // Draw the outter link using only merged path
    let outputEdgeD1 = linkGen({
      source: {
        x: intermediateX2 - moveX + plusSymbolRadius * 2,
        y: nodeCoordinate[curLayerIndex][curI].y + nodeLength / 2
      },
      target: {
        x: centerX + logitRadius,
        y: nodeCoordinate[curLayerIndex][curI].y + nodeLength / 2
      }
    });

    let outputEdgeD2 = linkGen({
      source: {
        x: centerX + logitRadius,
        y: nodeCoordinate[curLayerIndex][curI].y + nodeLength / 2
      },
      target: {
        x: softmaxX,
        y: nodeCoordinate[curLayerIndex][selectedI].y + nodeLength / 2
      }
    });

    // There are ways to combine these two paths into one. However, the animation
    // for merged path is not continuous, so we use two saperate paths here.

    let outputEdge1 = logitLayerLower.append('path')
      .attr('class', `logit-output-edge-${curI}`)
      .attr('d', outputEdgeD1)
      .style('fill', 'none')
      .style('stroke', edgeInitColor)
      .style('stroke-width', '1.2');

    let outputEdge2 = logitLayerLower.append('path')
      .attr('class', `logit-output-edge-${curI}`)
      .attr('d', outputEdgeD2)
      .style('fill', 'none')
      .style('stroke', edgeInitColor)
      .style('stroke-width', '1.2');
    
    let outputEdgeLength1 = outputEdge1.node().getTotalLength();
    let outputEdgeLength2 = outputEdge2.node().getTotalLength();
    let totalLength = outputEdgeLength1 + outputEdgeLength2;
    let totalDuration = hasInitialized ? 500 : 800;
    let opacityDuration = hasInitialized ? 400 : 600;

    outputEdge1.attr('stroke-dasharray', outputEdgeLength1 + ' ' + outputEdgeLength1)
      .attr('stroke-dashoffset', outputEdgeLength1);
    
    outputEdge2.attr('stroke-dasharray', outputEdgeLength2 + ' ' + outputEdgeLength2)
      .attr('stroke-dashoffset', outputEdgeLength2);

    outputEdge1.transition('softmax-output-edge')
      .duration(outputEdgeLength1 / totalLength * totalDuration)
      .attr('stroke-dashoffset', 0);

    outputEdge2.transition('softmax-output-edge')
      .delay(outputEdgeLength1 / totalLength * totalDuration)
      .duration(outputEdgeLength2 / totalLength * totalDuration)
      .attr('stroke-dashoffset', 0);
    
    // Draw the logit circle
    curNodeGroup.append('circle')
      .attr('class', 'logit-circle')
      .attr('id', `logit-circle-${curI}`)
      .attr('cx', centerX)
      .attr('cy', nodeCoordinate[curLayerIndex - 1][curI].y + nodeLength / 2)
      .attr('r', 7)
      .style('fill', layerColorScales.logit(logitColorScale(logits[curI])))
      .style('stroke', intermediateColor)
      .style('cursor', 'crosshair')
      .on('mouseover', () => logitCircleMouseOverHandler(curI))
      .on('mouseleave', () => logitCircleMouseLeaveHandler(curI))
      .on('click', () => { d3.event.stopPropagation() });
    
    // Show the element in the detailed view
    softmaxDetailViewInfo.startAnimation = {
      i: curI,
      duration: opacityDuration,
      // Always show the animation
      hasInitialized: false
    };
    softmaxDetailViewStore.set(softmaxDetailViewInfo);

    // Show the elements with animation    
    curNodeGroup.transition('softmax-edge')
      .duration(opacityDuration)
      .style('opacity', 1);

    if ((selectedI < 3 && curI == 9) || (selectedI >= 3 && curI == 0)) {
      // Show the hover text
      softmaxDetailAnnotation.select('.softmax-detail-hover-annotation')
        .transition('softmax-edge')
        .duration(opacityDuration)
        .style('opacity', 1);
    }

    softmaxDetailAnnotation.select(`#logit-text-${curI}`)
      .transition('softmax-edge')
      .duration(opacityDuration)
      .style('opacity', 1);
    
    curEdgeGroup.transition('softmax-edge')
      .duration(opacityDuration)
      .style('opacity', 1)
      .on('end', () => {
        // Recursive animaiton
        curIIndex ++;
        if (curIIndex < underneathIs.length) {
          linkData = [];
          drawOneEdgeGroup();
        } else {
          hasInitialized = true;
          softmaxDetailViewInfo.hasInitialized = true;
          softmaxDetailViewStore.set(softmaxDetailViewInfo);
        }
      });
    
    symbolClone.transition('softmax-edge')
      .duration(opacityDuration)
      .style('opacity', 0.2);
  }

  // Show the softmax detail view
  let anchorElement = svg.select('.intermediate-layer')
    .select('.layer-label').node();
  let pos = getMidCoords(svg, anchorElement);
  let wholeSvg = d3.select('#cnn-svg');
  let svgYMid = +wholeSvg.style('height').replace('px', '') / 2;
  let detailViewTop = 100 + svgYMid - 192 / 2;

  const detailview = document.getElementById('detailview');
  detailview.style.top = `${detailViewTop}px`;
  detailview.style.left = `${pos.left - 490 - 50}px`;
  detailview.style.position = 'absolute';

  softmaxDetailViewStore.set({
    show: true,
    logits: logits,
    logitColors: logits.map(d => layerColorScales.logit(logitColorScale(d))),
    selectedI: selectedI,
    highlightI: -1,
    outputName: classList[selectedI],
    outputValue: cnn[layerIndexDict['output']][selectedI].output,
    startAnimation: {i: -1, duration: 0, hasInitialized: hasInitialized}
  })

  drawOneEdgeGroup();

  // Draw logit circle color scale
  drawIntermediateLayerLegend({
    legendHeight: 5,
    curLayerIndex: curLayerIndex,
    range: d3.extent(logits)[1] - d3.extent(logits)[0],
    minMax: {min: d3.extent(logits)[0], max: d3.extent(logits)[1]},
    group: logitLayer,
    width: softmaxX - (intermediateX2 + plusSymbolRadius * 2 - moveX + 5),
    gradientAppendingName: 'flatten-logit-gradient',
    gradientGap: 0.1,
    colorScale: layerColorScales.logit,
    x: intermediateX2 + plusSymbolRadius * 2 - moveX + 5,
    y: svgPaddings.top + vSpaceAroundGap * (10) + vSpaceAroundGap + 
      nodeLength * 10
  });

  // Draw logit layer label
  let logitLabel = logitLayer.append('g')
    .attr('class', 'layer-label')
    .classed('hidden', detailedMode)
    .attr('transform', () => {
      let x = centerX;
      let y = (svgPaddings.top + vSpaceAroundGap) / 2 + 5;
      return `translate(${x}, ${y})`;
    });

  logitLabel.append('text')
    .style('text-anchor', 'middle')
    .style('dominant-baseline', 'middle')
    .style('opacity', 0.8)
    .style('font-weight', 800)
    .text('logit');
}

const removeLogitLayer = () => {
  svg.select('.logit-layer').remove();
  svg.select('.logit-layer-lower').remove();
  svg.selectAll('.plus-symbol-clone').remove();

  // Instead of removing the paths, we hide them, so it is faster to load in
  // the future
  svg.select('.underneath')
    .selectAll('.logit-lower')
    .style('opacity', 0);

  softmaxDetailViewStore.set({
      show: false,
      logits: []
  })
}

const softmaxClicked = (arg) => {
  let curLayerIndex = arg.curLayerIndex,
    moveX = arg.moveX,
    symbolX = arg.symbolX,
    symbolY = arg.symbolY,
    outputX = arg.outputX,
    outputY = arg.outputY,
    softmaxLeftMid = arg.softmaxLeftMid,
    selectedI = arg.selectedI,
    intermediateX1 = arg.intermediateX1,
    intermediateX2 = arg.intermediateX2,
    pixelWidth = arg.pixelWidth,
    pixelHeight = arg.pixelHeight,
    topY = arg.topY,
    bottomY = arg.bottomY,
    middleGap = arg.middleGap,
    middleRectHeight = arg.middleRectHeight,
    softmaxX = arg.softmaxX,
    softmaxTextY = arg.softmaxTextY,
    softmaxWidth = arg.softmaxWidth,
    symbolGroup = arg.symbolGroup,
    flattenRange = arg.flattenRange;

  let duration = 600;
  let centerX = softmaxLeftMid - moveX * 4 / 5;
  d3.event.stopPropagation();

  // Clean up the logit elemends before moving anything
  if (isInSoftmax) {
    allowsSoftmaxAnimationStore.set(false);
    removeLogitLayer();
  } else {
    allowsSoftmaxAnimationStore.set(true);
  }

  // Move the overlay gradient
  svg.select('.intermediate-layer-overlay')
    .select('rect.overlay')
    .transition('softmax')
    .ease(d3.easeCubicInOut)
    .duration(duration)
    .attr('transform', `translate(${isInSoftmax ? 0 : -moveX}, ${0})`);

  // Move the legends
  svg.selectAll(`.intermediate-legend-${curLayerIndex - 1}`)
    .each((d, i, g) => moveLegend(d, i, g, moveX, duration, isInSoftmax));

  svg.select('.intermediate-layer')
    .select(`.layer-label`)
    .each((d, i, g) => moveLegend(d, i, g, moveX, duration, isInSoftmax));

  svg.select('.intermediate-layer')
    .select(`.layer-detailed-label`)
    .each((d, i, g) => moveLegend(d, i, g, moveX, duration, isInSoftmax));

  // Also move all layers on the left
  for (let i = curLayerIndex - 1; i >= 0; i--) {
    let curLayer = svg.select(`g#cnn-layer-group-${i}`);
    let previousX = +curLayer.select('image').attr('x');
    let newX = isInSoftmax ? previousX + moveX : previousX - moveX;
    moveLayerX({
      layerIndex: i,
      targetX: newX,
      disable: true,
      delay: 0,
      transitionName: 'softmax',
      duration: duration
    });
  }

  // Hide the sum up annotation
  svg.select('.plus-annotation')
    .transition('softmax')
    .duration(duration)
    .style('opacity', isInSoftmax ? 1 : 0)
    .style('pointer-events', isInSoftmax ? 'all' : 'none');

  // Hide the softmax annotation
  let softmaxAnnotation = svg.select('.softmax-annotation')
    .style('pointer-events', isInSoftmax ? 'all' : 'none');
  
  let softmaxDetailAnnotation = softmaxAnnotation.selectAll('.softmax-detail-annoataion')
    .data([0])
    .enter()
    .append('g')
    .attr('class', 'softmax-detail-annoataion');

  // Remove the detailed annoatioan when quitting the detail view
  if (isInSoftmax) {
    softmaxAnnotation.selectAll('.softmax-detail-annoataion').remove();
  }

  softmaxAnnotation.select('.arrow-group')
    .transition('softmax')
    .duration(duration)
    .style('opacity', isInSoftmax ? 1 : 0);

  softmaxAnnotation.select('.annotation-text')
    .style('cursor', 'help')
    .style('pointer-events', 'all')
    .on('click', () => {
      d3.event.stopPropagation();
      // Scroll to the article element
      document.querySelector(`#article-softmax`).scrollIntoView({ 
        behavior: 'smooth' 
      });
    })
    .transition('softmax')
    .duration(duration)
    .style('opacity', isInSoftmax ? 1 : 0)
    .on('end', () => {
      if (!isInSoftmax) {
        // Add new annotation for the softmax button
        let textX = softmaxX + softmaxWidth / 2;
        let textY = softmaxTextY - 10;

        if (selectedI === 0) {
          textY = softmaxTextY + 70;
        }

        let text = softmaxDetailAnnotation.append('text')
          .attr('x', textX)
          .attr('y', textY)
          .attr('class', 'annotation-text softmax-detail-text')
          .style('dominant-baseline', 'baseline')
          .style('text-anchor', 'middle')
          .text('Normalize ');
        
        text.append('tspan') 
          .attr('dx', 1)
          .style('fill', '#E56014')
          .text('logits');
        
        text.append('tspan')
          .attr('dx', 1)
          .text(' into');

        text.append('tspan')
          .attr('x', textX)
          .attr('dy', '1.1em')
          .text('class probabilities');

        if (selectedI === 0) {
          drawArrow({
            group: softmaxDetailAnnotation,
            sx: softmaxX + softmaxWidth / 2 - 5,
            sy: softmaxTextY + 44,
            tx: softmaxX + softmaxWidth / 2,
            ty: textY - 12,
            dr: 50,
            hFlip: true,
            marker: 'marker-alt'
          });
        } else {
          drawArrow({
            group: softmaxDetailAnnotation,
            sx: softmaxX + softmaxWidth / 2 - 5,
            sy: softmaxTextY + 4,
            tx: softmaxX + softmaxWidth / 2,
            ty: symbolY - plusSymbolRadius - 4,
            dr: 50,
            hFlip: true,
            marker: 'marker-alt'
          });
        }

        // Add annotation for the logit layer label
        textX = centerX + 45;
        textY = (svgPaddings.top + vSpaceAroundGap) / 2 + 5;
        let arrowTX = centerX + 20;
        let arrowTY = (svgPaddings.top + vSpaceAroundGap) / 2 + 5;

        softmaxDetailAnnotation.append('g')
          .attr('class', 'layer-detailed-label')
          .attr('transform', () => {
            let x = centerX;
            let y = (svgPaddings.top + vSpaceAroundGap) / 2 - 5;
            return `translate(${x}, ${y})`;
          })
          .classed('hidden', !detailedMode)
          .append('text')
          // .attr('x', centerX)
          // .attr('y',  (svgPaddings.top + vSpaceAroundGap) / 2 - 6)
          .style('opacity', 0.7)
          .style('dominant-baseline', 'middle')
          .style('font-size', '12px')
          .style('font-weight', '800')
          .append('tspan')
          .attr('x', 0)
          .text('logit')
          .append('tspan')
          .attr('x', 0)
          .style('font-size', '8px')
          .style('font-weight', 'normal')
          .attr('dy', '1.5em')
          .text('(10)');

        softmaxDetailAnnotation.append('text')
          .attr('class', 'annotation-text')
          .attr('x', textX)
          .attr('y', (svgPaddings.top + vSpaceAroundGap) / 2 + 3)
          .style('text-anchor', 'start')
          .text('Before')
          .append('tspan')
          .attr('x', textX)
          .attr('dy', '1em')
          .text('normalization')


        drawArrow({
          group: softmaxDetailAnnotation,
          tx: arrowTX,
          ty: arrowTY,
          sx: textX - 6,
          sy: textY + 2,
          dr: 60,
          hFlip: false,
          marker: 'marker-alt'
        });

        softmaxDetailAnnotation.append('text')
          .attr('class', 'annotation-text')
          .attr('x', nodeCoordinate[layerIndexDict['output']][0].x - 35)
          .attr('y', (svgPaddings.top + vSpaceAroundGap) / 2 + 3)
          .style('text-anchor', 'end')
          .text('After')
          .append('tspan')
          .attr('x', nodeCoordinate[layerIndexDict['output']][0].x - 35)
          .attr('dy', '1em')
          .text('normalization')

        drawArrow({
          group: softmaxDetailAnnotation,
          tx: nodeCoordinate[layerIndexDict['output']][0].x - 8,
          ty: arrowTY,
          sx: nodeCoordinate[layerIndexDict['output']][0].x - 27,
          sy: textY + 2,
          dr: 60,
          hFlip: true,
          marker: 'marker-alt'
        });

        // Add annotation for the logit circle
        for (let i = 0; i < 10; i++) {
          softmaxDetailAnnotation.append('text')
            .attr('x', centerX)
            .attr('y', nodeCoordinate[curLayerIndex - 1][i].y + nodeLength / 2 + 8)
            .attr('class', 'annotation-text softmax-detail-text')
            .attr('id', `logit-text-${i}`)
            .style('text-anchor', 'middle')
            .style('dominant-baseline', 'hanging')
            .style('opacity', 0)
            .text(`${classList[i]}`);
        }

        let hoverTextGroup = softmaxDetailAnnotation.append('g')
          .attr('class', 'softmax-detail-hover-annotation')
          .style('opacity', 0);

        textX = centerX + 50;
        textY = nodeCoordinate[curLayerIndex - 1][0].y + nodeLength / 2;

        if (selectedI < 3) {
          textY = nodeCoordinate[curLayerIndex - 1][9].y + nodeLength / 2;
        }

        // Add annotation to prompt user to check the logit value
        let hoverText = hoverTextGroup.append('text')
          .attr('x', textX)
          .attr('y', textY)
          .attr('class', 'annotation-text softmax-detail-text softmax-hover-text')
          .style('text-anchor', 'start')
          .style('dominant-baseline', 'baseline')
          .append('tspan')
          .style('font-weight', 700)
          .style('dominant-baseline', 'baseline')
          .text(`Hover over `)
          .append('tspan')
          .style('font-weight', 400)
          .style('dominant-baseline', 'baseline')
          .text('to see');
        
        hoverText.append('tspan')
          .style('dominant-baseline', 'baseline')
          .attr('x', textX)
          .attr('dy', '1em')
          .text('its ');

        hoverText.append('tspan')
          .style('dominant-baseline', 'baseline')
          .attr('dx', 1)
          .style('fill', '#E56014')
          .text('logit');
        
        hoverText.append('tspan')
          .style('dominant-baseline', 'baseline')
          .attr('dx', 1)
          .text(' value');
        
        drawArrow({
          group: hoverTextGroup,
          tx: centerX + 15,
          ty: textY,
          sx: textX - 8,
          sy: textY + 2,
          dr: 60,
          hFlip: false
        });
      }
    })

  // Hide the annotation
  svg.select('.flatten-annotation')
    .transition('softmax')
    .duration(duration)
    .style('opacity', isInSoftmax ? 1 : 0)
    .style('pointer-events', isInSoftmax ? 'all' : 'none');

  // Move the left part of faltten layer elements
  let flattenLeftPart = svg.select('.flatten-layer-left');
  flattenLeftPart.transition('softmax')
    .duration(duration)
    .ease(d3.easeCubicInOut)
    .attr('transform', `translate(${isInSoftmax ? 0 : -moveX}, ${0})`)
    .on('end', () => {
      // Add the logit layer
      if (!isInSoftmax) {
        let logitArg = {
          curLayerIndex: curLayerIndex,
          moveX: moveX,
          softmaxLeftMid: softmaxLeftMid,
          selectedI: selectedI,
          intermediateX1: intermediateX1,
          intermediateX2: intermediateX2,
          pixelWidth: pixelWidth,
          pixelHeight: pixelHeight,
          topY: topY,
          bottomY: bottomY,
          middleGap: middleGap,
          middleRectHeight: middleRectHeight,
          softmaxX: softmaxX,
          symbolGroup: symbolGroup,
          symbolX: symbolX,
          flattenRange: flattenRange
        };
        drawLogitLayer(logitArg);
      }

      // Redraw the line from the plus symbol to the output node
      if (!isInSoftmax) {
        let newLine = flattenLeftPart.select('.edge-group')
          .append('line')
          .attr('class', 'symbol-output-line')
          .attr('x1', symbolX)
          .attr('y1', symbolY)
          .attr('x2', outputX + moveX)
          .attr('y2', outputY)
          .style('stroke-width', 1.2)
          .style('stroke', edgeInitColor)
          .style('opacity', 0);
        
        newLine.transition('softmax')
          .delay(duration / 3)
          .duration(duration * 2 / 3)
          .style('opacity', 1);
      } else {
        flattenLeftPart.select('.symbol-output-line').remove();
      }
      
      isInSoftmax = !isInSoftmax;
      isInSoftmaxStore.set(isInSoftmax);
    })
}

/**
 * Draw the flatten layer before output layer
 * @param {number} curLayerIndex Index of the selected layer
 * @param {object} d Bounded d3 data
 * @param {number} i Index of the selected node
 * @param {number} width CNN group width
 * @param {number} height CNN group height
 */
export const drawFlatten = (curLayerIndex, d, i, width, height) => {
  const clampNonNegative = (value) => Math.max(0, Number(value) || 0);
  const flattenLayer = cnn.flatten || [];
  if (!flattenLayer.length || !nodeCoordinate[curLayerIndex - 1]) {
    return;
  }

  svg.selectAll('.output-legend').classed('hidden', false);
  svg.select('g.edge-group').style('visibility', 'hidden');

  const prevLayerX = nodeCoordinate[curLayerIndex - 1][0].x;
  const curLayerX = nodeCoordinate[curLayerIndex][0].x;
  const desiredGap = nodeLength + hSpaceAroundGap * gapRatio;
  const leftX = prevLayerX - desiredGap;
  const longGap = hSpaceAroundGap * gapRatio;
  const nextLayerX = nodeCoordinate[curLayerIndex + 1] && nodeCoordinate[curLayerIndex + 1][0]
    ? nodeCoordinate[curLayerIndex + 1][0].x
    : curLayerX + longGap;
  const targetNextLayerX = curLayerX + longGap;
  const rightShift = targetNextLayerX - nextLayerX;
  const leftShift = Math.max(0, prevLayerX - leftX);

  moveLayerX({layerIndex: curLayerIndex - 1, targetX: leftX, disable: true, delay: 0});
  moveLayerX({
    layerIndex: curLayerIndex,
    targetX: curLayerX,
    disable: true,
    delay: 0,
    opacity: fadedLayerOpacity,
    specialIndex: i
  });

  for (let li = 0; li < curLayerIndex - 1; li++) {
    let leftTargetX = nodeCoordinate[li][0].x - leftShift;
    moveLayerX({
      layerIndex: li,
      targetX: leftTargetX,
      disable: true,
      delay: 0
    });

    svg.selectAll(`g#layer-label-${li}, g#layer-detailed-label-${li}`)
      .filter((d, ni, nodes) => !d3.select(nodes[ni]).classed('hidden'))
      .style('opacity', fadedLayerOpacity);
  }

  for (let li = curLayerIndex + 1; li < cnn.length; li++) {
    let targetX = nodeCoordinate[li][0].x + rightShift;
    moveLayerX({
      layerIndex: li,
      targetX: targetX,
      disable: true,
      delay: 0,
      opacity: fadedLayerOpacity
    });

    svg.selectAll(`g#layer-label-${li}, g#layer-detailed-label-${li}`)
      .filter((d, ni, nodes) => !d3.select(nodes[ni]).classed('hidden'))
      .style('opacity', fadedLayerOpacity);
  }

  // Keep expanded layers' headings fully visible.
  svg.selectAll(`g#layer-label-${curLayerIndex - 1}, g#layer-detailed-label-${curLayerIndex - 1},
    g#layer-label-${curLayerIndex}, g#layer-detailed-label-${curLayerIndex}`)
    .style('opacity', null);

  const stops = [
    {offset: '0%', color: 'rgb(250, 250, 250)', opacity: 1},
    {offset: '100%', color: 'rgb(250, 250, 250)', opacity: 0.86}
  ];
  addOverlayGradient('overlay-gradient-left', stops);

  let intermediateLayerOverlay = svg.append('g')
    .attr('class', 'intermediate-layer-overlay');

  intermediateLayerOverlay.append('rect')
    .attr('class', 'overlay')
    .style('fill', 'url(#overlay-gradient-left)')
    .style('stroke', 'none')
    .attr('width', clampNonNegative(leftX + svgPaddings.left - 14))
    .attr('height', height + svgPaddings.top + svgPaddings.bottom)
    .attr('x', -svgPaddings.left)
    .attr('y', 0)
    .style('opacity', 0)
    .transition('fade-in')
    .duration(300)
    .style('opacity', 1);

  let intermediateLayer = svg.append('g')
    .attr('class', 'intermediate-layer')
    .style('opacity', 0);

  const selectedNode = cnn[curLayerIndex][i];
  const selectedLinks = flattenLayer
    .map(flatNode => {
      const link = flatNode.outputLinks.find(outLink =>
        outLink.dest.layerName === selectedNode.layerName &&
        outLink.dest.index === selectedNode.index
      );
      if (!link) return null;
      return { flatNode, weight: link.weight };
    })
    .filter(Boolean)
    // Keep flatten features in channel blocks: [0..48], [49..97], ...
    // using the precomputed channel-major real index.
    .sort((a, b) => {
      let aIndex = Number.isFinite(a.flatNode.realIndex)
        ? a.flatNode.realIndex
        : a.flatNode.index;
      let bIndex = Number.isFinite(b.flatNode.realIndex)
        ? b.flatNode.realIndex
        : b.flatNode.index;
      return aIndex - bIndex;
    });

  const sourceData = selectedLinks.length > 0
    ? selectedLinks
    : flattenLayer.slice(0, Math.min(120, flattenLayer.length)).map(flatNode => ({
      flatNode,
      weight: 0
    }));

  const sampleCount = sourceData.length;
  const topY = nodeCoordinate[curLayerIndex - 1][0].y;
  const bottomY = nodeCoordinate[curLayerIndex - 1][nodeCoordinate[curLayerIndex - 1].length - 1].y + nodeLength;
  const stripX = leftX + nodeLength + hSpaceAroundGap * gapRatio * 0.8;
  const stripW = Math.max(8, nodeLength * 0.42);
  const symbolX = stripX + hSpaceAroundGap * gapRatio * 0.85;
  const symbolY = nodeCoordinate[curLayerIndex][i].y + nodeLength / 2;
  const rowH = Math.max(1.2, (bottomY - topY) / sampleCount);
  const preLayerDimension = cnn[curLayerIndex - 1][0].output.length;
  const preLayerGap = nodeLength / (2 * preLayerDimension);

  const sampled = sourceData.slice();

  const valExtent = d3.extent(sampled.map(entry => entry.flatNode.output));
  const valueRange = Math.max(Math.abs(valExtent[0] || 0), Math.abs(valExtent[1] || 0));
  const colorScale = layerColorScales.conv;

  const linkGen = d3.linkHorizontal().x(v => v.x).y(v => v.y);

  const strip = intermediateLayer.append('g').attr('class', 'flatten-layer');
  strip.selectAll('rect.flatten-strip-cell')
    .data(sampled)
    .enter()
    .append('rect')
    .attr('class', 'flatten-strip-cell')
    .attr('x', stripX)
    .attr('y', (entry, si) => topY + si * rowH)
    .attr('width', stripW)
    .attr('height', rowH)
    .style('fill', entry => colorScale(((entry.flatNode.output || 0) + valueRange) / Math.max(1e-6, 2 * valueRange)))
    .style('cursor', 'crosshair')
    .on('mouseover', entry => {
      hoverInfoStore.set({
        show: true,
        text: `flatten[${entry.flatNode.index}] = ${formater(entry.flatNode.output)}`
      });
    })
    .on('mouseleave', () => hoverInfoStore.set({show: false, text: ''}))
    .on('click', () => d3.event.stopPropagation());

  strip.selectAll('path.flatten-to-bottleneck')
    .data(sampled)
    .enter()
    .append('path')
    .attr('class', 'flatten-to-bottleneck')
    .attr('d', (entry, si) => linkGen({
      source: {x: stripX + stripW + 3, y: topY + si * rowH + rowH / 2},
      target: {x: symbolX - plusSymbolRadius - 2, y: symbolY}
    }))
    .style('fill', 'none')
    .style('stroke', entry => gappedColorScale(layerColorScales.weight, 2, entry.weight || 0, 0.25))
    .style('stroke-width', 0.8)
    .style('opacity', 0.8);

  // Render max_pool_2 -> flatten edges using flatten location metadata
  // (same mapping idea as the original CNN explainer implementation).
  const maxPoolToFlatten = sampled
    .map((entry, si) => {
      let inputLink = entry.flatNode && entry.flatNode.inputLinks
        ? entry.flatNode.inputLinks[0]
        : undefined;
      let loc = inputLink && Array.isArray(inputLink.weight)
        ? inputLink.weight
        : [0, 0];
      let row = loc[0] || 0;
      let preNodeIndex = inputLink && inputLink.source ? inputLink.source.index : 0;
      preNodeIndex = Math.max(0, Math.min(preNodeIndex, nodeCoordinate[curLayerIndex - 1].length - 1));
      return {
        source: {
          x: leftX + nodeLength + 3,
          y: nodeCoordinate[curLayerIndex - 1][preNodeIndex].y + (2 * row + 1) * preLayerGap
        },
        target: {
          x: stripX - 2,
          y: topY + si * rowH + rowH / 2
        }
      };
    });

  strip.selectAll('path.maxpool-to-flatten')
    .data(maxPoolToFlatten)
    .enter()
    .append('path')
    .attr('class', 'maxpool-to-flatten')
    .attr('d', e => linkGen({source: e.source, target: e.target}))
    .style('fill', 'none')
    .style('stroke', edgeInitColor)
    .style('stroke-width', 0.8)
    .style('opacity', 1);

  let symbolGroup = strip.append('g')
    .attr('class', 'plus-symbol')
    .attr('transform', `translate(${symbolX}, ${symbolY})`);

  symbolGroup.append('rect')
    .attr('x', -plusSymbolRadius)
    .attr('y', -plusSymbolRadius)
    .attr('width', 2 * plusSymbolRadius)
    .attr('height', 2 * plusSymbolRadius)
    .attr('rx', 3)
    .style('fill', 'none')
    .style('stroke', intermediateColor);

  symbolGroup.append('rect')
    .attr('x', -(plusSymbolRadius - 3))
    .attr('y', -0.5)
    .attr('width', 2 * (plusSymbolRadius - 3))
    .attr('height', 1)
    .style('fill', intermediateColor);

  symbolGroup.append('rect')
    .attr('x', -0.5)
    .attr('y', -(plusSymbolRadius - 3))
    .attr('width', 1)
    .attr('height', 2 * (plusSymbolRadius - 3))
    .style('fill', intermediateColor);

  strip.append('path')
    .attr('d', linkGen({
      source: {x: symbolX + plusSymbolRadius + 2, y: symbolY},
      // Shorten only this single edge (plus/bias -> bottleneck input).
      target: {x: nodeCoordinate[curLayerIndex][i].x - 2, y: symbolY}
    }))
    .style('fill', 'none')
    .style('stroke', edgeInitColor)
    .style('stroke-width', 1.2);

  const preRange = cnnLayerRanges[selectedScaleLevel][curLayerIndex - 1] || 1;
  drawIntermediateLayerLegend({
    legendHeight: 5,
    curLayerIndex,
    range: preRange,
    minMax: cnnLayerMinMax[curLayerIndex - 1],
    group: intermediateLayer,
    width: nodeLength + hSpaceAroundGap,
    x: leftX,
    y: svgPaddings.top + vSpaceAroundGap * (10) + vSpaceAroundGap + nodeLength * 10
  });

  svg.append('g')
    .attr('class', 'intermediate-layer-annotation')
    .style('opacity', 1)
    .append('text')
    .attr('class', 'annotation-text')
    .attr('x', stripX - 20)
    .attr('y', topY - 20)
    .style('text-anchor', 'start')
    .style('dominant-baseline', 'hanging')
    .text('flatten(784)');

  intermediateLayer.transition()
    .duration(320)
    .ease(d3.easeCubicInOut)
    .style('opacity', 1);
}