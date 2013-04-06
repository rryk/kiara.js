// Serialize/Deserializer info is an array where each entry is of the form
//
//   {
//     encoding: encodingType,
//     path: [ index1, field2, index3 ... ],
//     nested: [ ... ],
//     enumDict: { name1: value1, name2: value2, ... ]
//     enumDefault: value,
//   }.
//
// The serializer will exract data using path and write onto wire using specified encoding and in the same order as
// entries appear in the array. Note that serializer's path should always begin with an index to specify argument
// index. The deserilizer will do reverse process, reading fields from the wire in the same order entries appear in
// the array and writing them into respective path creating objects and arrays where necessary. Nested field is used
// for arrays and describes how to encode each element in the array in the same way as top-level array. Enum
// dictionary and enum default are only used when encoding is "enum". The value is expected to be string and if found
// in dictionary (enumDict) coded as integer value, otherwise as default integer value (enumDefault).
//
// Available encoding types:
//   zc-string     - zero-coded-string, UTF-16 characters are coded using Uint16Array.
//   array         - size of the array is coded using Uint32Array which is followed by the elements.
//   u8-32, i8-32  - integers are coded using [Uint|Int][8|16|32]Array, values outside of valid range will overflow.
//   float, double - reals are coded using Float[32|64]Array, values outside of valid range will overflow.
//   enum          - enums values are coded as integers using Uint32Array.
//   boolean       - coded using Uint8Array.
//
// For example, the following arguments
//
//   arguments: [
//     {
//       name: {
//         first: "str1",
//         last: "str2",
//       },
//       ratio: 3.14159265359
//     },
//     [
//       [
//         {n: "ab", v: 123},
//         {n: "bc", v: 321}
//       ],
//       [
//         {n: "cd", v: 231}
//       ]
//     ]
//   ]
//
// using the following info
//
//   [
//     {
//       type: "zc-string",
//       path: [0, "name", "first"]
//     },
//     {
//       type: "zc-string",
//       path: [0, "name", "last"]
//     },
//     {
//       type: "array",
//       path: [1, "field"],
//       nested: [
//         {
//           type: "array",
//           path: [],
//           nested: [
//             {
//               type: "zc-string",
//               path: ["n"]
//             },
//             {
//               type: "u8",
//               path: ["v"]
//             }
//           ]
//         }
//       ]
//     },
//     {
//       type: "double",
//       path: [0, "ratio"]
//     }
//   ];
//
// will be serialized as following
//
//    [
//      's', 't', 'r', '1', 0,  // Uint16Array
//      's', 't', 'r', '2', 0,  // Uint16Array
//      2, 2,                   // Uint32Array
//      'a', 'b', 0,            // Uint16Array
//      123,                    // Uint8Array
//      'b', 'c', 0,            // Uint16Array
//      65,                     // Uint8Array, overflow (321 mod 256 = 65)
//      1,                      // Uint32Array
//      'c', 'd', 0,            // Uint16Array
//      231,                    // Uint8Array
//      3.14159265359           // Float64Array
//    ]

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

function Extractor() {
    this._getters = [];
    this._setters = [];
    this._constructors = [];
}
Extractor.fromPath = function(path) {
    var x = new Extractor();
    for (var i = 0; i < path.length; ++i) {
        var value = path[i];
        switch (realTypeOf(value)) {
            case 'Number':
                x.index(value);
                break;
            case 'String':
                x.field(value);
                break;
            default:
                throw new KIARAError(100, 'Unsupported value : ' + value);
        }
    }
    return x;
}
Extractor.prototype.index = function (i) {
    this._getters.push(function (object, options) {
        return object[i];
    });
    this._setters.push(function (object, valueGetter, options) {
        object[i] = valueGetter();
    });
    this._constructors.push(function (options) {
        return [];
    });
    return this;
}
Extractor.prototype.field = function (name) {
    this._getters.push(function (object, options) {
        return object[name];
    });
    this._setters.push(function (object, valueGetter, options) {
        object[name] = valueGetter();
    });
    this._constructors.push(function (options) {
        return {};
    });
    return this;
}
Extractor.prototype.extract = function (object) {
    if (object)
        for (var i = 0; i < this._getters.length; ++i) {
            object = this._getters[i](object);
            if (!object)
                break;
        }
    return object;
}
Extractor.prototype.construct = function (object, valueGetter, options) {
    var len = this._getters.length;
    if (len == 0)
        return object;

    var i = 0;
    var newObject;
    function getNewObject() { return newObject; }
    var topObject = object;

    if (!object) {
        topObject = object = this._constructors[0](options);
    }

    for (; i < len-1; ++i) {
        newObject = this._getters[i](object, options);
        if (!newObject) {
            if (i+1 >= len)
                throw new KIARAError(100, "Wrong index: "+(i+1));
            newObject = this._constructors[i+1](options);
            this._setters[i](object, getNewObject, options);
        }
        object = newObject;
    }
    if (i < len) {
        this._setters[i](object, valueGetter, options);
    }
    return topObject;
}

