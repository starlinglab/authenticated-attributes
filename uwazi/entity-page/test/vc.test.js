/* eslint-disable no-undef */

import { CID } from "multiformats/cid";
import * as Block from "multiformats/block";
import { sha256 } from "multiformats/hashes/sha2";
import * as dagCBOR from "@ipld/dag-cbor";
import { verifyAsync } from "@noble/ed25519";

import { vcExport } from "../src/lib/vc.js";

function base64ToUint8Array(base64) {
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

async function verifyVC(vc) {
  // Validate signature:
  //   1. Recreate "attestation" object
  //   2. Encode as DAG-CBOR
  //   3. Check against signature field
  const attestation = {
    CID: CID.parse(vc.credentialSubject.id.slice(8)),
    value: vc.credentialSubject.value,
    encrypted: false,
    timestamp: vc.issuanceDate,
  };

  switch (vc.credentialSubject.encoding) {
    case "json":
      break;
    case "base64_dag-cbor":
      attestation.value = dagCBOR.decode(
        base64ToUint8Array(vc.credentialSubject.value)
      );
      break;
    case "base64_encrypted_dag-cbor":
      attestation.value = base64ToUint8Array(vc.credentialSubject.value);
      attestation.encrypted = true;
      break;
    default:
      throw new Error("unknown VC encoding");
  }

  // Get signed message (CID of DAG-CBOR)
  const block = await Block.encode({
    value: attestation,
    codec: dagCBOR,
    hasher: sha256,
  });
  return verifyAsync(
    base64ToUint8Array(vc.proof.sig),
    block.cid,
    base64ToUint8Array(vc.proof.pubKey)
  );
}

test("verify sig", async () => {
  // Check export
  const vcStr = vcExport({
    signature: {
      pubKey: base64ToUint8Array(
        "67meek60cPVutfMasym54S0UOcceEtWrJbcgSp6QPDc="
      ),
      sig: base64ToUint8Array(
        "xlSI5d4DisnP4NDgeqq+UYIoTauUy8ZgdczqJg/krZLfRuNvhgUIRaVEblZ5gjZ7QU9deZ/xcPZKG59aKy/lDg=="
      ),
      // CID of "attestation" object
      msg: CID.parse(
        "bafyreiadeqqwoqzxa6ckri3f6rhozd37p6crtbjo5ljemzt2sbf3uuyq7m"
      ),
    },
    timestamp: { ots: {} }, // ignored for VC
    attestation: {
      // CID of asset file, same CID as in the database key
      CID: CID.parse(
        "bafybeifgkpgb7yqgjnovszaio7tzetmdfmigylr24hg6a76wnjxcnhkx54"
      ),
      value: "application/wacz",
      attribute: "mime",
      encrypted: false,
      timestamp: "2023-07-26T19:05:06.882Z",
    },
  });
  expect(vcStr).toBe(
    '{"@context":["https://www.w3.org/2018/credentials/v1","urn:authattr:vc-schema:1"],' +
      '"id":"urn:cid:bafyreiadeqqwoqzxa6ckri3f6rhozd37p6crtbjo5ljemzt2sbf3uuyq7m",' +
      '"type":["VerifiableCredential","AuthAttrCredential"],' +
      '"issuer":"urn:authattr:pubkey:67meek60cPVutfMasym54S0UOcceEtWrJbcgSp6QPDc=",' +
      '"issuanceDate":"2023-07-26T19:05:06.882Z",' +
      '"credentialSubject":{"id":"urn:cid:bafybeifgkpgb7yqgjnovszaio7tzetmdfmigylr24hg6a76wnjxcnhkx54",' +
      '"attribute":"mime","value":"application/wacz","encoding":"json"},' +
      '"proof":{"type":"authattr_ed25519_v1","pubKey":"67meek60cPVutfMasym54S0UOcceEtWrJbcgSp6QPDc=",' +
      '"sig":"xlSI5d4DisnP4NDgeqq+UYIoTauUy8ZgdczqJg/krZLfRuNvhgUIRaVEblZ5gjZ7QU9deZ/xcPZKG59aKy/lDg=="}}'
  );
  const vc = JSON.parse(vcStr);
  expect(await verifyVC(vc)).toBe(true);
});

test("verify float change", async () => {
  // Float64 value with only one bit toggled on
  // Shortest representation is 5e-324
  // Most accurate representation is 4.94065645841246544177e-324
  // Explore more here: https://float.exposed/0x0000000000000001
  const smallFloat = 4.94065645841246544177e-324;
  const vcStr = vcExport({
    signature: {
      pubKey: new Uint8Array(32).fill(1),
      sig: new Uint8Array(64).fill(1),
      // CID of "attestation" object
      msg: CID.parse(
        "bafyreietqpflteqz6kj7lmdqz76kzkwdo65o4bhivxrmqvha7pdgixxos4"
      ),
    },
    timestamp: { ots: {} },
    attestation: {
      // CID of asset file, same CID as in the database key
      CID: CID.parse(
        "bafkreif7gtpfl7dwi5nflge2rsfp6vq6q5kkwfm7uvxyyezxhsnde5ly3y"
      ),
      value: smallFloat,
      attribute: "test",
      encrypted: false,
      timestamp: "2023-05-29T19:03:28.601Z",
    },
  });
  expect(vcStr).toBe(
    '{"@context":["https://www.w3.org/2018/credentials/v1","urn:authattr:vc-schema:1"],' +
      '"id":"urn:cid:bafyreietqpflteqz6kj7lmdqz76kzkwdo65o4bhivxrmqvha7pdgixxos4",' +
      '"type":["VerifiableCredential","AuthAttrCredential"],' +
      '"issuer":"urn:authattr:pubkey:AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=",' +
      '"issuanceDate":"2023-05-29T19:03:28.601Z",' +
      '"credentialSubject":{"id":"urn:cid:bafkreif7gtpfl7dwi5nflge2rsfp6vq6q5kkwfm7uvxyyezxhsnde5ly3y",' +
      '"attribute":"test","value":5e-324,"encoding":"json"},' +
      '"proof":{"type":"authattr_ed25519_v1","pubKey":"AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=",' +
      '"sig":"AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQ=="}}'
  );
  const vc = JSON.parse(vcStr);
  expect(dagCBOR.decode(dagCBOR.encode(vc.credentialSubject.value))).toBe(
    smallFloat
  );
});
