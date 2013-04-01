function contextError(context, error) {
    logger.error("Context error: "+error);
}

// -- Register Protocol Implementations --

function registerProtocols() {
    // JSON-RPC

    function JsonRpcProtocol(url) {
        KIARA.Protocol.call(this, 'jsonrpc');
        this._handler = new jsonrpc.JsonRpc(url);
    }

    KIARA.inherits(JsonRpcProtocol, KIARA.Protocol);

    JsonRpcProtocol.prototype.callMethod = function(callResponse, args) {
        var args = Array.prototype.slice.call(args);
        args.splice(0, 0, callResponse.getMethodName());
        args.push({
            callback : function(success, data) {
                if (success) {
                    // check data for 'error' field and return an exception
                    callResponse.setResult(data, 'result');
                }
                else
                    callResponse.setResult(data, 'error');
            }
        });
        this._handler.call.apply(this._handler, args);
    }

    KIARA.registerProtocol('jsonrpc', JsonRpcProtocol);

    // XML-RPC

    function XmlRpcProtocol(url) {
        KIARA.Protocol.call(this, 'xmlrpc');
        this._url = url;
    }

    KIARA.inherits(XmlRpcProtocol, KIARA.Protocol);

    XmlRpcProtocol.prototype.callMethod = function(callResponse, args) {
        var request =  new XmlRpcRequest(this._url, callResponse.getMethodName());
        for (var i in args) {
            request.addParam(args[i]);
        }
        var response = request.send(function (err, response) {
            if (err) {
                callResponse.setResult(err, 'error');
            } else {
                var result = response.parseXML();
                if (response.isFault())
                    callResponse.setResult(result, 'error');
                else
                    callResponse.setResult(result, 'result');
            }
        });
    }

    KIARA.registerProtocol('xmlrpc', XmlRpcProtocol);
}

// -- End Protocol Registration --

function runTest() {
    registerProtocols();

    console.log("Creating context...");
    var context = KIARA.createContext();
    context.addListener(contextError.bind(window, context));

    console.log("Context: ", context);

    console.log("Opening connection...");

    // context.openConnection is asynchronous
    // context.openConnectionSync is synchronous (do we need it ?)
    // We use NodeJS callback style (http://nodejs.org/api/fs.html#fs_fs_open_path_flags_mode_callback)
    context.openConnection("http://" + location.host + "/idl/calc.kiara",
        function (err, conn) {
            if (err) {
                console.error(err);
                return;
            }
            console.log("Connection: ", conn);

            //conn.set('protocol', 'xmlrpc');

            console.log("[1] Creating client func...");
            var add = conn.generateClientFunc("calc.add", "Request.a : Args[0]; Request.b : Args[1]; Response : Result;");
            console.log("[1] Client func: ", add);

            console.log("[1] Calling client func with request: [1, 2]");
            var addCall = add(1, 2);
            addCall.on('result', function(result, exception) {
                console.log("[1] Received return value for the client func: ", result);
            });
            addCall.on('error', function(error) {
                console.log("[1] Connection error:", error);
            });
            addCall.on('exception', function(exception) {
                console.log("[1] Remote exception: ", exception);
            });

            var addf = conn.generateClientFunc("calc.addf",
                "Request.a : Args[0]; Request.b : Args[1]; Response : Result;",
                {
                    'onresult' : function(result, exception) {
                        console.log("[2] Received return value for the client func: ", result);
                    },
                    'onerror' : function(error) {
                        console.log("[2] Connection error:", error);
                    }
                });
            console.log("[2] Client func: ", addf);

            console.log("[2] Calling client func with request: [3, 4]");
            var addfCall = addf(3, 4);

            console.log("[2] Call object: ", addfCall);
        }
    );
}