function ArrayOutputStream(array) {
    this.array = array;
}
ArrayOutputStream.prototype.writeInt8 = function(value) {
    this.array.push(value);
}
ArrayOutputStream.prototype.writeUInt8 = function(value) {
    this.array.push(value);
}
ArrayOutputStream.prototype.writeInt16 = function(value) {
    this.array.push(value);
}
ArrayOutputStream.prototype.writeUInt16 = function(value) {
    this.array.push(value);
}
ArrayOutputStream.prototype.writeInt32 = function(value) {
    this.array.push(value);
}
ArrayOutputStream.prototype.writeUInt32 = function(value) {
    this.array.push(value);
}
ArrayOutputStream.prototype.writeFloat32 = function(value) {
    this.array.push(value);
}
ArrayOutputStream.prototype.writeFloat64 = function(value) {
    this.array.push(value);
}
ArrayOutputStream.prototype.writeInt = function(value) {
    this.writeInt32(value);
}
ArrayOutputStream.prototype.writeUInt = function(value) {
    this.writeUInt32(value);
}
ArrayOutputStream.prototype.writeString = function(value) {
    this.array.push(value);
}
ArrayOutputStream.prototype.writeHint = function(key, value) {
    this.array.push({key : key, value : value});
}

// Serializers

function Serializer() {
    this._writers = {};
    this._readers = {};
}
Serializer.prototype.registerSerializer = function(name, reader, writer) {
    this._readers[name] = reader;
    this._writers[name] = writer;
}
Serializer.prototype.write = function(stream, name, object) {
    var write = this._writers[name];
    if (!write)
        throw new KIARAError("No writer for '"+name+"' type");
    return write(stream, object);
}
Serializer.prototype.read = function(stream, name) {
    var read = this._readers[name];
    if (!read)
        throw new KIARAError("No reader for '"+name+"' type");
    return read(stream);
}

function Serializers(serializers) {
    this._index = 0;
    this._serializers = serializers;
}
Serializers.prototype.resetIndex = function() {
    this._index = 0;
}
Serializers.prototype.getSerializer = function() {
    if (this._index >= this._serializers.length)
        throw new Error("Index out of bounds");
    return this._serializers[this._index++];
}

//var simpleSer = Serializer();
//simpleSer.registerSerializer('array', function(stream, )

function ArraySerializer() {
}
ArraySerializer.prototype.getNumNestedSerializers = function() {
    return 1;
}
ArraySerializer.prototype.write = function(stream, nestedSerializers, data) {
    var serializer = nestedSerializers.getSerializer();
    stream.writeHint('begin', 'array');
    stream.writeUInt(data.length);
    for (var i = 0; i < data.length; ++i) {
        serializer.write(stream, nestedSerializers, data);
    }
    stream.writeHint('end', 'array');
}
ArraySerializer.prototype.read = function(stream, nestedSerializers) {
    var serializer = nestedSerializers.getSerializer();

    stream.readHint(); // begin:array
    var len = stream.readUInt();
    var data = new Array(len);
    for (var i = 0; i < len; ++i) {
        data[i] = serializer.read(stream, nestedSerializers);
    }
    stream.readHint(); // end:array
}

function TypeSerializer(program) {
    this.program = program;
}
TypeSerializer.prototype.write = function(stream) {
    for (var i = 0; i < this.program.length; ++i) {
        var path = this.program[i].path;
        var type = this.program[i].type;
    }
}

function realTypeOf(obj) {
    return Object.prototype.toString.call(obj).slice(8, -1);
}

function runTest() {
    console.log("Serializer test");

    var data = [
        {
            name:{
                first:"str1",
                last:"str2"
            },
            ratio:3.14159265359
        },
        [
            [
                {n:"ab", v:123},
                {n:"bc", v:321}
            ],
            [
                {n:"cd", v:231}
            ]
        ]
    ];

    var x = [];

    x.push(Extractor.fromPath([0, "name", "first"]));
    x.push(Extractor.fromPath([0, "name", "last"]));
    x.push(Extractor.fromPath([1, 0, 0, "n"]));
    x.push(Extractor.fromPath([1, 0, 0, "v"]));
    x.push(Extractor.fromPath([1, 0, 1, "n"]));
    x.push(Extractor.fromPath([1, 0, 1, "v"]));
    x.push(Extractor.fromPath([1, 1, 0, "n"]));
    x.push(Extractor.fromPath([1, 1, 0, "v"]));
    x.push(Extractor.fromPath([0, "ratio"]));

    for (var i = 0; i < x.length; ++i) {
        console.log(x[i].extract(data));
    }

    function makeGetter(array) {
        var i = 0;
        return function () {
            if (i >= array.length)
                throw new Error("index "+i+" is out of bounds");
            return array[i++];
        }
    }

    var storage = makeGetter(["str1", "str2", "ab", 123, "bc", 321, "cd", 231, 3.14159265359]);

    var object = null;
    for (var i = 0; i < x.length; ++i) {
        object = x[i].construct(object, storage);
    }
    console.log(object);

    //   [
//     {
//       type: "zc-string",
//       path: [0, "name", "first"]
//     },
//     {
//       type: "zc-string",
//       path: [0, "name", "last"]
//     },
//     {
//       type: "array",
//       path: [1, "field"],
//       nested: [
//         {
//           type: "array",
//           path: [],
//           nested: [
//             {
//               type: "zc-string",
//               path: ["n"]
//             },
//             {
//               type: "u8",
//               path: ["v"]
//             }
//           ]
//         }
//       ]
//     },
//     {
//       type: "double",
//       path: [0, "ratio"]
//     }
//   ];

}
