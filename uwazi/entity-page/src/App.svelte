<script>
  import Attestation from "./lib/Attestation.svelte";

  let dbData = null;
  let loading = true;
  let errMsg = "";

  let entity;

  if (import.meta.env.DEV) {
    // Example dataset
    // In prod Uwazi will set this variable
    // https://uwazi.readthedocs.io/en/latest/admin-docs/designing-your-website.html#exploring-your-datasets
    entity = {
      sharedId: "wow65tfsa2",
      permissions: [
        {
          refId: "58ad7d240d44252fee4e6212",
          type: "user",
          level: "write",
        },
      ],
      obsoleteMetadata: [],
      user: "58ad7d240d44252fee4e6212",
      creationDate: 1683726145837,
      published: false,
      metadata: {
        sha256cid: {
          translateContext: "5bfbb1a0471dd0fc16ada146",
          _id: "645bda1524ec7d80e74731ea",
          label: "SHA256CID",
          type: "text",
          name: "sha256cid",
          indexInTemplate: 0,
          value: "bafybeifgkpgb7yqgjnovszaio7tzetmdfmigylr24hg6a76wnjxcnhkx54",
        },
      },
      attachments: [
        {
          _id: "645b9f413f4de0737494fa38",
          entity: "wow65tfsa2",
          type: "attachment",
          filename: "16837261456656tmwy4delgj.pdf",
          originalname: "Table Top Manual 4th Edition.pdf",
          mimetype: "application/pdf",
          size: 2652159,
          creationDate: 1683726145926,
        },
      ],
      documentType: "Document",
      __v: 0,
      relations: [],
      editDate: 1683741267794,
      title: "Test supporting PDF",
      documents: [],
      language: "en",
      template: "5bfbb1a0471dd0fc16ada146",
      _id: "645b9f413f4de0737494fa2c",
    };
  } else {
    // @ts-ignore
    entity = datasets.entity;
  }

  const entityTitle = entity.title;
  const entityHasAttachment = entity.attachments.length == 1;
  // Set attachment-based variables
  const fileCid =
    !entityHasAttachment ||
    (entity.metadata.sha256cid && entity.metadata.sha256cid.value) ||
    null;
  const fileType = !entityHasAttachment || entity.attachments[0].mimetype;
  const fileName = !entityHasAttachment || entity.attachments[0].originalname;
  const fileSize = !entityHasAttachment || entity.attachments[0].size;
  const fileUrl =
    !entityHasAttachment || "/api/files/" + entity.attachments[0].filename;

  const hyperbeeServer = "http://localhost:3001";
  const dagCborURL =
    "https://cdn.jsdelivr.net/npm/@ipld/dag-cbor@9/dist/index.min.js";

  const isScriptAlreadyIncluded = (src) => {
    const scripts = document.getElementsByTagName("script");
    for (let i = 0; i < scripts.length; i++)
      if (scripts[i].getAttribute("src") === src) return true;
    return false;
  };

  const loadScript = async (url) => {
    return new Promise(function (resolve, reject) {
      if (!isScriptAlreadyIncluded(url)) {
        const script = document.createElement("script");
        script.onload = function () {
          console.log("script loaded");
          resolve();
        };
        script.src = url;
        document.head.appendChild(script);
      } else {
        console.log("script was already loaded.");
        resolve();
      }
    });
  };

  const loadData = async (cid) => {
    loading = true;
    const resp = await fetch(`${hyperbeeServer}/${cid}`);
    if (!resp.ok) {
      errMsg = `failed to load data: ${resp.statusText}`;
      throw new Error("failed to load data");
    }
    return new Uint8Array(await resp.arrayBuffer());
  };

  const processData = (bytes) => {
    // @ts-ignore
    dbData = IpldDagCbor.decode(bytes);
    console.log(dbData);
  };

  (async () => {
    if (!entityHasAttachment) {
      errMsg = "No attachment for this entity";
      return;
    }
    if (!fileCid) {
      errMsg = "No CID set for this file";
      return;
    }
    try {
      await loadScript(dagCborURL);
      processData(await loadData(fileCid));
      loading = false;
    } catch (e) {
      errMsg = e.toString();
      console.error(e);
    }
  })();
