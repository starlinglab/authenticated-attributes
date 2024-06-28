# HTTP API

## Table of Contents

- [HTTP API](#http-api)
  - [Table of Contents](#table-of-contents)
  - [Running](#running)
  - [Headers](#headers)
  - [Paths](#paths)
    - [GET /v1/c/:cid/:attr](#get-v1ccidattr)
    - [GET /v1/c/:cid](#get-v1ccid)
    - [POST /v1/c/:cid/:attr](#post-v1ccidattr)
    - [POST /v1/c/:cid](#post-v1ccid)
    - [GET /v1/i](#get-v1i)
      - [Query type match](#query-type-match)
      - [Query type intersect](#query-type-intersect)
      - [Query type list](#query-type-list)
    - [GET /v1/cids](#get-v1cids)
    - [POST /v1/rel/:cid](#post-v1relcid)

## Running

Run `node server.js` in the `hyperbee` directory. You can set the port it runs on with the `PORT` environment variable, and `HYPERCORE` to where the database files will be stored. Set `JWT_SECRET` to your JWT secret for authenticating writes.

## Headers

CORS headers are set correctly to allow browser usage.

Sending a JWT as a bearer token is required for POST requests.

## Paths

### GET /v1/c/:cid/:attr

Get a specific attestation for a specific CID. The response body is DAG-CBOR encoded.

Here is an example response body after DAG-CBOR decoding:

```javascript
{
  version: "1.0",
  signature: {
    pubKey: Uint8Array(32),
    sig: Uint8Array(64),
    msg: CID(bafyreietqpflteqz6kj7lmdqz76kzkwdo65o4bhivxrmqvha7pdgixxos4)
  },
  timestamp: {
    ots: {
        proof: Uint8Array(503),
        upgraded: false,
        msg: CID(bafyreialprnoiwl25t37feen7wbkwwr4l5bpnokjydkog3mhiuodi2av6m)
    }
  },
  attestation: {
    CID: CID(bafkreif7gtpfl7dwi5nflge2rsfp6vq6q5kkwfm7uvxyyezxhsnde5ly3y),
    value: 'Web archive foo bar',
    attribute: 'description',
    encrypted: false,
    timestamp: '2023-05-29T19:03:28.601Z'
  }
}
```

A couple query params are available for dealing with encrypted values: `key` and `decrypt`. `key` should be set to the 32-byte decryption key (base64url encoded), and optionally `decrypt` can be set to `0` if the returned `attestation.value` field should not be decrypted in the response body.

Not specifying `key` for an attestation with an encrypted value will result in error code 400, as that is required to fully verify the attestation signature.

The query param `format` can be set to `vc` to get the attestation returned in Verifiable Credential JSON format. See [vc.md](./vc.md) for more details. Leaving `format` unset, empty, or set to `cbor` will result in the default DAG-CBOR encoding in the output.

Status code 404 is returned if the attribute doesn't exist in the database currently.

### GET /v1/c/:cid

Returns all attestations for a CID in a map, with attributes as keys (like `description`) and the whole AA object as a value (see the main schema for details).

The response body is DAG-CBOR encoded.

Here is an example response body after DAG-CBOR decoding:

```javascript
{
  "description": {
    version: "1.0",
    signature: {
      pubKey: Uint8Array(32),
      sig: Uint8Array(64),
      msg: CID(bafyreietqpflteqz6kj7lmdqz76kzkwdo65o4bhivxrmqvha7pdgixxos4)
    },
    timestamp: {
      ots: {
          proof: Uint8Array(503),
          upgraded: false,
          msg: CID(bafyreialprnoiwl25t37feen7wbkwwr4l5bpnokjydkog3mhiuodi2av6m)
      }
    },
    attestation: {
      CID: CID(bafkreif7gtpfl7dwi5nflge2rsfp6vq6q5kkwfm7uvxyyezxhsnde5ly3y),
      value: 'Web archive foo bar',
      attribute: 'description',
      encrypted: false,
      timestamp: '2023-05-29T19:03:28.601Z'
    }
  },
  "author": ...
}
```

Encrypted values will remain encrypted as described in [database.md](./database.md).

### POST /v1/c/:cid/:attr

Set an attestion for a CID. The request body is a DAG-CBOR encoded map with two attributes: `value` (anything), and `encKey` (false or 32 bytes).

The response body is empty with status code 200 indicating success, 400 indicating request body error, and 500 indicating database error.

If the query param `append` is set to `1`, then the provided value is appended to a pre-existing array stored at that attribute. An array is created if nothing is stored at that attribute. If a non-array is stored there, status code 400 will be returned.

### POST /v1/c/:cid

Set multiple attestations for a CID at once. The request body is a DAG-CBOR encoded array of objects. For example:

```json
[
  {"key": "caption", "value": "foo", "type": "str"},
  {"key": "rating", "value": 3.5, "type": "float64"},
  {"key": "people", "value": ["Alice", "Bob", "Eve"], "type": "str-array"}
  {"key": "desc", "value": "foo bar baz"},
]
```

`type` is one of `int32|unix|uint32|str|float64|str-array`, where "unix" means Unix time in milliseconds stored as an int64. If `type` is not included or null the attestation will never be indexed.

If query param "index" is set to "1" (like: `?index=1`) then indexing will be done for each attribute (except as described above).

An encryption key can also be set (per-attribute) so that it is stored encrypted in the database. It must be 32 bytes, encoded in binary as DAG-CBOR allows us to.

```json
[
  {
    "key": "secret_caption",
    "value": "oh ho ho",
    "encKey": "<32 binary bytes>"
  }
]
```

Encrypted attributes cannot be indexed, and so setting a `type` on them will be ignored.

### GET /v1/i

Search the index, using query params.

Example query params (decoded as an object):

```
{
  query: "match",
  key: <str>,
  val: "<int|float|str>"
  type: "int32|unix|uint32|str|float64"
}
```

"unix" means Unix time in milliseconds stored as an int64.

The response body is a DAG-CBOR encoded array of CID strings (not CID objects).

One additional query param is available: `{names: "1"}`. This enables setting the names of the assets. The response body is no longer an array of CIDs but instead an array of objects: `{"name": "<name of asset>", "cid": "<cid of asset>"}`. The names of the asset are pulled from the `title` or `name` attestation of the CID if it exists (in that order). This is just a convenience method for applications trying to make a more friendly search results page.

#### Query type match

The option `query: "match"` is described above. Only exact matches are retured.

#### Query type intersect

The option `query: "intersect"` returns all assets that have string array values sharing at least one value with the provided query array.

Example query params (decoded as object):

```
{
  query: "intersect",
  key: <str>,
  val: "<string array as JSON>"
}
```

#### Query type list

The option `query: "list"` returns values that have been indexed for the given key. It does return CIDs.

Example query params (decoded as object):

```
{
  query: "list",
  key: <str>
}
```

The response body is a DAG-CBOR encoded array of strings, values that can be used for `match` queries in the future.

### GET /v1/cids

Get all the CIDs stored in this database. The response is a DAG-CBOR encoded array of strings, not CID objects.

### POST /v1/rel/:cid

Add a relationship for this CID. The request body is DAG-CBOR encoded. Here is an example:

```javascript
{
  type: "children", // "children" or "parents"
  relation_type: "related", // More available, see schema.md
  cid: CID(...), // CID as native DAG-CBOR encoding, not string
}
```

This will automatically add the reverse relationship under the linked CID. For example if you set a `children` relationship with CID-A in the URL and CID-B in the body, that will get stored in the database, as well as a `parents` relationship from CID-B to CID-A. The relation type will remain the same in both cases.
