import { encode } from "@ipld/dag-cbor";
import { dbGet } from "./dbGet.js";
import { upgradeTimestampAttestation } from "./timestamp.js";
import { makeKey } from "./makeKey.js";

/**
 * Upgrade the OTS timestamp of an attestation, then save that new timestamp.
 *
 * sigKey is an ed25519 public key.
 */
const dbUpgrade = async (db, id, attr, sigKey, encryptionKey = false) => {
  const att = await dbGet(db, id, attr, sigKey, encryptionKey);
  await upgradeTimestampAttestation(att.timestamp);
  // Store attestation directly since it already has signature etc.
  const key = makeKey(id, attr);
  return db.put(key, encode(att));
};

export { dbUpgrade };
