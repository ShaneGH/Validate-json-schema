
import {
    JsonDocument, Schema
} from "./jsonSchema"

type Nil = null | undefined

export type Anchors = Readonly<{
    ref: Readonly<Record<string, Schema>>,
    dynamicRef: Readonly<Record<string, Schema>>
}>

export type ValidationContext = Readonly<{
    document: JsonDocument
    location: URL
    anchors: Anchors
}>

const defaultBaseUrl = URL.parse("schema-parser://missing-root")!
function resolveUri(uri: string, alternateRoot?: URL | Nil): URL | null {
    const p = URL.parse(uri)
    if (p) return p

    return URL.parse(uri, alternateRoot || defaultBaseUrl)
}

function buildAnchors(schema: Schema, accumulator: Anchors): Anchors {

    if (typeof schema === "boolean") {
        return accumulator
    }

    // TODO: validate anchor name and value
    if (schema.$anchor) {
        if (accumulator.ref[schema.$anchor]) {
            throw new Error("???8")
        }

        accumulator = {
            ...accumulator,
            ref: {
                ...accumulator.ref,
                [schema.$anchor]: schema
            }
        }
    }

    if (schema.$dynamicAnchor) {
        if (accumulator.dynamicRef[schema.$dynamicAnchor]) {
            throw new Error("???9")
        }

        accumulator = {
            ...accumulator,
            dynamicRef: {
                ...accumulator.dynamicRef,
                [schema.$dynamicAnchor]: schema
            }
        }
    }
    
    if (schema.type === "object" && schema.properties) {
        for (let child in schema.properties) {
            accumulator = buildAnchors(schema.properties[child], accumulator)
        }
    }

    if (schema.type === "array" && schema.items) {
        accumulator = buildAnchors(schema.items, accumulator)
    }
    
    return accumulator

}

export function build(document: JsonDocument, retreivalUri?: URL): ValidationContext {
    return {
        document,
        anchors: buildAnchors(document, {ref: {}, dynamicRef: {}}),
        location: document.$id != null && resolveUri(document.$id, retreivalUri)
            || retreivalUri
            || defaultBaseUrl
    };
}

// const emptyJsTypes: Readonly<Record<string, JsTypes>> = {}
// const emptySchemas: readonly Schema[] = []
// const emptyStrings: readonly string[] = []
// const emptyErrors: readonly Error[] = []
// const emptyobject: {} = {}

// function validateType(type: string, data: any): string | null {
//     if (type === "string") {
//         return typeof data === "string" ? null : "###Err_t_s"
//     }

//     if (type === "null") {
//         return data == null ? null : "###Err_t_nl"
//     }

//     if (type === "integer") {
//         return Number.isInteger(data) ? null : "###Err_t_int"
//     }

//     if (type === "number") {
//         return typeof data === "number" ? null : "###Err_t_n"
//     }

//     if (type === "boolean") {
//         return typeof data === "boolean" ? null : "###Err_t_b"
//     }

//     if (type === "object") {
//         return typeof data === "object" && !Array.isArray(data) ? null : "###Err_t_obj"
//     }

//     if (type === "array") {
//         return Array.isArray(data) ? null : "###Err_t_arr"
//     }
    
//     throw new Error("???Typ")
// }

// // TODO https://json-schema.org/draft/2020-12/json-schema-core#name-keyword-independence

// function validateString(schema: StringSchema, x: any): readonly Error[] {
//     return typeof x === "string" ? emptyErrors : asErrors("Err_str")
// }

// function validateInteger(schema: IntegerSchema, x: any): readonly Error[] {
//     return Number.isInteger(x) ? emptyErrors : asErrors("Err_int")
// }

// function validateNumber(schema: NumberSchema, x: any): readonly Error[] {
//     return typeof x === "number" ? emptyErrors : asErrors("Err_num")
// }

// function validateNull(schema: NullSchema, x: any): readonly Error[] {
//     return x === null ? emptyErrors : asErrors("Err_null")
// }

// function validateBoolean(schema: BooleanSchema, x: any): readonly Error[] {
//     return typeof x === "boolean" ? emptyErrors : asErrors("Err_bool")
// }

// function *propertySchemas(schema: ObjectSchema, property: string) {
//     let found = false
//     if (schema.properties?.[property] != null) {
//         found = true
//         yield tpl(["properties", property], schema.properties[property])
//     }

//     for (let rx in schema.patternProperties) {
//         // todo regex cache
//         if (!new RegExp(rx).test(property)) continue
        
//         found = true
//         yield tpl(["patternProperties", rx], schema.patternProperties[rx])
//     }

//     if (!found && schema.additionalProperties != null) {
//         yield tpl(["additionalProperties"], schema.additionalProperties)
//     }
// }

// function validateObject(
//     context: ValidationContext, 
//     schema: ObjectSchema,
//     data: any): readonly Error[] {

