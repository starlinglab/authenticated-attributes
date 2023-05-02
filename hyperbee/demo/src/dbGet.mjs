import { decode } from "@ipld/dag-cbor";

import { verifyAttSignature } from "./verifySignature.mjs";
import { decryptValue } from "./decryptValue.mjs";
import { makeKey } from "./makeKey.mjs";

/**
 * Get verified output from the database.
 * Only properly signed entries will be returned.
 *
 * If the value is encrypted and encKey is provided, the returned object will
 * have the value field decrypted. The "encrypted" boolean will not be changed.
 *
 * If "reduced" is set to true only the value and timestamp are returned,
 * not the whole object.
 *
 * Timestamping is currently not validated.
 *
 * sigKey is an ed25519 public key.
 */
const dbGet = async (db, id, attr, sigKey, encKey = false, reduced = false) => {
  const result = await db.get(makeKey(id, attr));
  const resultObj = decode(result.value);
  if (resultObj.attestation.encrypted && encKey) {
    resultObj.attestation.value = decryptValue(
      resultObj.attestation.value,
      encKey
    );
  }
  await verifyAttSignature(resultObj, sigKey);
  if (reduced) {
    return {
      value: resultObj.attestation.value,
      timestamp: resultObj.timestamp.submitted,
    };
  }
  return resultObj;
};

export { dbGet };
