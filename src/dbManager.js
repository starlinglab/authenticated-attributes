import Hypercore from "hypercore";
import Hyperbee from "hyperbee";
import { generateKeypair, KeyExistsError } from "./keystore.js";

/**
 * Creates hypercore/hyperbee at given path.
 * This also creates a key in the keystore to begin with, called "default",
 * if it doesn't already exist.
 *
 * @param {String} path
 * @returns {Hyperbee} database
 */
export async function openDB(path) {
  const core = new Hypercore(path);
  await core.ready();
  const db = new Hyperbee(core, {
    keyEncoding: "utf-8",
    valueEncoding: "binary",
  });
  try {
    await generateKeypair(db.id, "default");
  } catch (e) {
    if (!(e instanceof KeyExistsError)) {
      throw e;
    }
  }
  return db;
}
