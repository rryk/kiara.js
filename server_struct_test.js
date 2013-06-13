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
var calcService = context.createService('struct_test', 'http://localhost:'+port+'/rpc/struct_test');
calcService.registerMethod('StructTest.pack', null, function (ival, sval, callback) {
    callback(null, {ival : (ival | 0), sval : ""+sval});
});
calcService.registerMethod('StructTest.getInteger', null, function (data, callback) {
    callback(null, data.ival | 0);
});
calcService.registerMethod('StructTest.getString', null, function (data, callback) {
    console.log("StructTest.getString("+data+");");
    callback(null, data.sval+"");
});

var app = KIARA.node.middleware();

var endpointInfo = {
    info : "test server",
    idlURL : "/idl/struct_test.kiara", // absolute or relative URL
    // idlContents : "...",    // IDL contents
    servers : [
        {
            services : "*",
            protocol : {
                name : "jsonrpc"
            },
            transport : {
                name : "http",
                url : "/rpc/struct_test"
            }
        },
        {
            services : "*",
            protocol : {
                name : "xmlrpc"
            },
            transport : {
                name : "http",
                url : "/xmlrpc/struct_test"
            }
        }
    ]
};

app.use(KIARA.node.serveText("/service", JSON.stringify(endpointInfo, null, 2), {contentType : "application/json"}));
app.use(KIARA.node.serve("/rpc/struct_test", "jsonrpc", calcService));
app.use(KIARA.node.serve("/xmlrpc/struct_test", "xmlrpc", calcService));
app.use(KIARA.node.serveFiles(["/*.html", "/scripts/*", "/idl/*"], path.join(__dirname, 'static')));

var server = http.createServer(app);

server.listen(port, function() {
    console.log("KIARA Server listening on http://localhost:"+port+"/");
});
