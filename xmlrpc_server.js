var express = require('express'),
    xrpc = require('./static/scripts/connect-xmlrpc'),
    app = express();

//app.configure(function () {
//    app.use(xrpc.xmlRpc);
//});

app.post('/RPC', xrpc.route({
    'calc.add': function (a, b, callback) {
        callback(null, (a|0)+(b|0));
    }
}));

app.listen(3000);
