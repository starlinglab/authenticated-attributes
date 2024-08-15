# HTTP API example code

This page has some code examples for the [HTTP API](./http.md).

## JavaScript

These example should work in both Node.js and the browser.

Get list of CIDs:

```javascript
import { decode } from "@ipld/dag-cbor";

const resp = await fetch("https://example.com/v1/cids");
const cids = decode(new Uint8Array(await resp.arrayBuffer()));
```

Get attestation:

```javascript
import { decode } from "@ipld/dag-cbor";

const resp = await fetch(
  "https://example.com/v1/c/bafy.../asset_origin_id"
);
const att = decode(new Uint8Array(await resp.arrayBuffer())));
```

Get index query results:

```javascript
import { decode } from "@ipld/dag-cbor";

const resp = await fetch(
  "https://example.com/v1/i?" +
    new URLSearchParams({
      query: "match",
      key: "asset_origin_id",
      val: "foo-bar",
      type: "str",
    })
);
const matches = decode(new Uint8Array(await resp.arrayBuffer())));
```

Another useful import might be `import { CID } from "multiformats";`, as CID objects in
the server response will be automatically decoded into that `CID` type.

## CLI

Working with the server on the command line is tricky unfortunately, due to the usage of CBOR.
Here are some examples using the `cborg` CLI tool for decoding.

```
$ curl -sS localhost:3001/v1/cids | npx cborg bin2diag | less
$ curl -sS localhost:3001/v1/c/bafy.../children | npx cborg bin2diag | less

# Uploading
$ npx cborg json2bin '{"value":123, "encKey":false}' | curl -T - -X POST -v -H "Expect:" -sS localhost:3001/v1/c/bafy.../test
```
