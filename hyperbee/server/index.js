import express from 'express'
import Hypercore from 'hypercore'
import Hyperbee from 'hyperbee'
import { toString } from 'b4a'
import { BSON } from 'bson'

const app = express()
const port = 3000
const corePath = "server.hypercore"

// Setup hyperbee
const core = new Hypercore(corePath)
await core.ready()
console.log('hypercore key:', toString(core.key, 'hex'))
const db = new Hyperbee(core, {
    keyEncoding: 'utf-8',
    valueEncoding: 'binary'
})

// await db.put("abc/test", BSON.serialize({ "sig": 123, "timestamp": new Uint8Array([0x0, 0x1, 0x2, 0x3]) }))
// await db.put("abc/test2", BSON.serialize({ "value": "another value" }))

app.get('/:cid', async (req, res) => {
    let metadata = {}
    for await (const { key, value } of db.createReadStream({
        gte: req.params.cid,
        lt: `${req.params.cid}0`, // 0 is the symbol before / in binary, so the range of keys is the keys in the format <cid>/<any>
    })) {
        metadata[key.slice(req.params.cid.length + 1)] = BSON.deserialize(value)
    }

    res.type('application/bson')
    res.send(BSON.serialize(metadata))
})

app.listen(port, () => {
    console.log(`Listening on port ${port}`)
})
