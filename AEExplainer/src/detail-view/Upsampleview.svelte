<script>
  import UpsampleAnimator from './UpsampleAnimator.svelte';
  import { createEventDispatcher } from 'svelte';

  export let input;
  export let output;
  export let factor = 2;
  export let dataRange;
  export let isExited;

  const dispatch = createEventDispatcher();
  let isPaused = false;

  function handleClickPause() {
    isPaused = !isPaused;
  }

  function handlePauseFromInteraction(event) {
    isPaused = event.detail.text;
  }

  function handleClickX() {
    dispatch('message', { text: true });
  }

  function handleScroll() {
    let svgHeight = Number(d3.select('#cnn-svg').style('height').replace('px', '')) + 150;
    let scroll = new SmoothScroll('a[href*="#"]', {offset: -svgHeight});
    let anchor = document.querySelector(`#article-pooling`);
    scroll.animateScroll(anchor);
  }

  function handleControlKeydown(event, callback) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      callback();
    }
  }
</script>

<style>
  .control-pannel {
    display: flex;
    position: relative;
    flex-direction: column;
    align-items: center;
  }

  .buttons {
    cursor: pointer;
    position: absolute;
    top: 0px;
    right: 0px;
  }

  .control-button {
    color: gray;
    font-size: 15px;
    opacity: 0.4;
    cursor: pointer;
  }

  .control-button:not(:first-child) {
    margin-left: 5px;
  }

  .annotation {
    display: flex;
    align-items: center;
    justify-content: center;
    padding-left: 10px;
    font-size: 12px;
  }

  .annotation > img {
    width: 17px;
    margin-right: 5px;
  }

  .control-button:hover {
    opacity: 0.8;
  }

  .box {
    padding: 5px 15px 10px 15px;
  }

  .container {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .title-text {
    font-size: 1.2em;
    font-weight: 500;
    color: #4a4a4a;
  }
</style>

{#if !isExited}
  <div class="container">
    <div class="box">
      <div class="control-pannel">
        <div class="title-text">
          Upsampling
        </div>

        <div class="buttons">
          <div class="control-button"
            on:click={handleScroll}
            on:keydown={(event) => handleControlKeydown(event, handleScroll)}
            role="button"
            tabindex="0"
            title="Jump to article section">
            <i class="fas fa-info-circle"></i>
          </div>

          <div class="play-button control-button"
            on:click={handleClickPause}
            on:keydown={(event) => handleControlKeydown(event, handleClickPause)}
            role="button"
            tabindex="0"
            title="Play animation">
            {@html isPaused ?
              '<i class="fas fa-play-circle play-icon"></i>' :
              '<i class="fas fa-pause-circle"></i>'}
          </div>

          <div class="delete-button control-button"
            on:click={handleClickX}
            on:keydown={(event) => handleControlKeydown(event, handleClickX)}
            role="button"
            tabindex="0"
            title="Close">
            <i class="fas control-icon fa-times-circle"></i>
          </div>
        </div>
      </div>

      <div class="container is-centered is-vcentered">
        <UpsampleAnimator on:message={handlePauseFromInteraction}
          image={input} output={output} factor={factor}
          isPaused={isPaused} dataRange={dataRange}/>
      </div>

      <div class="annotation">
        <img src='PUBLIC_URL/assets/img/pointer.svg' alt='pointer icon'>
        <div class="annotation-text">
          <span style="font-weight:600">Hover over</span> the matrices to inspect one repeated block.
        </div>
      </div>
    </div>
  </div>
{/if}
