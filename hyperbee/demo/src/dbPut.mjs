import { encode } from "@ipld/dag-cbor";
import { CID } from "multiformats";

import { signAttestation } from "./signAttestation.mjs";
import { encryptValue } from "./encryptValue.mjs";
import { timestampAttestation } from "./timestamp.mjs";
import { makeKey } from "./makeKey.mjs";

// TODO: load from elsewhere.
// DO NOT USE IN PRODUCTION
const privKey = Buffer.from(
  "l/bAXV2FQcmsE1zK9P7s6Lih+Traa6hpg9vLRht2wys=",
  "base64"
);

const dbPut = async (db, id, attr, value, encryptionKey = false) => {
  const rawAttestation = {
    CID: CID.parse(id),
    attribute: attr,
    value,
    encrypted: Boolean(encryptionKey),
  };
  const signature = await signAttestation(privKey, rawAttestation);
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

export { dbPut };
