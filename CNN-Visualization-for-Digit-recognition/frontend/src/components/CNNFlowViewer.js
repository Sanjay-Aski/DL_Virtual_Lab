import React, { useEffect, useMemo, useRef } from 'react';
import * as d3 from 'd3';
import { getChannelMaps, matrixToDataUrl } from '../utils/imageTransforms';

const FIRST_NODE_Y = 88;
const LAST_NODE_Y = 390;
const BASE_SVG_WIDTH = 1120;
const STAGE_SPACING = 220; // Space between each stage
const SVG_HEIGHT = 460;
const MAX_FEATURE_NODES = 6;

function buildNodeCenters(stageIndex, count, stageXPositions, top = FIRST_NODE_Y, bottom = LAST_NODE_Y) {
  const safeCount = Math.max(count, 1);
  const x = stageXPositions[stageIndex];
  
  if (safeCount === 1) {
    return [{ x, y: (top + bottom) / 2 }];
  }

  const gap = (bottom - top) / (safeCount - 1);
  return Array.from({ length: safeCount }).map((_, index) => ({
    x,
    y: top + index * gap,
  }));
}

function averageActivation(map2D) {
  if (!Array.isArray(map2D) || map2D.length === 0) {
    return 0;
  }

  let total = 0;
  let count = 0;
  map2D.forEach((row) => {
    row.forEach((value) => {
      total += Math.abs(value);
      count += 1;
    });
  });

  return count ? total / count : 0;
}

function normalizeVector(values) {
  if (!values.length) {
    return [];
  }

  const maxValue = Math.max(...values);
  if (maxValue <= 0) {
    return values.map(() => 0);
  }

  return values.map((value) => value / maxValue);
}

