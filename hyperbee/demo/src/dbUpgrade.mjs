import * as ed from "@noble/ed25519";

import { dbGet } from "./dbGet.mjs";
import { upgradeTimestampAttestation } from "./timestamp.mjs";
import { makeKey } from "./makeKey.mjs";
import { encode } from "@ipld/dag-cbor";

// TODO: load from elsewhere.
// DO NOT USE IN PRODUCTION
const sigPubKey = await ed.getPublicKeyAsync(
  Buffer.from("l/bAXV2FQcmsE1zK9P7s6Lih+Traa6hpg9vLRht2wys=", "base64")
);

/**
 * Upgrade the OTS timestamp of an attestation, then save that new timestamp.
 */
const dbUpgrade = async (db, id, attr, encryptionKey = false) => {
  const att = await dbGet(db, id, attr, sigPubKey, encryptionKey);
  await upgradeTimestampAttestation(att.timestamp);
  // Store attestation directly since it already has signature etc.
  const key = makeKey(id, attr);
  return db.put(key, encode(att));
};

export { dbUpgrade };
