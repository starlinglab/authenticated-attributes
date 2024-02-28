import { encode } from "@ipld/dag-cbor";
import { dbGet } from "./dbGet.js";
import { upgradeTimestampAttestation } from "./otsTimestamp.js";
import { makeKey } from "./makeKey.js";

/**
 * Upgrade the OTS timestamp of an attestation, then save that new timestamp.
 *
 * @param {*} db - Hyperbee or batch
 * @param {string} id - CID
 * @param {string} attr - attribute/key
 * @param {Uint8Array} sigKey - ed25519 public key
 * @param {Uint8Array} [encryptionKey=false] - 32 byte key, if encryption is needed
 * @returns {*} - underlying hyperbee db.put result, usually undefined
 */
const dbUpgrade = async (db, id, attr, sigKey, encryptionKey = false) => {
  const att = await dbGet(db, id, attr, sigKey, encryptionKey);
  await upgradeTimestampAttestation(att.timestamp);
  // Store attestation directly since it already has signature etc.
  const key = makeKey(id, attr);
  return db.put(key, encode(att));
};

export { dbUpgrade };
