<!-- https://github.com/starlinglab/uwazi-hyperbee-prototype/issues/6 -->

<script>
  import { createEventDispatcher } from "svelte";
  import Button from "./Button.svelte";
  import { personalHyperbee } from "./store.js";

  export let sources; // [{name, server}, ...]
  export let success; // null means unknown/untested (for sources only)

  // Backup of sources that never gets changed
  let sourcesCopy = structuredClone(sources);

  const dispatch = createEventDispatcher();
</script>

<h2>Personal Hyperbee</h2>
<p class="mini">(always saved)</p>
<div class="source">
  <svg
    style:width="unset"
    class="icon plus"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 640 512"
    ><!--! Font Awesome Free 6.4.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2023 Fonticons, Inc. --><path
      d="M579.8 267.7c56.5-56.5 56.5-148 0-204.5c-50-50-128.8-56.5-186.3-15.4l-1.6 1.1c-14.4 10.3-17.7 30.3-7.4 44.6s30.3 17.7 44.6 7.4l1.6-1.1c32.1-22.9 76-19.3 103.8 8.6c31.5 31.5 31.5 82.5 0 114L422.3 334.8c-31.5 31.5-82.5 31.5-114 0c-27.9-27.9-31.5-71.8-8.6-103.8l1.1-1.6c10.3-14.4 6.9-34.4-7.4-44.6s-34.4-6.9-44.6 7.4l-1.1 1.6C206.5 251.2 213 330 263 380c56.5 56.5 148 56.5 204.5 0L579.8 267.7zM60.2 244.3c-56.5 56.5-56.5 148 0 204.5c50 50 128.8 56.5 186.3 15.4l1.6-1.1c14.4-10.3 17.7-30.3 7.4-44.6s-30.3-17.7-44.6-7.4l-1.6 1.1c-32.1 22.9-76 19.3-103.8-8.6C74 372 74 321 105.5 289.5L217.7 177.2c31.5-31.5 82.5-31.5 114 0c27.9 27.9 31.5 71.8 8.6 103.9l-1.1 1.6c-10.3 14.4-6.9 34.4 7.4 44.6s34.4 6.9 44.6-7.4l1.1-1.6C433.5 260.8 427 182 377 132c-56.5-56.5-148-56.5-204.5 0L60.2 244.3z"
    /></svg
  >
  <input class="server" type="text" bind:value={$personalHyperbee} />
</div>

<h2>Sources</h2>
{#if success === false}
  <p>Sources will not be updated due to error, edit and try to save again.</p>
{/if}
{#if success === null}
  <p>Unsaved changes</p>
{/if}
<div id="sources-list">
  {#each sources as { name, server }, i}
    <div class="source">
      <!-- svelte-ignore a11y-click-events-have-key-events -->
      <svg
        on:click={() => {
          success = null;
          sources.splice(i + 1, 0, {
            name: "Untitled",
            server: "https://example.com",
          });
          sources = sources; // Reactivity
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
          bind:value={name}
          on:input={() => (success = null)}
        />
        <input
          class="server"
          type="text"
          bind:value={server}
          on:input={() => (success = null)}
        />
      </div>
      <!-- svelte-ignore a11y-click-events-have-key-events -->
      <svg
        on:click={() => {
          success = null;
          sources.splice(i, 1);
          sources = sources; // Reactivity
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
        sources = structuredClone(sourcesCopy);
      }
      dispatch("prevPage");
    }}>Back</Button
  >
  <div id="left-buttons">
    {#if Object.keys(sources).length == 0}
      <div id="new-button">
        <Button
          border={true}
          on:click={() => {
            sources.push({
              name: "Untitled",
              server: "https://example.com",
            });
            sources = sources; // Reactivity
          }}>New</Button
        >
      </div>
    {/if}
    <Button border={true} on:click={() => dispatch("sourcesChange", sources)}
      >Save</Button
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
  .name {
    color: var(--theme3);
    font-size: 0.8em;
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