function CNNFlowViewer({ originalImageUrl, featureMaps = {}, probabilities = [] }) {
  const svgRef = useRef(null);

  // Extract conv layer names dynamically, sorted numerically
  const convLayerNames = useMemo(() => {
    const names = Object.keys(featureMaps || {})
      .filter((name) => name.startsWith('conv'))
      .sort((a, b) => {
        const numA = parseInt(a.match(/\d+/)?.[0] || 0, 10);
        const numB = parseInt(b.match(/\d+/)?.[0] || 0, 10);
        return numA - numB;
      });
    return names;
  }, [featureMaps]);

  // Dynamically extract feature maps for each conv layer
  const convMaps = useMemo(() => {
    return convLayerNames.map((layerName) =>
      getChannelMaps(featureMaps?.[layerName], MAX_FEATURE_NODES)
    );
  }, [featureMaps, convLayerNames]);

  // Convert maps to images
  const convImages = useMemo(() => {
    return convMaps.map((maps) => maps.map((map2D) => matrixToDataUrl(map2D, 64)));
  }, [convMaps]);

  const outputNodes = useMemo(
    () => Array.from({ length: 10 }).map((_, digit) => ({ digit, value: probabilities[digit] ?? 0 })),
    [probabilities]
  );

  const outputMaxValue = useMemo(() => Math.max(...outputNodes.map((node) => node.value), 0), [outputNodes]);

  const stageStrengths = useMemo(() => {
    const convStrengths = convMaps.map((maps) =>
      normalizeVector(maps.map((map2D) => averageActivation(map2D)))
    );
    const outputStrength = outputMaxValue > 0 ? outputNodes.map((node) => node.value / outputMaxValue) : outputNodes.map(() => 0);

    return [[1], ...convStrengths, outputStrength];
  }, [convMaps, outputMaxValue, outputNodes]);

  const stageCounts = useMemo(() => {
    const counts = [
      originalImageUrl ? 1 : 0,
      ...convImages.map((images) => images.length),
      outputNodes.length,
    ];
    return counts;
  }, [originalImageUrl, convImages, outputNodes]);

  // Calculate SVG width based on number of stages
  const svgWidth = useMemo(() => {
    const numStages = 2 + convLayerNames.length; // input + convs + output
    return Math.max(BASE_SVG_WIDTH, 100 + numStages * STAGE_SPACING);
  }, [convLayerNames.length]);

  // Calculate x positions for each stage
  const stageXPositions = useMemo(() => {
    const numStages = 2 + convLayerNames.length; // input + convs + output
    const positions = [];
    const startX = 100;
    for (let i = 0; i < numStages; i++) {
      positions.push(startX + i * STAGE_SPACING);
    }
    return positions;
  }, [convLayerNames.length]);

  const hasData = stageCounts.some((count) => count > 0);

  const graphData = useMemo(() => {
    const predictedDigit = outputNodes.reduce(
      (bestIndex, node, nodeIndex, arr) => (node.value > arr[bestIndex].value ? nodeIndex : bestIndex),
      0
    );

    const stages = [
      {
        id: 'input',
        label: 'Input',
        type: 'image',
        nodes: originalImageUrl ? [{ id: 'input-0', image: originalImageUrl, strength: 1 }] : [],
      },
    ];

    // Dynamically add conv layers
    convLayerNames.forEach((layerName, index) => {
      const convNum = index + 1;
      stages.push({
        id: layerName,
        label: `Conv${convNum}`,
        type: 'image',
        nodes: convImages[index].map((image, imageIndex) => ({
          id: `${layerName}-${imageIndex}`,
          image,
          strength: stageStrengths[index + 1][imageIndex] ?? 0,
        })),
      });
    });

    // Add output stage
    stages.push({
      id: 'output',
      label: 'Output',
      type: 'output',
      nodes: outputNodes.map((node) => ({
        id: `output-${node.digit}`,
        digit: node.digit,
        value: node.value,
        strength: stageStrengths[stageStrengths.length - 1][node.digit] ?? 0,
        active: node.digit === predictedDigit,
      })),
    });

    return stages;
  }, [convImages, convLayerNames, originalImageUrl, outputNodes, stageStrengths]);

  useEffect(() => {
    if (!hasData || !svgRef.current) {
      return;
    }

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${svgWidth} ${SVG_HEIGHT}`);

    const stageLayouts = graphData.map((stage, stageIndex) => {
      const centers = buildNodeCenters(
        stageIndex,
        stage.nodes.length || 1,
        stageXPositions,
        stage.id === 'output' ? 80 : FIRST_NODE_Y,
        stage.id === 'output' ? 400 : LAST_NODE_Y
      );

      return {
        ...stage,
        nodes: stage.nodes.map((node, index) => ({ ...node, ...centers[index] })),
      };
    });

    const allLinks = [];
    stageLayouts.slice(0, -1).forEach((fromStage, stageIndex) => {
      const toStage = stageLayouts[stageIndex + 1];
      fromStage.nodes.forEach((fromNode) => {
        toStage.nodes.forEach((toNode) => {
          const strength = Math.sqrt(Math.max(fromNode.strength ?? 0, 0) * Math.max(toNode.strength ?? 0, 0));
          allLinks.push({ fromNode, toNode, strength });
        });
      });
    });

    const linkGroup = svg.append('g').attr('class', 'cnn-d3-links');
    const pathGenerator = d3
      .linkHorizontal()
      .x((d) => d.x)
      .y((d) => d.y);

    linkGroup
      .selectAll('path')
      .data(allLinks)
      .enter()
      .append('path')
      .attr('d', (d) => pathGenerator({ source: d.fromNode, target: d.toNode }))
      .attr('fill', 'none')
      .attr('stroke', (d) => `rgba(107, 114, 128, ${(0.08 + 0.52 * d.strength).toFixed(3)})`)
      .attr('stroke-width', (d) => 0.5 + 1.8 * d.strength);

    const stageGroup = svg.append('g').attr('class', 'cnn-d3-stages');
    stageGroup
      .selectAll('text.stage-label')
      .data(stageLayouts)
      .enter()
      .append('text')
      .attr('x', (d, index) => stageXPositions[index])
      .attr('y', 36)
      .attr('text-anchor', 'middle')
      .attr('font-size', 34)
      .attr('font-weight', 700)
      .attr('fill', '#111827')
      .style('font-size', '30px')
      .text((d) => d.label);

    const nodeGroup = svg.append('g').attr('class', 'cnn-d3-nodes');

    stageLayouts.forEach((stage) => {
      if (stage.type === 'image') {
        const groups = nodeGroup
          .selectAll(`g.${stage.id}-nodes`)
          .data(stage.nodes)
          .enter()
          .append('g')
          .attr('transform', (d) => `translate(${d.x}, ${d.y})`);

        groups
          .append('rect')
          .attr('x', -22)
          .attr('y', -22)
          .attr('width', 44)
          .attr('height', 44)
          .attr('rx', 8)
          .attr('fill', '#ffffff')
          .attr('stroke', '#cbd5e1')
          .attr('stroke-width', 1.2);

        groups
          .filter((d) => !!d.image)
          .append('image')
          .attr('href', (d) => d.image)
          .attr('x', -20)
          .attr('y', -20)
          .attr('width', 40)
          .attr('height', 40)
          .attr('preserveAspectRatio', 'none');
      }

      if (stage.type === 'output') {
        const groups = nodeGroup
          .selectAll('g.output-nodes')
          .data(stage.nodes)
          .enter()
          .append('g')
          .attr('transform', (d) => `translate(${d.x}, ${d.y})`);

        groups
          .append('text')
          .attr('x', -44)
          .attr('y', 4)
          .attr('text-anchor', 'end')
          .attr('font-weight', 700)
          .attr('fill', '#111827')
          .text((d) => d.digit);

        groups
          .append('rect')
          .attr('x', -38)
          .attr('y', -6)
          .attr('width', 78)
          .attr('height', 12)
          .attr('rx', 6)
          .attr('fill', '#e5e7eb');

        groups
          .append('rect')
          .attr('x', -38)
          .attr('y', -6)
          .attr('height', 12)
          .attr('rx', 6)
          .attr('width', (d) => Math.max(1, d.value * 78))
          .attr('fill', (d) => (d.active ? '#2563eb' : '#94a3b8'));
      }
    });
  }, [graphData, hasData, stageXPositions, svgWidth]);

  return (
    <section className="card cnn-flow-card">
      <div className="feature-header">
        <h2>CNN Connected Layer View</h2>
        <span className="feature-help" title="Shows how information flows through connected CNN stages.">?</span>
      </div>

      {!hasData ? (
        <p className="hint">Run a prediction to visualize connected CNN layers.</p>
      ) : (
        <div className="cnn-flow-scroll">
          <div className="cnn-flow-canvas">
            <svg ref={svgRef} width={svgWidth} height={SVG_HEIGHT} className="cnn-d3-svg" aria-hidden="true" />
          </div>
        </div>
      )}
    </section>
  );
}

export default CNNFlowViewer;
