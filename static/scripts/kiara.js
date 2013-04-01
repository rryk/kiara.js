// Uses "returnExportsGlobal" pattern from https://github.com/umdjs/umd
(function (root, factory) {
    if (typeof exports === 'object') {
        // Node. Does not work with strict CommonJS, but
        // only CommonJS-like enviroments that support module.exports,
        // like Node.
        module.exports = factory(/*module*/);
    } else if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define([/*'module'*/], function (/*module*/) {
            return (root.KIARA = factory(/*module*/));
        });
    } else {
        // Browser globals
        root.KIARA = factory(/*root.module*/);
    }
}(this, function (/*module*/) {

    // Browser compatibility layer
    if (typeof Object.create !== 'function') {
        Object.create = function (o) {
            if (arguments.length > 1) {
                throw new Error('Object.create implementation only accepts the first parameter.');
            }
            function F() {}
            F.prototype = o;
            return new F();
        };
    }

    // Node.js compatibility layer
    var isNode = (typeof process === 'object' && typeof require === 'function');
    if (isNode) {
        var util = require('util');
    } else {
        var util = {};
        util.inherits = function(ctor, superCtor) {
            ctor.super_ = superCtor;
            ctor.prototype = Object.create(superCtor.prototype);
            ctor.prototype.constructor = ctor;
            ctor.superclass = superCtor.prototype;
        }
    }

    var KIARA = {};
    KIARA.inherits = util.inherits;

    // Data loading

    var binaryContentTypes = ["application/octet-stream"];
    var binaryExtensions = [".bin", ".bson"];

    function endsWith(str, suffix) {
        return str.indexOf(suffix, str.length - suffix.length) !== -1;
    }

    function isBinaryExtension(url) {
        for (var i in binaryExtensions) {
            if (endsWith(url, binaryExtensions[i]))
                return true;
        }
        return false;
    }

    function isBinaryContentType(contentType) {
        for (var i in binaryContentTypes) {
            if (contentType == binaryContentTypes[i]) {
                return true;
            }
        }
        return false;
    }

    /**
     * Load data via XMLHttpRequest
     * @private
     * @param {string} url URL of the document
     * @param {function} loadListener function called with loaded data
     * @param {function} errorListener function called with XMLHttpRequest when load failed,
     *                                 _url attribute of the XMLHttpRequest contains URL of the request
     */
    function loadData(url, loadListener, errorListener) {
        var xmlHttp = null;
        try {
            xmlHttp = new XMLHttpRequest();
        } catch (e) {
            xmlHttp = null;
        }
        if (xmlHttp) {
            xmlHttp._url = url;
            xmlHttp._contentChecked = false;
            xmlHttp.open('GET', url, true);
            if (isBinaryExtension(url))
                xmlHttp.responseType = "arraybuffer";

            xmlHttp.onreadystatechange = function() {
                if (xmlHttp._aborted) // This check is possibly not needed
                    return;
                // check compatibility between content and request mode
                if (!xmlHttp._contentChecked &&
                    // 2 - HEADERS_RECEIVED, 3 - LOADING, 4 - DONE
                    ((xmlHttp.readyState == 2 || xmlHttp.readyState == 3 ||xmlHttp.readyState == 4) &&
                        xmlHttp.status == 200)) {
                    xmlHttp._contentChecked = true; // we check only once
                    // check if we need to change request mode
                    var contentType = xmlHttp.getResponseHeader("content-type");
                    if (contentType) {
                        var binaryContent = isBinaryContentType(contentType);
                        var binaryRequest = (xmlHttp.responseType == "arraybuffer");
                        // When content is not the same as request, we need to repeat request
                        if (binaryContent != binaryRequest) {
                            xmlHttp._aborted = true;
                            var cb = xmlHttp.onreadystatechange;
                            xmlHttp.onreadystatechange = null;
                            var url = xmlHttp._url;
                            xmlHttp.abort();

                            // Note: We do not recycle XMLHttpRequest !
                            //       This does work only when responseType is changed to "arraybuffer",
                            //       however the size of the xmlHttp.response buffer is then wrong !
                            //       It does not work at all (at least in Chrome) when we use overrideMimeType
                            //       with "text/plain; charset=x-user-defined" argument.
                            //       The latter mode require creation of the fresh XMLHttpRequest.

                            xmlHttp = new XMLHttpRequest();
                            xmlHttp._url = url;
                            xmlHttp._contentChecked = true;
                            xmlHttp.open('GET', url, true);
                            if (binaryContent)
                                xmlHttp.responseType = "arraybuffer";
                            xmlHttp.onreadystatechange = cb;
                            xmlHttp.send(null);
                            return;
                        }
                    }
                }
                // Request mode and content type are compatible here (both binary or both text)
                if (xmlHttp.readyState == 4) {
                    if(xmlHttp.status == 200) {
                        console.log("Loaded: " + xmlHttp._url);

                        var mimetype = xmlHttp.getResponseHeader("content-type");
                        var response = null;

                        if (xmlHttp.responseType == "arraybuffer") {
                            response = xmlHttp.response;
                        } else if (mimetype == "application/json") {
                            response = JSON.parse(xmlHttp.responseText);
                        } else if (mimetype == "application/xml" || mimetype == "text/xml") {
                            response = xmlHttp.responseXML;
                        } else {
                            response = xmlHttp.responseText;
                        }
                        if (loadListener)
                            loadListener(response);
                    } else {
                        //console.error("Could not load external document '" + xmlHttp._url +
                        //    "': " + xmlHttp.status + " - " + xmlHttp.statusText);
                        if (errorListener)
                            errorListener(xmlHttp);
                    }
                }
            };
            xmlHttp.send(null);
        }
    };

    KIARA.SUCCESS = 0;
    KIARA.FALSE = false;
    KIARA.TRUE = true;

    /** Return codes signaling errors */

    KIARA.NO_ERROR          = KIARA.SUCCESS;
    KIARA.GENERIC_ERROR     = 0x0001;
    KIARA.INPUT_ERROR       = 0x0100;
    KIARA.OUTPUT_ERROR      = 0x0200;
    KIARA.CONNECTION_ERROR  = 0x0300;
    KIARA.IDL_LOAD_ERROR    = 0x0301;
    KIARA.API_ERROR         = 0x0500;
    KIARA.INIT_ERROR        = 0x0501;
    KIARA.FINI_ERROR        = 0x0502;
    KIARA.INVALID_VALUE     = 0x0503;
    KIARA.INVALID_TYPE      = 0x0504;
    KIARA.INVALID_OPERATION = 0x0505;
    KIARA.INVALID_ARGUMENT  = 0x0506;
    KIARA.UNSUPPORTED_FEATURE = 0x0507;

    /** Return codes from a function call */

    KIARA.EXCEPTION         = 0x1000;

    var errorMsg = {};
    errorMsg[KIARA.NO_ERROR] = 'No error';
    errorMsg[KIARA.GENERIC_ERROR] = 'Generic error';
    errorMsg[KIARA.INPUT_ERROR] = 'Input error';
    errorMsg[KIARA.OUTPUT_ERROR] = 'Output error';
    errorMsg[KIARA.CONNECTION_ERROR] = 'Connection error';
    errorMsg[KIARA.API_ERROR] = 'API error';
    errorMsg[KIARA.INIT_ERROR] = 'Init error';
    errorMsg[KIARA.FINI_ERROR] = 'Finalization error';
    errorMsg[KIARA.INVALID_VALUE] = 'Invalid value';
    errorMsg[KIARA.INVALID_TYPE] = 'Invalid type';
    errorMsg[KIARA.INVALID_OPERATION] = 'Invalid operation';
    errorMsg[KIARA.INVALID_ARGUMENT] = 'Invalid argument';

    KIARA.init = function() { };
    KIARA.finalize = function() { };

    // Represents a data type.
    KIARA.Type = function(kind, typeDefinition) {
        this.kind = kind;

        if (this.kind == "base")
            this.baseTypeName = typeDefinition;

        if (this.kind == "struct")
            this.fields = typeDefinition;

        if (this.kind == "enum")
            this.values = typeDefinition;

        if (this.kind == "array")
            this.elementType = typeDefinition;
    }

    var types = {};
    types.void = {
        name : 'void'
    };
    types.any = {
        name : 'any'
    };
    types.i8 = {
        name : 'i8',
        size : 1
    };
    types.u8 = {
        name : 'u8',
        size : 1
    };
    types.i16 = {
        name : 'i16',
        size : 2
    };
    types.u16 = {
        name : 'u16',
        size : 2
    };
    types.i32 = {
        name : 'i32',
        size : 4
    };
    types.u32 = {
        name : 'u32',
        size : 4
    };
    types.i64 = {
        name : 'i64',
        size : 8
    };
    types.u64 = {
        name : 'u64',
        size : 8
    };
    types.float = {
        name : 'float',
        size : 4
    };
    types.double = {
        name : 'u64',
        size : 8
    };
    types.boolean = {
        name : 'boolean',
        size : 1
    };
    types.string = {
        name : 'string'
    };

    KIARA.type_void = function(ctx) { return types.void; }
    KIARA.type_any = function(ctx) { return types.any; }
    KIARA.type_i8 = function(ctx) { return types.i8; }
    KIARA.type_u8 = function(ctx) { return types.u8; }
    KIARA.type_i16 = function(ctx) { return types.i16; }
    KIARA.type_u16 = function(ctx) { return types.u16; }
    KIARA.type_i32 = function(ctx) { return types.i32; }
    KIARA.type_u32 = function(ctx) { return types.u32; }
    KIARA.type_i64 = function(ctx) { return types.i64; }
    KIARA.type_u64 = function(ctx) { return types.u64; }
    KIARA.type_float = function(ctx) { return types.float; }
    KIARA.type_double = function(ctx) { return types.double; }
    KIARA.type_boolean = function (ctx) { return types.boolean; }
    KIARA.type_string = function (ctx) { return types.string; }

    // -- KIARAError --

    function KIARAError(errorCode, message) {
        if (Error.captureStackTrace) // V8
            Error.captureStackTrace(this, this.constructor); //super helper method to include stack trace in error object
        else
            this.stack = (new Error).stack;

        this.name = this.constructor.name;
        this.errorCode = errorCode || KIARA.GENERIC_ERROR;
        this.message = message || errorMsg[this.errorCode];
    }
    KIARAError.prototype = new Error();
    KIARAError.prototype.constructor = KIARAError;
    KIARA.Error = KIARAError;

    // -- Listener Support --

    // from http://stackoverflow.com/questions/10978311/implementing-events-in-my-own-object
    function augmentWithListener(object) {
        var _this = object;
        _this._events = {};

        _this.addListener = function(name, handler) {
            if (_this._events.hasOwnProperty(name))
                _this._events[name].push(handler);
            else
                _this._events[name] = [handler];
            if (_this._listenerAdded)
                _this._listenerAdded(name, handler);
        };

        _this.on = _this.addListener;

        _this.removeListener = function(name, handler) {
            /* This is a bit tricky, because how would you identify functions?
             This simple solution should work if you pass THE SAME handler. */
            if (!_this._events.hasOwnProperty(name))
                return;

            var index = _this._events[name].indexOf(handler);
            if (index != -1) {
                _this._events[name].splice(index, 1);
                if (_this._listenerRemoved)
                    _this._listenerRemoved(name, handler);
            }
        };

        _this.hasListeners = function(name) {
            if (!_this._events.hasOwnProperty(name))
                return false;
            return _this._events[name].length > 0;
        }

        _this.listeners = function(name) {
            if (!_this._events.hasOwnProperty(name))
                return [];
            return _this._events[name];
        }

        _this.emit = function(name) {
            if (!_this._events.hasOwnProperty(name))
                return;

            var args = Array.prototype.slice.call(arguments);
            args.splice(0, 1);

            var evs = _this._events[name], l = evs.length;
            for (var i = 0; i < l; i++) {
                evs[i].apply(null, args);
            }
        };
    }

    // -- Context --

    function Context() {
        augmentWithListener(this);
    }

    KIARA.createContext = function() { return new Context; }

    Context.prototype._handleError = function(error) {
        if (this.hasListeners('error'))
            return this.emit('error', error);
        throw error;
    }

    function checkContext(context) {
        if (!context || !(context instanceof Context))
            throw new KIARAError(KIARA.INVALID_ARGUMENT, "No KIARA context passed, use KIARA.createContext");
    }

    function checkCallback(callback) {
        if (!callback)
            throw new KIARAError(KIARA.INVALID_ARGUMENT, "No callback passed to the asynchronous function");
    }

    // -- MethodDescriptor --

    function MethodDescriptor(methodName, parsedTypeMapping) {
        this.methodName = methodName;
        this.parsedTypeMapping = parsedTypeMapping;
    }

    function checkMethodDescriptor(methodDescriptor) {
        if (!methodDescriptor || !(methodDescriptor instanceof MethodDescriptor))
            throw new KIARAError(KIARA.INVALID_ARGUMENT, "No method descriptor passed");
    }

    // -- CallResponse --

    function CallResponse(connection, methodDescriptor, options) {
        this._connection = connection;
        this._methodDescriptor = methodDescriptor;
        this._result = null;
        this._resultType = null; // 'result', 'exception', or 'error'
        augmentWithListener(this);
        var options = options || { };
        if (options.onerror)
            this.addListener('error', options.onerror);
        if (options.onresult)
            this.addListener('result', options.onresult);
        if (options.onexception)
            this.addListener('exception', options.onexception);
    }

    CallResponse.prototype.getMethodName = function() {
        return this._methodDescriptor.methodName;
    }

    CallResponse.prototype.setResult = function(result, resultType) {
        if (resultType != 'result' && resultType != 'exception' && resultType != 'error')
            throw new KIARAError(KIARA.INVALID_ARGUMENT, "Unsupported result type: "+resultType);
        this._result = result;
        this._resultType = resultType;
        this._handleResult();
    }

    CallResponse.prototype._listenerAdded = function(name, handler) {
        if (this._error || this._result || this._exception)
            this._handleResult();
    }

    CallResponse.prototype._handleResult = function() {
        if (this._result && this._resultType) {
            if (this.hasListeners(this._resultType)) {
                var resultType = this._resultType;
                var result = this._result;
                this._result = null;
                this._resultType = null;
                this.emit(resultType, result);
                return;
            }
            // special case
            if (this._resultType == 'exception' && this.hasListeners('result')) {
                var exception = this._result;
                this._result = null;
                this._resultType = null;
                this.emit('result', null, exception);
                return;
            }
        }
    }

    // -- Protocol base class --

    function Protocol(name) {
        this.name = name;
    }
    Protocol._protocols = {};

    Protocol.prototype.createMethodDescriptor = function(methodName, parsedTypeMapping) {
        return new MethodDescriptor(methodName, parsedTypeMapping);
    }
    Protocol.prototype.callMethod = function(callResponse, args) {
        throw new KIARAError(KIARA.UNSUPPORTED_FEATURE, "Protocol '"+this.name+"' not implemented");
    }
    Protocol.prototype.generateClientFunc = function(connection, methodDescriptor, options) {
        checkMethodDescriptor(methodDescriptor);
        var that = this;
        return function() {
            var callResponse = new CallResponse(connection, methodDescriptor, options);
            that.callMethod(callResponse, arguments);
            return callResponse;
        }
    }

    function registerProtocol(name, protocolCtor) {
        if (typeof protocolCtor !== 'function')
            throw new KIARAError(KIARA.INVALID_ARGUMENT, "registerProtocol require constructor function as argument");
        Protocol._protocols[name] = protocolCtor;
    }
    function getProtocol(name) {
        return Protocol._protocols[name];
    }
    KIARA.Protocol = Protocol;
    KIARA.registerProtocol = registerProtocol;
    KIARA.getProtocol = getProtocol;

    // -- Connection --

    function Connection(context, url, userCallback) {
        checkContext(context);
        this._context = context;
        this._url = null;
        this._errors = [];
        this._protocol = null;
        augmentWithListener(this);
        if (url)
            this.loadIDL(url, userCallback);
    }

    Connection.prototype._handleError = function(error) {
        if (this.hasListeners('error'))
            return this.emit('error', error);
        if (this._context)
            return this._context._handleError(error);
        throw error;
    }

    Connection.prototype._parseTypeMapping = function(qualifiedMethodName, typeMapping) {
        // TODO
        return { };
    }

    // Constructs a client function that will automatically serialize the method call and send it to the server.
    // The function will return an empty object, which can be used to set up a callback when response is received:
    //
    //   var login = conn.generateClientFunc(...);
    //   login(args).on('return', function(returnValue) { /* process return value here */ });
    //
    // Callback will be called with one argument that corresponds to the return value of the function in IDL.
    //
    // options argument is optional and can contain callback mappings:
    // result : function (result, exception) { ... }
    // error : function (error) { ... }
    // exception : function (exception) { ... }
    //
    // result is invoked when either result or exception returned from the remote side
    // error is invoked when call failed
    // exception is invoked when exception is returned from the remote side
    // when both result and exception callbacks are defined, result is not called on
    // remote exception.
    Connection.prototype.generateClientFunc = function(qualifiedMethodName, typeMapping, options) {
        if (!this._protocol)
            throw new KIARAError(KIARA.INVALID_OPERATION, "Client function cannot be generated before protocol is known, establish connection first");

        var parsedMapping = this._parseTypeMapping(qualifiedMethodName, typeMapping);
        var methodDescriptor = this._protocol.createMethodDescriptor(qualifiedMethodName, parsedMapping);
        return this._protocol.generateClientFunc(this, methodDescriptor, options);
    }

    Connection.prototype.loadIDL = function(url, userCallback) {
        // TODO can we load multiple IDLs at the same time ?
        this._url = url;
        loadData(url,
            this._onIDLLoaded.bind(this, userCallback),
            this._onIDLLoadError.bind(this, userCallback));
    }

    Connection.prototype._onIDLLoaded = function(userCallback, response) {
        var that = this;
        function handleError(error) {
            if (userCallback)
                return userCallback(error);
            else
                return that._handleError(error);
        }

        console.log("IDL Loaded: "+response);
        this._idl = response;
        // TODO parse IDL, open connection specified in the IDL

        //???BEGIN PROTOCOL SPECIFIC PART
        //var protocolName = 'jsonrpc';
        //var protocolUrl = 'http://' + location.hostname + ':8080/rpc/calc';
        var protocolName = 'xmlrpc';
        var protocolUrl = 'http://' + location.hostname + ':8080/xmlrpc/calc';
        //???END PROTOCOL SPECIFIC PART

        var protocolCtor = getProtocol(protocolName);
        if (!protocolCtor)
            handleError(new KIARAError(KIARA.UNSUPPORTED_FEATURE, "Protocol '"+protoclName+"' is not supported"));
        try {
            this._protocol = new protocolCtor(protocolUrl);
        } catch (e) {
            handleError(e);
        }

        if (userCallback)
            userCallback(null, this);
    }

    Connection.prototype._onIDLLoadError = function(userCallback, xhr) {
        var error = new KIARAError(KIARA.IDL_LOAD_ERROR,
            "Could not load IDL '" + xhr._url +"': " + xhr.status + " - " + xhr.statusText);
        if (userCallback)
            userCallback(error);
        else
            this._handleError(error);
    }

    Context.prototype.openConnection = function(url, userCallback) {
        checkCallback(userCallback);
        return new Connection(this, url, userCallback);
    };

    // -- Service (For server only) --

    function Service(context, name, url) {
        checkContext(context);
        this._name = name;
        this._context = context;
        this._url = null;
        this._errors = [];
        this._methods = {};
        augmentWithListener(this);
        // TODO get IDL via URL
        //if (url)
        //    this.loadIDL(url, userCallback);
    }

    function checkService(service) {
        if (!service || !(service instanceof Service))
            throw new KIARAError(KIARA.INVALID_ARGUMENT, "No KIARA service passed, use context.createService");
    }

    Service.prototype._handleError = function(error) {
        if (this.hasListeners('error'))
            return this.emit('error', error);
        if (this._context)
            return this._context._handleError(error);
        throw error;
    }

    Service.prototype.getName = function() { return this._name; }

    Service.prototype._parseTypeMapping = function(qualifiedMethodName, typeMapping) {
        // TODO
        return { };
    }

    Service.prototype.registerMethod = function(qualifiedMethodName, typeMapping, func) {
        var parsedMapping = this._parseTypeMapping(qualifiedMethodName, typeMapping);
        this._methods[qualifiedMethodName] = {
            'parsedMapping' : parsedMapping,
            'method' : func
        };
    }

    Service.prototype.removeMethod = function(qualifiedMethodName) {
        if (this._methods.hasOwnProperty(qualifiedMethodName))
            delete this._methods[qualifiedMethodName];
    }

    Context.prototype.createService = function(name, url) {
        return new Service(this, url);
    };

    // -- Nodejs / Expressjs Middleware --

    var node = {
        _initialized : false,
        _protocols : {}
    };

    node.init = function() {
        if (node._initialized)
            return;
        if (!isNode)
            throw new KIARAError(KIARA.INVALID_OPERATION, "No nodejs environment detected");
        node._initialized = true;

        node.parse = require('url').parse;
        node.fs = require('fs');
        node.path = require('path');
        node.http = require('http');

        // from connect/lib/utils.js
        node.parseUrl = function(req) {
            var parsed = req._parsedUrl;
            if (parsed && parsed.href == req.url) {
                return parsed;
            } else {
                return req._parsedUrl = node.parse(req.url);
            }
        };

        // from express/lib/utils.js
        node.pathRegexp = function(path, keys, sensitive, strict) {
            if (path instanceof RegExp) return path;
            if (Array.isArray(path)) path = '(' + path.join('|') + ')';
            path = path
                .concat(strict ? '' : '/?')
                .replace(/\/\(/g, '(?:/')
                .replace(/(\/)?(\.)?:(\w+)(?:(\(.*?\)))?(\?)?(\*)?/g, function(_, slash, format, key, capture, optional, star){
                    keys.push({ name: key, optional: !! optional });
                    slash = slash || '';
                    return ''
                        + (optional ? '' : slash)
                        + '(?:'
                        + (optional ? slash : '')
                        + (format || '') + (capture || (format && '([^/.]+?)' || '([^/]+?)')) + ')'
                        + (optional || '')
                        + (star ? '(/*)?' : '');
                })
                .replace(/([\/.])/g, '\\$1')
                .replace(/\*/g, '(.*)');
            return new RegExp('^' + path + '$', sensitive ? '' : 'i');
        };

        node.writeError = function(res, status, errorMsg) {
            res.writeHead(status, node.http.STATUS_CODES[status],
                {"Content-Type": "text/plain"});
            if (errorMsg)
                res.write(errorMsg);
            res.end();
        }

        // init protocols

        //??? BEGIN PROTOCOL SPECIFIC PART
        try {
            node._protocols['jsonrpc'] = require('./connect-jsonrpc.js').serve;
        } catch (e) {
            console.warn('Could not load JSON-RPC protocol: ', e);
        }

        try {
            node._protocols['xmlrpc'] = require('./connect-xmlrpc.js').serve;
        } catch (e) {
            console.warn('Could not load XML-RPC protocol: ', e);
        }
        //??? END PROTOCOL SPECIFIC PART
    }

    node.middleware = function() {
        node.init();
        function app(req, res) { app.handle(req, res); }
        app.requestHandlers = [];
        app.handle = function(req, res) {
            var processNext;
            function next() {
                processNext = true;
            }
            for (var i in app.requestHandlers) {
                processNext = false;
                app.requestHandlers[i](req, res, next);
                if (!processNext)
                    break;
            }
            if (processNext) {
                node.writeError(res, 404, "Cannot "+req.method+" "+req.url);
            }
        }
        app.use = function(requestHandler) {
            if (requestHandler)
                app.requestHandlers.push(requestHandler);
        }
        return app;
    }

    node.serve = function (path, protocol, service, options) {
        node.init();
        if (!path)
            throw new KIARAError(KIARA.INVALID_ARGUMENT, 'KIARA.node.serve() require path');
        checkService(service);

        var options = options || {};
        var keys = [];
        var sensitive = true;
        var regexp = node.pathRegexp(path
            , keys
            , options.sensitive
            , options.strict);

        var protocolHandler = node._protocols[protocol];
        if (!protocolHandler)
            throw new KIARAError(KIARA.UNSUPPORTED_FEATURE, "Protocol '"+protocol+"' is not supported by KIARA");

        var methodTable = {};
        for (var name in service._methods) {
            methodTable[name] = service._methods[name].method;
        }
        var serveProtocol = protocolHandler(methodTable);

        return function(req, res, next) {
            var path = node.parseUrl(req).pathname;
            var m = regexp.exec(path);
            if (!m)
                return next();
            console.log("KIARA RPC Handler: for "+path);
            //res.end("KIARA RPC Handler: for "+path);
            return serveProtocol(req, res, next);
        }
    }

    node.serveFiles = function(path, root, options) {
        node.init();

        var options = options || {};
        var keys = [];
        var sensitive = true;
        var regexp = node.pathRegexp(path
            , keys
            , options.sensitive
            , options.strict);

        root = node.path.normalize(root);
        return function(req, res, next) {
            var reqPath = node.parseUrl(req).pathname;
            var m = regexp.exec(reqPath);
            if (!m)
                return next();

            if (root) {
                reqPath = node.path.normalize(node.path.join(root, reqPath));
                if (reqPath.indexOf(root) != 0)
                    return node.writeError(res, 403);
            } else {
                if (~reqPath.indexOf('..')) {
                    return node.writeError(res, 403);
                }
            }

            node.fs.exists(reqPath, function(exists) {
                if (!exists) {
                    return node.writeError(res, 404, "404 Not Found\n");
                } else {
                    node.fs.readFile(reqPath, function(err, file) {
                        if (err) {
                            return node.writeError(res, 500, err+"\n");
                        } else {
                            res.writeHeader(200);
                            res.write(file, "binary");
                            res.end();
                        }
                    });
                }
            });
        }
    }

    KIARA.node = node;

    return KIARA;
}));
