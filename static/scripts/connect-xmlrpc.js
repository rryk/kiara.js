// Original implementation from https://github.com/fshost/xrpc
//
//(The MIT License)
//
//Copyright (c) 2012 Nathan Cartwright<fshost@yahoo.com>
//
//Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the 'Software'), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
//
//    The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
//
//    THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

/*
 Express-XmlRpc - XML-RPC middleware for Express

 based on rsscloud-node's xmlrpc module: https://github.com/lmorchard/rsscloud-node
 specs: http://www.xmlrpc.com/spec

 usage:
 // assuming app is an express server, use just prior to router in config, e.g.
 var express = require('express'),
 xrpc = require('express-xmlrpc'),
 app = express();

 app.configure(function () {
 app.use(express.methodOverride());
 app.use(xrpc.xmlrpc);
 app.use(server.router)
 });

 app.listen(3000);

 */

var XmlRpcParser = require('./lib/xmlrpc-parser');


exports.xmlRpc = function xmlRpc(req, res, next) {

    // Only attempt to parse text/xml Content-Type
    var ct = req.headers['content-type'] || '';
    var mime = ct.split(';')[0];
    if ('text/xml' != mime) { return next(); }

    var raw = [];
    var parser = new XmlRpcParser({
        onDone: function (data) {
            req.body_XMLRPC = data;
            next();
        },
        onError: function (msg) {
            req.body_XMLRPC = false;
            next();
        }
    });

    // If there's raw body data, try parsing that instead of hooking up events.
    if (req.rawBody) {
        return parser.parseString(req.rawBody).finish();
    }

    req.setEncoding('utf8');
    req.on('data', function (chunk) {
        raw.push(chunk);
        parser.parseString(chunk);
    });
    req.on('end', function () {
        req.rawBody = raw.join('');
        parser.finish();
    });

};

var XmlRpcResponse = require('./lib/xmlrpc-response');
var XmlRpcFault = require('./lib/xmlrpc-fault');


function xmlrpc(services, httpMethod) {
    services = services || {};

    return function (req, res, next) {
        var context = this;

        function respond(obj) {
            var body = obj.xml();
            res.writeHead(200, {
                'Content-Type': 'application/xml',
                'Content-Length': Buffer.byteLength(body)
            });
            res.end(body);
        }

        var cb = function (err, rv) {
            if (!err) {
                respond(new XmlRpcResponse([rv]));
            }
            else {
                respond(new XmlRpcFault(err.code || 0, err.message || err));
            }
        };

        function handleRequests(xmlrpc) {
            if (!xmlrpc) {
                respond(new XmlRpcFault(-32700, 'parse error. not well formed'));
            }

            var params = xmlrpc.params,
                method = services[xmlrpc.method];

            if (typeof method === 'function') {
                try {
                    params.push(cb);
                    method.apply(context, params);
                }
                catch (e) {
                    respond(new XmlRpcFault(-32500, 'Unexpected exception ' + e));
                    next(e);
                }
            }
            else {
                respond(new XmlRpcFault(-32601, 'requested method ' + xmlrpc.method + ' not found'));
            }
        }

        if (httpMethod && req.method !== httpMethod.toUpperCase()) {
            return next();
        }

        if (req.body_XMLRPC !== undefined)
            handleRequests(req.body_XMLRPC);
        else {
            // Only attempt to parse text/xml Content-Type
            var contentType = req.headers['content-type'] || '';
            var mime = contentType.split(';')[0];
            if ('application/xml' != mime && 'text/xml' != mime) {
                return next();
            }

            var raw = [];
            var parser = new XmlRpcParser({
                onDone: function (data) {
                    req.body_XMLRPC = data;
                    handleRequests(data);
                },
                onError: function (msg) {
                    req.body_XMLRPC = false;
                    next();
                }
            });

            // If there's raw body data, try parsing that instead of hooking up events.
            if (req.rawBody) {
                return parser.parseString(req.rawBody).finish();
            }

            req.setEncoding('utf8');
            req.on('data', function (chunk) {
                raw.push(chunk);
                parser.parseString(chunk);
            });
            req.on('end', function () {
                req.rawBody = raw.join('');
                parser.finish();
            });

        }
    };

}

// returns a route handler for an express server which dispatches XML-RPC
// requests to handlers. The return value from a handler is transformed from
// javascript into an XML-RPC response and sent.  Methods invoked consist
// of parameters and an additional argument of 'callback' which has a signature
// of callback(err, val) where val is data to respond to request with, or
// err is an error which will be responded as an xmlrpc fault
// (err.code can be set to a specific fault code if desired)
// note that optionally an object can be passed with a property of xmlRpcMethods
// containing methods.
// Also note that nested properties will be referenced as nested, e.g.
// xmlrpc call for 'blogger.getUsersBlogs' will reference to function A below
// { blogger: { getUsersBlogs: function A(...) { ... } } }
//
//     app.post('/RPC2', xrpc.route({
//         echo: function (param, callback) {
//             callback(null, 'Echo: ' + param);
//             // or if error,  callback(err);
//         }
//     }));
exports.route = xmlrpc;
exports.serve = function (services) {
    return xmlrpc(services, "POST");
}
