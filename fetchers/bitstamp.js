/*
API
https://www.bitstamp.net/api/
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
*/

var https = require('https');
var diff = require('../diff')

var pairState = {}

var pairs = ['btcusd', 'btceur']

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
        console.log("https error: " + error.message)

        setTimeout(function(){
            console.log('refetch after error for ' + curpair)
            pairState[curpair]['initialized'] = false
            fetchOrderbook(curpair)
        }, 30 * 1000)

    })

}

var nextPair = 0

function startNextPair(){
    if(nextPair < pairs.length){
        var p = pairs[nextPair]
        pairState[p] = {'initialized': false, currentBook: {'bids': {}, 'asks': {}}}

        fetchOrderbook(p)
        nextPair++
        setTimeout(startNextPair, 5000)
    }
}

startNextPair()