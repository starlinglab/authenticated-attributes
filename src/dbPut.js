import { encode } from "@ipld/dag-cbor";
import { CID } from "multiformats";
import OpenTimestamps from "opentimestamps";
import { getPublicKeyAsync } from "@noble/ed25519";

import { signAttestation } from "./signAttestation.js";
import { encryptValue } from "./encryptValue.js";
import {
  timestampAttestation,
  getDetachedTimestampFile,
} from "./otsTimestamp.js";
import { makeKey } from "./makeKey.js";
import { dbGet } from "./dbGet.js";
import { attestationVersion } from "./version.js";
import { encodeAttestation } from "./encodeAttestation.js";

let sigKey = null;

/**
 * Set a global signing key for write operations.
 * @param {Uint8Array} privKey - ed25519 private key
 */
const setSigningKey = (privKey) => {
  sigKey = privKey;
};

/**
 * Put data in the database.
 * @param {*} db - Hyperbee or batch
 * @param {string} id - CID
 * @param {string} attr - attribute/key
 * @param {*} value - data to be stored, as JavaScript object
 * @param {Uint8Array} [encryptionKey=false] - 32 byte key, if encryption is needed
 * @returns {Promise<*>} - underlying hyperbee db.put result, usually undefined
 */
const dbPut = async (db, id, attr, value, encryptionKey = false) => {
  const rawAttestation = {
    CID: CID.parse(id),
    attribute: attr,
    value,
    encrypted: Boolean(encryptionKey),
    timestamp: new Date().toISOString(),
  };
  const signature = await signAttestation(sigKey, rawAttestation);
  const signedAttestation = {
    attestation: rawAttestation,
    signature,
  };

  const attestation = rawAttestation;
  if (encryptionKey) {
    attestation.value = encryptValue(value, encryptionKey);
    attestation.encrypted = true;
  }

  const otsTimestamp = await timestampAttestation(signedAttestation);

  const key = makeKey(id, attr);
  return db.put(
    key,
    encode({
      attestation,
      signature,
      timestamp: {
        ots: otsTimestamp,
      },
      version: attestationVersion,
    })
  );
};

/**
 * Put data in the database, adding multiple key-value pairs at once.
 * This is much faster because timestamping can be batched, but each timestamp proof
 * will be larger than with dbPut.
 * @param {*} db - Hyperbee
 * @param {*} data - array of triples: [cidString, attrString, valueObject]
 * @param {Uint8Array} [encryptionKey=false] - 32 byte key, if encryption is needed
 */
const dbPutMultiple = async (db, data, encryptionKey = false) => {
  const detaches = [];
  const puts = {}; // map key string to un-encoded attestation object

  // Store put data
  for (const [id, attr, value] of data) {
    const rawAttestation = {
      CID: CID.parse(id),
      attribute: attr,
      value,
      encrypted: Boolean(encryptionKey),
      timestamp: new Date().toISOString(),
    };
    // eslint-disable-next-line no-await-in-loop
    const signature = await signAttestation(sigKey, rawAttestation);
    const signedAttestation = {
      attestation: rawAttestation,
      signature,
    };

    const attestation = rawAttestation;
    if (encryptionKey) {
      attestation.value = encryptValue(value, encryptionKey);
      attestation.encrypted = true;
    }

    // eslint-disable-next-line no-await-in-loop
    detaches.push(await getDetachedTimestampFile(signedAttestation));

    puts[makeKey(id, attr)] = {
      attestation,
      signature,
      timestamp: {
        // Copied from otsTimestamp.js
        ots: {
          // eslint-disable-next-line no-await-in-loop
          msg: (await encodeAttestation(signedAttestation)).toString(),
          upgraded: false,
          proof: null, // added below
        },
      },
      version: attestationVersion,
    };
  }

  // Timestamp, but disable console.log first to prevent "Submitting to remote calendar" messages
  // Adapted from otsTimestamp.js
  const oldConsoleLog = console.log;
  console.log = () => {};
  await OpenTimestamps.stamp(detaches);
  console.log = oldConsoleLog;

  // Do puts
  const batch = db.batch();
  let i = 0;
  for (const [id, attr] of data) {
    const key = makeKey(id, attr);
    puts[key].timestamp.ots.proof = detaches[i].serializeToBytes();
    // eslint-disable-next-line no-await-in-loop
    await batch.put(key, encode(puts[key]));
    i += 1;
  }
  await batch.flush();
};

class NotArrayError extends Error {}

/**
 * Appends to an array in the database.
 *
 * If the given attribute doesn't exist an array will be created.
 *
 * If a non-array object is already stored under the given attribute a
 * NotArrayError will be thrown.
 *
 * The new value of the array is returned.
 *
 * A batch is used so that the append is treated as one locked atomic operation,
 * not a separate read and write.
 *
 * @param {*} db - Hyperbee
 * @param {string} id - CID
 * @param {string} attr - attribute/key
 * @param {*} value - data to be stored, as JavaScript object
 * @param {Uint8Array} [encryptionKey=false] - 32 byte key, if encryption is needed
 * @returns {Promise<*>} - array as now stored in database
 */
