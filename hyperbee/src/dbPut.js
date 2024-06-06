import { encode } from "@ipld/dag-cbor";
import { CID } from "multiformats";

import { getPublicKeyAsync } from "@noble/ed25519";
import { signAttestation } from "./signAttestation.js";
import { encryptValue } from "./encryptValue.js";
import { timestampAttestation } from "./otsTimestamp.js";
import { makeKey } from "./makeKey.js";
import { dbGet } from "./dbGet.js";
import { attestationVersion } from "./version.js";

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
};
