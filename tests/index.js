"use strict"

global.__base = __dirname + "/../"

const redis = require("redis")
const should = require("should") // eslint-disable-line no-unused-vars

const ASet = require(`${__base}libs/index`)

describe("ASET", () => {
    const clientOptions = {
        c1: {
            ared: {
                s1: {
                    host: "127.0.0.1",
                    port: 8124,
                    redis: {
                        r1: {
                            host: "127.0.0.1",
                            port: 6379
                        }
                    }
                },
                s2: {
                    host: "127.0.0.1",
                    port: 8125,
                    redis: {
                        r2: {
                            host: "127.0.0.1",
                            port: 6380
                        }
                    }
                }
            },
            replication: 2,
            writePolicy: 2
        },
        c2: {
            ared: {
                s3: {
                    host: "127.0.0.1",
                    port: 8126,
                    redis: {
                        r1: {
                            host: "127.0.0.1",
                            port: 6381
                        }
                    }
                },
                s4: {
                    host: "127.0.0.1",
                    port: 8127,
                    redis: {
                        r2: {
                            host: "127.0.0.1",
                            port: 6382
                        }
                    }
                }
            },
            replication: 2,
            writePolicy: 2
        }
    }

    let aset = null

    before((done) => {
        for (let clientId in clientOptions) {
            for (let serverId in clientOptions[clientId].ared) {
                for (let redisId in clientOptions[clientId].ared[serverId].redis) {
                    const client = redis.createClient(clientOptions[clientId].ared[serverId].redis[redisId])

                    client.on("ready", () => {
                        client.send_command("FLUSHALL")
                        client.send_command("SCRIPT", ["FLUSH"])
                    })
                }
            }
        }

        aset = new ASet(clientOptions, "foo", () => {
            done()
        })
    })

    it("Should add values to different servers and publish only on new mins", (done) => {
        const score = 2
        const member = "bar"
        const score2 = 1
        const member2 = "quux"
        const score3 = 3
        const member3 = "buz"

        aset.add(score, member, (error, result) => {
            (error === null).should.be.true()
            result.should.be.equal("OK")

            aset.add(score2, member2, (error, result) => {
                (error === null).should.be.true()
                result.should.be.equal("OK")

                aset.add(score3, member3, (error, result) => {
                    (error === null).should.be.true()
                    result.should.be.equal("OK")
                })

                setTimeout(() => { // Wait for the publish to finish
                    aset._set["c1"][0].should.be.equal(score)
                    aset._set["c1"][1].should.be.equal(member)
                    aset._set["c2"][0].should.be.equal(score2)
                    aset._set["c2"][1].should.be.equal(member2)

                    done()
                }, 100)
            })
        })
    })

    it("Should get the smallest value", (done) => {
        const score = 2
        const member = "bar"
        const score2 = 1
        const member2 = "quux"
        const score3 = 3
        const member3 = "buz"

        aset.add(score, member, () => {
            aset.add(score2, member2, () => {
                aset.add(score3, member3, () => {
                    setTimeout(() => { // Wait for the publish to finish
                        aset.get((error, result) => {
                            (error === null).should.be.true()
                            result[0].should.be.equal(score2)
                            result[1].should.be.equal(member2)

                            setTimeout(() => { // Wait for the publish to finish
                                aset._set["c1"][0].should.be.equal(score)
                                aset._set["c1"][1].should.be.equal(member)
                                ;(aset._set["c2"] === null).should.be.true()

                                done()
                            }, 100)
                        })
                    }, 100)
                })
            })
        })
    })
})