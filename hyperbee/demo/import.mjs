import { argv, env } from "node:process";
import { spawnSync } from "node:child_process";

import Hypercore from "hypercore";
import Hyperbee from "hyperbee";
import AdmZip from "adm-zip";

import { dbPut } from "./src/dbPut.mjs";
import { newKey } from "./src/encryptValue.mjs";
import path from "node:path";

if (argv.length != 5) {
  throw new Error(
    "must specify hypercore for import and for key storage, as well as ZIP file"
  );
}

// Element 0 and 1 are "node" and "import.mjs"
const datacorePath = argv[2];
const keycorePath = argv[3];
const zipPath = argv[4];

// Set up Hypercore and Hyperbee

const datacore = new Hypercore(datacorePath);
await datacore.ready();
const datadb = new Hyperbee(datacore, {
  keyEncoding: "utf-8",
  valueEncoding: "binary",
});

const keycore = new Hypercore(keycorePath, undefined, {
  encryptionKey: Buffer.from(env.KEYCORE_KEY, "base64"),
});
await keycore.ready();
const keydb = new Hyperbee(keycore, {
  keyEncoding: "utf-8",
  valueEncoding: "binary",
});

// Validate ZIP and find files

const zip = new AdmZip(zipPath);
const zipEntries = zip.getEntries();

if (zipEntries.length < 3) {
  throw new Error("ZIP file must have at least three files");
}

let metaContentEntry = false,
  metaRecorderEntry = false,
  waczEntry = false;

zipEntries.forEach(function (zipEntry) {
  if (zipEntry.entryName.endsWith("-meta-content.json")) {
    metaContentEntry = zipEntry;
  } else if (zipEntry.entryName.endsWith("-meta-recorder.json")) {
    metaRecorderEntry = zipEntry;
  } else if (zipEntry.entryName.endsWith(".wacz")) {
    waczEntry = zipEntry;
  }
});

if (!metaContentEntry || !metaRecorderEntry || !waczEntry) {
  throw new Error("not all three required files were found in the ZIP");
}

// Get CID
const ipfsProc = spawnSync(
  "ipfs",
  [
    "add",
    "--only-hash=true",
    "--wrap-with-directory=false",
    "--cid-version=1",
    "--hash=sha2-256",
    "--pin=true",
    "--raw-leaves=true",
    "--chunker=size-262144",
    "--nocopy=false",
    "--fscache=false",
    "--inline=false",
    "--inline-limit=32",
    "--quieter",
    "-",
  ],
  { input: waczEntry.getData() }
);
const waczCID = ipfsProc.stdout.toString("utf-8").trim();

const ipfsProc2 = spawnSync("ipfs", [
  "add",
  "--only-hash=true",
  "--wrap-with-directory=false",
  "--cid-version=1",
  "--hash=sha2-256",
  "--pin=true",
  "--raw-leaves=true",
  "--chunker=size-262144",
  "--nocopy=false",
  "--fscache=false",
  "--inline=false",
  "--inline-limit=32",
  "--quieter",
  zipPath,
]);
const zipCID = ipfsProc2.stdout.toString("utf-8").trim();

await dbPut(datadb, waczCID, "asset", waczCID); // So that asset CID is ts'd and signed directly
console.log(`Recorded CID in db: ${waczCID}`);
await dbPut(datadb, waczCID, "filename", waczEntry.entryName);
console.log(`Recorded filename in db: ${waczEntry.entryName}`);
await dbPut(datadb, waczCID, "zipname", path.basename(zipPath));
console.log(`Recorded zipname in db: ${path.basename(zipPath)}`);

// Store as attribute and alias
await dbPut(datadb, waczCID, "zipcid", zipCID);
await dbPut(datadb, zipCID, "assetcid", waczCID);
console.log(`Recorded zipcid in db: ${zipCID}`);

// Make encryption key and store
const encKey = newKey();
await dbPut(keydb, waczCID, "enckey", encKey);

const metaContent = JSON.parse(metaContentEntry.getData())["contentMetadata"];
const metaRecorder = JSON.parse(metaRecorderEntry.getData());

// Add all keys, and go inside known object keys
// dbPut functions are called asynchronously to speed things up

for (var key in metaContent) {
  console.log(`Processing key: ${key}`);

  if (key === "extras") {
    for (var extrasKey in metaContent[key]) {
      dbPut(datadb, waczCID, extrasKey, metaContent[key][extrasKey]);
    }
  } else if (key === "private") {
    for (var privateKey in metaContent[key]) {
      // Encrypt these ones
      dbPut(datadb, waczCID, privateKey, metaContent[key][privateKey], encKey);
    }
  } else {
    dbPut(datadb, waczCID, key, metaContent[key]);
  }
}

// XXX: skip metaRecorder for now
