import { encode, decode } from "@ipld/dag-cbor";
import { CID } from "multiformats";

import { signAttestation } from "./signAttestation.mjs";
import { encryptValue } from "./encryptValue.mjs";
import { timestampAttestation } from "./timestamp.mjs";
import { makeKey } from "./makeKey.mjs";

const dbPut = async (db, id, attr, value, encryptionKey = false) => {
  const rawAttestation = { CID: CID.parse(id), [attr]: value };
  const signature = signAttestation(rawAttestation);
  const signedAttestation = {
    ...rawAttestation,
    signature,
  };

  let attestation;

  if (encryptionKey) {
    attestation = {
      CID: id,
      [attr]: encryptValue(value, encryptionKey),
    };
  } else {
    attestation = rawAttestation;
  }

  const timestamp = await timestampAttestation(signedAttestation);

  const key = makeKey(id, attr);
  return db.put(
    key,
    encode({
      ...attestation,
      signature,
      timestamp: timestamp,
    })
  );
};

export { dbPut };
