import express from "express";
import Hypercore from "hypercore";
import Hyperbee from "hyperbee";
import cors from "cors";
import { encode, decode } from "@ipld/dag-cbor";
import { env } from "node:process";
import bodyParser from "body-parser";
import { expressjwt } from "express-jwt";
import assert from "node:assert";

import { dbPut, setSigningKey } from "./src/dbPut.js";
import { keyFromPem } from "./src/signAttestation.js";
import { encodeFromType, indexFindMatches, indexPut } from "./src/index.js";
import { dbRawValue } from "./src/dbGet.js";

// Last import
import "dotenv/config";

const sigKey = await keyFromPem(env.HYPERBEE_SIGKEY_PATH);
setSigningKey(sigKey);

// Prevent leaking error msgs
// https://expressjs.com/en/advanced/best-practice-performance.html#set-node_env-to-production
env.NODE_ENV = "production";

const app = express();
const port = env.PORT ?? 3001;
const corePath = env.UWAZI_HYPERCORE ?? "server.hypercore";

// Setup hyperbee
const core = new Hypercore(corePath);
await core.ready();
const db = new Hyperbee(core, {
  keyEncoding: "binary",
  valueEncoding: "binary",
});

// CORS
app.use(
  cors({
    origin(origin, callback) {
      // Allow all origins because authentication is checked
      // This also allows non-browser clients that don't set the Origin header
      callback(null, true);
    },
    credentials: true,
  })
);

// Allow access to raw POST body bytes
app.use(bodyParser.raw({ type: () => true }));

// JWT checking
app.use(
  expressjwt({
    secret: env.JWT_SECRET,
    algorithms: ["HS256"],
  }).unless({ method: ["OPTIONS", "GET"] })
);

// Make 401 error visible to user
app.use((err, req, res, next) => {
  if (err.name === "UnauthorizedError") {
    res.status(401).send("401 Unauthorized");
  } else {
    next(err);
  }
});

/// Routes ///

// All routes are documented in docs/http.md rather than here.

// Search index (data in query params)
// CIDs are returned
app.get("/i", async (req, res) => {
  if (req.query.query !== "match") {
    res.status(400).send("only match queries are supported");
    return;
  }
  let encodedValue;
  try {
    encodedValue = encodeFromType(req.query.val, req.query.type);
  } catch (e) {
    res.status(400).send(e.message);
    return;
  }

  const cids = await indexFindMatches(db, req.query.key, encodedValue);
  if (req.query.names !== "1") {
    res.type("application/cbor");
    res.send(Buffer.from(encode(cids)));
    return;
  }

  const ret = [];
  for (const cid of cids) {
    // eslint-disable-next-line no-await-in-loop
    let name = await dbRawValue(db, cid, "title");
    if (!name || typeof name !== "string") {
      // eslint-disable-next-line no-await-in-loop
      name = await dbRawValue(db, cid, "name");
    }
    if (!name || typeof name !== "string") {
      name = "";
    }
    ret.push({ name, cid });
  }

  res.type("application/cbor");
  res.send(Buffer.from(encode(ret)));
});

// Get all attestations for CID
app.get("/c/:cid", async (req, res) => {
  const metadata = {};
  for await (const { key, value } of db.createReadStream({
    gte: `att/${req.params.cid}`,
    lt: `att/${req.params.cid}0`, // 0 is the symbol after / in binary, so the range of keys is the keys in the format <cid>/<any>
  })) {
    // Key of map is database key but with prefix (att), CID, and slash separators removed
    // Prefix + CID-ending slash is 5 chars
    metadata[key.slice(req.params.cid.length + 5)] = decode(value);
  }
  res.type("application/cbor");
  res.send(Buffer.from(encode(metadata)));
});

// Set a single attestation for a CID
app.post("/c/:cid/:attr", async (req, res, next) => {
  let data;
  try {
    data = decode(new Uint8Array(req.body));
    assert.ok("value" in data);
    assert.ok(data.encKey === false || data.encKey instanceof Uint8Array);
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
    return;
  }

  res.status(200).send();
});

// Set multiple attestations for a CID
app.post("/c/:cid", async (req, res, next) => {
  let data;
  try {
    data = decode(new Uint8Array(req.body));
    assert.equal(typeof data, "object");
  } catch (e) {
    console.log(e);
    res.status(400).send();
    return;
  }
  try {
    const batch = db.batch();
    const putPromises = [];
    for (const { key, value, type } of data) {
      putPromises.push(dbPut(batch, req.params.cid, key, value));
      if (req.query.index === "1" && type != null) {
        let encodedValue;
        try {
          encodedValue = encodeFromType(value, type);
        } catch (e) {
          res.status(400).send(e.message);
          return;
        }
        putPromises.push(indexPut(batch, key, encodedValue, req.params.cid));
      }
    }
    await Promise.all(putPromises);
    await batch.flush();
  } catch (e) {
    next(e);
    res.status(500).send();
    return;
  }

  res.status(200).send();
});

/// End of routes ///

app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
