var xmlrpc = require('xmlrpc')

// Creates an XML-RPC client. Passes the host information on where to
// make the XML-RPC calls.
//var client = xmlrpc.createClient({ host: 'localhost', port: 8080, path: '/rpc/echo'})
//var client = xmlrpc.createClient({ host: 'localhost', port: 3000, path: '/RPC'})
var client = xmlrpc.createClient({ host: 'localhost', port: 8080, path: '/xmlrpc/calc'})

// Sends a method call to the XML-RPC server
client.methodCall('calc.add', [1,2], function (error, value) {
    // Results of the method response
    console.log('Method response for \'calc.add\': ' + value)
    console.log('Error: ' +error)
})
