// https://github.com/starlinglab/authenticated-attributes/issues/34

const encodeUint32 = (uint) => {
  const arr = new ArrayBuffer(4); // 32 bits is 4 bytes
  const view = new DataView(arr);
  view.setUint32(0, uint, false);
  return new Uint8Array(arr);
};

/* eslint-disable no-bitwise */

/**
 * As described in the GitHub issue, signed numbers need to be modified so that
 * byte ordering matches their numerical ordering.
 */
const fixSignedBytes = (b) => {
  const bytes = b;
  if ((bytes[0] & 0x80) >>> 7) {
    // Sign bit is 1, so invert all bits
    return bytes.map((e) => ~e);
  }
  // Sign bit is 0, so only toggle on the sign bit
  bytes[0] |= 0x80;
  return bytes;
};

/* eslint-enable no-bitwise */

/**
 * Encode a Date object as int64 Unix timestamp
 */
const encodeDate = (date) => {
  // Max date.getTime() value is ~53 bits large
  // This is larger than a uint32 can hold so it's stored as an int64 to not
  // lose any precision
  const arr = new ArrayBuffer(8); // 64 bits is 8 bytes
  const view = new DataView(arr);
  view.setBigInt64(0, BigInt(date.getTime()), false);
  return fixSignedBytes(new Uint8Array(arr));
};

const encodeFloat64 = (float) => {
  const arr = new ArrayBuffer(8); // 64 bits is 8 bytes
  const view = new DataView(arr);
  view.setFloat64(0, float, false);
  return fixSignedBytes(new Uint8Array(arr));
};

const encodeInt32 = (int) => {
  const arr = new ArrayBuffer(4);
  const view = new DataView(arr);
  view.setInt32(0, int, false);
  return fixSignedBytes(new Uint8Array(arr));
};

const encodeString = (str) => str.toLowerCase().trim();

const indexPut = async (db, prop, value, cid) => {
  // value is optional for db.put
  await db.put(`i/${prop}/${value}/${cid}`);
};

const indexDel = async (db, prop, value, cid) => {
  await db.del(`i/${prop}/${value}/${cid}`);
};

/**
 * Remove all index keys for this property
 */
const indexClear = async (db, prop) => {
  const batch = db.batch();
  await batch.lock();

  for await (const { key } of batch.createReadStream({
    gte: `i/${prop}`,
    lt: `i/${prop}0`, // 0 is the symbol after / in binary, so the range of keys is i/<prop>/.*
  })) {
    // TODO: is not using `await` here safe?
    batch.del(key);
  }

  await batch.flush();
};

export {
  encodeUint32,
  encodeInt32,
  encodeDate,
  encodeFloat64,
  encodeString,
  indexPut,
  indexDel,
  indexClear,
};
