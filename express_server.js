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

var express;
try {
  var express = require('express');
} catch (err) {
  console.error("Please install express first: npm install express");
  console.error(err);
  process.exit(1);
}
var http = require('http')
  , path = require('path')
  , KIARA = require('./static/scripts/kiara.js');

// Register additional MIME types
express.static.mime.define({'text/plain': ['kiara', 'idl']});

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

var app = express();

app.configure(function() {
  app.set('port', port);
  app.use(express.favicon());
  app.use(express.logger('dev'));

  // CORS support
  app.all('/*', function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "X-Requested-With");
    next();
  });

  // Serve index.html when root is specified '/'
  app.get('/', function(req, res) {
    res.sendfile('static/kiara_test.html') // res.sendfile('static/index.html')
  });


  // For direct access to the raw data stream KIARA.node.serve must be called
  // before express.bodyParser
  app.use(KIARA.node.serve("/rpc/calc", "jsonrpc", calcService));
  app.use(KIARA.node.serve("/xmlrpc/calc", "xmlrpc", calcService));

  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.directory(path.join(__dirname, 'static'))); // serve directories
  app.use(express.static(path.join(__dirname, 'static'))); // static content
});

app.configure('development', function() {
  app.use(express.errorHandler());
});

// Run server

http.createServer(app).listen(app.get('port'), function() {
  console.log("KIARA server listening on http://localhost:" + app.get('port'));
});

// Run jsonrpc server

var jayson = require("jayson");

// create a server
var jsonrpcServer = jayson.server({
    'calc.add': function(a, b, callback) {
        callback(null, ((a | 0) + (b | 0)) | 0);
    },
    'calc.addf': function(a, b, callback) {
        callback(null, a + b);
    }
});

// Bind a http interface to the server and let it listen to localhost:3000
jsonrpcServer.http().listen(3000, function() {
    console.log("KIARA JSON-RPC server listening on http://localhost:" + 3000);
});

// Run xmlrpc server

var xmlrpc = require('xmlrpc');

// Creates an XML-RPC server to listen to XML-RPC method calls
var server = xmlrpc.createServer({ host: 'localhost', port: 3001 })
// Handle methods not found
server.on('NotFound', function(method, params) {
  console.log('Method ' + method + ' does not exist');
})
// Handle method calls by listening for events with the method call name
server.on('calc.add', function (err, params, callback) {
  console.log('Method call params for \'calc.add\': ' + params);
  var a = params[0];
  var b = params[1];
  // ...perform an action...
  var result = ((a | 0) + (b | 0)) | 0;
  // Send a method response with a value
  callback(null, result);
})
console.log('XML-RPC server listening on port 3001')

// Local Variables:
// tab-width:2
// c-basic-offset: 2
// espresso-indent-level: 2
// indent-tabs-mode: nil
// End:
// vim: set expandtab tabstop=2 shiftwidth=2:
