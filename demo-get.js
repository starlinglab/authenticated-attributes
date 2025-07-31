import { getInfo } from "./src/otsTimestamp.js";
import { dbGet, dbIsEncrypted, dbRawValue } from "./src/dbGet.js";
import { openDB } from "./src/dbManager.js";

const db = await openDB("demo.hypercore");

// Attestation data
const waczCID = "bafybeifgkpgb7yqgjnovszaio7tzetmdfmigylr24hg6a76wnjxcnhkx54";
const attribute = "description";

// Decode and print value
const result = await dbGet(db, waczCID, attribute);
console.log(result);
// TODO
// console.log('timestamp verified?', verifyTimestamp(resultObj));

console.log("\nExtra timestamp info:");
getInfo(result.timestamp.ots.proof);

// Upgrade and check
// console.log("Upgrading...");
// await dbUpgrade(db, waczCID, attribute, sigPubKey);
// getInfo(result.timestamp.ots.proof);

// Encrypted value
//
// 32 byte DEMO encryption key that is reused in demo.js
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
console.log((await dbGet(db, waczCID, "secret-stuff", key, true)).value);
