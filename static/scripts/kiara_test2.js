function contextError(context, error) {
    logger.error("Context error: "+error);
}

// -- Register Protocol Implementations --

function registerProtocols() {
    // JSON WebSocket protocol (uses JSON-serialized calls)

    function JSONWebSocket(url) {
        KIARA.Protocol.call(this, 'websocket-json');
        this._url = url;

        this.MAX_RECONNECT_ATTEMPTS = 5;
        
        this._funcs = {};
        this._activeCalls = {};
        this._cachedCalls = [];
        this._nextCallID = 0;
        this._reconnectAttempts = 0;
        
        this.connect();
    }

    KIARA.inherits(JSONWebSocket, KIARA.Protocol);

    // Messages:
    //   [ 'call', callID, methodName, arg1, arg2, ... ]
    //   [ 'call-reply', callID, success, retValOrException ]

    JSONWebSocket.prototype.connect = function() {
        this._wb = new WebSocket(this._url);
        this._wb.onopen = this._handleConnect.bind(this);
        this._wb.onerror = this._wb.onclose = this._handleDisconnect.bind(this);
        this._wb.onmessage = this._handleMessage.bind(this);
    }
    
    JSONWebSocket.prototype.callMethod = function(callResponse, args) {
        if (this._wb.readyState == WebSocket.OPEN) {
            var callID = this._nextCallID++;
            var argsArray = Array.prototype.slice.call(args);
            var request = [ "call", callID, callResponse.getMethodName() ].concat(argsArray);
            this._wb.send(JSON.stringify(request));
            this._activeCalls[callID] = callResponse;
        } else {
            this._cachedCalls.push([callResponse, args]);
        }
    }
    
    JSONWebSocket.prototype.registerFunc = function(methodDescriptor, nativeMethod) {
        this._funcs[methodDescriptor.methodName] = nativeMethod;
    }
    
    JSONWebSocket.prototype._handleMessage = function(message) {
      var data = JSON.parse(message.data);
      var msgType = data[0];
      if (msgType == 'call-reply') {
        var callID = data[1];
        if (callID in this._activeCalls) {
          var callResponse = this._activeCalls[callID];
          var success = data[2];
          var retValOrException = data[3];
          callResponse.setResult(retValOrException, success ? 'result' : 'exception');
          delete this._activeCalls[callID];
        } else {
          throw new KIARAError(KIARA.CONNECTION_ERROR, 
                               "Received a response for an unrecognized call id: " + callID);
        }
      } else if (msgType == 'call') {
        var callID = data[1];
        var methodName = data[2];
        if (methodName in this._funcs) {
          var args = data.slice(3);
          var response = [ 'call-reply', callID ];
          try {
            retVal = this._funcs[methodName].apply(null, args);
            response.push(true);
            response.push(retVal);
          } catch (exception) {
            response.push(false);
            response.push(exception);
          }
          this._wb.send(JSON.stringify(response));
        } else {
          throw new KIARAError(KIARA.CONNECTION_ERROR, 
                               "Received a call for an unregistered method: " + methodName);
        }
      } else {
          throw new KIARAError(KIARA.CONNECTION_ERROR, "Unknown message type: " + msgType);
      }
    }

    JSONWebSocket.prototype._handleConnect = function() {
        for (var callIndex in this._cachedCalls) {
          var call = this._cachedCalls[callIndex];
          this.callMethod(call[0], call[1])
        }
        call._cachedCalls = [];
    }

    JSONWebSocket.prototype._handleDisconnect = function(event) {
        this._reconnectAttempts++;
        if (this._reconnectAttempts <= this.MAX_RECONNECT_ATTEMPTS) {
            this.connect();
        } else {
            for (var callID in this._activeCalls) {
              var callResponse = this._activeCalls[callID];
              callResponse.setResult(event, 'error');
            }
            this._activeCalls = {};

            for (var callIndex in this._cachedCalls) {
              var cachedCall = this._cachedCalls[callIndex];
              cachedCall[0].setResult(event, 'error');
            }
            this._cachedCalls = [];
        }
    }

    KIARA.registerProtocol('websocket-json', JSONWebSocket);
}

// -- End Protocol Registration --

function runTest() {
    registerProtocols();

    console.log("Creating context...");
    var context = KIARA.createContext();
    context.addListener(contextError.bind(window, context));

    console.log("Context: ", context);

    console.log("Opening connection...");

    context.openConnection("http://" + location.host + "/idl/login.kiara",
        function (err, conn) {
            if (err) {
                console.error(err);
                return;
            }
            console.log("Connection: ", conn);

            console.log("[1] Creating func wrapper...");
            var login = conn.generateFuncWrapper(
                "opensim.login.login",
                "Request.request : Args[0]; Response : Result;");
            console.log("[1] Func wrapper: ", login);

            var retValue = 42;
            conn.registerFuncImplementation(
                "opensim.login.foobar",
                "Request.a : Args[0]; Request.b : Args[1]; Response : Result;",
                function(arg1, arg2) {
                  console.log("Received call to opensim.login.foobar with arg1 = ", arg1, " and arg2 = ", arg2);
                  console.log("Returning ", retValue, " from opensim.login.foobar.");
                  return retValue;
                }
            );

            var loginRequest = {
                name: {
                    first: "Test",
                    last: "User"
                },
                pwdHash: "$1$202cb962ac59075b964b07152d234b70",  // $1$ + md5('123')
                start: "last",
                channel: "OpenSIM OMP JS Client",
                version: "0.1",
                platform: "Lin",
                mac: "00:00:00:00:00:00",  // FIXME(rryk): We can't get MAC address from the JavaScript.
                options: ["inventory-skeleton", "inventory-root"],
                id0: "00000000-0000-0000-0000-000000000000",  // FIXME(rryk): Not sure how to compute hardware hash.
                agree_to_tos: "true",
                read_critical: "true",
                viewer_digest: "00000000-0000-0000-0000-000000000000"
            };

            console.log("[1] Calling func wrapper with request: [", loginRequest, "]");
            var loginCall = login(loginRequest);
            loginCall.on('result', function(exception, result) {
                console.log("[1] Received return value for the func wrapper: ", result);
            });
            loginCall.on('error', function(error) {
                console.log("[1] Connection error:", error);
            });
        }
    );
}
