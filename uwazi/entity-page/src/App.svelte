<script>
  import Attestation from "./lib/Attestation.svelte";

  let dbData = null;
  let loading = true;
  let errMsg = "";

  const fileCid = document.getElementById("file-cid").innerText;

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

    /*
    const parentDiv = document.getElementById("hyperbee");
    const tbl = document.createElement("table");
    Object.entries(dbData).forEach(([k, v]) => {
      const tr = tbl.insertRow();
      const td1 = tr.insertCell();
      td1.appendChild(document.createTextNode(k));
      const td2 = tr.insertCell();
      if (v.attestation.encrypted) {
        td2.style.fontStyle = "italic";
        td2.appendChild(document.createTextNode("encrypted"));
      } else {
        td2.appendChild(document.createTextNode(v.attestation.value));
      }
    });
    parentDiv.appendChild(tbl);
    */
  };

  (async () => {
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

{#if loading && !errMsg}
  <p>Loading...</p>
{/if}
{#if errMsg}
  <p class="error">{errMsg}</p>
{/if}

<div id="attestation-sidebar">
  <Attestation
    attestation={{ attribute: "Test", value: 123 }}
    signer="Starling Lab"
  />
  <Attestation
    attestation={{ attribute: "Test 2", value: 1234 }}
    signer="Starling Lab"
  />
</div>

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
