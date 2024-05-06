import { readFile } from "node:fs/promises";
import { webcrypto } from "node:crypto";

import { getPublicKeyAsync, signAsync } from "@noble/ed25519";

import { encodeAttestation } from "./encodeAttestation.js";

// Support Node.js 18 (LTS)
// https://github.com/paulmillr/noble-ed25519#usage
if (!globalThis.crypto) globalThis.crypto = webcrypto;

/**
 * @ignore
 * @param {Uint8Array} privKey
 * @param {*} rawAttestation
 * @returns {object}
 */
const signAttestation = async (privKey, rawAttestation) => {
  const pubKey = await getPublicKeyAsync(privKey);
  const rawAttCID = await encodeAttestation(rawAttestation);
  const signature = await signAsync(rawAttCID, privKey);
  return { sig: signature, msg: rawAttCID, pubKey };
};

/**
 * Extracts a 32-byte ed25519 private key from the given PEM/ASN encoded key file,
 * such as those generated by openssl.
 *
 * @param {string} pemPath - path to .pem file
 * @returns {Promise<Buffer>}
 */
const keyFromPem = async (pemPath) => {
  /*
  Adapted from my work in the shell:
  $ cat example.key | sed -n 2p | base64 -d | tail -c 32  # and then base64 again to make it visible

  Where example.key looks like this:
  
  -----BEGIN PRIVATE KEY-----
  MC4CAQAwBQYDK2VwBCIEIMgOprnsIP3GrBs/WsIY3tpMKDCTBdWFZ+UThVF23Zk7
  -----END PRIVATE KEY-----
  */

  const data = await readFile(pemPath, { encoding: "utf8" });
  return Buffer.from(data.split(/\r?\n/)[1], "base64").subarray(-32);
};

export { signAttestation, keyFromPem };
