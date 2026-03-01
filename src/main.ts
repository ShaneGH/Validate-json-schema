
import { JsonDocument } from "./jsonSchema"
import { validateDocument, ValidationError } from "./validate.js"

let count = 0

function success(name: string, f: (() => ValidationError[])) {
    count += 1
    try {
        const result = f()
        console.assert(!result.length, `${name}: Errors encountered`, ...result)
    } catch (e) {
        console.error(name, e)
    }
}

function failure(name: string, f: (() => ValidationError[]), fields: [string, string][]) {
    count += 1

    try {
        const result = f()
        result.sort((x, y) => x.field.localeCompare(y.field))
        fields.sort((x, y) => x[1].localeCompare(y[1]))

        console.assert(result.length === fields.length,
            `${name}: Incorrect error count encountered`,
            "Actual:",
            ...result,
            "Expected:",
            ...fields)

        for (let i = 0; i < Math.min(result.length, fields.length); i++) {
            console.assert(result[i].field === fields[i][1] && result[i].schema === fields[i][0],
                `${name}: Errors not matching`,
                "Actual:",
                result[i],
                "Expected:",
                fields[i])
        }
    } catch (e) {
        console.error(name, e)
    }
}

function schemaError(name: string, f: (() => ValidationError[]), msg: string) {
    count += 1

    try {
        try {
            f()
            console.assert(false, `${name}: Expected error`)
        } catch (e) {
            let err = e as Error
            console.assert(err.message === msg, `${name}: Expected error message`, err.message, msg)
        }
    } catch (e) {
        console.error(e)
    }
}

