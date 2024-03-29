/*
Import script for taking in Starling integrity pipeline ZIP files and turning
them into Authenticated Attributes databases.
*/

import { argv, env } from "node:process";
import { spawnSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

import Hypercore from "hypercore";
import Hyperbee from "hyperbee";
import AdmZip from "adm-zip";
import { CID } from "multiformats";

import { dbAddRelation, dbPut, setSigningKey } from "./src/dbPut.js";
import { newKey } from "./src/encryptValue.js";
import { keyFromPem } from "./src/signAttestation.js";

if (argv.length !== 5) {
  throw new Error(
    "must specify hypercore for import and for key storage, as well as ZIP file"
  );
}

const sigKey = await keyFromPem(env.HYPERBEE_SIGKEY_PATH);
setSigningKey(sigKey);

// Element 0 and 1 are "node" and "import.js"
const datacorePath = argv[2];
const keycorePath = argv[3];
const zipPath = argv[4];

// JSON file mapping encrypted archive CIDs to content CIDs
const cidMapping = JSON.parse(
  fs.readFileSync(env.MAPPING_JSON_PATH, { encoding: "utf-8" })
);

// Set up Hypercore and Hyperbee

const datacore = new Hypercore(datacorePath);
await datacore.ready();
const datadb = new Hyperbee(datacore, {
  keyEncoding: "binary",
  valueEncoding: "binary",
});

const keycore = new Hypercore(keycorePath, undefined, {
  encryptionKey: Buffer.from(env.KEYCORE_KEY, "base64"),
});
await keycore.ready();
const keydb = new Hyperbee(keycore, {
  keyEncoding: "binary",
  valueEncoding: "binary",
});

// Validate ZIP and find files

const zip = new AdmZip(zipPath);
const zipEntries = zip.getEntries();

if (zipEntries.length < 3) {
  throw new Error("ZIP file must have at least three files");
}

let metaContentEntry = false;
let metaRecorderEntry = false;
let contentEntry = false;

zipEntries.forEach((zipEntry) => {
  if (zipEntry.entryName.endsWith("-meta-content.json")) {
    metaContentEntry = zipEntry;
  } else if (zipEntry.entryName.endsWith("-meta-recorder.json")) {
    metaRecorderEntry = zipEntry;
  } else if (
    !zipEntry.entryName.includes("-meta-") &&
    !zipEntry.entryName.includes("/")
  ) {
    contentEntry = zipEntry;
  }
});

if (!metaContentEntry || !metaRecorderEntry || !contentEntry) {
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
  { input: contentEntry.getData() }
);
const contentCID = ipfsProc.stdout.toString("utf-8").trim();

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

await dbPut(datadb, contentCID, "asset", CID.parse(contentCID)); // So that asset CID is ts'd and signed directly
console.log(`Recorded CID in db: ${contentCID}`);
await dbPut(datadb, contentCID, "filename", contentEntry.entryName);
console.log(`Recorded filename in db: ${contentEntry.entryName}`);
await dbPut(datadb, contentCID, "zipname", path.basename(zipPath));
console.log(`Recorded zipname in db: ${path.basename(zipPath)}`);

// Store as attribute and alias
await dbPut(datadb, contentCID, "zipcid", CID.parse(zipCID));
await dbPut(datadb, zipCID, "assetcid", CID.parse(contentCID));
console.log(`Recorded zipcid in db: ${zipCID}`);

// Make encryption key and store
const encKey = newKey();
await dbPut(keydb, contentCID, "enckey", encKey);

const metaContent = JSON.parse(metaContentEntry.getData()).contentMetadata;
// eslint-disable-next-line no-unused-vars
const metaRecorder = JSON.parse(metaRecorderEntry.getData());

// Add all keys, and go inside known object keys
// dbPut functions are called asynchronously to speed things up

const promises = [];

// eslint-disable-next-line no-restricted-syntax
for (const key in metaContent) {
  // https://eslint.org/docs/latest/rules/guard-for-in
  if (!Object.hasOwn(metaContent, key)) {
    // eslint-disable-next-line no-continue
    continue;
  }

  console.log(`Processing key: ${key}`);

  if (key === "extras") {
    // eslint-disable-next-line no-restricted-syntax
    for (const extrasKey in metaContent[key]) {
      // https://eslint.org/docs/latest/rules/guard-for-in
      if (!Object.hasOwn(metaContent, key)) {
        // eslint-disable-next-line no-continue
        continue;
      }

      if (extrasKey === "relatedAssetCid") {
        // Store this as parent<->child relationship
        // Use mapping file to turn this encrypted archive CID into a content CID,
        // then store it as an array
        const parentEncryptedArchiveCid = metaContent[key][extrasKey];
        const parentContentCid = cidMapping[parentEncryptedArchiveCid];

        // Using await here for consistency when adding relations (since batch is used)
        // XXX this could be improved later

        // eslint-disable-next-line no-await-in-loop
        await dbAddRelation(
          datadb,
          contentCID,
          "parents",
          "verified",
          CID.parse(parentContentCid)
        );
        // eslint-disable-next-line no-await-in-loop
        await dbAddRelation(
          datadb,
          parentContentCid,
          "children",
          "verified",
          CID.parse(contentCID)
        );
      }
      promises.push(
        dbPut(datadb, contentCID, extrasKey, metaContent[key][extrasKey])
      );
    }
  } else if (key === "private") {
    // eslint-disable-next-line no-restricted-syntax
    for (const privateKey in metaContent[key]) {
      // https://eslint.org/docs/latest/rules/guard-for-in
      if (!Object.hasOwn(metaContent, key)) {
        // eslint-disable-next-line no-continue
        continue;
      }

      // Encrypt these ones
      promises.push(
        dbPut(
          datadb,
          contentCID,
          privateKey,
          metaContent[key][privateKey],
          encKey
        )
      );
    }
  } else {
    promises.push(dbPut(datadb, contentCID, key, metaContent[key]));
  }
}

// XXX: skip metaRecorder for now

await Promise.all(promises);
