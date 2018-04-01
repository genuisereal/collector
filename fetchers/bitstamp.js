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

var pairs = ['btcusd', 'btceur']

var bookState = timeDb = {}

function fetchTrades(pair){

    https.get('https://www.bitstamp.net/api/v2/transactions/' + pair + "/?time=hour", function(resp){

        var data = ''

        resp.on('data', (chunk)=>{

            data += chunk
        })

        resp.on('end', async ()=>{

            var tdata = JSON.parse(data)

            var newtime = lasttime = parseInt(await timeDb[pair].get("time"))

            var trades = tdata
                .filter(t =>{
                    return t.date > lasttime
                })
                .sort((t, tt) =>{

                    return t.date < tt.date ? -1 : t.date > tt.date ? 1 : 0
                })

            trades.forEach(t => {

                console.log("T " + (t.date * 1000) + " bitstamp " + pair + " " +t.tid + " " + (t.type == 0 ? 'B' : 'S') + " " + t.price + " " + t.amount)
            })

            if(trades.length != 0){

                newtime = parseInt(trades[trades.length-1].date) // last trade date (trades is sorted in asc mode)
            }

            console.log('filtered by timestamp ' + lasttime)
            console.log("original length: " + tdata.length + " filtered lenght: " + trades.length)
            console.log("new last timestamp: " + newtime)

            await timeDb[pair].put('time', newtime)

            setTimeout(()=>{
                fetchTrades(pair)
            }, 15 * 1000)
        })

    }).on('error', function(error){
        console.log("Error trades: bitstamp " + pair + " " + error.message)

        setTimeout(function(){
            console.log('refetch on error trades bitstamp ' + pair)

            fetchTrades(pair)
        }, 30000)
    })
}

function fetchOrderbook(pair){

    https.get('https://www.bitstamp.net/api/v2/order_book/' + pair +"/", function(resp){

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
            if(!bookState[pair]['initialized']){
                //reset pair orderbook state and print
                bookState[pair]['initialized'] = true;
                bookState[pair]['currentBook'] = newBook

                var bids = Object.keys(newBook['bids'])

                for(var i = 0; i < bids.length; i++){
                    var price = bids[i]
                    console.log("O " + ts + " bitstamp " + pair + " B " + price + " " + newBook['bids'][price] + " R")
                }

                var asks = Object.keys(newBook['asks'])

                for(var i = 0; i < asks.length; i++){
                    var price = asks[i]
                    console.log("O " + ts + " bitstamp " + pair + " A " + price + " " + newBook['asks'][price] + " R")
                }
            }
            else{
                //print delta
                var delta = diff.orderbookDiff(bookState[pair]['currentBook'], newBook)

                bookState[pair]['currentBook'] = newBook

                if(delta['bids']){
                    var bids = Object.keys(delta['bids'])

                    for(var i = 0; i < bids.length; i++){
                        var price = bids[i]
                        console.log("O " + ts + " bitstamp " + pair + " B " + price + " " + delta['bids'][price])
                    }
                }

                if(delta['asks']){
                    var asks = Object.keys(delta['asks'])

                    for(var i = 0; i < asks.length; i++){
                        var price = asks[i]
                        console.log("O " + ts + " bitstamp " + pair + " A " + price + " " + delta['asks'][price])
                    }
                }
            }
        })

        setTimeout(function(){
            fetchOrderbook(pair)
        }, 15 * 1000)

    }).on('error', function(error){
        console.log("Error orderoobk: bitstamp " + pair + " " + error.message)

        setTimeout(function(){
            console.log('refetch on error bitstamp orderbook ' + pair)
            bookState[pair]['initialized'] = false
            fetchOrderbook(pair)
        }, 30 * 1000)

    })

}

async function start(){

    for(var i = 0; i < pairs.length; i++){

        var pair = pairs[i]

        bookState[pair] = {'initialized': false, currentBook: {'bids': {}, 'asks': {}}}

        timeDb[pair] = await createTimeDb(pair)

        //fetchOrderbook(pair)
        fetchTrades(pair)

        await sleep(5000)
    }
}

function sleep(ms){
    return new Promise( resolve => {
        setTimeout(resolve, ms)
    })
}

var levelup = require('levelup')
var leveldown = require('leveldown')

async function createTimeDb(pair){

    var db = levelup(leveldown("./lasttrade_bitstamp_" + pair))

    try{
        await db.get("time")
    }catch(e){
        //define current time as value
        await db.put("time", new Date().getTime()/1000)
    }

    return db
}

start()

