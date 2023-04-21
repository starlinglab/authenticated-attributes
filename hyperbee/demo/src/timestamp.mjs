import OpenTimestamps from "opentimestamps";

import { encodeAttestation } from "./encodeAttestation.mjs";

const timestampAttestation = async (signedAttestation) => {
  const signedAttCID = await encodeAttestation(signedAttestation);
  const detached = OpenTimestamps.DetachedTimestampFile.fromBytes(
    new OpenTimestamps.Ops.OpSHA256(),
    Buffer.from(signedAttCID.toString())
  );

  await OpenTimestamps.stamp(detached);
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
