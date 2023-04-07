import Hypercore from "hypercore";
import Hyperbee from "hyperbee";
import { BSON } from "bson";

const core = new Hypercore("./demo-storage");

// core.key and core.discoveryKey will only be set after core.ready resolves
await core.ready();

const db = new Hyperbee(core, {
  keyEncoding: "utf-8",
  valueEncoding: "binary",
});

// Put BSON value
await db.put(
  "key",
  BSON.serialize({ sig: 123, timestamp: new Uint8Array([0x0, 0x1, 0x2, 0x3]) })
);

// Decode and print BSON value
const data = await db.get("key");
console.log(BSON.deserialize(data.value));
