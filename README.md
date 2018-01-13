# ASet - Scalable Redis Sorted Sets
Redis Sorted Sets that scales.

### WARNING! Highly experimental. Use at your own risk!

## INTRO

To see what problem ASet is tackling, please read [ASet — scaling sorted sets](https://medium.com/@drainingsun/aset-scaling-sorted-sets-df6f54e9fa98)

## REQUIREMENTS
* Node.js v6+
* Redis v4+

## INSTALLATION
`npm install aset`

## USAGE
```javascript
const ASet = require("aset")  
 
const setKey = "foo"
 
// Minimum recommended config (4 servers) 
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
    
const aset = new ASet(clientOptions, setKey, () => {
    const score = 101
    const member = "bar"
    
    aset.add(score, member, (error, result) => {
        if (error) {
            throw error
        }
        
        console.log(result) // OK
    })
    
    // OR
    
    aset.get((error, result) => {
        if (error) {
            throw error
        }
        
        console.log(result) // [score, member]             
    })
})
```

## SCALING
* `c1, c2, c*` are into how many pieces the sorted set will be split. Add more to scale write performance.
* `s1, s2, s*` are servers used for replication. Add more to scale read performance.
* `r1, r2, r*` are just Redis instances. Add as many per server as cores are available.
* It is important that all `c, s and r` are unique (due to ARed requirements).
* Currently if you change `s and r`, you need to use ARed rebalancer. But if you change `c` you will need to 
rebalance data manually.


## BEST PRACTICES
* It's better to separate ADD and GET. This way, in case you only have 1 GET process, it will perform at it's max.
* You can scale ADD by adding more of the processes. I recommend using PM2 and a reverse proxy with NGINX for that.
* You can only scale GET if order of the results is not important or you have your own mechanism to ensure the order.

## TESTING
NOTE: Requires Redis (localhost and ports 6379-6832) to be installed (4 instances for full testing)

```bash
npm test
```

## LINTING
```bash
npm run lint
```

## CONTRIBUTING
Go nuts! Just don't forget to test and lint. Credit will be given where it's due.

## FUTURE
* Create rebalancer.
* Benchmarks
* Lots of fixes and optimizations