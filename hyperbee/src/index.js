// https://github.com/starlinglab/authenticated-attributes/issues/34
//
// Checks are in place for each encode function

/**
 * @module
 * @ignore
 */

const encodeUint32 = (uint) => {
  if (!Number.isSafeInteger(uint) || uint > 2 ** 32 - 1 || uint < 0) {
    throw new Error("not uint32");
  }
  const arr = new ArrayBuffer(4); // 32 bits is 4 bytes
  const view = new DataView(arr);
  view.setUint32(0, uint, false);
  return Buffer.from(arr);
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
 * Encode an int64.
 *
 * Ideally this should only be used for Unix millis timestamps.
 * Consider using encodeInt32 instead.
 *
 * Argument can be an integer or a BigInt.
 */
const encodeInt64 = (i) => {
  if (!Number.isSafeInteger(i) && typeof i !== "bigint") {
    // not int
    throw new Error("not int64");
  }
  if (i > 2n ** 63n - 1n || i < -(2n ** 63n)) {
    // Out of range
    throw new Error("not int64");
  }
  const arr = new ArrayBuffer(8); // 64 bits is 8 bytes
  const view = new DataView(arr);
  view.setBigInt64(0, BigInt(i), false);
  return fixSignedBytes(Buffer.from(arr));
};

/**
 * Encode a Date object as int64 Unix timestamp
 */
const encodeDate = (date) =>
  // Max date.getTime() value is ~53 bits large
  // This is larger than a uint32 can hold so it's stored as an int64 to not
  // lose any precision
  encodeInt64(date.getTime());

const encodeFloat64 = (float) => {
  if (!Number.isFinite(float)) {
    throw new Error("not float64");
  }
  const arr = new ArrayBuffer(8); // 64 bits is 8 bytes
  const view = new DataView(arr);
  view.setFloat64(0, float, false);
  return fixSignedBytes(Buffer.from(arr));
};

const encodeInt32 = (int) => {
  if (!Number.isSafeInteger(int) && typeof i !== "bigint") {
    // not int
    throw new Error("not int32");
  }
  if (int > 2n ** 31n - 1n || int < -(2n ** 31n)) {
    // Out of range
    throw new Error("not int32");
  }
  const arr = new ArrayBuffer(4);
  const view = new DataView(arr);
  view.setInt32(0, int, false);
  return fixSignedBytes(Buffer.from(arr));
};

const encodeString = (str) => Buffer.from(str.toLowerCase().trim());

/**
 * Encode a string array. This is more of an intermediate encoding as it just
 * returns an array of Buffers. But indexPut will handle it.
 */
const encodeStrArray = (strs) => {
  const arr = [];
  for (const str of strs) {
    arr.push(Buffer.from(str));
  }
  return arr;
};

/**
 * Uses the correct encoding function for the given params
 *
 * @param {number|string} val
 * @param {string} type - one of int32|unix|uint32|str|float64|str-array
 *
 * "unix" means Unix time in milliseconds stored as an int64.
 *
 * An error will be raised for invalid values or an unrecognized type.
 */
const encodeFromType = (val, type) => {
  switch (type) {
    // encode* funcs check number type and range so this is safe

    case "int32":
      return encodeInt32(Number(val));
    case "unix":
      return encodeInt64(Number(val));
    case "uint32":
      return encodeUint32(Number(val));
    case "str":
      return encodeString(val);
    case "float64":
      return encodeFloat64(Number(val));
    default:
      throw new Error("unrecognized type");
  }
};

const indexPutSingle = async (db, prop, value, cid) => {
  const bufSize = `i/${prop}/`.length + value.length + `/${cid}`.length;
  const buf = Buffer.alloc(bufSize);
  let offset = buf.write(`i/${prop}/`);
  offset += value.copy(buf, offset);
  buf.write(`/${cid}`, offset);
  // Store key with null value
  await db.put(buf);
};

/**
 * value should be Array of Buffer
 */
const indexPutArray = async (db, prop, value, cid) => {
  let batch = db; // db might actually be batch
  if (db.constructor.name !== "Batch") {
    // db is not a batch so create one
    batch = db.batch();
    await batch.lock();
  }
  for (const v of value) {
    indexPutSingle(batch, prop, v, cid);
  }
  if (db.constructor.name !== "Batch") {
    await batch.flush();
  }
};

/**
 * Make an entry in the index.
 *
 * values must be encoded before being passed in, so they must always be Buffer.
 * Or an array of buffers, in which case the type str-array is assumed.
 */
const indexPut = async (db, prop, value, cid) => {
  if (Array.isArray(value)) {
    return indexPutArray(db, prop, value, cid);
  }
  return indexPutSingle(db, prop, value, cid);
};

/**
 * Remove an entry in the index.
 *
 * values must be encoded before being passed in, so they must always be Buffer.
 */
const indexDel = async (db, prop, value, cid) => {
  const bufSize = `i/${prop}/`.length + value.length + `/${cid}`.length;
  const buf = Buffer.alloc(bufSize);
  let offset = buf.write(`i/${prop}/`);
  offset += value.copy(buf, offset);
  buf.write(`/${cid}`, offset);
  await db.del(buf);
};

/**
 * Remove all index keys for this property.
 *
 * A batch is already used here and so can't be passed in as a replacement for the db param.
 */
const indexClear = async (db, prop) => {
  const batch = db.batch();
  await batch.lock();

  const delPromises = [];
  for await (const { key } of batch.createReadStream({
    gte: `i/${prop}/`,
    lt: `i/${prop}0`, // 0 is the symbol after / in binary, so the range of keys is i/<prop>/.*
  })) {
    delPromises.push(batch.del(key));
  }

  await Promise.all(delPromises);
  await batch.flush();
};

/**
 * Find all exact matches for a property value.
 *
 * values must be encoded before being passed in, so they must always be Buffer.
 *
 * This only works if the db was properly opened with a binary key encoding (the default).
 *
 * Matches are returned as CID strings, not CID objects.
 *
 * This function supports the str-array type, and so will return all CIDs that have `value`
 * in their arrays for `prop`. So in that case `value` should just be a single Buffer, the
 * array entry being searched for. Not the whole array itself.
 */
const indexFindMatches = async (db, prop, value) => {
  // Create buffer for db key
  // +1 is for `/` or `0` character at the end
  const bufSize = `i/${prop}/`.length + value.length + 1;
  const startKey = Buffer.alloc(bufSize);
  let offset = startKey.write(`i/${prop}/`);
  offset += value.copy(startKey, offset);
  startKey.write(`/`, offset);
  const endKey = Buffer.from(startKey);
  endKey.write(`0`, offset);

  const cids = [];

  // createReadStream uses batch internally
  for await (const { key } of db.createReadStream({
    gte: startKey,
    lt: endKey,
  })) {
    cids.push(key.subarray(bufSize).toString());
  }
  return cids;
};

export {
  encodeUint32,
  encodeInt32,
  encodeInt64,
  encodeDate,
  encodeFloat64,
  encodeString,
  encodeStrArray,
  indexPut,
  indexDel,
  indexClear,
  indexFindMatches,
  encodeFromType,
};
