<!--
Adapted from https://svelte.dev/examples/modal
Modified so the modal appears below the mouse, not centered.`
-->

<script>
  export let showModal = false;
  export let pos = { x: 0, y: 0 };

  let dialog; // HTMLDialogElement

  $: if (dialog && showModal) {
    dialog.showModal();
    // Disable default button focus which looks bad
    dialog.querySelector("#buttons-div button:first-of-type").blur();
  }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<dialog
  bind:this={dialog}
  on:close={() => (showModal = false)}
  on:click|self={() => dialog.close()}
  style:left={pos.x}
  style:top={pos.y}
>
  <div on:click|stopPropagation>
    <div id="icon-div">
      <slot name="icon">
        <svg
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 496 512"
          ><!--! Font Awesome Pro 6.4.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2023 Fonticons, Inc. --><path
            d="M314.9 194.4v101.4h-28.3v120.5h-77.1V295.9h-28.3V194.4c0-4.4 1.6-8.2 4.6-11.3 3.1-3.1 6.9-4.7 11.3-4.7H299c4.1 0 7.8 1.6 11.1 4.7 3.1 3.2 4.8 6.9 4.8 11.3zm-101.5-63.7c0-23.3 11.5-35 34.5-35s34.5 11.7 34.5 35c0 23-11.5 34.5-34.5 34.5s-34.5-11.5-34.5-34.5zM247.6 8C389.4 8 496 118.1 496 256c0 147.1-118.5 248-248.4 248C113.6 504 0 394.5 0 256 0 123.1 104.7 8 247.6 8zm.8 44.7C130.2 52.7 44.7 150.6 44.7 256c0 109.8 91.2 202.8 203.7 202.8 103.2 0 202.8-81.1 202.8-202.8.1-113.8-90.2-203.3-202.8-203.3z"
          />
        </svg>
      </slot>
    </div>
    <div id="title-div">
      <slot name="title" />
    </div>
    <div id="content-div">
      <div style="display: inline-block; text-align: left;">
        <slot name="content" />
      </div>
    </div>
    <div id="buttons-div">
      <slot name="buttons" />
    </div>
  </div>
</dialog>

<style>
  dialog {
    max-width: 22em;
    border-radius: 0.2em;
    border: none;
    padding: 0;
    box-shadow: 0 4px 8px 0 rgba(0, 0, 0, 0.2), 0 6px 20px 0 rgba(0, 0, 0, 0.19);
    position: absolute;
    margin: 0;
  }
  dialog::backdrop {
    background: rgba(0, 0, 0, 0);
  }
  dialog > div {
    padding: 0.5em;
  }
  dialog[open] {
    animation: zoomin 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  @keyframes zoomin {
    from {
      transform: scale(0.95);
    }
    to {
      transform: scale(1);
    }
  }
  dialog[open]::backdrop {
    animation: fadein 0.2s ease-out;
  }
  @keyframes fadein {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  #icon-div {
    text-align: center;
    margin-top: 0.5em;
  }
  #icon-div :global(svg) {
    width: 1.2em;
    height: 1.2em;
    color: var(--theme1);
  }
  #title-div {
    text-align: center;
    margin: 1em 1em;
    overflow-wrap: break-word;
  }
  #content-div {
    margin: 0 2em 1em;
    font-size: 0.9em;
    color: grey;
    text-align: center;
  }
  #buttons-div {
    text-align: center;
  }
  #buttons-div :global(button) {
    text-transform: uppercase;
    color: var(--theme1);
    font-weight: bold;
    display: inline-block;
    border: none;
    background-color: rgba(0, 0, 0, 0);
    border-radius: 0.2em;
    padding: 0.5em;
  }
  #buttons-div :global(button:hover) {
    background-color: var(--theme1-hover);
  }
  #buttons-div :global(button:active) {
    background-color: var(--theme1-active);
    color: white;
  }
</style>
