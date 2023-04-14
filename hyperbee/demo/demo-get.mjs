// Test getting the timestamp value from the HyperbeeInstance

import Hypercore from "hypercore";
import Hyperbee from "hyperbee";
import { BSON } from "bson";

import { makeKey } from "./src/makeKey.mjs";
import { getInfo } from "./src/timestamp.mjs";

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

// Decode and print BSON value
const result = await db.get(makeKey(waczCID, attribute));
const resultObj = BSON.deserialize(result.value, { promoteBuffers: true });
console.log(resultObj);
getInfo(resultObj.timestamp);
