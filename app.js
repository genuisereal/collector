var cp = require('child_process');
var ch = require('@apla/clickhouse')

var child = cp.fork('./fetchers/bitstamp', [], {stdio: ['ipc', 'pipe', 'pipe']})

child.stdout.on('data', function(data){
    var lines = data.toString().split("\n")
    for(var i=0; i < lines.length; i++){

        var line = lines[i]

        if(line.length > 0){
            var fields = line.split(' ')

            if(fields[0] == "O"){
                if(fields.length > 1){
                    console.log(fields.join(" "))
                }
                else{
                    require("assert").ok(fields.length <= 0, "unexpectedly fields lenght is > 0:" + fields.length + " " + fields.join("#"))
                }
            }
            else{
                console.log("!O /" + line + "/" + line.length)

            }
        }
        else{
            require('assert').ok(line.length <= 0, "unexpectedly last lien lenght > 0: " + line.length)
        }

    }
})


