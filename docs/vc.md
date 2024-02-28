# Verifiable Credentials

It is possible to export attestations as [Verifiable Credentials](https://en.wikipedia.org/wiki/Verifiable_credentials) as defined by the W3C. Currently this code is frontend-only in [vc.js](../uwazi/entity-page/src/lib/vc.js), but it could be moved to the backend when needed.

## Example VC

```jsonc
{
  "@context": [
    "https://www.w3.org/2018/credentials/v1",
    "urn:authattr:vc-schema:1"
  ],
  // CID of "attestation" field in attestation, the part that gets signed
  // Because the credential is just a transformation of this
  "id": "urn:cid:bafyreietqpflteqz6kj7lmdqz76kzkwdo65o4bhivxrmqvha7pdgixxos4",
  "type": ["VerifiableCredential", "AuthAttrCredential"],
  "issuer": "urn:authattr:pubkey:82zNiAAng99HblAvTe2mjsC3fQ-gI416b0fNLiNmS8s=",
  // Timestamp from attestation, not timestamp of VC creation
  "issuanceDate": "2023-07-13T14:34:17Z",
  "credentialSubject": {
    // CID of the file, as that is what the claims in this credential are about
    "id": "urn:cid:bafkreif7gtpfl7dwi5nflge2rsfp6vq6q5kkwfm7uvxyyezxhsnde5ly3y",
    // Fields copied from attestation schema:
    "attribute": "description",
    "value": "Web archive foo bar",
    // Explains the how to decode what has been stored at "value"
    "encoding": "json", // "json", "base64_dag-cbor", "base64_encrypted_dag-cbor"
  },
  "proof": {
    "type": "authattr_ed25519_v1", // Something unique
    "pubKey": "<base64-encoded public key>",
    "sig": "<base64-encoded signature>"
  }
}
```

The signature of the attestation can be verified from the VC alone, by reconstructing the DAG-CBOR of the original schema `attestation` field and checking the signature from the VC `proof` section against the CID of the reconstructed `attestation` field.

## Schema Table

| Key                           | Type                                                          | Notes                                                                                                                                      |
| ----------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `@context`                    | array of URIs                                                 | First string is always `https://www.w3.org/2018/credentials/v1`, second is the auth. attr. schema with version: `urn:authattr:vc-schema:1` |
| `id`                          | URI                                                           | CID of the original attestation DAG-CBOR, using `urn:cid:`                                                                                 |
| `type`                        | array of strings                                              | Always `["VerifiableCredential","AuthAttrCredential"]`                                                                                     |
| `issuer`                      | URI                                                           | Signer public key, using our special URN `urn:authattr:pubkey:`                                                                            |
| `issuanceDate`                | timestamp                                                     | Timestamp originally stored with attestation                                                                                               |
| `credentialSubject.id`        | URI                                                           | CID of the file the attestation is about, using `urn:cid:`                                                                                 |
| `credentialSubject.attribute` | string                                                        | Attestation attribute                                                                                                                      |
| `credentialSubject.value`     | any                                                           | Attestation value, possibly encoded (see `encoding`)                                                                                       |
| `credentialSubject.encoding`  | one of `json`, `base64_dag-cbor`, `base64_encrypted_dag-cbor` | Explains how to decode `value`. `json` means it is stored natively.                                                                        |
| `proof.type`                  | string                                                        | Always `authattr_ed25519_v1`, except for version updates                                                                                   |
| `proof.pubKey`                | string                                                        | Base64-encoded ed25519 public key                                                                                                          |
| `proof.sig`                   | string                                                        | Base64-encoded ed25519 signature                                                                                                           |

