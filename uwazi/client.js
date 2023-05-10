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

const getCID = () => {
  return document.getElementById("file-cid").innerText;
};

const loadData = async (cid) => {
  const resp = await fetch(`${hyperbeeServer}/${cid}`);
  if (!resp.ok) {
    throw new Error("failed to load data");
  }
  return new Uint8Array(await resp.arrayBuffer());
};

const processData = (bytes) => {
  const data = IpldDagCbor.decode(bytes);
  console.log(data);
  const parentDiv = document.getElementById("hyperbee");
  const tbl = document.createElement("table");
  Object.entries(data).forEach(([k, v]) => {
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
};

(async () => {
  try {
    await loadScript(dagCborURL);
    processData(await loadData(getCID()));
  } catch (e) {
    console.error(e);
  }
})();
