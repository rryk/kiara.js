var xmlrpc = require('xmlrpc')

// Creates an XML-RPC client. Passes the host information on where to
// make the XML-RPC calls.
var client = xmlrpc.createClient({ host: 'localhost', port: 3001, path: '/'})

// Sends a method call to the XML-RPC server
client.methodCall('calc.add', [1,2], function (error, value) {
    // Results of the method response
    console.log('Method response for \'calc.add\': ' + value)
    console.log('Error: ' +error)
})