(function basic() {

    const freakyObject = {
        "x": 1,
        "y": [null, true, {
            "p": {
                "q": null
            }
        }],
        "z": 3.4
    }

    const schema: JsonDocument = {
        "$schema": "http://json-schema.org/draft-04/schema#",
        "type": "object",
        "properties": {
            "t_any1": {},
            "t_any2": true,
            "t_none": false,
            "t_string": {
                "type": "string"
            },
            "t_multi_type": {
                "type": ["string", "number"]
            },
            "t_null": {
                "type": "null"
            },
            "t_number": {
                "type": "number"
            },
            "t_integer": {
                "type": "integer"
            },
            "t_boolean": {
                "type": "boolean"
            },
            "t_array": {
                "type": "array",
                "$anchor": "anchored_array",
                "items": {
                    "type": "boolean"
                }
            },
            "t_prefixed_array": {
                "type": "array",
                "prefixItems": [{
                    "type": "string"
                }, {
                    "type": "number"
                }],
                "items": {
                    "type": "boolean"
                }
            },
            "t_contains_array": {
                "contains": {
                    "type": "boolean"
                }
            },
            "t_defd_bool": {
                "$ref": "#/$defs/defd_bool"
            },
            "t_defd_anchor": {
                "$ref": "#anchored_array"
            },
            "t_defd_doublebool": {
                "$ref": "#/$defs/defd_double_bool"
            },
            "t_circular_reference": {
                "$ref": "#/$defs/circular_reference"
            },
            "t_enum_1": {
                "enum": [null, 1, "5", freakyObject]
            },
            "t_const_1": {
                "const": freakyObject
            },
            "constrained_number": {
                "multipleOf": 5,
                "exclusiveMinimum": 5,
                "exclusiveMaximum": 15,
            },
            "constrained_number2": {
                "minimum": 5,
                "maximum": 15,
            },
            "constrained_string": {
                "minLength": 1,
                "maxLength": 3,
                "pattern": "^d*$"
            }
        },
        "required": [
            "t_string"
        ],
        "$defs": {
            "defd_bool": {
                "type": "boolean"
            },
            "defd_double_bool": {
                "$ref": "#/$defs/defd_bool"
            },
            "circular_reference": {
                "$ref": "#/$defs/circular_reference2"
            },
            "circular_reference2": {
                "$ref": "#/$defs/circular_reference"
            }
        }
    }

    success("simple, any1", () => validateDocument(schema, { "t_string": "xxx", "t_any1": 333 }))
    success("simple, any1.1", () => validateDocument(schema, { "t_string": "xxx", "t_any1": {} }))
    success("simple, any2", () => validateDocument(schema, { "t_string": "xxx", "t_any2": 333 }))
    success("simple, any2.1", () => validateDocument(schema, { "t_string": "xxx", "t_any2": {} }))
    failure("simple, none", () => validateDocument(schema, { "t_string": "xxx", "t_none": {} }), [["#/properties/t_none", "t_none"]])

    success("simple, string", () => validateDocument(schema, { "t_string": "xxx" }))
    success("simple, extra prop", () => validateDocument(schema, { "t_string": "yyy", "hello1": 66 }))
    failure("simple, incorrect data type, string", () => validateDocument(schema, { "t_string": 8 }), [["#/properties/t_string/type", "t_string"]])
    failure("missing field, string", () => validateDocument(schema, {}), [["#/required/t_string", "t_string"]])

    success("simple + null", () => validateDocument(schema, { "t_string": "xxx", "t_null": null }))
    failure("simple, incorrect data type, null", () => validateDocument(schema, { "t_string": "", "t_null": 8 }), [["#/properties/t_null/type", "t_null"]])

    success("simple + number", () => validateDocument(schema, { "t_string": "xxx", "t_number": 12.23 }))
    failure("simple, incorrect data type, number", () => validateDocument(schema, { "t_string": "", "t_number": {} }), [["#/properties/t_number/type", "t_number"]])
    failure("simple, null, number", () => validateDocument(schema, { "t_string": "", "t_number": null }), [["#/properties/t_number/type", "t_number"]])

    success("simple + int", () => validateDocument(schema, { "t_string": "xxx", "t_integer": 12 }))
    failure("simple, incorrect data type, int", () => validateDocument(schema, { "t_string": "", "t_integer": {} }), [["#/properties/t_integer/type", "t_integer"]])
    failure("simple, incorrect data type, int (frac)", () => validateDocument(schema, { "t_string": "", "t_integer": 2.2 }), [["#/properties/t_integer/type", "t_integer"]])
    failure("simple, null, int", () => validateDocument(schema, { "t_string": "", "t_integer": null }), [["#/properties/t_integer/type", "t_integer"]])

    success("simple + boolean", () => validateDocument(schema, { "t_string": "xxx", "t_boolean": true }))
    failure("simple, incorrect data type, boolean", () => validateDocument(schema, { "t_string": "", "t_boolean": {} }), [["#/properties/t_boolean/type", "t_boolean"]])
    failure("simple, null, boolean", () => validateDocument(schema, { "t_string": "", "t_boolean": null }), [["#/properties/t_boolean/type", "t_boolean"]])

    success("simple + array", () => validateDocument(schema, { "t_string": "xxx", "t_array": [true] }))
    success("simple + array (empty)", () => validateDocument(schema, { "t_string": "xxx", "t_array": [] }))
    failure("simple, incorrect data type, array", () => validateDocument(schema, { "t_string": "", "t_array": {} }), [["#/properties/t_array/type", "t_array"]])
    failure("simple, null, array", () => validateDocument(schema, { "t_string": "", "t_array": null }), [["#/properties/t_array/type", "t_array"]])
    failure("simple, array, mix of good and null data", () => validateDocument(schema, { "t_string": "xxx", "t_array": [true, null] }), [
        ["#/properties/t_array/items/type", "t_array/1"]])
    failure("simple, array, mix of good and bad data", () => validateDocument(schema, { "t_string": "xxx", "t_array": [true, 8] }), [
        ["#/properties/t_array/items/type", "t_array/1"]])

    success("prefixArray, 4", () => validateDocument(schema, { "t_string": "xxx", "t_prefixed_array": ["xx", 4, true, false] }))
    success("prefixArray, 3", () => validateDocument(schema, { "t_string": "xxx", "t_prefixed_array": ["xx", 4, true] }))
    success("prefixArray, 2", () => validateDocument(schema, { "t_string": "xxx", "t_prefixed_array": ["xx", 4] }))
    success("prefixArray, 1", () => validateDocument(schema, { "t_string": "xxx", "t_prefixed_array": ["xx"] }))
    success("prefixArray, 0", () => validateDocument(schema, { "t_string": "xxx", "t_prefixed_array": [] }))
    failure("prefixArray, invalid, 3", () => validateDocument(schema, { "t_string": "xxx", "t_prefixed_array": ["xx", 4, true, "xc"] }), [
        ["#/properties/t_prefixed_array/items/type","t_prefixed_array/3"]
    ])
    failure("prefixArray, invalid, 2", () => validateDocument(schema, { "t_string": "xxx", "t_prefixed_array": ["xx", 4, 5, false] }), [
        ["#/properties/t_prefixed_array/items/type","t_prefixed_array/2"]
    ])
    failure("prefixArray, invalid, 1", () => validateDocument(schema, { "t_string": "xxx", "t_prefixed_array": ["xx", "s", true, false] }), [
        ["#/properties/t_prefixed_array/prefixItems/1/type","t_prefixed_array/1"]
    ])
    failure("prefixArray, invalid, 0", () => validateDocument(schema, { "t_string": "xxx", "t_prefixed_array": [null, 4, true, false] }), [
        ["#/properties/t_prefixed_array/prefixItems/0/type","t_prefixed_array/0"]
    ])

    success("t_multi_type, 1", () => validateDocument(schema, { "t_string": "xxx", "t_multi_type": "xxx" }))
    success("t_multi_type, 2", () => validateDocument(schema, { "t_string": "xxx", "t_multi_type": 444 }))
    failure("t_multi_type, 3", () => validateDocument(schema, { "t_string": "xxx", "t_multi_type": true }), [
        ["#/properties/t_multi_type/type", "t_multi_type"]
    ])

    success("containsArray, success", () => validateDocument(schema, { "t_string": "xxx", "t_contains_array": [true, false] }))
    failure("containsFailure, 1", () => validateDocument(schema, { "t_string": "xxx", "t_contains_array": [] }), [
        ["#/properties/t_contains_array/contains", "t_contains_array"]
    ])
    failure("containsFailure, 1", () => validateDocument(schema, { "t_string": "xxx", "t_contains_array": ["true"] }), [
        ["#/properties/t_contains_array/contains", "t_contains_array"]
    ])

    // success("anchored array", () => validateDocument(schema, { "t_string": "xxx", "t_defd_anchor": [true] }))
    failure("anchored, mix of good and bad data", () => validateDocument(schema, { "t_string": "", "t_defd_anchor": [true, 8] }), 
        [["#/properties/t_defd_anchor/#anchored_array/items/type", "t_defd_anchor/1"]])

    success("ref + boolean", () => validateDocument(schema, { "t_string": "xxx", "t_defd_bool": true }))
    failure("ref, incorrect data type, boolean", () => validateDocument(schema, { "t_string": "", "t_defd_bool": {} }), 
        [["#/properties/t_defd_bool/#/$defs/defd_bool/type", "t_defd_bool"]])
    failure("ref, null, boolean", () => validateDocument(schema, { "t_string": "", "t_defd_bool": null }), 
        [["#/properties/t_defd_bool/#/$defs/defd_bool/type", "t_defd_bool"]])

    success("double ref + boolean", () => validateDocument(schema, { "t_string": "xxx", "t_defd_doublebool": true }))
    failure("double ref, incorrect data type, boolean", () => validateDocument(schema, { "t_string": "", "t_defd_doublebool": {} }), 
        [["#/properties/t_defd_doublebool/#/$defs/defd_double_bool/#/$defs/defd_bool/type", "t_defd_doublebool"]])
    failure("double ref, null, boolean", () => validateDocument(schema, { "t_string": "", "t_defd_doublebool": null }), 
        [["#/properties/t_defd_doublebool/#/$defs/defd_double_bool/#/$defs/defd_bool/type", "t_defd_doublebool"]])

    schemaError("circular_reference", () => validateDocument(schema, { "t_string": "xxx", "t_circular_reference": [] }), "??? circular reference")

    success("enum 1", () => validateDocument(schema, { "t_string": "xxx", "t_enum_1": null }))
    success("enum 2", () => validateDocument(schema, { "t_string": "xxx", "t_enum_1": 1 }))
    success("enum 3", () => validateDocument(schema, { "t_string": "xxx", "t_enum_1": "5" }))
    success("enum 4", () => validateDocument(schema, { "t_string": "xxx", "t_enum_1": JSON.parse(JSON.stringify(freakyObject)) }))
    failure("enum 5", () => validateDocument(schema, { "t_string": "xxx", "t_enum_1": undefined }), [["#/properties/t_enum_1/enum", "t_enum_1"]])
    failure("enum 6", () => validateDocument(schema, { "t_string": "xxx", "t_enum_1": 2 }), [["#/properties/t_enum_1/enum", "t_enum_1"]])
    failure("enum 7", () => validateDocument(schema, { "t_string": "xxx", "t_enum_1": "55" }), [["#/properties/t_enum_1/enum", "t_enum_1"]])

    for (const f of [
        (x: any) => {x.x = 2},
        (x: any) => {x.ppp = 2},
        (x: any) => {x.y[0] = 2},
        (x: any) => {x.y.push(5)},
        (x: any) => {x.y.pop()},
        (x: any) => {delete x.z}
    ]) {
        const cpy = JSON.parse(JSON.stringify(freakyObject))
        f(cpy)
        failure("enum 8", () => validateDocument(schema, { "t_string": "xxx", "t_enum_1": cpy }), [["#/properties/t_enum_1/enum", "t_enum_1"]])
    }

    success("const 1", () => validateDocument(schema, { "t_string": "xxx", "t_const_1": JSON.parse(JSON.stringify(freakyObject)) }))
    failure("const 2", () => validateDocument(schema, { "t_string": "xxx", "t_const_1": undefined }), [["#/properties/t_const_1/const", "t_const_1"]])
    failure("const 3", () => validateDocument(schema, { "t_string": "xxx", "t_const_1": 2 }), [["#/properties/t_const_1/const", "t_const_1"]])
    failure("const 4", () => validateDocument(schema, { "t_string": "xxx", "t_const_1": "55" }), [["#/properties/t_const_1/const", "t_const_1"]])

    for (const f of [
        (x: any) => {x.x = 2},
        (x: any) => {x.ppp = 2},
        (x: any) => {x.y[0] = 2},
        (x: any) => {x.y.push(5)},
        (x: any) => {x.y.pop()},
        (x: any) => {delete x.z}
    ]) {
        const cpy = JSON.parse(JSON.stringify(freakyObject))
        f(cpy)
        failure("const 8", () => validateDocument(schema, { "t_string": "xxx", "t_const_1": cpy }), [["#/properties/t_const_1/const", "t_const_1"]])
    }

    success("numeric constraints 1", () => validateDocument(schema, { "t_string": "xxx", "constrained_number": 10 }))
    failure("numeric constraints 2", () => validateDocument(schema, { "t_string": "xxx", "constrained_number": 11 }), [
        ["#/properties/constrained_number/multipleOf", "constrained_number"]
    ])
    failure("numeric constraints 3", () => validateDocument(schema, { "t_string": "xxx", "constrained_number": 5 }), [
        ["#/properties/constrained_number/exclusiveMinimum", "constrained_number"]
    ])
    failure("numeric constraints 4", () => validateDocument(schema, { "t_string": "xxx", "constrained_number": 15 }), [
        ["#/properties/constrained_number/exclusiveMaximum", "constrained_number"]
    ])

    success("numeric constraints 5", () => validateDocument(schema, { "t_string": "xxx", "constrained_number2": 5 }))
    success("numeric constraints 6", () => validateDocument(schema, { "t_string": "xxx", "constrained_number2": 15 }))
    failure("numeric constraints 7", () => validateDocument(schema, { "t_string": "xxx", "constrained_number2": 16 }), [
        ["#/properties/constrained_number2/maximum", "constrained_number2"]
    ])
    failure("numeric constraints 8", () => validateDocument(schema, { "t_string": "xxx", "constrained_number2": 4 }), [
        ["#/properties/constrained_number2/minimum", "constrained_number2"]
    ])
    
    success("string constraints 1", () => validateDocument(schema, { "t_string": "xxx", "constrained_string": "d" }))
    success("string constraints 2", () => validateDocument(schema, { "t_string": "xxx", "constrained_string": "ddd" }))
    failure("string constraints 3", () => validateDocument(schema, { "t_string": "xxx", "constrained_string": "" }), [
        ["#/properties/constrained_string/minLength", "constrained_string"]
    ])
    failure("string constraints 4", () => validateDocument(schema, { "t_string": "xxx", "constrained_string": "dddd" }), [
        ["#/properties/constrained_string/maxLength", "constrained_string"]
    ])
    failure("string constraints 5", () => validateDocument(schema, { "t_string": "xxx", "constrained_string": "aaa" }), [
        ["#/properties/constrained_string/pattern", "constrained_string"]
    ])
}());

