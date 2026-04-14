/* global d3 */

import {
  svgStore, cnnStore, nodeCoordinateStore, hoverInfoStore,
  detailedModeStore, hSpaceAroundGapStore
} from '../stores.js';
import { getInputKnot } from './draw-utils.js';
import { moveLayerX, addOverlayGradient } from './intermediate-utils.js';
import { addOverlayRect } from './intermediate-draw.js';
import { overviewConfig } from '../config.js';

const nodeLength = overviewConfig.nodeLength;
const svgPaddings = overviewConfig.svgPaddings;
const gapRatio = overviewConfig.gapRatio;

let svg = undefined;
svgStore.subscribe(value => { svg = value; });

let cnn = undefined;
cnnStore.subscribe(value => { cnn = value; });

let nodeCoordinate = undefined;
nodeCoordinateStore.subscribe(value => { nodeCoordinate = value; });

let detailedMode = undefined;
detailedModeStore.subscribe(value => { detailedMode = value; });

let hSpaceAroundGap = undefined;
hSpaceAroundGapStore.subscribe(value => { hSpaceAroundGap = value; });

const toNumber = (value) => {
  if (Array.isArray(value)) return 0;
  if (value === undefined || value === null) return 0;
  return Number(value);
};

const clampNonNegative = (value) => Math.max(0, Number(value) || 0);

const findLayerIndex = (layerName) => {
  for (let i = 0; i < cnn.length; i++) {
    if (cnn[i] && cnn[i][0] && cnn[i][0].layerName === layerName) {
      return i;
    }
  }
  return -1;
};

