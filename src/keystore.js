// Keystore is stored at ~/.local/share/authenticated-attributes/<db_id>.json
// Format is:
//
// {
//   "private key name": {"pub": "abcdef1234...", priv": "abcdef1234..."},
//   "public key name": {"pub": "abcdef1234..."}
// }
//
// Public keys are always stored.
// Private keys are stored if the user is writing to the DB.
// Entries with no private keys are still useful, because they can be used to
// read and verify data from a foreign DB.

import { promises as fs } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";
import * as ed from "@noble/ed25519";

class KeyExistsError extends Error {}

/**
 * @ignore
 * @param {string} dbId - Database identifier
 * @returns {string} - Path to keystore file
 */
const getKeystorePath = (dbId) => {
  const dir = join(
    homedir(),
    ".local",
    "share",
    "authenticated-attributes",
    "keystore"
  );
  return join(dir, `${dbId}.json`);
};

/**
 * @ignore
 * @param {string} dirPath - Directory path to create
 * @returns {Promise<void>}
 */
const ensureDirectory = async (dirPath) => {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (err) {
    if (err.code !== "EEXIST") throw err;
  }
};

/**
 * @ignore
 * @param {string} dbId - Database identifier
 * @returns {Promise<object>} - Keystore object
 */
const loadKeystoreRaw = async (dbId) => {
  const keystorePath = getKeystorePath(dbId);
  const dir = dirname(keystorePath);
  await ensureDirectory(dir);

  try {
    const data = await fs.readFile(keystorePath, "utf8");
    return JSON.parse(data);
  } catch (err) {
    if (err.code === "ENOENT") return {};
    throw err;
  }
};

/**
 * @ignore
 * @param {string} dbId - Database identifier
 * @param {object} keystore - Keystore object to save
 * @returns {Promise<void>}
 */
const saveKeystore = async (dbId, keystore) => {
  const keystorePath = getKeystorePath(dbId);
  await fs.writeFile(keystorePath, JSON.stringify(keystore, null, 2));
};

/**
 * Store a public key in the keystore with the given name.
 * Only use this if you don't have access to the private key.
 *
 * KeyExistsError is raised if a key with this name already exists in this keystore.
 *
 * @param {string} dbId - Database identifier
 * @param {string} name - Name/identifier for the key
 * @param {Uint8Array} publicKey - Public key data
 * @returns {Promise<void>}
 */
const writePublicKey = async (dbId, name, publicKey) => {
  const keystore = await loadKeystoreRaw(dbId);
  if (name in keystore) {
    throw new KeyExistsError();
  }
  const base64Key = Buffer.from(publicKey).toString("base64");
  keystore[name] = { pub: base64Key };
  await saveKeystore(dbId, keystore);
};

/**
 * Store a private key in the keystore with the given name.
 * The corresponding public key will also be stored.
 *
 * Only use this if you have generated a private key already externally.
 * Otherwise use generateKeypair.
 *
 * A KeyExistsError is raised if this key already exists.
 *
 * @param {string} dbId - Database identifier
 * @param {string} name - Name/identifier for the key
 * @param {Uint8Array} privateKey - Private key data
 * @returns {Promise<void>}
 */
const writePrivateKey = async (dbId, name, privateKey) => {
  const keystore = await loadKeystoreRaw(dbId);
  if (name in keystore) {
    throw new KeyExistsError();
  }
  keystore[name] = {
    priv: Buffer.from(privateKey).toString("base64"),
    pub: Buffer.from(await ed.getPublicKeyAsync(privateKey)).toString("base64"),
  };
  await saveKeystore(dbId, keystore);
};

/**
 * Create an ed25519 key pair and store it in the keystore.
 *
 * @param {string} dbId - Database identifier
 * @param {string} name - Name/identifier for the key
 * @returns {Promise<void>}
 */
const generateKeypair = async (dbId, name) => {
  await writePrivateKey(dbId, name, ed.utils.randomPrivateKey());
};

/**
 * Retrieve a key object by name from the keystore.
 *
 * @param {string} dbId - Database identifier
 * @param {string} name - Name/identifier of the key to retrieve
 * @returns {Promise<object|null>} - Key object with 'pub' and/or 'priv' property as Uint8Array, or null if not found
 */
const getKeyByName = async (dbId, name) => {
  const keystore = await loadKeystoreRaw(dbId);
  const keyData = keystore[name];
  if (!keyData) return null;

  if (keyData.priv) {
    return {
      priv: Buffer.from(keyData.priv, "base64"),
      pub: Buffer.from(keyData.pub, "base64"),
    };
  }
  if (keyData.pub) {
    return { pub: Buffer.from(keyData.pub, "base64") };
  }
};

/**
 * Get all the keys in the keystore, as bytes.
 *
 * @param {string} dbId - Database identifier
 * @returns {Promise<object|null>}
 */
const getKeystore = async (dbId) => {
  const keystore = await loadKeystoreRaw(dbId);
  for (const [keyName, keys] of Object.entries(keystore)) {
    keystore[keyName].pub = Buffer.from(keys.pub, "base64");
    if (keys.priv) {
      keystore[keyName].priv = Buffer.from(keys.priv, "base64");
    }
  }
  return keystore;
};

export {
  writePublicKey,
  writePrivateKey,
  getKeyByName,
  getKeystore,
  generateKeypair,
  KeyExistsError,
};
