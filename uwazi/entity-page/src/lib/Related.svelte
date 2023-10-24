<!-- Content for the "related" page -->

<script>
  import { createEventDispatcher } from "svelte";
  import { hyperbeeSources } from "./store.js";

  export let att;

  /*
  Results from doing index searching across sources.

  Example format:

  {
    "<source number>": [
      {"name": "<name of asset>", "cid": "<cid of asset>"},
      ...
    ],
    ...
  }
  */
  export let results = {};

  const dispatch = createEventDispatcher();

  function shortenCid(cid) {
    return `${cid.slice(0, 4)}...${cid.slice(-6)}`;
  }
</script>

<div>
  <p>
    Showing all assets that have: <code>{att.attribute}</code> =
    <code>{att.value}</code>
  </p>
  {#each $hyperbeeSources as { name }, i}
    <h2>{name}</h2>
    <ul>
      {#each results[i] as item}
        <li>
          {item.name}
          <!-- svelte-ignore a11y-click-events-have-key-events -->
          (<span
            class="cid"
            title={item.cid}
            on:click={() => {
              dispatch("changePage", { page: "cid", cid: item.cid.toString() });
            }}>{shortenCid(item.cid)}</span
          >)
        </li>
      {/each}
    </ul>
  {/each}
</div>

<style>
  .cid {
    cursor: pointer;
    text-decoration: underline;
  }
</style>
