const hyperbeeServer = "http://localhost:3001";

const dagCborURL =
  "https://cdn.jsdelivr.net/npm/@ipld/dag-cbor@9/dist/index.min.js";

const isScriptAlreadyIncluded = (src) => {
  const scripts = document.getElementsByTagName("script");
  for (let i = 0; i < scripts.length; i++)
    if (scripts[i].getAttribute("src") === src) return true;
  return false;
};

const loadScript = (url) => {
  if (!isScriptAlreadyIncluded(url)) {
    const script = document.createElement("script");
    script.onload = function () {
      console.log("script loaded");
      loadData();
    };
    script.src = url;
    document.head.appendChild(script);
  } else {
    console.log("script was already loaded.");
  }
};

const processData = (bytes) => {
  const data = IpldDagCbor.decode(bytes);
  console.log(data);
  const parentElem = document.getElementById("hyperbee");
  parentElem.innerText = JSON.stringify(data);
};

const loadData = () => {
  const xhr = new XMLHttpRequest();
  xhr.open("GET", `${hyperbeeServer}/abc`, true);
  xhr.responseType = "arraybuffer";
  xhr.onload = (e) => {
    if (xhr.readyState === xhr.DONE && xhr.status === 200) {
      processData(new Uint8Array(xhr.response));
    } else {
      console.error(xhr.statusText);
    }
  };
  xhr.onerror = (e) => {
    console.error(xhr.statusText);
  };
  xhr.send(null);
};

loadScript(dagCborURL);
