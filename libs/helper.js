"use strict"

const murmurhash = require("murmurhash-native")

class Helper {
    static getClient(clients, member) {
        let list = []

        for (let clientId in clients) {
            list.push([murmurhash.murmurHash64(clientId + member), clientId])
        }

        return list.sort(Helper._sort)[0]
    }

    static _sort(a, b) {
        return (a[0] > b[0]) - (a[0] < b[0])
    }

    static _sortReverse(a, b) {
        return (a[0] - b[0])
    }
}

module.exports = Helper