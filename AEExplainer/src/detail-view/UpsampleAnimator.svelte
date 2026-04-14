<script>
  import { createEventDispatcher } from 'svelte';
  import { array1d, getVisualizationSizeConstraint, gridData } from './DetailviewUtils.js';
  import Dataview from './Dataview.svelte';

  export let image;
  export let output;
  export let factor = 2;
  export let isPaused;
  export let dataRange;

  const dispatch = createEventDispatcher();

  let inputHighlights = array1d(image.length * image.length, () => false);
  let outputHighlights = array1d(output.length * output.length, () => false);
  let inputSlice = gridData([[0]]);
  let outputSlice = gridData([[0, 0], [0, 0]]);
  let interval;
  let counter = 0;

  const updateFocus = (animatedH, animatedW) => {
    inputHighlights = array1d(image.length * image.length, () => false);
    outputHighlights = array1d(output.length * output.length, () => false);

    inputHighlights[animatedH * image.length + animatedW] = true;

    let outputStartH = animatedH * factor;
    let outputStartW = animatedW * factor;
    for (let r = 0; r < factor; r++) {
      for (let c = 0; c < factor; c++) {
        let outH = outputStartH + r;
        let outW = outputStartW + c;
        outputHighlights[outH * output.length + outW] = true;
      }
    }

    inputSlice = gridData([[image[animatedH][animatedW]]]);

    let outPatch = [];
    for (let r = 0; r < factor; r++) {
      let row = [];
      for (let c = 0; c < factor; c++) {
        row.push(output[outputStartH + r][outputStartW + c]);
      }
      outPatch.push(row);
    }
    outputSlice = gridData(outPatch);
  }

  const startAnimation = () => {
    if (interval) clearInterval(interval);
    counter = 0;
    interval = setInterval(() => {
      if (isPaused) return;
      let flatIndex = counter % (image.length * image.length);
      let animatedH = Math.floor(flatIndex / image.length);
      let animatedW = flatIndex % image.length;
      updateFocus(animatedH, animatedW);
      counter++;
    }, 250);
  }

  function handleMouseover(event) {
    let animatedH = event.detail.hoverH;
    let animatedW = event.detail.hoverW;
    updateFocus(animatedH, animatedW);
    isPaused = true;
    dispatch('message', { text: isPaused });
  }

  startAnimation();
  let gridImage = gridData(image);
  let gridOutput = gridData(output);

  $: {
    startAnimation();
    gridImage = gridData(image);
    gridOutput = gridData(output);
  }
</script>

<style>
  .column {
    padding: 5px;
  }
</style>

<div class="column has-text-centered">
  <div class="header-text">
    Input ({image.length}, {image[0].length})
  </div>
  <Dataview on:message={handleMouseover} data={gridImage} highlights={inputHighlights}
    outputLength={image.length} isKernelMath={false}
    constraint={getVisualizationSizeConstraint(image.length)} dataRange={dataRange} stride={1}/>
</div>

<div class="column has-text-centered">
  <div style="display: flex; align-items: center; justify-content: center; gap: 5px;">
    <span>repeat(</span>
    <Dataview data={inputSlice} highlights={outputHighlights} isKernelMath={true}
      constraint={20} dataRange={dataRange}/>
    <span>) </span>
    <span>=</span>
    <Dataview data={outputSlice} highlights={outputHighlights} isKernelMath={true}
      constraint={20} dataRange={dataRange}/>
  </div>
</div>

<div class="column has-text-centered">
  <div class="header-text">
    Output ({output.length}, {output[0].length})
  </div>
  <Dataview on:message={handleMouseover} data={gridOutput} highlights={outputHighlights}
    outputLength={output.length} isKernelMath={false}
    constraint={getVisualizationSizeConstraint(output.length)} dataRange={dataRange} stride={1}/>
</div>
