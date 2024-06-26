import { decode } from "@ipld/dag-cbor";
import pkg from "tweetnacl";

const { secretbox } = pkg;

class DecryptError extends Error {}

/**
 * Decrypt and decode an encrypted value from the database.
 *
 * Throws a DecryptError if decryption fails.
 *
 * @param {*} msgWithNonce - the bytes of attestation.value as a Uint8Array or Buffer
 * @param {*} encryptionKey - a 32 byte decryption key (Uint8Array or Buffer)
 * @returns {*} - the decrypted value as a JavaScript object (NOT dag-cbor bytes)
 */
const decryptValue = (msgWithNonce, encryptionKey) => {
  // Adapted from https://github.com/dchest/tweetnacl-js/wiki/Examples#secretbox
  const nonce = msgWithNonce.slice(0, secretbox.nonceLength);
  const msg = msgWithNonce.slice(secretbox.nonceLength, msgWithNonce.length);
  const decrypted = secretbox.open(msg, nonce, encryptionKey);
  if (!decrypted) {
    throw new DecryptError();
  }
  return decode(decrypted);
};

export { decryptValue, DecryptError };
