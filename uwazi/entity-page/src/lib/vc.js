import { uint8ArrayToBase64 } from "./shared.js";

function isCID(cid) {
  // The proper way to know would be to import the CID library and use `instanceof`
  // But that would bloat our deps, so instead I'm hacking around it by
  // checking for the existence of a property other objects likely won't have
  return (
    typeof cid === "object" &&
    "multihash" in cid &&
    "/" in cid &&
    "asCID" in cid &&
    "toV0" in cid &&
    typeof cid.toV0 === "function"
  );
}

function isJsonCID(k, v) {
  // CID object becomes something else when being prepared for JSON
  // Example: {"/": "bafyreietqpflteqz6kj7lmdqz76kzkwdo65o4bhivxrmqvha7pdgixxos4"}

  if (k !== "/") {
    return false;
  }
  try {
    const c = Multiformats.CID.parse(v);
    return Boolean(c);
  } catch {
    return false;
  }
}

export function vcExport(data) {
  const vc = {
    "@context": [
      "https://www.w3.org/2018/credentials/v1",
      "urn:authattr:vc-schema:1",
    ],
    id: `urn:cid:${data.signature.msg}`,
    type: ["VerifiableCredential", "AuthAttrCredential"],
    issuer: `urn:authattr:pubkey:${uint8ArrayToBase64(data.signature.pubKey)}`,
    issuanceDate: data.attestation.timestamp,
    credentialSubject: {
      id: `urn:cid:${data.attestation.CID}`,
      attribute: data.attestation.attribute,
      value: data.attestation.value,
      encoding: "json",
    },
    proof: {
      type: "authattr_ed25519_v1",
      pubKey: uint8ArrayToBase64(data.signature.pubKey),
      sig: uint8ArrayToBase64(data.signature.sig),
    },
  };

  if (vc.credentialSubject.encrypted) {
    // Encode value otherwise the default bytes->JSON conversion will be used
    // which is terrible
    vc.credentialSubject.value = uint8ArrayToBase64(data.attestation.value);
    vc.credentialSubject.encoding = "base64_encrypted_dag-cbor";
    return JSON.stringify(vc);
  }

  // See if different encoding of value is required. If there are any bytes
  // in data.attestation.value, the whole thing needs to be DAG-CBOR encoded
  // to maintain integrity and allow for proper decoding.

  let vcStr;
  try {
    vcStr = JSON.stringify(vc, (k, v) => {
      if (
        // Directly bytes
        k instanceof Uint8Array ||
        // Or it's a CID, which should be encoded properly so the sig is valid
        isCID(k) ||
        // Check values too
        v instanceof Uint8Array ||
        isCID(v) ||
        // Finally check if it's a converted CID
        isJsonCID(k, v)
      ) {
        throw new Error("binary");
      }
      return v;
    });
  } catch {
    // Error occured, meaning there is binary data that must be encoded
    vc.credentialSubject.value = uint8ArrayToBase64(
      IpldDagCbor.encode(data.attestation.value)
    );
    vc.credentialSubject.encoding = "base64_dag-cbor";
    return JSON.stringify(vc);
  }

  // No error, no binary data
  return vcStr;
}
