<!-- Download attestation to personal hyperbee modal -->

<script>
  import Button from "./Button.svelte";
  import { hyperbeeJWT, hyperbeeSources } from "./store.js";

  export let data;
  export let fileCid;
  export let curSource;

  let downloadDialog; // Element

  export function showModal() {
    downloadDialog.showModal();
    // Reset view
    downloadDialog.querySelector("#dl-server-form").style.display = "block";
    downloadDialog.querySelector("#dl-server-info").style.display = "none";
    // Disable default input focus which looks bad
    downloadDialog.querySelector("#dl-server-button > button").blur();
  }

  async function downloadFormSubmit() {
    // Show info text in dialog now
    downloadDialog.querySelector("#dl-server-form").style.display = "none";
    downloadDialog.querySelector("#dl-server-info").style.display = "block";
    const text = downloadDialog.querySelector("#dl-server-info-text");
    text.innerText = "Loading...";

    const body = IpldDagCbor.encode([
      {
        key: data.attestation.attribute,
        value: data.attestation.value,
        type: "str",
      },
    ]);
    try {
      const res = await fetch(
        new URL(`c/${fileCid}?index=1`, $hyperbeeSources[curSource].server),
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/cbor",
            Authorization: `Bearer ${$hyperbeeJWT}`,
          },
          body,
        }
      );
      if (!res.ok) {
        throw new Error(`Network response was not ok: ${res.status}`);
      }
    } catch (error) {
      console.error(error);
      text.innerText = error;
      return;
    }
    // Success
    text.innerText =
      "Successfully sent attestation to chosen hyperbee. Reload to see updated attestation.";
  }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<dialog bind:this={downloadDialog} on:click|self={() => downloadDialog.close()}>
  <div id="dl-server-form" on:click|stopPropagation>
    <div id="dl-server-title">Send data to</div>
    <form on:submit|preventDefault={downloadFormSubmit}>
      <div id="dl-server-sources">
        {$hyperbeeSources[curSource].name}<br /><code
          >{$hyperbeeSources[curSource].server}</code
        >
      </div>
      <div id="dl-server-button">
        <Button type="submit">Submit</Button>
      </div>
    </form>
  </div>
  <div id="dl-server-info" style="display: none">
    <div id="dl-server-info-text" />
  </div>
</dialog>

<style>
  @import "./modal.css" scoped;

  #dl-server-title {
    margin: 0.5em;
    font-weight: bold;
    text-align: center;
    font-size: 1.2em;
  }
  #dl-server-sources {
    margin: 1em 0.5em;
  }
  #dl-server-button {
    text-align: center;
  }
  #dl-server-info-text {
    margin: 0.5em;
    text-align: center;
  }
  code {
    /* For Uwazi */
    font-family: Menlo, Consolas, Monaco, Liberation Mono, Lucida Console,
      monospace;
    margin: unset;
    padding: unset;
    position: unset;
  }
</style>
