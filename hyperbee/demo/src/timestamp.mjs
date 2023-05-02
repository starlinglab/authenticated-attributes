import OpenTimestamps from "opentimestamps";

import { encodeAttestation } from "./encodeAttestation.mjs";

const timestampAttestation = async (signedAttestation) => {
  const signedAttCID = await encodeAttestation(signedAttestation);
  const detached = OpenTimestamps.DetachedTimestampFile.fromBytes(
    new OpenTimestamps.Ops.OpSHA256(),
    Buffer.from(signedAttCID.toString())
  );

  // Timestamp, but disable console.log first to prevent "Submitting to remote calendar" messages
  var oldConsoleLog = console.log;
  console.log = () => {};
  await OpenTimestamps.stamp(detached);
  console.log = oldConsoleLog;

  const fileOts = detached.serializeToBytes();
  return {
    incompleteProof: fileOts,
    timestampedValue: signedAttCID,
    submitted: new Date().toISOString(),
  };
};

const getInfo = (bytes) => {
  const detached = OpenTimestamps.DetachedTimestampFile.deserialize(bytes);
  const infoResult = OpenTimestamps.info(detached);
  console.log(infoResult);
};

export { timestampAttestation, getInfo };
