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

let https = require('https');
let diff = require('../diff')
let assert = require('assert')

let pairs = ['btcusd']//, 'btceur']

let bookState = {}
let bookValid = {}
let timeDb = {}

let ba = ['bids', 'asks']

function fetchTrades(pair){

    https.get('https://www.bitstamp.net/api/v2/transactions/' + pair + "/?time=hour", function(resp){

        let data = ''

        resp.on('data', (chunk)=>{

            data += chunk
        })

        resp.on('end', async ()=>{

            let tdata = JSON.parse(data)

            let newtime = lasttime = parseInt(await timeDb[pair].get("time"))

            let trades = tdata
                .filter(t =>{
                    return t.date > lasttime
                })
                .sort((t, tt) =>{

                    return t.date < tt.date ? -1 : t.date > tt.date ? 1 : 0
                })

            trades.forEach(t => {

                console.log("T " + (t.date * 1000) + " bitstamp " + pair + " " +t.tid + " "+(t.type == 0 ? 'B' : 'S')+" " + t.price + " " + t.amount)
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

        let data = '';

        resp.on('data', function(chunk){

            data += chunk
        });

        resp.on('end', function(){

            let bdata = JSON.parse(data);
            let ts = bdata.timestamp * 1000;

            //prepare orderbook state
            let newBook = {'bids': {}, 'asks': {}}

            ba.forEach( side => {

                bdata[side].forEach( order => {

                    let price = order[0]
                    let volume = order[1]

                    assert.ok(newBook[side][price] === undefined, "Error: price duplicate " + side + " p " + price + " v " + newBook[side][price] + " v` " + volume)

                    newBook[side][price] = volume
                })
            })

            //print
            if(!bookValid[pair]){
                //reset pair orderbook state and print
                bookValid[pair] = true
                bookState[pair] = newBook

                ba.forEach( side => {
                    Object.keys(newBook[side])
                        .forEach( price => {

                            let volume = newBook[side][price]

                            console.log("O " + ts + " bitstamp " + pair + " "+(side == 'bids' ? "B" : 'A')+" " + price + " " + volume + " R")
                        })
                })
            }
            else{
                //print delta
                let delta = diff.orderbookDiff(bookState[pair], newBook)

                bookState[pair] = newBook

                ba.forEach( side => {
                    Object.keys(delta[side])
                        .forEach( price => {

                            let volume = delta[side][price]

                            console.log("O " + ts + " bitstamp " + pair + " "+(side == 'bids' ? "B" : 'A')+" " + price + " " + volume)
                        })
                })
            }
        })

        setTimeout(function(){
            fetchOrderbook(pair)
        }, 15 * 1000)

    }).on('error', function(error){
        console.log("Error orderoobk: bitstamp " + pair + " " + error.message)

        setTimeout(function(){
            console.log('refetch on error bitstamp orderbook ' + pair)
            bookValid[pair] = false
            fetchOrderbook(pair)
        }, 30 * 1000)

    })

}

let levelup = require('levelup')
let leveldown = require('leveldown')

async function createTimeDb(pair){

    let db = levelup(leveldown("./lasttrade_bitstamp_" + pair))

    try{
        await db.get("time")
    }catch(e){
        //define current time as value
        await db.put("time", new Date().getTime()/1000)
    }

    return db
}

function sleep(ms){
    return new Promise( resolve => {
        setTimeout(resolve, ms)
    })
}

async function start(){

    for(let i = 0; i < pairs.length; i++){

        let pair = pairs[i]

        bookState[pair] = {'bids': {}, 'asks': {} }
        bookValid[pair] = false

        timeDb[pair] = await createTimeDb(pair)

        fetchOrderbook(pair)
        // fetchTrades(pair)

        await sleep(5000)
    }
}

start()