export const drawFcToUnflatten = (d, nodeIndex, width, height) => {
  if (!svg || !cnn || !nodeCoordinate) return;

  let intermediateLayer = svg.select('.intermediate-layer');
  if (intermediateLayer.empty()) {
    intermediateLayer = svg.append('g')
      .attr('class', 'intermediate-layer')
      .style('opacity', 1);
  }

  intermediateLayer.selectAll('.reshape-flow-layer').remove();

  let curLayerIndex = findLayerIndex(d.layerName);
  if (curLayerIndex < 2) return;

  let bottleneckIndex = findLayerIndex('bottleneck');
  if (bottleneckIndex < 0) {
    bottleneckIndex = curLayerIndex - 1;
  }
  let fcIndex = curLayerIndex - 1;

  let selectedLinks = (d.inputLinks || [])
    .filter(link => link && link.source && Array.isArray(link.weight) && link.weight.length >= 3)
    .sort((a, b) => a.weight[2] - b.weight[2])
    .slice(0, 49);
  if (selectedLinks.length === 0) return;

  let fcNodes = selectedLinks.map(link => link.source);
  let bottleneckNodes = cnn[bottleneckIndex];
  if (!bottleneckNodes || bottleneckNodes.length === 0) return;
  if (!nodeCoordinate[bottleneckIndex] || !nodeCoordinate[bottleneckIndex][0]) return;
  if (!nodeCoordinate[curLayerIndex] || !nodeCoordinate[curLayerIndex][nodeIndex]) return;
  if (!nodeCoordinate[fcIndex] || nodeCoordinate[fcIndex].length === 0) return;

  let bottleneckX = nodeCoordinate[bottleneckIndex][0].x;
  let outputX = nodeCoordinate[curLayerIndex][nodeIndex].x;

  svg.select('g.edge-group').style('visibility', 'hidden');

  // Base overview layout uses a "long gap" before conv and bottleneck layers.
  // max_pool_1->conv_2, max_pool_2->bottleneck and upsample_1->conv_3 all use it.
  // Force bottleneck->unflatten to exactly this same long-gap spacing.
  let longGap = hSpaceAroundGap * gapRatio;
  let targetUnflattenX = bottleneckX + longGap;
  let shift = targetUnflattenX - outputX;

  // Keep bottleneck and all layers to its left fixed; move unflatten and
  // everything to the right so only bottleneck <-> unflatten spacing changes.
  for (let li = curLayerIndex; li < cnn.length; li++) {
    if (!nodeCoordinate[li] || !nodeCoordinate[li][0]) { continue; }
    moveLayerX({
      layerIndex: li,
      targetX: nodeCoordinate[li][0].x + shift,
      disable: true,
      delay: 0,
      opacity: li === curLayerIndex ? 0.2 : undefined,
      specialIndex: li === curLayerIndex ? nodeIndex : undefined
    });
  }
  outputX = targetUnflattenX;

  addOverlayGradient('overlay-gradient-reshape', [
    {offset: '0%', color: 'rgb(250, 250, 250)', opacity: 0.88},
    {offset: '100%', color: 'rgb(250, 250, 250)', opacity: 1}
  ]);
  addOverlayRect(
    'overlay-gradient-reshape',
    bottleneckX + nodeLength + hSpaceAroundGap * 0.4,
    0,
    Math.max(0, outputX - bottleneckX),
    (height || 0) + svgPaddings.top + svgPaddings.bottom
  );

  let leftX = bottleneckX + nodeLength + Math.max(20, (outputX - bottleneckX - nodeLength) * 0.15);
  let midX = leftX + (outputX - leftX - nodeLength) * 0.52;
  let matrixX = midX - 10;
  let topY = nodeCoordinate[fcIndex][0].y;
  let bottomY = nodeCoordinate[fcIndex][nodeCoordinate[fcIndex].length - 1].y + nodeLength;
  let rowHeight = (bottomY - topY) / Math.max(1, fcNodes.length);
  let linkGen = d3.linkHorizontal().x(v => v.x).y(v => v.y);

  let layer = intermediateLayer.append('g')
    .attr('class', 'reshape-flow-layer')
    .style('opacity', 0);

  let fcToTarget = [];
  let fcRects = [];

  fcNodes.forEach((node, idx) => {
    let cy = topY + idx * rowHeight + rowHeight / 2;
    let row = node.index % 7;
    let col = Math.floor((node.index % 49) / 7);

    fcRects.push({
      idx,
      row,
      col,
      x: matrixX,
      y: topY + idx * rowHeight,
      value: toNumber(node.output),
      node
    });

    fcToTarget.push({
      source: { x: matrixX + 11, y: cy },
      target: { x: outputX - 4, y: nodeCoordinate[curLayerIndex][nodeIndex].y + nodeLength / 2 },
      className: idx === 0 || idx === 48 ? 'reshape-edge-solid' : 'reshape-edge-fade'
    });
  });

  // Draw top and bottom detail strips with abstract middle, mirroring flatten style.
  let topRows = fcRects.slice(0, 7);
  let bottomRows = fcRects.slice(42, 49);
  let middleRows = fcRects.slice(7, 42);

  let colorScale = d3.scaleLinear()
    .domain(d3.extent(fcRects.map(v => v.value)))
    .range(['#f2f2f2', '#7bccc4']);

  layer.selectAll('rect.fc-row-top')
    .data(topRows)
    .enter()
    .append('rect')
    .attr('class', 'fc-row-top')
    .attr('x', r => r.x)
    .attr('y', r => r.y)
    .attr('width', 11)
    .attr('height', rowHeight * 0.92)
    .style('fill', r => colorScale(r.value))
    .style('cursor', 'crosshair')
    .on('mouseover', r => {
      hoverInfoStore.set({ show: true, text: `fc_layer[${r.node.index}] = ${r.value.toFixed(4)}` });
    })
    .on('mouseleave', () => hoverInfoStore.set({ show: false, text: '' }))
    .on('click', () => { d3.event.stopPropagation(); });

  layer.selectAll('rect.fc-row-bottom')
    .data(bottomRows)
    .enter()
    .append('rect')
    .attr('class', 'fc-row-bottom')
    .attr('x', r => r.x)
    .attr('y', r => r.y)
    .attr('width', 11)
    .attr('height', rowHeight * 0.92)
    .style('fill', r => colorScale(r.value))
    .style('cursor', 'crosshair')
    .on('mouseover', r => {
      hoverInfoStore.set({ show: true, text: `fc_layer[${r.node.index}] = ${r.value.toFixed(4)}` });
    })
    .on('mouseleave', () => hoverInfoStore.set({ show: false, text: '' }))
    .on('click', () => { d3.event.stopPropagation(); });

  let middleBins = [];
  for (let i = 0; i < 7; i++) {
    let bin = middleRows.slice(i * 5, (i + 1) * 5);
    middleBins.push({
      y: bin.length > 0 ? bin[0].y : topY,
      h: Math.max(2, rowHeight * Math.max(1, bin.length) * 0.75),
      value: d3.mean(bin.map(v => v.value))
    });
  }

  layer.selectAll('rect.fc-row-middle')
    .data(middleBins)
    .enter()
    .append('rect')
    .attr('class', 'fc-row-middle')
    .attr('x', matrixX + 2)
    .attr('y', r => r.y)
    .attr('width', 7)
    .attr('height', r => r.h)
    .style('fill', '#E5E5E5');

  let bottleneckEdgeData = [];
  bottleneckNodes.forEach((bn, bi) => {
    let by = nodeCoordinate[bottleneckIndex][bi].y + nodeLength / 2;
    let fcSampleIndices = [0, 8, 16, 24, 32, 40, 48];
    fcSampleIndices.forEach(fi => {
      let fcNode = fcNodes[fi];
      let weight = toNumber(fcNode.inputLinks && fcNode.inputLinks[bi] ? fcNode.inputLinks[bi].weight : 0);
      let fcy = topY + fi * rowHeight + rowHeight / 2;
      bottleneckEdgeData.push({
        source: { x: nodeCoordinate[bottleneckIndex][bi].x + nodeLength + 3, y: by },
        target: { x: matrixX - 3, y: fcy },
        weight
      });
    });
  });

  layer.append('g')
    .attr('class', 'reshape-bottleneck-edges')
    .selectAll('path')
    .data(bottleneckEdgeData)
    .enter()
    .append('path')
    .attr('d', e => linkGen({ source: e.source, target: e.target }))
    .style('fill', 'none')
    .style('stroke', '#ECECEC')
    .style('stroke-width', 0.6)
    .style('opacity', 0)
    .each(function() {
      let len = this.getTotalLength();
      d3.select(this)
        .attr('stroke-dasharray', `${len} ${len}`)
        .attr('stroke-dashoffset', len)
        .transition('reshape-stage-1')
        .delay(100)
        .duration(550)
        .style('opacity', 1)
        .attr('stroke-dashoffset', 0);
    });

  layer.append('g')
    .attr('class', 'reshape-fc-output-edges')
    .selectAll('path')
    .data(fcToTarget)
    .enter()
    .append('path')
    .attr('d', e => linkGen({ source: e.source, target: e.target }))
    .style('fill', 'none')
    .style('stroke', e => e.className === 'reshape-edge-solid' ? '#D8D8D8' : '#ECECEC')
    .style('stroke-width', e => e.className === 'reshape-edge-solid' ? 1 : 0.6)
    .style('opacity', 0)
    .each(function() {
      let len = this.getTotalLength();
      d3.select(this)
        .attr('stroke-dasharray', `${len} ${len}`)
        .attr('stroke-dashoffset', len)
        .transition('reshape-stage-2')
        .delay(620)
        .duration(620)
        .style('opacity', 1)
        .attr('stroke-dashoffset', 0);
    });

  layer.append('path')
    .attr('d', linkGen({
      source: { x: outputX - 4, y: nodeCoordinate[curLayerIndex][nodeIndex].y + nodeLength / 2 },
      target: getInputKnot(nodeCoordinate[curLayerIndex][nodeIndex])
    }))
    .style('fill', 'none')
    .style('stroke', '#D8D8D8')
    .style('stroke-width', 1);

  let label = layer.append('g')
    .attr('class', 'layer-label')
    .classed('hidden', detailedMode)
    .attr('transform', `translate(${matrixX + 5}, ${(svgPaddings.top + 24)})`)
    .style('cursor', 'help');

  label.append('text')
    .style('text-anchor', 'middle')
    .style('dominant-baseline', 'middle')
    .style('opacity', 0.8)
    .style('font-weight', 800)
    .text('reshape');

  let annotation = svg.select('.intermediate-layer-annotation');
  if (!annotation.empty()) {
    annotation.append('g')
      .attr('class', 'reshape-annotation')
      .append('text')
      .attr('class', 'annotation-text')
      .attr('x', matrixX - 95)
      .attr('y', topY + 25)
      .style('text-anchor', 'start')
      .style('dominant-baseline', 'hanging')
      .text('49 fc_layer predecessors are rearranged')
      .append('tspan')
      .attr('x', matrixX - 95)
      .attr('dy', '1.2em')
      .text('into the selected unflatten channel map.');
  }

  layer.append('rect')
    .attr('x', leftX - 12)
    .attr('y', topY - 8)
    .attr('width', clampNonNegative(outputX - leftX + 20))
    .attr('height', bottomY - topY + 16)
    .style('fill', 'transparent')
    .style('pointer-events', 'all')
    .on('click', () => { d3.event.stopPropagation(); });

  layer.transition('reshape-fade-in')
    .duration(320)
    .style('opacity', 1);
};