const dbAppend = async (db, id, attr, value, encryptionKey = false) => {
  const batch = db.batch();
  await batch.lock();

  const result = await dbGet(
    batch,
    id,
    attr,
    await getPublicKeyAsync(sigKey),
    encryptionKey,
    true
  );
  if (result === null) {
    // Nothing is stored under this attribute yet
    await dbPut(batch, id, attr, [value], encryptionKey);
    await batch.flush();
    return [value];
  }
  if (!(result.value instanceof Array)) {
    throw new NotArrayError();
  }

  // Append to existing array
  result.value.push(value);
  await dbPut(batch, id, attr, result.value, encryptionKey);
  await batch.flush();
  return result.value;
};

/**
 * Turn relationship data into batched put data for dbPutMultiple.
 * Note that this will not overwrite existing relationships.
 * See dbAddRelation for data details.
 *
 * @param {*} db - Hyperbee
 * @param {*} data - array of [id, childOrParent, relationType, relationCid]
 * @returns {*} - data for dbPutMultiple
 */
const batchRelationships = async (db, data) => {
  const batch = db.batch();
  await batch.lock();

  // Get existing id+childOrParent data, store it, add this data to it,
  // then transform that whole struct into triples for dbPutMultiple

  const hierData = {};

  for (const [id, childOrParent, relationType, relationCid] of data) {
    if (childOrParent !== "children" && childOrParent !== "parents") {
      throw new Error(
        `childOrParent must be children or parents, found '${childOrParent}'`
      );
    }

    let result;
    if (hierData[id] != null && hierData[id][childOrParent] != null) {
      result = hierData[id][childOrParent];
    } else {
      // eslint-disable-next-line no-await-in-loop
      result = await dbGet(
        batch,
        id,
        childOrParent,
        // eslint-disable-next-line no-await-in-loop
        await getPublicKeyAsync(sigKey),
        false,
        true
      );
      if (result != null) {
        if (!hierData[id]) hierData[id] = {};
        hierData[id][childOrParent] = result.value;
      }
    }
    if (result == null) {
      // Nothing stored here yet
      if (!hierData[id]) hierData[id] = {};
      hierData[id][childOrParent] = { [relationType]: [relationCid] };
    } else if (relationType in hierData[id][childOrParent]) {
      hierData[id][childOrParent][relationType].push(relationCid);
    } else {
      hierData[id][childOrParent][relationType] = [relationCid];
    }
  }

  // Transform hierData into data for dbPutMultiple: [[cidString, attrString, valueObject], ...]
  const putData = [];
  for (const [key, value] of Object.entries(hierData)) {
    if (value.children) {
      putData.push([key, "children", value.children]);
    }
    if (value.parents) {
      putData.push([key, "parents", value.parents]);
    }
  }

  await batch.close();
  return putData;
};

/**
 * Add a relation to the database according to our relationship schema.
 *
 * If the given key and/or relationType doesn't exist it will be created.
 *
 * Duplicate CIDs in the array are allowed.
 *
 * A batch is used so that the change is treated as one locked atomic operation,
 * not a separate read and write.
 *
 * @param {*} db - Hyperbee
 * @param {string} id - CID
 * @param {string} childOrParent is either "children" or "parents" as the db key
 * @param {string} relationType is a type for the relation like "derived" or "transcoded"
 * @param {CID} relationCid is the CID object to be added as a relation
 */
const dbAddRelation = async (
  db,
  id,
  childOrParent,
  relationType,
  relationCid
) => {
  if (childOrParent !== "children" && childOrParent !== "parents") {
    throw new Error("childOrParent must be children or parents");
  }

  const batch = db.batch();
  await batch.lock();

  const result = await dbGet(
    batch,
    id,
    childOrParent,
    await getPublicKeyAsync(sigKey),
    false,
    true
  );
  if (result === null) {
    // Nothing is stored under this attribute yet
    await dbPut(batch, id, childOrParent, { [relationType]: [relationCid] });
    await batch.flush();
    return;
  }
  if (relationType in result.value) {
    result.value[relationType].push(relationCid);
  } else {
    result.value[relationType] = [relationCid];
  }
  await dbPut(batch, id, childOrParent, result.value);
  await batch.flush();
};

/**
 * Same as dbAddRelation. The first CID that matches the given one is removed.
 *
 * @param {*} db - Hyperbee
 * @param {string} id - CID
 * @param {string} childOrParent is either "children" or "parents" as the db key
 * @param {string} relationType is a type for the relation like "derived" or "transcoded"
 * @param {CID} relationCid is the CID object to be added as a relation
 */
const dbRemoveRelation = async (
  db,
  id,
  childOrParent,
  relationType,
  relationCid
) => {
  if (childOrParent !== "children" && childOrParent !== "parents") {
    throw new Error("childOrParent must be children or parents");
  }

  const batch = db.batch();
  await batch.lock();

  const result = await dbGet(
    batch,
    id,
    childOrParent,
    await getPublicKeyAsync(sigKey),
    false,
    true
  );
  if (result === null) {
    // Nothing is stored under this attribute yet, so do nothing
    await batch.flush();
    return;
  }
  if (!(relationType in result.value)) {
    // Array for this relationType doesn't exist, so do nothing
    await batch.flush();
    return;
  }
  // Array exists for relationType
  for (let i = 0; i < result.value[relationType].length; i++) {
    const cid = result.value[relationType][i];
    if (cid.equals(relationCid)) {
      result.value[relationType].splice(i, 1);
      break;
    }
  }
  await dbPut(batch, id, childOrParent, result.value);
  await batch.flush();
};

export {
  dbPut,
  setSigningKey,
  dbAppend,
  dbAddRelation,
  dbRemoveRelation,
  NotArrayError,
  dbPutMultiple,
  batchRelationships,
};
