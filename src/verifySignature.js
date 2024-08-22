import { webcrypto } from "node:crypto";

import { verifyAsync } from "@noble/ed25519";

import { encodeAttestation } from "./encodeAttestation.js";

// Support Node.js 18 (LTS)
// https://github.com/paulmillr/noble-ed25519#usage
if (!globalThis.crypto) globalThis.crypto = webcrypto;

/**
 * @ignore
 * @throws if failed to verify
 * @param {*} attestationObj
 * @param {Uint8Array} givenPubKey
 * @returns {Promise<true>}
 */
const verifyAttSignature = async (attestationObj, givenPubKey) => {
  // check that the signed message is the CID for the rawAttestation
  const rawAttestationCID = await encodeAttestation(attestationObj.attestation);
  if (!rawAttestationCID.equals(attestationObj.signature.msg)) {
    throw new Error(
      "Could not verify signature due to the signed message not matching the raw attestation CID"
    );
  }

  // verify the signature object

  const { sig, msg, pubKey } = attestationObj.signature;

  // Confirm public key matches expected one
  const areEqual =
    givenPubKey.length === pubKey.length &&
    givenPubKey.every((value, index) => value === pubKey[index]);
  if (!areEqual) {
    throw new Error(
      `given public key (${givenPubKey}) does not match stored one (${pubKey}`
    );
  }

  const isValid = await verifyAsync(sig, msg.bytes, givenPubKey);
  if (!isValid) {
    throw new Error("signature could not be validated");
  }
  return true;
};

export { verifyAttSignature };
