export function uint8ArrayToBase64(uint8Array) {
  let binaryString = "";
  uint8Array.forEach((byte) => {
    binaryString += String.fromCharCode(byte);
  });
  return btoa(binaryString);
}

/**
 * Returns the index type as a string for the given value.
 *
 * For example, "float64" or "str". null is returned if the value is un-indexable.
 */
export function getIndexType(val) {
  // Can't detect integers: https://github.com/starlinglab/authenticated-attributes/issues/34#issuecomment-1693567351
  if (Number.isFinite(val)) {
    return "float64";
  }
  if (typeof val === "string") {
    return "str";
  }
  if (Array.isArray(val) && typeof val[0] === "string") {
    return "str-array";
  }
  return null;
}
