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

// Chat service

INTERNAL_ERROR        = 0
INVALID_USER_ID       = 1
INVALID_USER_NAME     = 2
INVALID_USER_PASSWORD = 3
INVALID_AUTH_STATE    = 4
AUTHENTICATION_FAILED = 5
NO_MESSAGES           = 6

var users = [
    {'dmitri':'dmitri'},
    {'user1':'user1'},
    {'user2':'user2'}
];

var messages = [];
var state = {userName: null, id: null};

var chatService = context.createService('chat', 'http://localhost:'+port+'/rpc/chat');
chatService.registerMethod('ChatServer.registerUser', null, function (userName, userPassword, callback) {

    console.log("ChatServer.registerUser(" + JSON.stringify(Array.prototype.slice.call(arguments,0,-1)) + ")");

    callback(null, null);
});

chatService.registerMethod('ChatServer.loginUser', null, function (userName, userPassword, callback) {
    console.log("ChatServer.loginUser(" + JSON.stringify(Array.prototype.slice.call(arguments,0,-1)) + ")");

    state.userName = userName;
    state.id = 1;
    callback(null, state.id);
    //callback({code: AUTHENTICATION_FAILED, message: "Invalid user id or password"});
});

chatService.registerMethod('ChatServer.sendMessage', null, function (recipient, message, callback) {
    console.log("ChatServer.sendMessage(" + JSON.stringify(Array.prototype.slice.call(arguments,0,-1)) + ")");

    messages.push({sender: 2, message: message});

    callback(null, null);
});

chatService.registerMethod('ChatServer.getUserIdByName', null, function (userName, callback) {
    console.log("ChatServer.getUserIdByName(" + JSON.stringify(Array.prototype.slice.call(arguments,0,-1)) + ")");

    var id = null;
    if (userName == "BROADCAST")
        id = 0;
    if (userName === state.userName)
        id = 1;
    if (userName == "echo")
        id = 2;
    if (id === null)
        callback({code: INVALID_USER_ID, message: "Invalid user id"});
    else
        callback(null, id);
});

chatService.registerMethod('ChatServer.getUserNameById', null, function (id, callback) {
    console.log("ChatServer.getUserNameById(" + JSON.stringify(Array.prototype.slice.call(arguments,0,-1)) + ")");

    switch (id)
    {
    case 0: callback(null, "BROADCAST");
    case 1: callback(null, state.userName);
    case 2: callback(null, "echo");
    default: break;
    }
    callback({code: INVALID_USER_ID, message: "getUserNameById"});
});


chatService.registerMethod('ChatServer.receiveMessage', null, function (callback) {
    //console.log("ChatServer.receiveMessage(" + JSON.stringify(Array.prototype.slice.call(arguments,0,-1)) + ")");

    if (messages.length) {
        var message = messages.shift()
        console.log("receive message -> "+JSON.stringify(message));
        callback(null, message);
    } else {
        callback(NO_MESSAGES, null);
    }
});

chatService.registerMethod('ChatServer.logoutUser', null, function (callback) {
    console.log("ChatServer.logoutUser(" + JSON.stringify(Array.prototype.slice.call(arguments,0,-1)) + ")");

    callback(null, []);
});

// Application

var app = KIARA.node.middleware();

// Setup chat service

var endpointInfo = {
    info : "chat server",
    idlURL : "/idl/chat.kiara", // absolute or relative URL
    // idlContents : "...",    // IDL contents
    servers : [
        {
            services : "*",
            protocol : {
                name : "jsonrpc"
            },
            transport : {
                name : "http",
                url : "/rpc/chat"
            }
        },
        {
            services : "*",
            protocol : {
                name : "xmlrpc"
            },
            transport : {
                name : "http",
                url : "/xmlrpc/chat"
            }
        }
    ]
};

app.use(KIARA.node.serveText("/service", JSON.stringify(endpointInfo, null, 2), {contentType : "application/json"}));
app.use(KIARA.node.serve("/rpc/chat", "jsonrpc", chatService));
app.use(KIARA.node.serve("/xmlrpc/chat", "xmlrpc", chatService));

// Setup common static resources

app.use(KIARA.node.serveFiles(["/*.html", "/scripts/*", "/idl/*"], path.join(__dirname, 'static')));

var server = http.createServer(app);

server.listen(port, function() {
    console.log("KIARA Server listening on http://localhost:"+port+"/");
});
