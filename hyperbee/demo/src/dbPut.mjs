import { encode } from "@ipld/dag-cbor";
import { CID } from "multiformats";

import * as ed from "@noble/ed25519";
import { signAttestation } from "./signAttestation.mjs";
import { encryptValue } from "./encryptValue.mjs";
import { timestampAttestation } from "./timestamp.mjs";
import { makeKey } from "./makeKey.mjs";
import { dbGet } from "./dbGet.mjs";

var sigKey = null;

const setSigningKey = (privKey) => {
  sigKey = privKey;
};

const dbPut = async (db, id, attr, value, encryptionKey = false) => {
  const rawAttestation = {
    CID: CID.parse(id),
    attribute: attr,
    value,
    encrypted: Boolean(encryptionKey),
  };
  const signature = await signAttestation(sigKey, rawAttestation);
  const signedAttestation = {
    ...rawAttestation,
    signature,
  };

  let attestation;

  if (encryptionKey) {
    attestation = {
      CID: CID.parse(id),
      attribute: attr,
      value: encryptValue(value, encryptionKey),
      encrypted: true,
    };
  } else {
    attestation = rawAttestation;
  }

  const timestamp = await timestampAttestation(signedAttestation);

  const key = makeKey(id, attr);
  return db.put(
    key,
    encode({
      attestation,
      signature,
      timestamp: timestamp,
    })
  );
};

/**
 * Appends to an array in the database.
 *
 * If the given attribute doesn't exist an array will be created.
 *
 * If a non-array object is already stored under the given attribute an error
 * will be thrown.
 *
 * The new value of the array is returned.
 */
const dbAppend = async (db, id, attr, value, encryptionKey = false) => {
  const result = await dbGet(
    db,
    id,
    attr,
    await ed.getPublicKeyAsync(sigKey),
    encryptionKey,
    true
  );
  if (result === null) {
    // Nothing is stored under this attribute yet
    await dbPut(db, id, attr, [value], encryptionKey);
    return [value];
  }
  if (!(result.value instanceof Array)) {
    throw new Error(`A non-array object is stored at ${attr}`);
  }

  // Append to existing array
  result.value.push(value);
  await dbPut(db, id, attr, result.value, encryptionKey);
  return result.value;
};

export { dbPut, setSigningKey, dbAppend };
