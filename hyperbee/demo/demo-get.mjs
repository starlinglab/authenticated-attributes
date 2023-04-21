// Test getting the timestamp value from the HyperbeeInstance

import Hypercore from "hypercore";
import Hyperbee from "hyperbee";
import { decode } from "@ipld/dag-cbor";

import { makeKey } from "./src/makeKey.mjs";
import { getInfo } from "./src/timestamp.mjs";
import { verifyAttSignature } from "./src/verifySignature.mjs";

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

// Decode and print value
const result = await db.get(makeKey(waczCID, attribute));
const resultObj = decode(result.value);
console.log(resultObj);
console.log("signature verified?", await verifyAttSignature(resultObj));
// TODO
// console.log('timestamp verified?', verifyTimestamp(resultObj));

getInfo(resultObj.timestamp.incompleteProof);
