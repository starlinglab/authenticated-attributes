import express from "express";
import Hypercore from "hypercore";
import Hyperbee from "hyperbee";
import cors from "cors";
import { encode, decode } from "@ipld/dag-cbor";
import { env } from "node:process";
import bodyParser from "body-parser";
import { expressjwt } from "express-jwt";
import assert from "node:assert";
import { getPublicKeyAsync } from "@noble/ed25519";
import { CID } from "multiformats";

import {
  dbAddRelation,
  dbAppend,
  dbPut,
  setSigningKey,
  NotArrayError,
} from "./src/dbPut.js";
import { keyFromPem } from "./src/signAttestation.js";
import { encodeFromType, indexFindMatches, indexPut } from "./src/index.js";
import { NeedsKeyError, dbGet, dbRawValue } from "./src/dbGet.js";

// Last import
import "dotenv/config";
import { attToVC } from "./src/vc.js";

const sigPrivKey = await keyFromPem(env.HYPERBEE_SIGKEY_PATH);
setSigningKey(sigPrivKey);
const sigPubKey = await getPublicKeyAsync(sigPrivKey);

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

// JWT checking (can be disabled)
if (env.JWT_SECRET !== "DISABLE_JWT_FOR_DEBUGGING_ONLY") {
  app.use(
    expressjwt({
      secret: env.JWT_SECRET,
      algorithms: ["HS256"],
    }).unless({ method: ["OPTIONS", "GET"] })
  );
}

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
  if (req.query.query !== "match" && req.query.query !== "intersect") {
    res.status(400).send("only match/intersect queries are supported");
    return;
  }
  let encodedValue;
  try {
    if (req.query.type === "str-array") {
      encodedValue = encodeFromType(JSON.parse(req.query.val), req.query.type);
    } else {
      encodedValue = encodeFromType(req.query.val, req.query.type);
    }
  } catch (e) {
    res.status(400).send(e.message);
    return;
  }

  let cids;

  if (req.query.type === "str-array") {
    if (req.query.query !== "intersect") {
      res.status(400).send("query type not supported with str-array");
      return;
    }

    // Return all matches for all parts of array
    // XXX this is quadratic-time-ish
    const indexPromises = [];
    for (const item of encodedValue) {
      indexPromises.push(indexFindMatches(db, req.query.key, item));
    }
    const results = await Promise.all(indexPromises); // Array of CID string arrays
    cids = new Set(); // Prevent duplicate matches
    for (const result of results) {
      for (const cid of result) {
        cids.add(cid);
      }
    }
    cids = Array.from(cids); // Convert back to array for encoding
  } else {
    // Regular type with just a single value
    cids = await indexFindMatches(db, req.query.key, encodedValue);
  }

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

// Get one attestation
app.get("/c/:cid/:attr", async (req, res) => {
  let encKey = false;
  if (req.query.key) {
    encKey = Buffer.from(req.query.key, "base64url");
  }
  let leaveEncrypted = false;
  if (req.query.decrypt === "0") {
    leaveEncrypted = true;
  }
  let att;
  try {
    att = await dbGet(
      db,
      req.params.cid,
      req.params.attr,
      sigPubKey,
      encKey,
      false,
      leaveEncrypted
    );
    if (att === null) {
      res.status(404).send("attribute not found");
      return;
    }
  } catch (e) {
    if (e instanceof NeedsKeyError) {
      res.status(400).send("needs encryption key");
      return;
    }

    // Unexpected error, give up
    throw e;
  }

  if (!req.query.format || req.query.format === "cbor") {
    res.type("application/cbor");
    res.send(Buffer.from(encode(att)));
  } else if (req.query.format === "vc") {
    res.type("application/json");
    res.send(attToVC(att));
  } else {
    res.status(400).send("invalid format requested");
  }
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

// Get all CIDs
app.get("/cids", async (req, res) => {
  const cids = new Set();
  for await (const { key } of db.createReadStream({
    gt: "att/",
    lt: "att0", // 0 is the symbol after / in binary
  })) {
    // keys are in the form "att/<cid>/<attr>", we only want the CID
    cids.add(key.toString().split("/")[1]);
  }
  res.type("application/cbor");
  res.send(Buffer.from(encode(Array.from(cids))));
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
    if (req.query.append === "1") {
      await dbAppend(
        db,
        req.params.cid,
        req.params.attr,
        data.value,
        data.encKey
      );
    } else {
      await dbPut(db, req.params.cid, req.params.attr, data.value, data.encKey);
    }
  } catch (e) {
    if (e instanceof NotArrayError) {
      res.status(400).send("non-array data stored under this attribute");
      return;
    }
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
    for (const entry of data) {
      try {
        assert.ok(entry.encKey == null || entry.encKey instanceof Uint8Array);
      } catch (e) {
        res.status(400).send();
        return;
      }

      putPromises.push(
        dbPut(batch, req.params.cid, entry.key, entry.value, entry.encKey)
      );
      if (
        req.query.index === "1" &&
        entry.type != null &&
        entry.encKey == null
      ) {
        let encodedValue;
        try {
          encodedValue = encodeFromType(entry.value, entry.type);
        } catch (e) {
          res.status(400).send(e.message);
          return;
        }
        putPromises.push(
          indexPut(batch, entry.key, encodedValue, req.params.cid)
        );
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

// Add a relationship
app.post("/rel/:cid", async (req, res, next) => {
  let data;
  try {
    data = decode(new Uint8Array(req.body));
    assert.ok("type" in data);
    assert.ok("relation_type" in data);
    assert.ok("cid" in data);
    assert.ok(data.type === "children" || data.type === "parents");
  } catch (e) {
    console.log(e);
    res.status(400).send();
    return;
  }
  try {
    await dbAddRelation(
      db,
      req.params.cid,
      data.type,
      data.relation_type,
      data.cid
    );
    await dbAddRelation(
      db,
      data.cid.toString(),
      data.type === "children" ? "parents" : "children", // invert
      data.relation_type,
      CID.parse(req.params.cid)
    );
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
