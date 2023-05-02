import Hypercore from "hypercore";
import Hyperbee from "hyperbee";
import { decode } from "@ipld/dag-cbor";

import { dbPut, setSigningKey } from "./src/dbPut.mjs";
import { makeKey } from "./src/makeKey.mjs";
import { keyFromPem } from "./src/signAttestation.mjs";

// Set up Hypercore and Hyperbee
const core = new Hypercore("./demo.hypercore");
await core.ready();

const db = new Hyperbee(core, {
  keyEncoding: "utf-8",
  valueEncoding: "binary",
});

// Set signing key
setSigningKey(await keyFromPem("./demokey.pem"));

// Attestation data
const waczCID = "bafybeifgkpgb7yqgjnovszaio7tzetmdfmigylr24hg6a76wnjxcnhkx54";
const attribute = "description";
const value =
  "Web archive [ https://t.me/place_kh, https://t.me/place_kh/7848, https://t.me/s/place_kh/7848 ] captured using Browsertrix on 2022-06-07";

// Add attestation, sign, timestamp, and encrypt as needed.
await dbPut(db, waczCID, attribute, value, false);

// Decode and print value
const data = await db.get(makeKey(waczCID, attribute));
console.log(decode(data.value));

// Encrypted value
//
// 32 byte DEMO encryption key that is reused in demo-get.mjs
const key = Buffer.from(
  "QHle+CRiaq8iv1fP9xopZGbO6F7F8926TpSOrReQJ1Q=",
  "base64"
);
await dbPut(db, waczCID, "secret-stuff", [123, "secret value"], key);
