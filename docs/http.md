# HTTP API

## Table of Contents
- [HTTP API](#http-api)
  - [Table of Contents](#table-of-contents)
  - [Running](#running)
  - [Headers](#headers)
  - [Paths](#paths)
    - [GET /c/:cid](#get-ccid)
    - [POST /c/:cid/:attr](#post-ccidattr)
    - [POST /c/:cid](#post-ccid)
    - [GET /i](#get-i)
      - [Query type match](#query-type-match)
      - [Query type intersect](#query-type-intersect)
    - [GET /cids](#get-cids)


## Running

Run `node server.js` in the `hyperbee` directory. You can set the port it runs on with the `PORT` environment variable, and `UWAZI_HYPERCORE` to where the database files will be stored. Set `JWT_SECRET` to your JWT secret for authenticating writes.

## Headers

CORS headers are set correctly to allow browser usage.

Sending a JWT as a bearer token is required for POST requests.

## Paths

### GET /c/:cid

Returns all attestations for a CID in a map, with attributes as keys (like `description`) and the whole AA object as a value (see the main schema for details).

The response body is DAG-CBOR encoded.

Here is an pseudo-example response body after DAG-CBOR decoding:

```javascript
{
  "description": {
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
}
```
### POST /c/:cid/:attr

Set an attestion for a CID. The request body is a DAG-CBOR encoded map with two attributes: `value` (anything), and `encKey` (false or 32 bytes).

The response body is empty with status code 200 indicating success, 400 indicating request body error, and 500 indicating database error.

### POST /c/:cid

Set multiple attestations for a CID at once. The request body is a DAG-CBOR encoded array of objects. For example:

```json
[
  {"key": "caption", "value": "foo", "type": "str"},
  {"key": "rating", "value": 3.5, "type": "float64"},
  {"key": "people", "value": ["Alice", "Bob", "Eve"], "type": "str-array"}
]
```

`type` is one of `int32|unix|uint32|str|float64|str-array`, where "unix" means Unix time in milliseconds stored as an int64. If `type` is not included or null the attestation will never be indexed.

If query param "index" is set to "1" (like: `?index=1`) then indexing will be done for each attribute (except as described above).

### GET /i

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

### GET /cids

Get all the CIDs stored in this database. The response is a DAG-CBOR encoded array of strings, not CID objects.
