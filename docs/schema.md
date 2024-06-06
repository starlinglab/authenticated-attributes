# Schema

Read [database.md](./database.md) if you haven't already.

## Indexing

Indexing is supported in a limited way in the database. An index entry is stored as a key with no value (`null`). The format is:

```
i/<property>/<value>/<cid>
```

For example, if `city` is to be indexed, and a new CID `bafkreif7gtpfl7dwi5nflge2rsfp6vq6q5kkwfm7uvxyyezxhsnde5ly3y` with an attestation for `city` of `Toronto` has been added, the index will set:

```
i/city/toronto/bafkreif7gtpfl7dwi5nflge2rsfp6vq6q5kkwfm7uvxyyezxhsnde5ly3y
```

You'll notice `Toronto` became `toronto`. Values are transformed before entering the index, for UX or sorting reasons. Integers and floats are stored as bytes with specific rules. See [this comment](https://github.com/starlinglab/authenticated-attributes/issues/34#issuecomment-1632726982) for details.

This indexing strategy allows us to iterate over the key pattern of `i/city/toronto/*` and retrieve all the CIDs that are tagged as being in Toronto, for example. Without indexing, we would be forced to check every CID.

Note indexing is not done by default, and must be enabled through the HTTP API or with `indexPut`.

## Relationships

In general you can put whatever you want in any attestation. But Authenticated Attributes comes with some APIs for creating relationships between assets. This section explains how those relationships are stored in the database.

They are stored as attestations, under two names: `children` or `parents`. Each of these attestations has a value with a structure like this:

```javascript
{
    relation_type1: [CID(bafy1...), CID(bafy2...)],
    relation_type2: [CID(bafy3...)]
}
```

The relation types can be anything, but we have a predefined list of meanings:

| Type         | Purpose                                                                |
| ------------ | ---------------------------------------------------------------------- |
| `related`    | The most basic form of relation, for when no other word is appropriate |
| `transcoded` | For media transcodings and file format/size changes                    |
| `redacted`   | The child is a redacted version of the parent                          |
| `verified`   | The child in some way verifies or supports the parent                  |
| `encrypted`  | The child is an encrypted version of the parent                        |



