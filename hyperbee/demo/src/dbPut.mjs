import { encode, decode } from "@ipld/dag-cbor";
import { CID } from "multiformats";
import * as ed from "@noble/ed25519";

import { signAttestation } from "./signAttestation.mjs";
import { encryptValue } from "./encryptValue.mjs";
import { timestampAttestation } from "./timestamp.mjs";
import { makeKey } from "./makeKey.mjs";

// TODO: load from elsewhere.
// DO NOT USE IN PRODUCTION
const privKey = ed.utils.randomPrivateKey();

const dbPut = async (db, id, attr, value, encryptionKey = false) => {
  const rawAttestation = { CID: CID.parse(id), attribute: attr, value };
  const signature = await signAttestation(privKey, rawAttestation);
  const signedAttestation = {
    ...rawAttestation,
    signature,
  };

  let attestation;

  if (encryptionKey) {
    attestation = {
      CID: id,
      attribute: attr,
      value: encryptValue(value, encryptionKey),
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

export { dbPut };
