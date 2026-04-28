
// import { JsonDocument } from "./jsonSchema.js"
// import { addToRange, advanceRangeCursor, create as createRange, forceCompact, itemFrom, itemTo} from "./rangeCollection.js"
// import { validateDocument, ValidationError } from "./validate.js"

// let count = 0


// const schema: JsonDocument = {
//     "$schema": "http://json-schema.org/draft-04/schema#",
//     "type": "object",
//     "properties": {
//         "t_any1": {},
//         "t_any2": true,
//         "t_none": false,
//         "t_string": {
//             "type": "string"
//         },
//         "t_multi_type": {
//             "type": ["string", "number"]
//         },
//         "t_null": {
//             "type": "null"
//         },
//         "t_number": {
//             "type": "number"
//         },
//         "t_integer": {
//             "type": "integer"
//         },
//         "t_boolean": {
//             "type": "boolean"
//         },
//         "t_array": {
//             "type": "array",
//             "$anchor": "anchored_array",
//             "items": {
//                 "type": "boolean"
//             }
//         },
//         "t_prefixed_array": {
//             "type": "array",
//             "prefixItems": [{
//                 "type": "string"
//             }, {
//                 "type": "number"
//             }],
//             "items": {
//                 "type": "boolean"
//             }
//         },
//         "t_contains_array": {
//             "contains": {
//                 "type": "boolean"
//             }
//         },
//         "t_defd_bool": {
//             "$ref": "#/$defs/defd_bool"
//         },
//         "t_defd_anchor": {
//             "$ref": "#anchored_array"
//         },
//         "t_defd_doublebool": {
//             "$ref": "#/$defs/defd_double_bool"
//         },
//         "t_circular_reference": {
//             "$ref": "#/$defs/circular_reference"
//         },
//         // "t_enum_1": {
//         //     "enum": [null, 1, "5", freakyObject]
//         // },
//         // "t_const_1": {
//         //     "const": freakyObject
//         // },
//         "constrained_number": {
//             "multipleOf": 5,
//             "exclusiveMinimum": 5,
//             "exclusiveMaximum": 15,
//         },
//         "constrained_number2": {
//             "minimum": 5,
//             "maximum": 15,
//         },
//         "constrained_string": {
//             "minLength": 1,
//             "maxLength": 3,
//             "pattern": "^d*$"
//         }
//     },
//     "required": [
//         "t_string"
//     ],
//     "$defs": {
//         "defd_bool": {
//             "type": "boolean"
//         },
//         "defd_double_bool": {
//             "$ref": "#/$defs/defd_bool"
//         },
//         "circular_reference": {
//             "$ref": "#/$defs/circular_reference2"
//         },
//         "circular_reference2": {
//             "$ref": "#/$defs/circular_reference"
//         }
//     }
// }

// function success(name: string, f: (() => ValidationError[])) {
//     count += 1
//     try {
//         const result = f()
//         console.assert(!result.length, `${name}: Errors encountered`, ...result)
//     } catch (e) {
//         console.error(name, e)
//     }
// }

// function failure(name: string, f: (() => ValidationError[]), fields: [string, string][]) {
//     count += 1

//     try {
//         const result = f()
//         result.sort((x, y) => x.field.localeCompare(y.field))
//         fields.sort((x, y) => x[1].localeCompare(y[1]))

//         console.assert(result.length === fields.length,
//             `${name}: Incorrect error count encountered`,
//             "Actual:",
//             ...result,
//             "Expected:",
//             ...fields)

//         for (let i = 0; i < Math.min(result.length, fields.length); i++) {
//             console.assert(result[i].field === fields[i][1] && result[i].schema === fields[i][0],
//                 `${name}: Errors not matching`,
//                 "Actual:",
//                 result[i],
//                 "Expected:",
//                 fields[i])
//         }
//     } catch (e) {
//         console.error(name, e)
//     }
// }

// function schemaError(name: string, f: (() => ValidationError[]), msg: string) {
//     count += 1

//     try {
//         try {
//             f()
//             console.assert(false, `${name}: Expected error`)
//         } catch (e) {
//             let err = e as Error
//             console.assert(err.message === msg, `${name}: Expected error message`, err.message, msg)
//         }
//     } catch (e) {
//         console.error(e)
//     }
// }

// (function basic() {

//     const freakyObject = {
//         "x": 1,
//         "y": [null, true, {
//             "p": {
//                 "q": null
//             }
//         }],
//         "z": 3.4
//     }



// (function conditionalSubSchemas() {
//     function executeBothWays(f: (x: boolean) => void) {
//         f(true)
//         f(false)
//     }

//     function schema(x: {anyOf?: number, allOf?: number, oneOf?: number, not?: boolean, typeInSub: boolean}): JsonDocument {

//         function addSubType(schema: any) {
//             return x.typeInSub ? {type: "object", ...schema} : schema
//         }

//         function sub(subType: string, count: number, x: any) {
//             if (!count) return x

//             return {
//                 ...x,
//                 [subType]: [...Array(count).keys()].map(i => addSubType({
//                     "properties": {
//                         [`p_${subType}_${i}`]: {
//                             "type": "string"
//                         }
//                     },
//                     "required": [`p_${subType}_${i}`]
//                 }))
//             }
//         }

//         const schema: any = sub("allOf", x.allOf || 0, 
//             sub("oneOf", x.oneOf || 0,
//                 sub("anyOf", x.anyOf || 0, {
//                     "$schema": "http://json-schema.org/draft-04/schema#",
//                     "properties": {
//                         "p1": {"type": "string"}
//                     }
//                 })))

//         if (x.not) {
//             // TODO: add a validation rule here
//             // so that it conditionally failable
//             schema["not"] = addSubType({
//                 "properties": {
//                     "p_not": {"type": "string"}
//                 }
//             })
//         }

//         if (!x.typeInSub) {
//             schema.type = "object"
//         }

//         //console.dir(schema, {depth: 10})
        
//         return schema
//     }

// }());



// console.log("DONE " + count)
