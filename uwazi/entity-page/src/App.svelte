<script>
  import Attestation from "./lib/Attestation.svelte";
  import Button from "./lib/Button.svelte";
  import SourcesList from "./lib/SourcesList.svelte";
  import { hyperbeeSources } from "./lib/store.js";

  /// Consts ///

  const dagCborURL =
    "https://cdn.jsdelivr.net/npm/@ipld/dag-cbor@9.0.1/dist/index.min.js";
  const replayWebURL =
    "https://cdn.jsdelivr.net/npm/replaywebpage@1.7.14/ui.js";

  /// Setup funcs ///

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

  const loadData = async (sources, cid) => {
    let datas = [];
    for (var i = 0; i < sources.length; i++) {
      const resp = await fetch(`${sources[i].server}/${cid}`);
      if (!resp.ok) {
        errMsg = `failed to load data: ${resp.statusText}`;
        throw new Error("failed to load data");
      }
      datas.push(IpldDagCbor.decode(new Uint8Array(await resp.arrayBuffer())));
    }
    return datas;
  };

  /**
   * Walks through hyperbeeSources, amalgamating entries from all sources.
   *
   * Returns an Array of the following:
   * {
   *   source: <hyperbee name>,
   *   attr: <attribute name>,
   *   data: <attestation data>,
   *   alts: [ // What other hyperbees have to say about this attr
   *     {source, data}
   *   ]
   * }
   */
  const getDbEntries = (datas) => {
    // Store already seen attribute names in a hashmap for O(1) checking
    const usedAttrs = {};
    const ret = [];
    for (var i = 0; i < $hyperbeeSources.length; i++) {
      const hb = $hyperbeeSources[i];
      if (Object.keys(datas[i]).length === 0) {
        continue;
      }
      for (const [attr, data] of Object.entries(datas[i])) {
        if (attr in usedAttrs) {
          // Add as alternate data
          ret[usedAttrs[attr]].alts.push({ source: hb.name, data });
        } else {
          // Store the index of the attribute in usedAttrs
          usedAttrs[attr] =
            ret.push({ source: hb.name, attr, data, alts: [] }) - 1;
        }
      }
    }
    return ret;
  };

  const reloadData = async (sources, cid) => {
    loading = true;
    errMsg = "";
    try {
      const datas = await loadData(sources, cid);
      dbEntries = getDbEntries(datas);
    } catch (e) {
      errMsg = e.toString();
      console.error(e);
      loading = false;
      return false;
    }
    loading = false;
    return true;
  };

  /// Variables ///

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
    entity = datasets.entity;
  }

  const entityTitle = entity.title;
  const entityHasAttachment = entity.attachments.length == 1;
  // Set attachment-based variables
  const entityCid =
    !entityHasAttachment ||
    (entity.metadata.sha256cid && entity.metadata.sha256cid.value) ||
    null;
  let fileCid = entityCid; // Changes based on what page is viewing
  const fileType = !entityHasAttachment || entity.attachments[0].mimetype;
  const fileName = !entityHasAttachment || entity.attachments[0].originalname;
  const fileSize = !entityHasAttachment || entity.attachments[0].size;
  const fileUrl =
    !entityHasAttachment || "/api/files/" + entity.attachments[0].filename;
  const isWacz = !entityHasAttachment || fileName.endsWith(".wacz");

  // Names for different "pages" that can be viewed
  // Current avail. pages: entity, sources, cid
  let curPage = "entity";
  let loading = true;
  let errMsg = "";
  let fileObject; // <object> element

  let dbEntries;

  let sourcesListSuccess = null; // null means sources haven't been tested yet

  // Main function
  (async () => {
    if (!entityHasAttachment) {
      errMsg = "No attachment for this entity";
      return;
    }
    if (!fileCid) {
      errMsg = "No CID set for this file";
      return;
    }

    if ($hyperbeeSources.length === 0) {
      hyperbeeSources.set([
        {
          name: "Local Dev",
          server: "http://localhost:3001",
        },
        {
          name: "Local Dev 2",
          server: "http://localhost:3001",
        },
      ]);
    }

    try {
      await loadScript(dagCborURL);
      if (isWacz) {
        await loadScript(replayWebURL);
      }
      await reloadData($hyperbeeSources, fileCid);
    } catch (e) {
      errMsg = e.toString();
      console.error(e);
    }
  })();

  $: if (!loading && !errMsg && !isWacz && fileObject) {
    // Set the embedded file CSS based on the filetype
    // Images need max-width/height set so they scale to fit the container
    // PDFs, videos need explicit width and height
    // Everything else is given explicit width and height since that's probably
    // the option that will work best for most files overall.
    if (fileType.startsWith("image/")) {
      fileObject.style.maxWidth = "100%";
      fileObject.style.maxHeight = "100%";
    } else {
      fileObject.style.width = "100%";
      fileObject.style.height = "100%";
    }
  }

  function handleChangePageMsg(event) {
    if (event.detail.page === "sources") {
      // Reset back to unknown state
      sourcesListSuccess = null;
    } else if (event.detail.page === "cid") {
      // Load data for cid
      fileCid = event.detail.cid;
      // Async function, but running it in the background is fine since it
      // properly sets the loading variable and everything
      reloadData($hyperbeeSources, fileCid);

      if (fileCid === entityCid) {
        // User has clicked back into the entity, so display the entity page instead
        curPage = "entity";
        return;
      }
    }
    curPage = event.detail.page;
  }
