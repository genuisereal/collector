var cp = require('child_process')

var fetchers = [{ script: './fetcher_bitstamp', pair: 'btcusd'}, { script: './fetcher_bitstamp', pair: 'btceur'}]

var children = {}


fetchers.forEach(respawn)

function respawn(fetcher){

    var child = cp.fork(fetcher.script, [fetcher.pair], {stdio: ['ipc', 'pipe', 'pipe'] })
    console.log('respawn pid ' + child.pid)

    children[child.pid] = {child: child, lastDataRecievedTime: -1, respawned: false}

    children[child.pid]['child'].stdout.on('data', (data) => {
        children[child.pid]['lastDataRecievedTime'] = Date.now()


        if(data.toString().split(' ')[0] == '#book' && data.toString().split(' ')[7] == 'R')
        {
            console.log("R? " + data.toString().split(' ')[7])
            if(children[child.pid]['respawned'])
            {
                return
            }
            else
            {
                children[child.pid]['respawned'] = true
            }
            console.log(data.toString())
        }
    })

    children[child.pid]['child'].on('exit', (code, signal) => {
        console.log('exit pid ' + child.pid)
        delete children[child.pid]

        respawn(fetcher)
    })


}

setInterval(()=> {

    for(var pid in children){
        console.log('check for respawn pid ' + pid)
        if(Date.now() - children[pid].lastDataRecievedTime > 29000){
            console.log('kill pid '+ pid)
            children[pid].child.kill()
        }
    }
    console.log('parent is alive ' + process.pid)
}, 30000)