(function conditionalSubSchemas() {
    function executeBothWays(f: (x: boolean) => void) {
        f(true)
        f(false)
    }

    function schema(x: {anyOf?: number, allOf?: number, oneOf?: number, not?: boolean, typeInSub: boolean}): JsonDocument {

        function addSubType(schema: any) {
            return x.typeInSub ? {type: "object", ...schema} : schema
        }

        function sub(subType: string, count: number, x: any) {
            if (!count) return x

            return {
                ...x,
                [subType]: [...Array(count).keys()].map(i => addSubType({
                    "properties": {
                        [`p_${subType}_${i}`]: {
                            "type": "string"
                        }
                    },
                    "required": [`p_${subType}_${i}`]
                }))
            }
        }

        const schema: any = sub("allOf", x.allOf || 0, 
            sub("oneOf", x.oneOf || 0,
                sub("anyOf", x.anyOf || 0, {
                    "$schema": "http://json-schema.org/draft-04/schema#",
                    "properties": {
                        "p1": {"type": "string"}
                    }
                })))

        if (x.not) {
            // TODO: add a validation rule here
            // so that it conditionally failable
            schema["not"] = addSubType({
                "properties": {
                    "p_not": {"type": "string"}
                }
            })
        }

        if (!x.typeInSub) {
            schema.type = "object"
        }

        //console.dir(schema, {depth: 10})
        
        return schema
    }

    executeBothWays((typeInSub: boolean) => success(`baseline, success; typeInSub: ${typeInSub}`, () => validateDocument(schema({typeInSub,}), { "p1": "xxx" })))
    failure(`baseline, fail`, () => validateDocument(schema({typeInSub: false}), { "p1": 111 }), [
        ["#/properties/p1/type", "p1"]])

    executeBothWays((typeInSub: boolean) => success(`oneOf, success, 1; typeInSub: ${typeInSub}`, () => validateDocument(schema({typeInSub,oneOf: 1}), { "p1": "xxx", "p_oneOf_0": "aaa" })))
    executeBothWays((typeInSub: boolean) => success(`oneOf, success. 2; typeInSub: ${typeInSub}`, () => validateDocument(schema({typeInSub,oneOf: 2}), { "p1": "xxx", "p_oneOf_0": "aaa", "p_oneOf_1": 444 })))
    executeBothWays((typeInSub: boolean) => success(`oneOf, success, 3; typeInSub: ${typeInSub}`, () => validateDocument(schema({typeInSub,oneOf: 2}), { "p1": "xxx", "p_oneOf_0": 444, "p_oneOf_1": "aaa" })))
    executeBothWays((typeInSub: boolean) => failure(`oneOf, fail, 1; typeInSub: ${typeInSub}`, () => validateDocument(schema({typeInSub,oneOf: 1}), { "p1": "xxx" }), 
        [["#/oneOf", ""],
        ["#/oneOf/0/required/p_oneOf_0", "p_oneOf_0"]]))
    executeBothWays((typeInSub: boolean) => failure(`oneOf, fail, 2; typeInSub: ${typeInSub}`, () => validateDocument(schema({typeInSub,oneOf: 1}), { "p1": "xxx", "p_oneOf_0": 4 }), 
        [["#/oneOf", ""],
        ["#/oneOf/0/properties/p_oneOf_0/type", "p_oneOf_0"]]))
    executeBothWays((typeInSub: boolean) => failure(`oneOf, fail, 3; typeInSub: ${typeInSub}`, () => validateDocument(schema({typeInSub,oneOf: 2}), { "p1": "xxx", "p_oneOf_0": "aaa", "p_oneOf_1": "aaa" }), 
        [["#/oneOf", ""]]))

    executeBothWays((typeInSub: boolean) => success(`allOf, success; typeInSub: ${typeInSub}`, () => validateDocument(schema({typeInSub,allOf: 2}), { "p1": "xxx", "p_allOf_0": "aaa", "p_allOf_1": "aaa" })))
    executeBothWays((typeInSub: boolean) => failure(`allOf, fail, 1; typeInSub: ${typeInSub}`, () => validateDocument(schema({typeInSub,allOf: 2}), { "p1": "xxx", "p_allOf_0": 111, "p_allOf_1": 222 }), [
        ["#/allOf/0/properties/p_allOf_0/type", "p_allOf_0"],
        ["#/allOf/1/properties/p_allOf_1/type", "p_allOf_1"]
    ]))
    executeBothWays((typeInSub: boolean) => failure(`allOf, fail, 2; typeInSub: ${typeInSub}`, () => validateDocument(schema({typeInSub,allOf: 2}), { "p1": "xxx", "p_allOf_0": 111, "p_allOf_1": "aaa" }), [
        ["#/allOf/0/properties/p_allOf_0/type", "p_allOf_0"]
    ]))
    executeBothWays((typeInSub: boolean) => failure(`allOf, fail, 3; typeInSub: ${typeInSub}`, () => validateDocument(schema({typeInSub,allOf: 2}), { "p1": "xxx", "p_allOf_0": "aaa", "p_allOf_1": 222 }), [
        ["#/allOf/1/properties/p_allOf_1/type", "p_allOf_1"]
    ]))

    executeBothWays((typeInSub: boolean) => success(`anyOf, success, 1; typeInSub: ${typeInSub}`, () => validateDocument(schema({typeInSub,anyOf: 2}), { "p1": "xxx", "p_anyOf_0": "aaa", "p_anyOf_1": "aaa" })))
    executeBothWays((typeInSub: boolean) => success(`anyOf, success, 2; typeInSub: ${typeInSub}`, () => validateDocument(schema({typeInSub,anyOf: 2}), { "p1": "xxx", "p_anyOf_0": "aaa", "p_anyOf_1": 111 })))
    executeBothWays((typeInSub: boolean) => success(`anyOf, success, 3; typeInSub: ${typeInSub}`, () => validateDocument(schema({typeInSub,anyOf: 2}), { "p1": "xxx", "p_anyOf_0": 111, "p_anyOf_1": "aaa" })))
    executeBothWays((typeInSub: boolean) => failure(`anyOf, fail, 1; typeInSub: ${typeInSub}`, () => validateDocument(schema({typeInSub,anyOf: 2}), { "p1": "xxx", "p_anyOf_0": 111, "p_anyOf_1": 222 }), [
        ["#/anyOf/0/properties/p_anyOf_0/type", "p_anyOf_0"],
        ["#/anyOf/1/properties/p_anyOf_1/type", "p_anyOf_1"]
    ]))

    executeBothWays((typeInSub: boolean) => success(`not, success typeInSub: ${typeInSub}`, () => validateDocument(schema({not: true, typeInSub}), { "p1": "xxx", "p_not": 111 })))
    executeBothWays((typeInSub: boolean) => failure(`not, fail; typeInSub: ${typeInSub}`, () => validateDocument(schema({typeInSub,not: true}), { "p1": "xxx", "p_not": "aaa" }), [
        ["#/not", ""]
    ]))
}());

