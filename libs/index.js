"use strict"

const async = require("async")
const redis = require("redis")

const ARed = require("ared")

const Helper = require("./helper")

class ASet {
    constructor(clientOptions, queueKey, callback) {
        this._clients = {}
        this._key = queueKey
        this._set = {}
        this.channel = "newMinValue"
        this.separator = ";"

        async.waterfall([
            (callback) => {
                this._listen(clientOptions, callback)
            },
            (callback) => {
                this._subscribe(clientOptions, callback)
            },
            (callback) => {
                this._update(callback)
            }
        ], () => {
            return callback()
        })
    }

    _listen(clientOptions, callback) {
        async.waterfall([
            (callback) => {
                let x = Object.keys(clientOptions).length

                for (let clientId in clientOptions) {
                    let y = Object.keys(clientOptions[clientId].ared).length

                    for (let serverId in clientOptions[clientId].ared) {
                        const serverOptions = {
                            host: clientOptions[clientId].ared[serverId].host,
                            port: clientOptions[clientId].ared[serverId].port
                        }

                        const redisAred = new ARed()

                        redisAred.separator = this.separator

                        redisAred.listen(
                            serverOptions,
                            clientOptions[clientId].ared[serverId].redis,
                            null,

                            () => {
                                if (--y === 0) {
                                    if (--x === 0) {
                                        return callback()
                                    }
                                }
                            }
                        )
                    }
                }
            },

            (callback) => {
                let x = Object.keys(clientOptions).length

                for (let clientId in clientOptions) {
                    const forwardingOptions = {}

                    for (let serverId in clientOptions[clientId].ared) {
                        forwardingOptions[serverId] = {
                            host: clientOptions[clientId].ared[serverId].host,
                            port: clientOptions[clientId].ared[serverId].port
                        }
                    }

                    this._clients[clientId] = new ARed()

                    this._clients[clientId].separator = this.separator
                    this._clients[clientId].replication = clientOptions[clientId].replication
                    this._clients[clientId].writePolicy = clientOptions[clientId].writePolicy

                    this._clients[clientId].listen(null, null, forwardingOptions, () => {
                        if (--x === 0) {
                            return callback()
                        }
                    })
                }
            }
        ], () => {
            return callback()
        })
    }

    _subscribe(clientOptions, callback) {
        let x = Object.keys(clientOptions).length

        for (let clientId in clientOptions) {
            let y = Object.keys(clientOptions[clientId].ared).length

            for (let serverId in clientOptions[clientId].ared) {
                let z = Object.keys(clientOptions[clientId].ared[serverId].redis).length

                for (let redisId in clientOptions[clientId].ared[serverId].redis) {
                    const client = redis.createClient(clientOptions[clientId].ared[serverId].redis[redisId])

                    client.on("message", (channel, message) => {
                        // Will be triggered as many times as replication factor. Need ideas. One way would be mark
                        // publish as a read command, but that won't resolve issues using LUA. Modify LUA scripts upon
                        // execution to only do it on one Redis server?
                        this._set[clientId] = JSON.parse(message)
                    })

                    client.subscribe(this.channel, (error) => {
                        if (error) {
                            throw error
                        }

                        if (--z === 0) {
                            if (--y === 0) {
                                if (--x === 0) {
                                    return callback()
                                }
                            }
                        }
                    })
                }
            }
        }
    }

    _update(callback) {
        let x = Object.keys(this._clients).length

        for (let clientId in this._clients) {
            this._clients[clientId].exec("zrange", [this._key, 0, 0, "WITHSCORES"], (error, result) => {
                if (error) {
                    throw error
                }

                if (result[this._key].length > 0) {
                    this._set[clientId] = result[this._key]
                } else {
                    this._set[clientId] = null
                }

                if (--x === 0) {
                    return callback()
                }
            })
        }
    }

    add(score, member, callback) {
        const clientId = Helper.getClient(this._clients, member)[1]

        const lua = `local x = redis.call("zrange", KEYS[1], 0, 0, "WITHSCORES")
            redis.call("zadd", KEYS[1], ARGV[1], ARGV[2])
            
            if x[1] == nil or ARGV[1] < x[2] then
                redis.call("publish", KEYS[2], cjson.encode({tonumber(ARGV[1]), ARGV[2]}))
            end`

        const args = [lua, 2, this._key, this.channel, score, member]

        this._clients[clientId].exec("eval", args, (error) => {
            return callback(error, "OK")
        })
    }

    get(callback) {
        const set = []

        for (let serverId in this._set) {
            if (this._set[serverId] !== null) {
                set.push([this._set[serverId][0], this._set[serverId][1], serverId])
            }
        }

        if (set.length > 0) {
            const item = set.sort(Helper._sortReverse)[0]

            this._set[item[2]] = null

            const lua = `local count = redis.call("zrem", KEYS[1], ARGV[1])
                local x = redis.call("zrange", KEYS[1], 0, 0, "WITHSCORES")
                if x[1] ~= nil then
                    redis.call("publish", KEYS[2], cjson.encode({tonumber(x[2]), x[1]}))
                else    
                    redis.call("publish", KEYS[2], cjson.encode(nil))
                end
                return count`

            const args = [lua, 2, this._key, this.channel, item[1]]

            this._clients[item[2]].exec("eval", args, (error, result) => {
                if (result[lua] !== 1) {
                    this.get(callback)
                } else {
                    return callback(error, [item[0], item[1]])
                }
            })
        } else {
            return callback(null, null)
        }
    }
}

module.exports = ASet