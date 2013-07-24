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

var https = require('https')
    , path = require('path')
    , KIARA = require('./static/scripts/kiara.js');

function getUserHome() {
    return process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE;
}

// Create KIARA service
var context = KIARA.createContext();

// Calculator service

// var calcService = context.createService('calc', 'https://localhost:'+port+'/rpc/calc');
var calcService = context.createService('calc', 'https://localhost:'+port+'/rpc/calc');
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

// StructTest service

// var structTestService = context.createService('struct_test', 'https://localhost:'+port+'/rpc/struct_test');
var structTestService = context.createService('struct_test', 'https://localhost:'+port+'/rpc/struct_test');
structTestService.registerMethod('StructTest.pack', null, function (ival, sval, callback) {
    console.log('received : ('+ival+','+sval+')');
    callback(null, {ival : (ival | 0), sval : ""+sval});
});
structTestService.registerMethod('StructTest.getInteger', null, function (data, callback) {
    console.log("StructTest.getInteger("+JSON.stringify(data)+");");
    callback(null, data.ival | 0);
});
structTestService.registerMethod('StructTest.getString', null, function (data, callback) {
    console.log("StructTest.getString("+JSON.stringify(data)+");");
    callback(null, data.sval+"");
});
structTestService.registerMethod('StructTest.throwException', null, function (code, message, callback) {
    console.log("StructTest.throwException("+JSON.stringify([code, message])+");");
    callback({code: code, message: message}, null);
});


// Application

var app = KIARA.node.middleware();

// Currently we do not support multiple IDLs in the JSON negotiation document.
// Thus we setup two different negotiation services:
//
// http://localhost:PORT/service  for calc
// http://localhost:PORT/service2 for struct_test

// Setup calc service

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
                name : "https",
                url : "/rpc/calc"
            }
        },
        {
            services : "*",
            protocol : {
                name : "xmlrpc"
            },
            transport : {
                name : "https",
                url : "/xmlrpc/calc"
            }
        }
    ]
};

app.use(KIARA.node.serveText("/service", JSON.stringify(endpointInfo, null, 2), {contentType : "application/json"}));
app.use(KIARA.node.serve("/rpc/calc", "jsonrpc", calcService));
app.use(KIARA.node.serve("/xmlrpc/calc", "xmlrpc", calcService));

// Setup struct_test service

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
                name : "https",
                url : "/rpc/struct_test"
            }
        },
        {
            services : "*",
            protocol : {
                name : "xmlrpc"
            },
            transport : {
                name : "https",
                url : "/xmlrpc/struct_test"
            }
        }
    ]
};

app.use(KIARA.node.serveText("/service2", JSON.stringify(endpointInfo, null, 2), {contentType : "application/json"}));
app.use(KIARA.node.serve("/rpc/struct_test", "jsonrpc", structTestService));
app.use(KIARA.node.serve("/xmlrpc/struct_test", "xmlrpc", structTestService));

// Setup common static resources

app.use(KIARA.node.serveFiles(["/*.html", "/scripts/*", "/idl/*"], path.join(__dirname, 'static')));

// added for SSL
var fs = require('fs');

var options = {
    key: fs.readFileSync(path.join(getUserHome(), 'kiaraCA/node_key.pem')),
    cert: fs.readFileSync(path.join(getUserHome(), 'kiaraCA/node_crt.pem')),
    ca: fs.readFileSync(path.join(getUserHome(), 'kiaraCA/cacert.pem')),
    // This is necessary only if using the client certificate authentication.
    requestCert: true
};

var server = https.createServer(options, app);

server.listen(port, function() {
    console.log("KIARA SSL Server listening on https://localhost:"+port+"/");
});
