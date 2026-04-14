/* global d3 */

const layerColorScales = {
  input: [d3.interpolateGreys, d3.interpolateGreys, d3.interpolateGreys],
  conv: d3.interpolateRdBu,
  relu: d3.interpolateRdBu,
  pool: d3.interpolateRdBu,
  upsample: d3.interpolateRdBu,
  sigmoid: d3.interpolateRdBu,
  reshape: d3.interpolateRdBu,
  fc: d3.interpolateGreys,
  bottleneck: d3.interpolateOranges,
  output: d3.interpolateGreys,
  weight: d3.interpolateBrBG,
  logit: d3.interpolateOranges
};

let nodeLength = 52;

export const overviewConfig = {
  nodeLength : nodeLength,
  plusSymbolRadius : nodeLength / 5,
  numLayers : 17,
  edgeOpacity : 0.8,
  edgeInitColor : 'rgb(175, 175, 175)',
  edgeHoverColor : 'rgb(130, 130, 130)',
  edgeHoverOuting : false,
  edgeStrokeWidth : 0.7,
  intermediateColor : 'rgb(175, 175, 175)',
  layerColorScales: layerColorScales,
  svgPaddings: {top: 25, bottom: 25, left: 50, right: 50},
  kernelRectLength: 8/3,
  gapRatio: 4,
  overlayRectOffset: 12,
  classLists: ['z0', 'z1', 'z2', 'z3', 'z4', 'z5', 'z6', 'z7', 'z8', 'z9']
};