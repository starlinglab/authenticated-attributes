import { webcrypto } from "node:crypto";

import { verifyAsync } from "@noble/ed25519";

import { encodeAttestation } from "./encodeAttestation.js";
import { getKeystore } from "./keystore.js";

// Support Node.js 18 (LTS)
// https://github.com/paulmillr/noble-ed25519#usage
if (!globalThis.crypto) globalThis.crypto = webcrypto;

function isEqualArray(a, b) {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

/**
 * @ignore
 * @throws if failed to verify
 * @param {string} dbId - database identifier
 * @param {*} attestationObj
 * @returns {Promise<true>}
 */
const verifyAttSignature = async (dbId, attestationObj) => {
  // check that the signed message is the CID for the rawAttestation
  const rawAttestationCID = await encodeAttestation(attestationObj.attestation);
  if (!rawAttestationCID.equals(attestationObj.signature.msg)) {
    throw new Error(
      "Could not verify signature due to the signed message not matching the raw attestation CID"
    );
  }

  // verify the signature object

  const { sig, msg, pubKey } = attestationObj.signature;

  // Find this public key in the keystore
  const keystore = await getKeystore(dbId);
  let foundKey = false;
  for (const [_, keys] of Object.entries(keystore)) {
    if (isEqualArray(keys.pub, pubKey)) {
      foundKey = true;
      break;
    }
  }

  if (!foundKey) {
    throw new Error(
      `could not find matching public key in keystore: ${Buffer.from(
        pubKey
      ).toString("base64")}`
    );
  }

  const isValid = await verifyAsync(sig, msg.bytes, pubKey);
  if (!isValid) {
    throw new Error("signature could not be validated");
  }
  return true;
};

export { verifyAttSignature };
