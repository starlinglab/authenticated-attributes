import Hypercore from "hypercore";
import Hyperbee from "hyperbee";
import { BSON } from "bson";

import { dbPut } from "./src/dbPut.mjs";
import { makeKey } from "./src/makeKey.mjs";

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
const value =
  "Web archive [ https://t.me/place_kh, https://t.me/place_kh/7848, https://t.me/s/place_kh/7848 ] captured using Browsertrix on 2022-06-07";

// Add attestation, sign, timestamp, and encrypt as needed.
await dbPut(db, waczCID, attribute, value, false);

// Decode and print BSON value
const data = await db.get(makeKey(waczCID, attribute));
console.log(BSON.deserialize(data.value, { promoteBuffers: true }));
