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

function realTypeOf(obj) {
    return Object.prototype.toString.call(obj).slice(8, -1);
}

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
                throw new KIARA.Error(KIARA.INVALID_ARGUMENT, 'Unsupported value : ' + value);
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
                throw new KIARA.Error(100, "Wrong index: "+(i+1));
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
// Special functions, usually implemented in terms of typed functions
ArrayOutputStream.prototype.writeInt = function(value) {
    this.writeInt32(value);
}
ArrayOutputStream.prototype.writeUInt = function(value) {
    this.writeUInt32(value);
}
ArrayOutputStream.prototype.writeNumber = function(value) {
    this.writeFloat64(value);
}
ArrayOutputStream.prototype.writeBoolean = function(value) {
    this.writeUInt8(value);
}
ArrayOutputStream.prototype.writeString = function(value) {
    this.array.push(value);
}
ArrayOutputStream.prototype.writeHint = function(key, value) {
    this.array.push({key : key, value : value});
}

// Serializers

function TypeSerializer() {
    this._serializers = {};
}
TypeSerializer.prototype.addSerializer = function(type, serializerCtor) {
    this._serializers[type] = new serializerCtor(type.getWorld(), this);
}
TypeSerializer.prototype.write = function(stream, typeOfObject, object) {
    var serializer = this._serializers[typeOfObject];
    if (!serializer)
        throw new KIARA.Error(KIARA.INVALID_ARGUMENT, "No serializer for type "+typeOfObject+" registered");
    serializer.write(stream, typeOfObject, object);
}
TypeSerializer.prototype.read = function(stream, typeOfObject) {
    var serializer = this._serializers[typeOfObject];
    if (!serializer)
        throw new KIARA.Error(KIARA.INVALID_ARGUMENT, "No serializer for type "+typeOfObject+" registered");
    return serializer.read(stream, typeOfObject);
}

function isStringType(ty, world) {
    var w = world || KIARA.World();
    return ty === w.type_string() || ty === w.type_js_string();
}

function isNumberType(ty, world) {
    var w = world || KIARA.World();
    return (ty === w.type_js_number() ||
            ty === w.type_i8() || ty === w.type_u8() ||
            ty === w.type_i16() || ty === w.type_u16() ||
            ty === w.type_i32() || ty === w.type_u32() ||
            ty === w.type_i64() || ty === w.type_u64() ||
            ty === w.type_float() || ty === w.type_double());
}

function isBooleanType(ty, world) {
    var w = world || KIARA.World();
    return (ty === w.type_js_boolean() || ty === w.type_boolean());
}

function PrimitiveSerializer(world, serializers) {
    this.world = world;
    this.serializers = serializers;
}
PrimitiveSerializer.prototype.write = function(stream, typeOfData, data) {
    if (isStringType(typeOfData, this.world)) {
        stream.writeString(data);
    } else if (isBooleanType(typeOfData, this.world)) {
        stream.writeBoolean(data);
    } else if (typeOfData === this.world.type_js_number()) {
        stream.writeNumber(data);
    } else if (typeOfData === this.world.type_i8()) {
        stream.writeInt8(data);
    } else if (typeOfData === this.world.type_u8()) {
        stream.writeUInt8(data);
    } else if (typeOfData === this.world.type_i16()) {
        stream.writeInt16(data);
    } else if (typeOfData === this.world.type_u16()) {
        stream.writeUInt16(data);
    } else if (typeOfData === this.world.type_i32()) {
        stream.writeInt32(data);
    } else if (typeOfData === this.world.type_u32()) {
        stream.writeUInt32(data);
    } else if (typeOfData === this.world.type_i64()) {
        stream.writeInt64(data);
    } else if (typeOfData === this.world.type_u64()) {
        stream.writeUInt64(data);
    } else if (typeOfData === this.world.type_float()) {
        stream.writeFloat32(data);
    } else if (typeOfData === this.world.type_double()) {
        stream.writeFloat64(data);
    }
    throw new KIARA.Error(KIARA.INVALID_TYPE, "Type "+typeOfData+" is not a primitive type");
}

