// original response
// {
//     timestamp: '1516278766',
//         bids:
//         [['11995.00', '0.37961901'],
//             ['11991.50', '1.00000000'],
//             ['11990.00', '0.34183986'],
//             ['11988.50', '0.24500000'],
//             ['11985.50', '0.19300000'],
//             ['11982.50', '0.23000000'],
//             ['11982.40', '0.21264500'],
//             ['11979.50', '0.22200000'],
//             ['11977.33', '1.65966132'],
//             ...
//         ],
//         asks:
//         [['11995.00', '0.37961901'],
//             ['11991.50', '1.00000000'],
//             ['11990.00', '0.34183986'],
//             ['11988.50', '0.24500000'],
//             ['11985.50', '0.19300000'],
//             ['11982.50', '0.23000000'],
//             ...
//         ]
// }

var https = require('https')

var pair = process.argv[2]
console.log('pair ' + pair)

var options =    {
    hostname: 'www.bitstamp.net'
    ,   path: '/api/v2/order_book/' + pair
    ,   headers: { 'User-Agent' : 'bitcoin-analytics.com/201801' }
    ,   timeout: 8000
    ,   rejectUnauthorized: false
    ,   method: 'GET'
    ,
}

var ba = ['bids','asks']
var side_out = { 'bids': 'B', 'asks': 'A'}

var stage = 'reset' //reset, delta

var time = 15000

var orderbookState = { 'bids': {} , 'asks': {}}

var orderbookTimestamp

// makeStep()
setInterval(makeStep, time)

function makeStep(){
    switch (stage){
        case "reset":
            https.get(options, (response) => {
                orderbookReset(response)
                stage = 'delta'
            })
            break
        case 'delta':
            https.get(options, (response) => {
                deltaOrderbook(response)
                stage = 'delta'
            })
            break
        default:
            break
    }
}

function deltaOrderbook(response)
{
    if(response.statusCode != 200)
    {
        console.log('HTTP Error ' + response.statusCode)
    }

    response.setEncoding('utf8')

    var body = ''

    response.on('data', (chunk) =>
    {
        body += chunk
    })

    response.on('end', () =>
    {
        var book = JSON.parse(body)

        newOrderbookState = { 'bids': {} , 'asks': {}}

        ba.forEach((side) => {
            book[side].forEach((order) => {
                newOrderbookState[side][order[0]] = parseFloat(order[1])
            })
        })

        var delta = orderbookDiff(orderbookState, newOrderbookState)

        //reset state
        orderbookState = newOrderbookState

        var ts = book.timestamp * 1000

        ba.forEach((side) => {
            Object.keys(orderbookState[side]).forEach((price) => {
            //row format = [#order,#trade] [timestamp] [exchange] [pair] [B,A] [price] [volume] [R]
            console.log('#order '+ts+' BITSTAMP '+pair.toUpperCase()+' '+side_out[side]+' '+price+' '+orderbookState[side][price])
            })
        })
    })
}

function orderbookReset(response)
{
    if(response.statusCode != 200)
    {
        console.log('HTTP Error ' + response.statusCode)
    }

    response.setEncoding('utf8')

    var body = ''

    response.on('data', (chunk) =>
    {
        body += chunk
    })

    response.on('end', () =>
    {
        var book = JSON.parse(body)

        //reset state
        orderbookState = { 'bids': {} , 'asks': {}}

        ba.forEach((side) => {
            book[side].forEach((order) => {
                orderbookState[side][order[0]] = parseFloat(order[1])
            })
        })

        var ts = book.timestamp * 1000

        ba.forEach((side) => {
            Object.keys(orderbookState[side]).forEach((price) => {
            //row format = [#order,#trade] [timestamp] [exchange] [pair] [B,A] [price] [volume] [R]
                console.log('#book '+ts+' BITSTAMP '+pair.toUpperCase()+' '+side_out[side]+' '+price+' '+orderbookState[side][price]+' R' + ' '+side + ' ' + price)
            })
        })
    })
}

function orderbookDiff(oldBook, newBook)
{
    var dd = {};

    ['bids', 'asks'].forEach(function (side)
    {
        var d = diff(oldBook[side] || {} , newBook[side] || {})
        if (d)
        {
            dd[side] = d
        }
    })
    return (dd.bids || dd.asks) ? dd : null
}

function diff(o, n)
{
    var diff = {}

    var empty = true

    for(var price in o)
    {
        if(!n[price])
        {
            diff[price] = 0
            empty = false
        }
        else if(o[price] != n[price])
        {
            diff[price] = n[price]
            empty = false
        }
    }

    for(var price in n)
    {
        if(!o[price])
        {
            diff[price] = n[price]
            empty = false
        }
    }

    return empty ? null : diff
}


