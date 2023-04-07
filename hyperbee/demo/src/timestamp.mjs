import OpenTimestamps from "opentimestamps";
import { CID } from "multiformats";

const dummyCID = "bafybeifgkpgb7yqgjnovszaio7tzetmdfmigylr24hg6a76wnjxcnhkx54";

// TODO: replace with non-dummy CID
const getCIDForAtt = (a) => dummyCID;

const timestampAttestation = (signedAtt) => {
  const cidForAtt = getCIDForAtt(signedAtt);
  return timestampHash(cidForAtt);
};

const getSHA256FromCIDv1 = (cidStr) => CID.parse(cidStr).multihash.digest;

const timestampHash = async (cidStr) => {
  const hash = getSHA256FromCIDv1(cidStr);
  // hash must be the same length as SHA256 and be an Array or ArrayBuffer, see
  // https://github.com/opentimestamps/javascript-opentimestamps/blob/36e27fca500273a63e013fff62d963357e882a27/src/detached-timestamp-file.js#L151
  const detached = OpenTimestamps.DetachedTimestampFile.fromHash(
    new OpenTimestamps.Ops.OpSHA256(),
    hash
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
