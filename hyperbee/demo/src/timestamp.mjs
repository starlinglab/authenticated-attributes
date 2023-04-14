import OpenTimestamps from "opentimestamps";

const dummyCID = "bafybeifgkpgb7yqgjnovszaio7tzetmdfmigylr24hg6a76wnjxcnhkx54";

// TODO: replace with non-dummy CID
const getCIDForAtt = (a) => dummyCID;

const timestampAttestation = (signedAtt) => {
  const cidForAtt = getCIDForAtt(signedAtt);
  return timestampHash(cidForAtt);
};

const timestampHash = async (cidStr) => {
  const detached = OpenTimestamps.DetachedTimestampFile.fromBytes(
    new OpenTimestamps.Ops.OpSHA256(),
    Buffer.from(cidStr)
  );

  await OpenTimestamps.stamp(detached);
  const fileOts = detached.serializeToBytes();
  return fileOts;
};

// TODO: fix, doesn't fully work yet
// Throws error 'StreamDeserialization deserialize: Invalid param'
const getInfo = (bytes) => {
  const detached = OpenTimestamps.DetachedTimestampFile.deserialize(bytes);
  const infoResult = OpenTimestamps.info(detached);
  console.log(infoResult);
};

export { timestampAttestation, timestampHash, getInfo };
