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
    callback(null, a+b);
});

var app = KIARA.node.middleware();

app.use(KIARA.node.serve("/rpc/calc", "jsonrpc", calcService));
app.use(KIARA.node.serve("/xmlrpc/calc", "xmlrpc", calcService));
app.use(KIARA.node.serveFiles(["/*.html", "/scripts/*", "/idl/*"], path.join(__dirname, 'static')));

var server = http.createServer(app);

server.listen(port, function() {
    console.log("KIARA Server listening on http://localhost:"+port+"/");
});
