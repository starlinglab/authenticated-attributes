<script>
  import Modal from "./Modal.svelte";

  export let data;
  export let signer = "";

  let showModal = false;
  let modalPos = { x: 0, y: 0 };
  let attrIcon; // Element

  function uint8ArrayToBase64(uint8Array) {
    let binaryString = "";
    uint8Array.forEach((byte) => {
      binaryString += String.fromCharCode(byte);
    });
    return btoa(binaryString);
  }
</script>

<div id="container">
  <div id="text">
    <h2 class="attr">{data.attestation.attribute}</h2>
    {#if data.attestation.encrypted}
      <span class="value encrypted">encrypted</span>
    {:else}
      <span class="value">{data.attestation.value}</span>
    {/if}
  </div>
  <div id="icons">
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <svg
      class="icon"
      bind:this={attrIcon}
      on:click={() => {
        let rect = attrIcon.getBoundingClientRect();
        modalPos.x = rect.left + 10;
        modalPos.y = rect.top + 10;
        showModal = true;
      }}
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 496 512"
      ><!--! Font Awesome Pro 6.4.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2023 Fonticons, Inc. --><path
        d="M314.9 194.4v101.4h-28.3v120.5h-77.1V295.9h-28.3V194.4c0-4.4 1.6-8.2 4.6-11.3 3.1-3.1 6.9-4.7 11.3-4.7H299c4.1 0 7.8 1.6 11.1 4.7 3.1 3.2 4.8 6.9 4.8 11.3zm-101.5-63.7c0-23.3 11.5-35 34.5-35s34.5 11.7 34.5 35c0 23-11.5 34.5-34.5 34.5s-34.5-11.5-34.5-34.5zM247.6 8C389.4 8 496 118.1 496 256c0 147.1-118.5 248-248.4 248C113.6 504 0 394.5 0 256 0 123.1 104.7 8 247.6 8zm.8 44.7C130.2 52.7 44.7 150.6 44.7 256c0 109.8 91.2 202.8 203.7 202.8 103.2 0 202.8-81.1 202.8-202.8.1-113.8-90.2-203.3-202.8-203.3z"
      />
      <title>{signer}</title>
    </svg>
    <svg
      class="icon"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      ><!--! Font Awesome Pro 6.4.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2023 Fonticons, Inc. --><path
        d="M288 32c0-17.7-14.3-32-32-32s-32 14.3-32 32V274.7l-73.4-73.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l128 128c12.5 12.5 32.8 12.5 45.3 0l128-128c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L288 274.7V32zM64 352c-35.3 0-64 28.7-64 64v32c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V416c0-35.3-28.7-64-64-64H346.5l-45.3 45.3c-25 25-65.5 25-90.5 0L165.5 352H64zm368 56a24 24 0 1 1 0 48 24 24 0 1 1 0-48z"
      />
    </svg>
  </div>
</div>

<Modal bind:showModal bind:pos={modalPos}>
  <span slot="title">
    <strong>{data.attestation.attribute}</strong>:
    {#if data.attestation.encrypted}
      <span class="encrypted">encrypted</span>
    {:else}
      {data.attestation.value}
    {/if}
  </span>
  <span slot="content">
    <div id="modal-content">
      <p>
        <strong>Source:</strong>
        {signer}
      </p>
      <p>
        <strong>Timestamp:</strong>
        {data.timestamp.submitted}
      </p>
      <p>
        <strong>Public Key:</strong>
        <code> {uint8ArrayToBase64(data.signature.pubKey)}</code>
      </p>
      <p><strong>Signature:</strong> ?</p>
      <p>
        <strong>Attestation CID:</strong>
        <code>{data.signature.signedMsg}</code>
      </p>
      <p><strong>Timestamping Proof:</strong> ?</p>
    </div>
  </span>
  <span slot="buttons">
    <button type="button">Export Attestation</button>
    <button type="button">View Timestamp</button>
  </span>
</Modal>

<style>
  #container {
    display: flex;
    margin: 1em 0;
  }
  #text {
    padding-right: 1em;
    word-break: break-word;
  }
  #icons {
    margin: auto 0;
    margin-left: auto;
    min-width: max-content;
  }
  .attr {
    color: var(--theme1);
    margin: 0;
    text-decoration: underline;
  }
  .value {
    color: var(--theme2);
  }
  .icon {
    color: var(--theme1);
  }
  .encrypted {
    font-style: italic;
  }

  #modal-content {
    word-break: break-all;
  }
  #modal-content > p {
    margin: 0.2em 0;
  }
</style>
