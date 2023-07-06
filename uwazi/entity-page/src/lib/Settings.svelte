<!-- https://github.com/starlinglab/uwazi-hyperbee-prototype/issues/6 -->

<script>
  import { createEventDispatcher, onMount } from "svelte";
  import Button from "./Button.svelte";
  import { hyperbeeSources } from "./store.js";

  export let success; // null means unknown/untested (for sources only)

  const dispatch = createEventDispatcher();

  let sourcesCopy = [];
  let sourcesBackup = [];

  onMount(() => {
    // Operate on copy so unsaved changes don't affect $hyperbeeSources
    sourcesCopy = structuredClone($hyperbeeSources);
    // Backup of sources that never gets changed
    sourcesBackup = structuredClone($hyperbeeSources);
  });

  $: if (success) {
    // Reload data if sources are actually modified due to request success
    sourcesCopy = structuredClone($hyperbeeSources);
    sourcesBackup = structuredClone($hyperbeeSources);
  }
</script>

<h2>Sources</h2>
{#if success === false}
  <p>Sources will not be updated due to error, edit and try to save again.</p>
{/if}
{#if success === null}
  <p>Unsaved changes</p>
{/if}

<div id="sources-list">
  {#each sourcesCopy as { name, server }, i}
    <div class="source">
      <!-- svelte-ignore a11y-click-events-have-key-events -->
      <svg
        on:click={() => {
          success = null;
          sourcesCopy.splice(i + 1, 0, {
            name: "",
            server: "",
          });
          sourcesCopy = sourcesCopy; // Reactivity
        }}
        class="icon plus"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 448 512"
        ><!--! Font Awesome Pro 6.4.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2023 Fonticons, Inc. --><path
          d="M256 80c0-17.7-14.3-32-32-32s-32 14.3-32 32V224H48c-17.7 0-32 14.3-32 32s14.3 32 32 32H192V432c0 17.7 14.3 32 32 32s32-14.3 32-32V288H400c17.7 0 32-14.3 32-32s-14.3-32-32-32H256V80z"
        /></svg
      >
      <div class="input-container">
        <input
          class="name"
          type="text"
          placeholder="ACME Corp News"
          bind:value={name}
          on:input={() => (success = null)}
        />
        <input
          class="server"
          type="url"
          placeholder="https://example.com"
          bind:value={server}
          on:input={() => (success = null)}
        />
      </div>
      <!-- svelte-ignore a11y-click-events-have-key-events -->
      <svg
        on:click={() => {
          success = null;
          sourcesCopy.splice(i, 1);
          sourcesCopy = sourcesCopy; // Reactivity
        }}
        class="icon trash"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 448 512"
        ><!--! Font Awesome Pro 6.4.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2023 Fonticons, Inc. --><path
          d="M135.2 17.7C140.6 6.8 151.7 0 163.8 0H284.2c12.1 0 23.2 6.8 28.6 17.7L320 32h96c17.7 0 32 14.3 32 32s-14.3 32-32 32H32C14.3 96 0 81.7 0 64S14.3 32 32 32h96l7.2-14.3zM32 128H416V448c0 35.3-28.7 64-64 64H96c-35.3 0-64-28.7-64-64V128zm96 64c-8.8 0-16 7.2-16 16V432c0 8.8 7.2 16 16 16s16-7.2 16-16V208c0-8.8-7.2-16-16-16zm96 0c-8.8 0-16 7.2-16 16V432c0 8.8 7.2 16 16 16s16-7.2 16-16V208c0-8.8-7.2-16-16-16zm96 0c-8.8 0-16 7.2-16 16V432c0 8.8 7.2 16 16 16s16-7.2 16-16V208c0-8.8-7.2-16-16-16z"
        /></svg
      >
    </div>
  {/each}
</div>
<div id="buttons">
  <Button
    border={true}
    on:click={() => {
      if (success !== true) {
        // Reset sources, either these ones weren't saved or failed to load when they were
        sourcesCopy = structuredClone(sourcesBackup);
      }
      dispatch("prevPage");
    }}>Back</Button
  >
  <div id="left-buttons">
    {#if sourcesCopy.length == 0}
      <div id="new-button">
        <Button
          border={true}
          on:click={() => {
            sourcesCopy.push({
              name: "",
              server: "",
            });
            sourcesCopy = sourcesCopy; // Reactivity
          }}>New</Button
        >
      </div>
    {/if}
    <Button
      border={true}
      on:click={() => {
        dispatch("sourcesChange", sourcesCopy);
      }}>Save</Button
    >
  </div>
</div>

<style>
  #sources-list {
    margin-bottom: 1em;
  }
  .source {
    display: flex;
    padding: 0.5em 1em;
    background-color: #ededed;
    border-bottom: 1px solid black;
  }
  .icon {
    margin-top: auto;
    margin-bottom: auto;
  }
  #sources-list .icon {
    cursor: pointer;
  }
  .plus {
    margin-right: 1em;
  }
  .trash {
    margin-left: 1em;
  }
  .input-container {
    flex-grow: 1;
  }
  input {
    background-color: transparent;
    border: 0;
    width: 100%;
  }
  input[type="url"]:invalid {
    color: red;
  }
  .name {
    color: var(--theme3);
    font-size: 0.9em;
  }
  #buttons {
    display: flex;
  }
  #left-buttons {
    display: flex;
    margin-left: auto;
  }
  #new-button {
    margin-left: auto;
    margin-right: 0.5em;
  }
  hr {
    margin: 2em auto;
    background-color: var(--theme-border);
    border: 0;
    height: 2px;
  }
  .mini {
    margin-top: -1em;
    font-size: 0.8em;
    padding-left: 0.2ch;
  }
</style>
