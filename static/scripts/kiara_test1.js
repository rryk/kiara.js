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

    // WAMP (WebSocket Application Messaging Protocol)

    function WAMProtocol(url) {
        KIARA.Protocol.call(this, 'wamp');
        this._url = url;
        this._requestedCalls = [];
        this._dispatchedCalls = [];
        this._session = null;
        this._failureReason = null;
        ab.connect(url, this.sessionEstablished, this.sessionInterrupted);
    }

    KIARA.inherits(WAMProtocol, KIARA.Protocol);

    WAMProtocol.prototype.callMethod = function(callResponse, args) {
      var call = { callResponse: callResponse, args: args };
      if (this._session != null) {               // connected - dispatch calls
        args = args.splice(0, 0, "service:" + callResponse.getMethodName());
        var that = this;
        this._session.call.apply(this._session, args).then(function(result) {
          callResponse.setResult(result, 'result');
          that._dispatchedCalls.splice(that._dispatchedCalls.indexOf(call), 1);
        });
        this._dispatchedCalls.push(call);
      } else if (this._failureReason != null) {  // connection failed - return error
        callResponse.setResult(this._failureReason, 'error');
      } else {                                   // didn't connect yet - cache call to be called later
        this._requestedCalls.push(call);
      }
    };

    // Callback when session is established. Executes all previously cached calls.
    WAMProtocol.sessionEstablished = function(session) {
        this._session = session;
        this._session.prefix("service", this._url + "#");
        for (var requestedCall in this._requestedCalls)
          this.callMethod(requestedCall.callResponse, requestedCall.args);
    };

    // Callback when session was interrupted. Fails all previously cached or dispatched calls.
    WAMProtocol.sessionInterrupted = function(code, reason) {
        this._failureReason = reason;
        for (var dispatchedCall in this._dispatchedCalls)
          dispatchedCall.callResponse.setResult(reason, 'error');
        for (var requestedCall in this._requestedCalls)
          requestedCall.callResponse.setResult(reason, 'error');
    };

    KIARA.registerProtocol('wamp', WAMProtocol);
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

            console.log("[1] Creating func wrapper...");
            var add = conn.generateFuncWrapper("calc.add", "Request.a : Args[0]; Request.b : Args[1]; Response : Result;");
            console.log("[1] Func wrapper: ", add);

            console.log("[1] Calling func wrapper with request: [1, 2]");
            var addCall = add(1, 2);
            addCall.on('result', function(result, exception) {
                console.log("[1] Received return value for the func wrapper: ", result);
            });
            addCall.on('error', function(error) {
                console.log("[1] Connection error:", error);
            });
            addCall.on('exception', function(exception) {
                console.log("[1] Remote exception: ", exception);
            });

            var addf = conn.generateFuncWrapper("calc.addf",
                "Request.a : Args[0]; Request.b : Args[1]; Response : Result;",
                {
                    'onresult' : function(result, exception) {
                        console.log("[2] Received return value for the func wrapper: ", result);
                    },
                    'onerror' : function(error) {
                        console.log("[2] Connection error:", error);
                    }
                });
            console.log("[2] Func wrapper: ", addf);

            console.log("[2] Calling func wrapper with request: [3, 4]");
            var addfCall = addf(3, 4);

            console.log("[2] Call object: ", addfCall);
        }
    );
}
