import * as ed from "@noble/ed25519";

import { encodeAttestation } from "./encodeAttestation.mjs";

const verifyAttSignature = async (attestationObj) => {
  // check that the signedMsg is the CID for the rawAttestation
  const rawAttestationCID = await encodeAttestation(attestationObj.attestation);
  if (!rawAttestationCID.equals(attestationObj.signature.signedMsg)) {
    throw new Error(
      "Could not verify signature due to the signed message not matching the raw attestation CID"
    );
  }

  // verify the signature object
  const { signature, signedMsg, pubKey } = attestationObj.signature;
  const isValid = await ed.verifyAsync(signature, signedMsg, pubKey);
  if (!isValid) {
    throw new Error("signature could not be validated");
  }
  return true;
};

export { verifyAttSignature };
