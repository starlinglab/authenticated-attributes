import Hypercore from "hypercore";
import Hyperbee from "hyperbee";

/**
 * Creates hypercore/hyperbee at given path.
 * @param {String} path
 * @returns {Hyperbee} database
 */
export async function openDB(path) {
  const core = new Hypercore(path);
  await core.ready();
  return new Hyperbee(core, {
    keyEncoding: "utf-8",
    valueEncoding: "binary",
  });
}