</script>

<div id="top-container-6facc2a3">
  {#if loading && !errMsg}
    <p>Loading...</p>
  {/if}
  {#if errMsg}
    <p class="error">{errMsg}</p>
    {#if curPage === "entity"}
      <div id="error-button">
        <Button
          border={true}
          on:click={() => {
            errMsg = "";
            handleChangePageMsg({ detail: { page: "sources" } });
          }}>Edit Sources</Button
        >
      </div>
    {/if}
  {/if}

  {#if !loading}
    {#if (curPage === "entity" || curPage === "cid") && !errMsg}
      <div id="title-bar">
        <h1>{entityTitle}</h1>
      </div>
      <div id="container-6facc2a3">
        <div id="non-sidebar">
          <div id="file-info">
            {#if curPage === "entity"}
              <p id="top-file-text">
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
                {#if isWacz}
                  <replay-web-page source={fileUrl} replayBase="/api/files/" />
                {:else}
                  <object
                    bind:this={fileObject}
                    id="file-object"
                    title={fileName}
                    data={fileUrl}
                    type={fileType}
                  >
                    <span class="error">Failed to display file</span>
                    <style>
                      #embed-container {
                        background-color: var(--theme-border);
                      }
                    </style>
                  </object>
                {/if}
              </div>
            {:else}
              <p>Can't display file information for just a CID.</p>
            {/if}
            <p><strong>CID</strong> <code>{fileCid}</code></p>
          </div>
          <div id="bottom-buttons">
            <Button border={true}>
              <svg
                class="icon"
                fill="currentColor"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 512 512"
                ><!--! Font Awesome Pro 6.4.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2023 Fonticons, Inc. --><path
                  d="M410.3 231l11.3-11.3-33.9-33.9-62.1-62.1L291.7 89.8l-11.3 11.3-22.6 22.6L58.6 322.9c-10.4 10.4-18 23.3-22.2 37.4L1 480.7c-2.5 8.4-.2 17.5 6.1 23.7s15.3 8.5 23.7 6.1l120.3-35.4c14.1-4.2 27-11.8 37.4-22.2L387.7 253.7 410.3 231zM160 399.4l-9.1 22.7c-4 3.1-8.5 5.4-13.3 6.9L59.4 452l23-78.1c1.4-4.9 3.8-9.4 6.9-13.3l22.7-9.1v32c0 8.8 7.2 16 16 16h32zM362.7 18.7L348.3 33.2 325.7 55.8 314.3 67.1l33.9 33.9 62.1 62.1 33.9 33.9 11.3-11.3 22.6-22.6 14.5-14.5c25-25 25-65.5 0-90.5L453.3 18.7c-25-25-65.5-25-90.5 0zm-47.4 168l-144 144c-6.2 6.2-16.4 6.2-22.6 0s-6.2-16.4 0-22.6l144-144c6.2-6.2 16.4-6.2 22.6 0s6.2 16.4 0 22.6z"
                /></svg
              >
              Edit</Button
            >
            <Button border={true}>
              <svg
                class="icon"
                fill="currentColor"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 576 512"
                ><!--! Font Awesome Pro 6.4.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2023 Fonticons, Inc. --><path
                  d="M288 32c-80.8 0-145.5 36.8-192.6 80.6C48.6 156 17.3 208 2.5 243.7c-3.3 7.9-3.3 16.7 0 24.6C17.3 304 48.6 356 95.4 399.4C142.5 443.2 207.2 480 288 480s145.5-36.8 192.6-80.6c46.8-43.5 78.1-95.4 93-131.1c3.3-7.9 3.3-16.7 0-24.6c-14.9-35.7-46.2-87.7-93-131.1C433.5 68.8 368.8 32 288 32zM144 256a144 144 0 1 1 288 0 144 144 0 1 1 -288 0zm144-64c0 35.3-28.7 64-64 64c-7.1 0-13.9-1.2-20.3-3.3c-5.5-1.8-11.9 1.6-11.7 7.4c.3 6.9 1.3 13.8 3.2 20.7c13.7 51.2 66.4 81.6 117.6 67.9s81.6-66.4 67.9-117.6c-11.1-41.5-47.8-69.4-88.6-71.1c-5.8-.2-9.2 6.1-7.4 11.7c2.1 6.4 3.3 13.2 3.3 20.3z"
                /></svg
              >
              View Additional Metadata</Button
            >
            {#if dbEntries.length === 0}
              <Button
                border={true}
                on:click={() => {
                  handleChangePageMsg({ detail: { page: "sources" } });
                }}>Edit Sources</Button
              >
            {/if}
            <div id="delete-button"><Button border={true}>Delete</Button></div>
          </div>
        </div>
        <div id="attestation-sidebar">
          {#if dbEntries.length > 0}
            {#each dbEntries as { source, attr, data, alts }}
              {#if attr === "childOf" && !data.attestation.encrypted}
                <Attestation
                  {data}
                  {alts}
                  signer={source}
                  customTitle="Parents"
                  on:changePage={handleChangePageMsg}
                >
                  <span slot="value">
                    {#each data.attestation.value as cid}
                      <!-- svelte-ignore a11y-click-events-have-key-events -->
                      <span
                        class="cid"
                        on:click={() => {
                          handleChangePageMsg({
                            detail: { page: "cid", cid: cid.toString() },
                          });
                        }}>{cid}</span
                      ><br />
                    {/each}
                  </span>
                </Attestation>
              {:else if attr === "parentOf" && !data.attestation.encrypted}
                <Attestation
                  {data}
                  {alts}
                  signer={source}
                  customTitle="Derivatives"
                  on:changePage={handleChangePageMsg}
                >
                  <span slot="value">
                    {#each data.attestation.value as cid}
                      <!-- svelte-ignore a11y-click-events-have-key-events -->
                      <span
                        class="cid"
                        on:click={() => {
                          handleChangePageMsg({
                            detail: { page: "cid", cid: cid.toString() },
                          });
                        }}>{cid}</span
                      ><br />
                    {/each}
                  </span>
                </Attestation>
              {:else}
                <Attestation
                  {data}
                  {alts}
                  signer={source}
                  on:changePage={handleChangePageMsg}
                />
              {/if}
            {/each}
          {:else}
            <p class="error">No attestations found</p>
          {/if}
        </div>
      </div>
    {:else if curPage === "sources"}
      <div id="title-bar">
        <h1>Sources</h1>
      </div>
      <div id="sources-list-container">
        <SourcesList
          sources={$hyperbeeSources}
          success={sourcesListSuccess}
          on:changePage={(e) => {
            errMsg = "";
            handleChangePageMsg(e);
          }}
          on:sourcesChange={(e) => {
            (async () => {
              sourcesListSuccess = await reloadData($hyperbeeSources, fileCid);
              if (sourcesListSuccess) {
                // Actually call .set so that subscribers get the update and
                // it's stored in localStorage
                hyperbeeSources.set($hyperbeeSources);
              }
            })();
          }}
        />
      </div>
    {/if}
  {/if}
</div>

{#if import.meta.env.DEV}
  <style>
    /* Basic styling for running directly in the browser when dev testing. */

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

    /* Use whole viewport when not running in Uwazi */
    #top-container-6facc2a3 {
      height: 100vh !important;
    }
    body {
      margin: 0;
    }
  </style>
{/if}
{#if import.meta.env.PROD}
  <style>
    #hyperbee-entity-page-app {
      max-width: 95vw !important;
    }
  </style>
{/if}

<style>
  .error {
    color: red;
    font-size: 2em !important;
  }
  #top-container-6facc2a3 {
    height: 80vh; /* Leaves space for Uwazi top nav */
    display: flex;
    flex-direction: column;
    overflow: hidden;
    color: var(--theme2);
  }

  #error-button {
    width: max-content;
    margin-left: 2em;
  }

  #title-bar {
    flex-grow: 0;
    margin-left: 1em;
  }
  #container-6facc2a3 {
    display: flex;
    flex: auto;
    overflow: hidden;
    border-top: 2px solid var(--theme-border);
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
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  #file-info {
    margin-left: 4em;
    padding-right: 3em;
    flex-grow: 1;
    overflow-y: auto;
  }
  #top-file-text {
    margin-top: 2em;
  }
  #embed-container {
    height: 65%;
    width: 100%;
  }
  #embed-container .error {
    position: relative;
    top: 1em;
    left: 1em;
  }
  #bottom-buttons {
    margin-bottom: 1em;
    padding-left: 1em;
    border-top: 2px solid var(--theme-border);
    padding-top: 1em;
    display: flex;
    gap: 1em;
  }
  #delete-button {
    margin-left: auto;
    margin-right: 1em;
  }

  #sources-list-container {
    margin-left: 2em;
    width: 40%;
  }

  .cid {
    cursor: pointer;
    text-decoration: underline;
    text-overflow: ellipsis;
    overflow: hidden;
    white-space: nowrap;
    display: inline-block;
    width: 100%;
    color: var(--theme2);
  }

  /* Undo Uwazi styling */
  a {
    border-bottom: 0 !important;
  }
  p {
    margin: revert !important;
  }
</style>
