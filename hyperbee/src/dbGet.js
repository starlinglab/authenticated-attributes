import { decode } from "@ipld/dag-cbor";

import { verifyAttSignature } from "./verifySignature.js";
import { decryptValue } from "./decryptValue.js";
import { makeKey } from "./makeKey.js";

/**
 * Get verified output from the database.
 * Only properly signed entries will be returned.
 *
 * If the value is encrypted and encKey is not provided, an error will be raised,
 * as this means the signature cannot be validated either.
 *
 * The "encrypted" boolean will not be changed.
 *
 * Timestamping is currently not validated.
 *
 * null is returned if the key doesn't exist in the database.
 *
 * Providing a batch instead of a db is allowed.
 *
 * @param {*} db - Hyperbee or batch
 * @param {string} id - CID
 * @param {string} attr - attribute/key
 * @param {Uint8Array} sigKey - ed25519 public key
 * @param {Uint8Array} [encKey=false] - 32 byte key, if decryption is needed
 * @param {boolean} [reduced=false] - if set to true only the value and timestamp are returned, not the whole object
 * @returns {object|null} - see schema docs
 */
const dbGet = async (db, id, attr, sigKey, encKey = false, reduced = false) => {
  const result = await db.get(makeKey(id, attr));
  if (result === null) {
    return null;
  }
  const resultObj = decode(result.value);
  if (resultObj.attestation.encrypted) {
    resultObj.attestation.value = decryptValue(
      resultObj.attestation.value,
      encKey
    );
  }
  await verifyAttSignature(resultObj, sigKey);
  if (reduced) {
    return {
      value: resultObj.attestation.value,
      timestamp: resultObj.attestation.timestamp,
    };
  }
  return resultObj;
};

/**
 * Returns if the attribute is listed as encrypted.
 *
 * No signatures are validated.
 *
 * null is returned if the key doesn't exist in the database.
 *
 * @param {*} db - Hyperbee or batch
 * @param {string} id - CID
 * @param {string} attr - attribute/key
 * @returns {boolean|null}
 */
const dbIsEncrypted = async (db, id, attr) => {
  const result = await db.get(makeKey(id, attr));
  if (result === null) {
    return null;
  }
  const resultObj = decode(result.value);
  return resultObj.attestation.encrypted;
};

/**
 * Returns only the decoded value of the given attribute.
 * No signatures are validated!
 *
 * Specifically the attestation value is returned.
 *
 * null is returned if the key doesn't exist in the database.
 *
 * @param {*} db - Hyperbee or batch
 * @param {string} id - CID
 * @param {string} attr - attribute/key
 * @returns {*}
 */
const dbRawValue = async (db, id, attr) => {
  const result = await db.get(makeKey(id, attr));
  if (result === null) {
    return null;
  }
  const resultObj = decode(result.value);
  return resultObj.attestation.value;
};

export { dbGet, dbIsEncrypted, dbRawValue };
