import { decode } from "@ipld/dag-cbor";
import pkg from "tweetnacl";

const { secretbox } = pkg;

/**
 * @ignore
 * @param {*} msgWithNonce
 * @param {*} encryptionKey
 * @returns {*}
 */
const decryptValue = (msgWithNonce, encryptionKey) => {
  // Adapted from https://github.com/dchest/tweetnacl-js/wiki/Examples#secretbox
  const nonce = msgWithNonce.slice(0, secretbox.nonceLength);
  const msg = msgWithNonce.slice(secretbox.nonceLength, msgWithNonce.length);
  const decrypted = secretbox.open(msg, nonce, encryptionKey);
  if (!decrypted) {
    throw new Error("Could not decrypt message");
  }
  return decode(decrypted);
};

export { decryptValue };
