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

exports.orderbookDiff = orderbookDiff

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