import express from "express";
import Hypercore from "hypercore";
import Hyperbee from "hyperbee";
import cors from "cors";
import { encode, decode } from "@ipld/dag-cbor";
import { env } from "node:process";
import bodyParser from "body-parser";

import { dbAddRelation, dbPut, setSigningKey } from "./src/dbPut.mjs";
import { keyFromPem } from "./src/signAttestation.mjs";

const sigKey = await keyFromPem(env.HYPERBEE_SIGKEY_PATH);
setSigningKey(sigKey);

const app = express();
const port = env.PORT ?? 3001;
const corePath = env.UWAZI_HYPERCORE ?? "server.hypercore";

// Setup hyperbee
const core = new Hypercore(corePath);
await core.ready();
const db = new Hyperbee(core, {
  keyEncoding: "utf-8",
  valueEncoding: "binary",
});

// CORS
app.use(cors());

// Allow access to raw POST body bytes
app.use(bodyParser.raw({ type: () => true }));

// Routes

app.get("/:cid", async (req, res) => {
  let metadata = {};
  for await (const { key, value } of db.createReadStream({
    gte: req.params.cid,
    lt: `${req.params.cid}0`, // 0 is the symbol before / in binary, so the range of keys is the keys in the format <cid>/<any>
  })) {
    metadata[key.slice(req.params.cid.length + 1)] = decode(value);
  }
  res.type("application/cbor");
  res.send(Buffer.from(encode(metadata)));
});

app.post("/:cid/:attr", async (req, res, next) => {
  // Expected body from client is dag-cbor encoded
  // Two attrs in map:
  //
  // {
  //   value: <any value>,
  //   encKey: <false or bytes>
  // }

  let data;
  try {
    data = decode(new Uint8Array(req.body));
  } catch (e) {
    console.log(e);
    res.status(400).send();
    return;
  }
  try {
    await dbPut(db, req.params.cid, req.params.attr, data.value, data.encKey);
  } catch (e) {
    next(e);
    res.status(500).send();
  }

  res.status(200).send();
});

app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
