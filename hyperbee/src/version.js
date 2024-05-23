// https://github.com/starlinglab/authenticated-attributes/issues/61

/**
 * The current attestation version this database writes.
 */
const attestationVersion = "1.0";

/**
 * Find out if this attestation can be decoded.
 *
 * @param {string|undefined|null} ver - attestation version string (X.Y)
 * @returns {boolean}
 */
const isAttVersionSupported = (ver) => {
  if (ver == null || ver === attestationVersion) {
    // No version field (undefined) is equivalent to 1.0 for historical reasons.
    return true;
  }
  if (ver.startsWith("1.")) {
    // Same major version
    return true;
  }
  // Different major version
  return false;
};

export { attestationVersion, isAttVersionSupported };