(function differentPropertySelectors() {
    const schema: JsonDocument = {
        "$schema": "http://json-schema.org/draft-04/schema#",
        "type": "object",
        "properties": {
            "add_true": {
                "type": "object",
                "properties": {
                    "x": { "type": "string" }
                },
                "additionalProperties": true
            },
            "add_false": {
                "type": "object",
                "properties": {
                    "x": { "type": "string" }
                },
                "additionalProperties": false
            },
            "add_number": {
                "type": "object",
                "properties": {
                    "x": { "type": "string" }
                },
                "additionalProperties": { "type": "number" }
            },
            "add_nullable": {
                "type": "object",
                "properties": {
                    "x": { "type": "string" }
                },
                "additionalProperties": { 
                    "anyOf": [
                        { "type": "number" },
                        { "type": "null" }
                    ]
                }
            },
            "add_fallthrough": {
                "type": "object",
                "properties": {
                    "xx": { "type": "string" }
                },
                "patternProperties": {
                    "^xx": { "type": "number" }
                },
                "additionalProperties": { "type": "null" }
            }
        }
    }

    success("no additions", () => validateDocument(schema, { 
        "add_true": { "x": "xxx" }, 
        "add_false": { "x": "xxx" }, 
        "add_number": { "x": "xxx" }, 
        "add_nullable": { "x": "xxx" }
    }))

    success("good additions", () => validateDocument(schema, { 
        "add_true": { "x": "xxx", "y": true, "z": 66 }, 
        "add_false": { "x": "xxx" }, 
        "add_number": { "x": "xxx", "y": 55 }, 
        "add_nullable": { "x": "xxx", "y": null, "z": 55 }
    }))

    failure("bad additions", () => validateDocument(schema, { 
        "add_true": { "x": "xxx" }, 
        "add_false": { "x": "xxx", "y": null, "z": 44 }, 
        "add_number": { "x": "xxx", "y": null, "z": "44" }, 
        "add_nullable": { "x": "xxx", "y": "55" }
    }), [
        ['#/properties/add_false/additionalProperties','add_false/y'],
        ['#/properties/add_false/additionalProperties','add_false/z'],
        ['#/properties/add_number/additionalProperties/type','add_number/y'],
        ['#/properties/add_number/additionalProperties/type','add_number/z'],
        ['#/properties/add_nullable/additionalProperties/anyOf/0/type','add_nullable/y'],
        ['#/properties/add_nullable/additionalProperties/anyOf/1/type','add_nullable/y']
    ])

    failure("fallthrough 1", () => validateDocument(schema, { 
        "add_fallthrough": { 
            "xx": 55
        }
    }), [
        ['#/properties/add_fallthrough/properties/xx/type','add_fallthrough/xx']
    ])

    failure("fallthrough 2", () => validateDocument(schema, { 
        "add_fallthrough": { 
            "xx": "xxx", 
            "xx_xx": "xxx",
            "xx_xx_xx": 4,
            "y": null ,
            "z": 55 
        }
    }), [
        ['#/properties/add_fallthrough/patternProperties/^xx/type','add_fallthrough/xx'],
        ['#/properties/add_fallthrough/patternProperties/^xx/type','add_fallthrough/xx_xx'],
        ['#/properties/add_fallthrough/additionalProperties/type','add_fallthrough/z']
    ])
}());


console.log("DONE " + count)
