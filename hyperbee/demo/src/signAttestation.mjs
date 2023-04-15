import * as ed from "@noble/ed25519";

import { encodeAttestation } from "./encodeAttestation.mjs";

const signAttestation = async (privKey, rawAttestation) => {
  const pubKey = await ed.getPublicKeyAsync(privKey);
  const rawAttCID = await encodeAttestation(rawAttestation);
  const signature = await ed.signAsync(rawAttCID, privKey);
  return { signature, signedMsg: rawAttCID, pubKey };
};

export { signAttestation };