//     if (typeof data !== "object" || Array.isArray(data)) return rootErrors("###Err_o")

//     const output: Error[] = []
//     for (let req of schema.required || emptyStrings) {
//         if (data[req] === undefined)
//             output.push({
//                 message: "###Err_m1",
//                 fieldPath: [req],
//                 schemaPath: ["required", req]
//             });
//     }

//     for (let property in data) {
//         for (let sch of propertySchemas(schema, property)) {
//             output.push(...validateSchema(context, sch[1], data[property])
//                 .map(prependPath(sch[0], property)))
//         }
//     }

//     return output
// }

// function validateArray(context: ValidationContext, schema: ArraySchema, data: any): readonly Error[] {
//     if (!Array.isArray(data)) return rootErrors("###Err_a")

//     if (!schema.items) return emptyErrors

//     const output: Error[] = []
//     for (let i = 0; i < data.length; i++) {
//         output.push(...validateSchema(context, schema.items, data[i])
//             .map(prependPath(i, i)))
//     }

//     return output;
// }

// function asErrors(error: string | null): readonly Error[] {
//     return error == null ? emptyErrors : rootErrors(error)
// }

// function asError(error: string | null): Error | null {
//     return error == null ? null : rootError(error)
// }

// function isTyped(schema: Schema): schema is ConcreteSchema {
//     return typeof (schema as any)["type"] === "string"
// }

// const emptyRefPaths: readonly RefPath[] = []
// function validateGenericRef(
//     context: ValidationContext, 
//     ref: string, 
//     type: "ref" | "dynamicRef",
//     anchors: Record<string, Schema>, 
//     data: any, 
//     refPath?: readonly RefPath[]): readonly Error[] {

//     const loc = URL.parse(ref, context.location)
//     if (!loc) throw new Error("???2")

//     if (loc.protocol !== context.location.protocol
//         || loc.host !== context.location.host
//         || loc.port !== context.location.port
//         || loc.pathname !== context.location.pathname
//     ) throw new Error("???3")

//     if (refPath) {
//         for (const ref of refPath) {
//             if (ref.type == type && ref.url.toString() === loc.toString()) {
//                 throw new Error("??? circular reference")
//             }
//         }
//     }

//     refPath = [...(refPath || emptyRefPaths), { type: type, url: loc }]

//     const anchorName = /^#([A-Za-z_][-A-Za-z0-9._]*)$/.exec(loc.hash)?.[1]
//     if (anchorName) {
//         const anchor = anchors[anchorName]
//         if (!anchor) {
//             throw new Error("???4")
//         }

//         return validateSchema(context, anchor, data, refPath)
//             .map(prependPath(ref, null))
//     }

//     if (loc.hash.length > 1 && loc.hash[1] !== "/") {
//         throw new Error("???5")
//     }

//     const parts = loc.hash.substring(2).split("/")
//     let target = context.document as any
//     for (let part of parts) {
//         target = target[part]
//         if (target == null) {
//             throw new Error("???6")
//         }
//     }

//     const result = tryValidateSchema(context, target, data, refPath)
//     if (result === "INVALID_SCHEMA") {
//         throw new Error("???7")
//     }

//     return result.map(prependPath(ref, null))
// }

// function validateDynamicRef(context: ValidationContext, schema: DynamicRefSchema, data: any, refPath?: readonly RefPath[]): readonly Error[] {
//     // TODO: ref vs dynamicRef
//     return validateGenericRef(context, schema.$dynamicRef, "dynamicRef", context.anchors.dynamicAnchors, data, refPath)
// }

// function validateRef(context: ValidationContext, schema: RefSchema, data: any, refPath?: readonly RefPath[]): readonly Error[] {
//     // TODO: ref vs dynamicRef
//     return validateGenericRef(context, schema.$ref, "ref", context.anchors.anchors, data, refPath)
// }

// function validateSchema(context: ValidationContext, schema: Schema, data: any, refPath?: readonly RefPath[]): readonly Error[] {
//     const result = tryValidateSchema(context, schema, data, refPath)
//     if (result === "INVALID_SCHEMA") {
//         throw new Error("???10")
//     }

//     return result
// }

// type ValidationResult = null | Error | readonly Error[]

// function aggregateValidationResults(...rs: readonly ValidationResult[]) {
//     return rs.reduce((s: Error[], x: ValidationResult) => {
//         if (x == null) return s

//         if (Array.isArray(x)) {
//             s.push(...x)
//         } else {
//             s.push(x as any)
//         }

//         return s
//     }, [] as Error[]);
// }

// function tryValidateSchema(context: ValidationContext, schema: Schema, data: any, refPath?: readonly RefPath[]): readonly Error[] | "INVALID_SCHEMA" {
//     // console.dir({
//     //     "tryValidateSchema": "tryValidateSchema",
//     //     schema,
//     //     data,
//     //     isObject: isObject(schema)
//     // }, {depth: 20})
    
//     if (schema === true) {
//         return emptyErrors
//     }

