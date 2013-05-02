#! /usr/bin/env node

if (process.argv.length > 2 && process.argv[2] == '--help') {
    console.log('Usage: node ' + process.argv[1] + ' [PORT]');
    console.log(' PORT is by default 8080');
    process.exit(0);
}

var port = 8080;
if (process.argv.length > 2) {
    port = +process.argv[2];
}

var http = require('http')
    , path = require('path')
    , KIARA = require('./static/scripts/kiara.js');

// Create KIARA service
var context = KIARA.createContext();
var calcService = context.createService('calc', 'http://localhost:'+port+'/rpc/calc');
calcService.registerMethod('calc.add', null, function (a, b, callback) {
    callback(null, ((a | 0) + (b | 0)) | 0);
});
calcService.registerMethod('calc.sub', null, function (a, b, callback) {
    callback(null, ((a | 0) - (b | 0)) | 0);
});
calcService.registerMethod('calc.addf', null, function (a, b, callback) {
    console.log("calc.addf("+a+","+b+");");
    callback(null, a+b);
});

calcService.registerMethod('calc.stringToInt32', null, function (s, callback) {
    console.log("calc.stringToInt32("+s+");");
    callback(null, s|0);
});

calcService.registerMethod('calc.int32ToString', null, function (i, callback) {
    console.log("calc.int32ToString("+i+");");
    callback(null, i.toString());
});

var app = KIARA.node.middleware();

var endpointInfo = {
    info : "test server",
    idlURL : "/idl/calc.kiara", // absolute or relative URL
    // idlContents : "...",    // IDL contents
    servers : [
        {
            services : "*",
            protocol : {
                name : "jsonrpc"
            },
            transport : {
                name : "http",
                url : "/rpc/calc"
            }
        },
        {
            services : "*",
            protocol : {
                name : "xmlrpc"
            },
            transport : {
                name : "http",
                url : "/xmlrpc/calc"
            }
        }
    ]
};

app.use(KIARA.node.serveText("/service", JSON.stringify(endpointInfo, null, 2), {contentType : "application/json"}));
app.use(KIARA.node.serve("/rpc/calc", "jsonrpc", calcService));
app.use(KIARA.node.serve("/xmlrpc/calc", "xmlrpc", calcService));
app.use(KIARA.node.serveFiles(["/*.html", "/scripts/*", "/idl/*"], path.join(__dirname, 'static')));

var server = http.createServer(app);

server.listen(port, function() {
    console.log("KIARA Server listening on http://localhost:"+port+"/");
});
