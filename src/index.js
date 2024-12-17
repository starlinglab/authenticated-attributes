export { isAttVersionSupported, attestationVersion } from "./version.js";
export { dbGet, dbIsEncrypted, dbRawValue } from "./dbGet.js";
export {
  setSigningKey,
  dbPut,
  dbAppend,
  dbAddRelation,
  dbRemoveRelation,
} from "./dbPut.js";
export { dbUpgrade } from "./dbUpgrade.js";
export { decryptValue } from "./decryptValue.js";
export { keyFromPem } from "./signAttestation.js";
export { attToVC } from "./vc.js";
export { openDB } from "./dbManager.js";
