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
    /* 
    Basic styling for running directly in the browser for dev testing.
    Taken from https://systemfontstack.com/
     */
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
  </style>
{/if}

<h1>{entityTitle}</h1>

{#if loading && !errMsg}
  <p>Loading...</p>
{/if}
{#if errMsg}
  <p class="error">{errMsg}</p>
{/if}

{#if !loading && !errMsg}
  <div id="attestation-sidebar">
    {#each Object.entries(dbData) as [attr, data]}
      <Attestation {data} signer="Starling Lab" />
    {/each}
  </div>
{/if}

<style>
  .error {
    color: red;
    font-size: 2em;
  }
  #attestation-sidebar {
    width: 30%;
    margin: 0 auto;
  }
</style>