</script>

{#if import.meta.env.DEV}
  <style>
    /* Basic styling for running directly in the browser for dev testing. */

    /* Taken from https://systemfontstack.com/ */
    :root {
      font-family: -apple-system, BlinkMacSystemFont, avenir next, avenir,
        segoe ui, helvetica neue, helvetica, Cantarell, Ubuntu, roboto, noto,
        arial, sans-serif;
    }
    code,
    pre {
      font-family: Menlo, Consolas, Monaco, Liberation Mono, Lucida Console,
        monospace;
    }

    /* Use whole viewport when not running Uwazi */
    #container-6facc2a3 {
      height: 100vh !important;
    }
    body {
      margin: 0;
    }
  </style>
{/if}

{#if loading && !errMsg}
  <p>Loading...</p>
{/if}
{#if errMsg}
  <p class="error">{errMsg}</p>
{/if}

{#if !loading && !errMsg}
  <div id="container-6facc2a3">
    <div id="non-sidebar">
      <h1>{entityTitle}</h1>
      <div id="file-info">
        <p>
          {fileType.split("/")[1].toUpperCase()}
          <a href={fileUrl} target="_blank">
            <svg
              style="color: var(--theme1);"
              class="icon"
              fill="currentColor"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 512 512"
              ><!--! Font Awesome Pro 6.4.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2023 Fonticons, Inc. --><path
                d="M320 0c-17.7 0-32 14.3-32 32s14.3 32 32 32h82.7L201.4 265.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L448 109.3V192c0 17.7 14.3 32 32 32s32-14.3 32-32V32c0-17.7-14.3-32-32-32H320zM80 32C35.8 32 0 67.8 0 112V432c0 44.2 35.8 80 80 80H400c44.2 0 80-35.8 80-80V320c0-17.7-14.3-32-32-32s-32 14.3-32 32V432c0 8.8-7.2 16-16 16H80c-8.8 0-16-7.2-16-16V112c0-8.8 7.2-16 16-16H192c17.7 0 32-14.3 32-32s-14.3-32-32-32H80z"
              /></svg
            >
          </a>
        </p>
        <div id="embed-container">
          <embed
            src="http://localhost:8000/Table Top Manual 4th Edition.pdf"
            type={fileType}
            width="100%"
            height="100%"
          />
        </div>
        <p><strong>CID</strong> <code>{fileCid}</code></p>
      </div>
    </div>
    <div id="attestation-sidebar">
      {#each Object.entries(dbData) as [attr, data]}
        {#if attr === "childOf" && !data.attestation.encrypted}
          <Attestation {data} signer="Starling Lab" customTitle="Parent(s)">
            <span slot="value">
              {#each data.attestation.value as cid}
                <span class="cid">{cid}</span><br />
              {/each}
            </span>
          </Attestation>
        {:else if attr === "parentOf" && !data.attestation.encrypted}
          <Attestation {data} signer="Starling Lab" customTitle="Derivatives">
            <span slot="value">
              {#each data.attestation.value as cid}
                <span class="cid">{cid}</span><br />
              {/each}
            </span>
          </Attestation>
        {:else}
          <Attestation {data} signer="Starling Lab" />
        {/if}
      {/each}
    </div>
  </div>
{/if}

<style>
  .error {
    color: red;
    font-size: 2em;
  }
  #container-6facc2a3 {
    /*margin: 0 2em;*/
    display: flex;
    height: 80vh; /* Leaves space for Uwazi top nav */
  }
  #attestation-sidebar {
    width: 30%;
    padding-left: 1em;
    padding-right: 2em; /* no scrollbar overlap */
    overflow-y: auto;
    border-left: 2px solid var(--theme-border);
  }
  #non-sidebar {
    flex-grow: 1;
    padding-left: 1em;
    margin-right: 3em;
    height: 100%;
  }
  #file-info {
    margin-left: 4em;
  }
  #embed-container {
    height: 50%;
    width: 100%;
  }

  .cid {
    cursor: pointer;
    text-decoration: underline;
    text-overflow: ellipsis;
    overflow: hidden;
    white-space: nowrap;
    display: inline-block;
    width: 100%;
  }
</style>
