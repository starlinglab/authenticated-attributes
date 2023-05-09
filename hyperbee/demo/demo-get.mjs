// Test getting the timestamp value from the HyperbeeInstance

import Hypercore from "hypercore";
import Hyperbee from "hyperbee";
import * as ed from "@noble/ed25519";

import { getInfo } from "./src/timestamp.mjs";
import { dbGet, dbIsEncrypted, dbRawValue } from "./src/dbGet.mjs";

// Set up Hypercore and Hyperbee
const core = new Hypercore("./demo.hypercore");
await core.ready();

const db = new Hyperbee(core, {
  keyEncoding: "utf-8",
  valueEncoding: "binary",
});

// Attestation data
const waczCID = "bafybeifgkpgb7yqgjnovszaio7tzetmdfmigylr24hg6a76wnjxcnhkx54";
const attribute = "description";
// TODO: this is just a demo key
const sigPubKey = await ed.getPublicKeyAsync(
  Buffer.from("l/bAXV2FQcmsE1zK9P7s6Lih+Traa6hpg9vLRht2wys=", "base64")
);

// Decode and print value
const result = await dbGet(db, waczCID, attribute, sigPubKey);
console.log(result);
// TODO
// console.log('timestamp verified?', verifyTimestamp(resultObj));

console.log("\nExtra timestamp info:");
getInfo(result.timestamp.incompleteProof);

// Encrypted value
const key = Buffer.from(
  "QHle+CRiaq8iv1fP9xopZGbO6F7F8926TpSOrReQJ1Q=",
  "base64"
);

console.log(
  "Is 'secret-stuff' encrypted?",
  await dbIsEncrypted(db, waczCID, "secret-stuff")
);
console.log("Retrieve 'secret-stuff' without encryption key:");
console.log(await dbRawValue(db, waczCID, "secret-stuff"));
console.log("Retrieve 'secret-stuff' WITH encryption key:");
console.log(
  (await dbGet(db, waczCID, "secret-stuff", sigPubKey, key, true)).value
);