//     if (schema === false) {
//         return [{
//             message: "###Err_false",
//             fieldPath: [],
//             schemaPath: []
//         }]
//     }

//     if (schema == null || typeof schema !== "object" || Array.isArray(schema)) {
//         return "INVALID_SCHEMA"
//     }

//     if (isRef(schema)) {
//         return validateRef(context, schema, data, refPath)
//     }

//     if (isDynamicRef(schema)) {
//         return validateDynamicRef(context, schema, data, refPath)
//     }

//     if (isObject(schema)) {
//         return aggregateValidationResults(
//             validateObject(context, schema, data),
//             tryValidateSubSchemas(context, schema, data))
//     }

//     if (isArray(schema)) {
//         return aggregateValidationResults(
//             validateArray(context, schema, data),
//             tryValidateSubSchemas(context, schema, data))
//     }

//     if (isString(schema)) {
//         return aggregateValidationResults(
//             validateString(schema, data),
//             tryValidateSubSchemas(context, schema, data))
//     }

//     if (isNumber(schema)) {
//         return aggregateValidationResults(
//             validateNumber(schema, data),
//             tryValidateSubSchemas(context, schema, data))
//     }

//     if (isInteger(schema)) {
//         return aggregateValidationResults(
//             validateInteger(schema, data),
//             tryValidateSubSchemas(context, schema, data))
//     }

//     if (isNumber(schema)) {
//         return aggregateValidationResults(
//             validateNumber(schema, data),
//             tryValidateSubSchemas(context, schema, data))
//     }

//     if (isBoolean(schema)) {
//         return aggregateValidationResults(
//             validateBoolean(schema, data),
//             tryValidateSubSchemas(context, schema, data))
//     }

//     if (isNull(schema)) {
//         return aggregateValidationResults(
//             validateNull(schema, data),
//             tryValidateSubSchemas(context, schema, data))
//     }
    
//     for (const x in schema as any) {
//         if (!commonConcreteProps[x])
//             throw new Error("###Err_unknown schema")
//     }

//     return tryValidateSubSchemas(context, schema, data)
// }

// function aggregateNullable<T>(...xss: (readonly T[] | Nil)[]): readonly T[] | null {
//     return xss.reduce<T[] | null>((s, x) => {
//         if (x) {
//             s = s || []
//             s.push(...x)
//         }

//         return s
//     }, null)
// }

// function tryValidateSubSchemas(context: ValidationContext, schema: ConcreteSchema, data: any, refPath?: readonly RefPath[]): readonly Error[] {
    
//     const allOf = schema.allOf
//         ?.reduce((s, sub, i) => {
//             s.push(
//                 ...validateSchema(context, sub, data, refPath)
//                 .map(prependPath(`allOf[${i}]`, null)))
//             return s
//         }, [] as Error[])

//     const anyOf = schema.anyOf
//         ?.reduce((s, sub, i) => {
//             if (s[0]) return s

//             const result = validateSchema(context, sub, data, refPath)
//             if (!result.length) return tpl(true, [] as Error[])

//             s[1].push(...result.map(prependPath(`anyOf[${i}]`, null)))
//             return s
//         }, tpl(false, [] as Error[]))[1]

//     const oneOfTmp = schema.oneOf
//         ?.reduce((s, sub, i) => {
//             const result = validateSchema(context, sub, data, refPath)
//             s[1].push(...result.map(prependPath(`oneOf[${i}]`, null)))
//             return tpl(s[0] + Math.max(0, result.length * -2 + 1), s[1])
//         }, tpl(0, [] as Error[]))

//     const oneOf = oneOfTmp
//         && (oneOfTmp[0] !== 1 || null)
//         && [{
//             message: oneOfTmp[0] === 0 ? "###Err_none" : "###Err_morethan1",
//             fieldPath: [],
//             schemaPath: ["oneOf"]
//         }, ...oneOfTmp[1]]
        
//     const notTmp = schema.not
//         && validateSchema(context, schema.not, data, refPath)
//         || null
    
//     const not = notTmp
//         && (!notTmp.length || null)
//         && [{
//             message: "###Err_not",
//             fieldPath: [],
//             schemaPath: ["not"]
//         }]

//     return aggregateNullable(allOf, anyOf, oneOf, not) || emptyErrors
// }

// if (!defaultBaseUrl) {
//     throw new Error("Unable to build default root url")
// }

// export function validateDocument(document: JsonDocument, data: any, retreivalUri?: URL): ValidationError[] {
//     const ctxt = buildValidationContext(document, retreivalUri)

//     const {
//         $schema: _,
//         $id: __,
//         $vocabulary: ___,
//         ...doc
//     } = document

//     return validateSchema(ctxt, doc, data)
//         .map(e => ({
//             field: e.fieldPath.join("/"),
//             schema: `#/${e.schemaPath.join("/")}`,
//             message: e.message
//         }))
// }