PrimitiveSerializer.prototype.read = function(stream, typeOfData) {
    if (isStringType(typeOfData, this.world)) {
        return stream.readString();
    } else if (isBooleanType(typeOfData, this.world)) {
        return stream.readBoolean();
    } else if (typeOfData === this.world.type_js_number()) {
        return stream.readNumber();
    } else if (typeOfData === this.world.type_i8()) {
        return stream.readInt8();
    } else if (typeOfData === this.world.type_u8()) {
        return stream.readUInt8();
    } else if (typeOfData === this.world.type_i16()) {
        return stream.readInt16();
    } else if (typeOfData === this.world.type_u16()) {
        return stream.readUInt16();
    } else if (typeOfData === this.world.type_i32()) {
        return stream.readInt32();
    } else if (typeOfData === this.world.type_u32()) {
        return stream.readUInt32();
    } else if (typeOfData === this.world.type_i64()) {
        return stream.readInt64();
    } else if (typeOfData === this.world.type_u64()) {
        return stream.readUInt64();
    } else if (typeOfData === this.world.type_float()) {
        return stream.readFloat32();
    } else if (typeOfData === this.world.type_double()) {
        return stream.readFloat64();
    }
    throw new KIARA.Error(KIARA.INVALID_TYPE, "Type "+typeOfData+" is not a primitive type");
}

function ArraySerializer(world, serializers) {
    this.world = world;
    this.serializers = serializers;
}
ArraySerializer.prototype.write = function(stream, typeOfData, data) {
    var typeOfElement = typeOfData.getElementType();
    var elementSerializer = this.serializers.getSerializer(typeOfElement);
    stream.writeHint('begin', 'array');
    stream.writeUInt(data.length);
    for (var i = 0; i < data.length; ++i) {
        elementSerializer.write(stream, typeOfElement, data[i]);
    }
    stream.writeHint('end', 'array');
}
ArraySerializer.prototype.read = function(stream, typeOfData) {
    var typeOfElement = typeOfData.getElementType();
    var elementSerializer = this.serializers.getSerializer(typeOfElement);

    stream.readHint(); // begin:array
    var len = stream.readUInt();
    var data = new Array(len);
    for (var i = 0; i < len; ++i) {
        data[i] = serializer.read(stream, typeOfElement);
    }
    stream.readHint(); // end:array
}

//function TypeSerializer(program) {
//    this.program = program;
//}
//TypeSerializer.prototype.write = function(stream) {
//    for (var i = 0; i < this.program.length; ++i) {
//        var path = this.program[i].path;
//        var type = this.program[i].type;
//    }
//}


function createType(data, world) {
    world = world || KIARA.World();
    if (KIARA.isString(data))
        return world.type_js_string();
    if (KIARA.isNumber(data))
        return world.type_js_number();
    if (KIARA.isBoolean(data))
        return world.type_js_boolean();
    if (KIARA.isArray(data)) {
        var any = KIARA.AnyType.get(world);
        var types = [];
        var typeSet = {};
        for (var i = 0; i < data.length; ++i) {
            var ty = createType(data[i]);
            if (ty === any) {
                // any unifies everything
                types = [any];
                break;
            }
            if (!typeSet.hasOwnProperty(ty)) {
                types.push(ty);
                typeSet[ty] = true;
            }
        }
        if (types.length === 1)
            return KIARA.ArrayType.get(world, types[0]);
        else
            return KIARA.ArrayType.get(world, KIARA.VariantType.get(world, types));
    }
    if (KIARA.isObject(data)) {
        var elementTypes = [];
        var elementNames = [];
        for (var key in data) {
            if (data.hasOwnProperty(key)) {
                elementNames.push(key);
                elementTypes.push(createType(data[key]));
            }
        }
        var ty;
        if (elementTypes.length === 0) {
            ty = KIARA.StructType.get(world, "", 0);
        } else {
            ty = KIARA.StructType.create(world, "", elementTypes);
            ty.setElementNames(elementNames);
        }
        return ty;
    }
    if (data === undefined || data === null) {
        return KIARA.AnyType.get(world);
    }
    throw new KIARA.Error(KIARA.INVALID_TYPE, "Cannot compute type for object: "+data);
}

function runTest1() {
    console.log("Serializer test 1");



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

    console.log(createType(data).toString());
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
