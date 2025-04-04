/* eslint-disable no-console */
import OpenTimestamps from "opentimestamps";

import { encodeAttestation } from "./encodeAttestation.js";

/**
 * @module
 * @ignore
 */

const getDetachedTimestampFile = async (signedAttestation) => {
  const signedAttCID = await encodeAttestation(signedAttestation);
  return OpenTimestamps.DetachedTimestampFile.fromBytes(
    new OpenTimestamps.Ops.OpSHA256(),
    Buffer.from(signedAttCID.toString())
  );
};

const timestampAttestation = async (signedAttestation) => {
  const signedAttCID = await encodeAttestation(signedAttestation);
  const detached = OpenTimestamps.DetachedTimestampFile.fromBytes(
    new OpenTimestamps.Ops.OpSHA256(),
    Buffer.from(signedAttCID.toString())
  );

  // Timestamp, but disable console.log first to prevent "Submitting to remote calendar" messages
  const oldConsoleLog = console.log;
  console.log = () => {};
  await OpenTimestamps.stamp(detached);
  console.log = oldConsoleLog;

  const fileOts = detached.serializeToBytes();
  return {
    proof: fileOts,
    upgraded: false,
    msg: signedAttCID.toString(),
  };
};

const getInfo = (bytes) => {
  const detached = OpenTimestamps.DetachedTimestampFile.deserialize(bytes);
  const infoResult = OpenTimestamps.info(detached);
  console.log(infoResult);
};

/**
 * takes the "timestamp" field of the final attestation as input and changes it
 * to hold an upgraded proof. The timestamp attestation object is returned also
 * as a courtesy.
 *
 * The "upgraded" field inside will be set to true, and the "proof" field
 * will be changed to contain the upgraded proof bytes instead.
 *
 * No error is raised if the timestamp is already upgraded.
 *
 * An error is raised if the timestamp could not be upgraded.
 */
const upgradeTimestampAttestation = async (tsAtt) => {
  if (tsAtt.upgraded) {
    return tsAtt;
  }
  const detached = OpenTimestamps.DetachedTimestampFile.deserialize(
    tsAtt.proof
  );

  // Upgrade, but disable "Got 1 attestation(s) from" messages
  const oldConsoleLog = console.log;
  console.log = () => {};
  await OpenTimestamps.upgrade(detached);
  console.log = oldConsoleLog;

  if (!detached.timestamp.isTimestampComplete()) {
    throw new Error("timestamp could not be upgraded, probably too soon");
  }

  // eslint-disable-next-line no-param-reassign
  tsAtt.proof = detached.serializeToBytes();
  // eslint-disable-next-line no-param-reassign
  tsAtt.upgraded = true;
  return tsAtt;
};

export {
  timestampAttestation,
  getInfo,
  upgradeTimestampAttestation,
  getDetachedTimestampFile,
};
