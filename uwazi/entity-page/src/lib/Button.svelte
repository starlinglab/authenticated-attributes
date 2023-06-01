<!-- Shared styling for buttons -->

<script>
  export let border = false;
</script>

<button on:click type="button" class:border><slot /></button>

{#if import.meta.env.PROD}
  <style>
    button {
      font-size: 0.85em !important;
    }
  </style>
{/if}

<style>
  button {
    text-transform: uppercase;
    color: var(--theme1);
    font-weight: bold;
    display: inline-block;
    border: none;
    background-color: transparent;
    border-radius: 0.3em;
    padding: 0.5em;
    cursor: pointer;
  }
  button:hover {
    background-color: var(--theme1-hover);
  }
  button:active {
    background-color: var(--theme1-active);
    color: white;
  }
  .border {
    border: 2px solid var(--theme-border);
  }
</style>
