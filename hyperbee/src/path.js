/**
 * Store a filepath -> CID mapping.
 *
 * @param {*} db - Hyperbee or batch
 * @param {string} filepath - absolute filepath (starts with slash)
 * @param {string} cid
 */
const pathSet = async (db, filepath, cid) => {
  await db.put(`path/${filepath}`, cid);
};

/**
 * Get the CID stored at the given filepath.
 *
 * @param {*} db - Hyperbee or batch
 * @param {*} filepath - absolute filepath (starts with slash)
 * @returns {Promise<null|string>}
 */
const pathGet = async (db, filepath) => {
  const r = await db.get(`path/${filepath}`, {
    valueEncoding: "utf-8",
  });
  if (r === null) {
    return null;
  }
  return r.value;
};

export { pathSet, pathGet };
