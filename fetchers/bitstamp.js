/*
API
https://www.bitstamp.net/api/

orderbook api

https://www.bitstamp.net/api/v2/order_book/btcusd/

pairs btcusd, btceur

{"timestamp": "1522316936",
    "bids": [
        ["7500.44", "8.98200000"],
        ["7500.43", "2.00000000"],
        ["7498.50", "1.99800000"],
        ...
        ],
    "asks": [
        ["7502.00", "0.49007084"],
        ["7506.12", "0.48000000"],
        ["7507.97", "0.00082400"],
        ...
        ]
}

trades api

https://www.bitstamp.net/api/v2/transactions/btcusd/?time=minute
time : minute, hour(default), day

[{"date": "1522421103", "tid": "60762078", "price": "6833.87", "type": "0", "amount": "0.00108707"},
{"date": "1522421103", "tid": "60762077", "price": "6831.35", "type": "1", "amount": "0.26957422"},
{"date": "1522421103", "tid": "60762076", "price": "6831.35", "type": "1", "amount": "0.05045656"},
...
{"date": "1522421045", "tid": "60761951", "price": "6852.38", "type": "1", "amount": "0.04000000"}]
*/

var https = require('https');
var diff = require('../diff')

var levelup = require('levelup')
var leveldown = require('leveldown')

var pairState = {}

var pairs = ['btcusd']//, 'btceur']

function fetchTrades(curpair){

    https.get('https://www.bitstamp.net/api/v2/transactions/' + curpair + "/?time=hour", function(resp){

        var data = ''

        resp.on('data', function(chunk){

            data += chunk
        })

        resp.on('end', async function(){

            var tdata = JSON.parse(data)

            var db = pairState[curpair]["db"]

            var prevts = await db.get("time")

            var trades = tdata.filter(function(t) {
                return t['date'] > prevts
            })

            var newts = prevts

            for(var i = trades.length-1; i >= 0; i--){

                var t = trades[i]
                var ts = t["date"] * 1000
                var tid = t["tid"]
                var price = t["price"]
                var amount = t["amount"]
                var sellbuy = t["type"] == 0 ? 'B' : "S" //0 (buy) or 1 (sell).

                newts = parseInt(t["date"])

                console.log("T " + ts + " bitstamp " + curpair + " " + tid + " " + sellbuy + " " + price + " " + amount )
            }

            console.log('filtered by timestamp ' + prevts)
            console.log("original length: " + tdata.length + " filtered lenght: " + trades.length)
            console.log("new last timestamp: " + newts)

            await db.put('time', newts)

            setTimeout(function(){
                fetchTrades(curpair)
            }, 15 * 1000)
        })

    }).on('error', function(error){
        console.log("Error trades: bitstamp " + curpair + " " + error.message)

        setTimeout(function(){
            console.log('refetch on error trades bitstamp ' + curpair)

            fetchTrades(curpair)
        }, 30000)
    })
}

function fetchOrderbook(curpair){

    https.get('https://www.bitstamp.net/api/v2/order_book/' + curpair +"/", function(resp){

        var data = '';

        resp.on('data', function(chunk){

            data += chunk
        });

        resp.on('end', function(){

            var book = JSON.parse(data);
            var ts = book.timestamp * 1000;

            //prepare orderbook state
            var newBook = {'bids': {}, 'asks': {}}

            var buys = book['bids'];

            if(buys){
                for (var i = 0; i < buys.length; i++){
                    var p = buys[i][0]
                    newBook['bids'][p] = buys[i][1]
                }
            }

            var sells = book['asks'];

            if(sells){
                for(var i = 0; i < sells.length; i++){
                    var p = sells[i][0]
                    newBook['asks'][p] = sells[i][1]
                }
            }

            //print
            if(!pairState[curpair]['initialized']){
                //reset pair orderbook state and print
                pairState[curpair]['initialized'] = true;
                pairState[curpair]['currentBook'] = newBook

                var bids = Object.keys(newBook['bids'])

                for(var i = 0; i < bids.length; i++){
                    var price = bids[i]
                    console.log("O " + ts + " bitstamp " + curpair + " B " + price + " " + newBook['bids'][price] + " R")
                }

                var asks = Object.keys(newBook['asks'])

                for(var i = 0; i < asks.length; i++){
                    var price = asks[i]
                    console.log("O " + ts + " bitstamp " + curpair + " A " + price + " " + newBook['asks'][price] + " R")
                }
            }
            else{
                //print delta
                var delta = diff.orderbookDiff(pairState[curpair]['currentBook'], newBook)

                pairState[curpair]['currentBook'] = newBook

                if(delta['bids']){
                    var bids = Object.keys(delta['bids'])

                    for(var i = 0; i < bids.length; i++){
                        var price = bids[i]
                        console.log("O " + ts + " bitstamp " + curpair + " B " + price + " " + delta['bids'][price])
                    }
                }

                if(delta['asks']){
                    var asks = Object.keys(delta['asks'])

                    for(var i = 0; i < asks.length; i++){
                        var price = asks[i]
                        console.log("O " + ts + " bitstamp " + curpair + " A " + price + " " + delta['asks'][price])
                    }
                }
            }
        })

        setTimeout(function(){
            fetchOrderbook(curpair)
        }, 15 * 1000)

    }).on('error', function(error){
        console.log("Error orderoobk: bitstamp " + curpair + " " + error.message)

        setTimeout(function(){
            console.log('refetch on error bitstamp orderbook ' + curpair)
            pairState[curpair]['initialized'] = false
            fetchOrderbook(curpair)
        }, 30 * 1000)

    })

}

var nextPair = 0

async function startNextPair(){
    if(nextPair < pairs.length){
        var p = pairs[nextPair]
        pairState[p] = {'initialized': false, currentBook: {'bids': {}, 'asks': {}}}

        pairState[p]['db'] = await createDb(p)


        //fetchOrderbook(p)
        fetchTrades(p)
        // nextPair++
        // setTimeout(startNextPair, 5000)
    }
}

async function createDb(p){

    var db = levelup(leveldown("./lasttrade_bitstamp_" + p))

    try{
        var time = await db.get("time")
    }catch(e){
        //define current time as value
        await db.put("time", new Date().getTime()/1000)
    }

    return db
}

startNextPair()

