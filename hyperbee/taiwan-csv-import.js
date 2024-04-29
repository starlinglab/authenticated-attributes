import fs from "node:fs";
import { argv } from "node:process";
import { parse } from "csv-parse/sync";
import Hypercore from "hypercore";
import Hyperbee from "hyperbee";
import { CID } from "multiformats";

import { dbAddRelation, dbPut, setSigningKey } from "./src/dbPut.js";
import { keyFromPem } from "./src/signAttestation.js";

function str2arr(s) {
  const arr = [];
  for (const item of s.split(",")) {
    arr.push(item.trim());
  }
  return arr;
}

function isoDate2uwazi(s) {
  // Convert "2024-01-12" into a UTC unix timestamp: 1705017600
  return new Date(s).getTime() / 1000;
}

const sigKey = await keyFromPem("taiwan_db2_key.pem");
setSigningKey(sigKey);

const core = new Hypercore("hypercores/taiwan_db2.hypercore");
await core.ready();
const db = new Hyperbee(core, {
  keyEncoding: "binary",
  valueEncoding: "binary",
});

const records = parse(fs.readFileSync(argv[2]), {
  skip_empty_lines: true,
  columns: true,
  from: 2, // Skip header and example rows
});

const promises = [];
for (const record of records) {
  if (record.Complete !== "TRUE") {
    continue;
  }

  promises.push(dbPut(db, record.CID, "title", record.Title));

  if (record["Related to (CID)"].trim() !== "") {
    for (const relatedCid of str2arr(record["Related to (CID)"])) {
      if (relatedCid === "") {
        continue;
      }
      promises.push(
        dbAddRelation(
          db,
          record.CID,
          "children",
          "related",
          CID.parse(relatedCid)
        )
      );
    }
  }

  promises.push(dbPut(db, record.CID, "source_url", record.URL));
  promises.push(dbPut(db, record.CID, "publisher", record.Publisher));
  promises.push(
    dbPut(db, record.CID, "publish_date", isoDate2uwazi(record["Publish Date"]))
  );
  promises.push(
    dbPut(db, record.CID, "capture_date", isoDate2uwazi(record["Capture Date"]))
  );
  if (record.Location !== "") {
    promises.push(dbPut(db, record.CID, "location", record.Location));
  }
  if (record.Election !== "") {
    promises.push(dbPut(db, record.CID, "election", str2arr(record.Election)));
  }
  if (record.Candidate !== "") {
    promises.push(
      dbPut(db, record.CID, "candidate", str2arr(record.Candidate))
    );
  }
  if (record.Party !== "") {
    promises.push(dbPut(db, record.CID, "party", str2arr(record.Party)));
  }
  if (record["Notes/ Description (Optional)"] !== "") {
    promises.push(
      dbPut(db, record.CID, "notes", record["Notes/ Description (Optional)"])
    );
  }
}

await Promise.all(promises);
