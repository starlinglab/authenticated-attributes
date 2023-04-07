import Hypercore from "hypercore";
import Hyperbee from "hyperbee";
import { BSON } from "bson";

const core = new Hypercore("./demo.hypercore");

// core.key and core.discoveryKey will only be set after core.ready resolves
await core.ready();

const db = new Hyperbee(core, {
  keyEncoding: "utf-8",
  valueEncoding: "binary",
});

// Add attestation, sign, timestamp, and encrypt.

const CID = "bafybeifgkpgb7yqgjnovszaio7tzetmdfmigylr24hg6a76wnjxcnhkx54";
const attribute = "description";

const value =
  "Web archive [ https://t.me/place_kh, https://t.me/place_kh/7848, https://t.me/s/place_kh/7848 ] captured using Browsertrix on 2022-06-07";

const makeKey = (id, attr) => `${id}/${attr}`;

const signAttestation = (rawAtt) => "";

const timestampAttestation = (signedAtt) => "";

const encrypt = (v, encryptionKey) => "xxxxx";

const dbPut = (id, attr, value, encryptionKey = false) => {
  const rawAttestation = { CID: id, [attr]: value };
  const signature = signAttestation(rawAttestation);
  const signedAttestation = {
    ...rawAttestation,
    signature,
  };

  let attestation;

  if (encryptionKey) {
    attestation = {
      CID: id,
      [attr]: encrypt(value, encryptionKey),
    };
  } else {
    attestation = rawAttestation;
  }

  const key = makeKey(id, attr);
  return db.put(
    key,
    BSON.serialize({
      ...attestation,
      signature,
      timestamp: timestampAttestation(signedAttestation),
    })
  );
};

// Put BSON value
await dbPut(CID, attribute, value, false);

// Decode and print BSON value
const data = await db.get(makeKey(CID, attribute));
console.log(BSON.deserialize(data.value));
