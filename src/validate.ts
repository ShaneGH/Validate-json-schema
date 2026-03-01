import { 
    ArraySchema, 
    ArraySchemaTemplate, 
    BooleanSchema, 
    BooleanSchemaTemplate, 
    NumericSchema, 
    NumericSchemaTemplate, 
    JsonDocument, 
    NullSchema, 
    NullSchemaTemplate,
    ObjectSchema, 
    ObjectSchemaTemplate, 
    SchemaType, 
    StringSchema, 
    StringSchemaTemplate, 
    TypedSchema } from "./jsonSchema.js"
import { build as buildValidationContext, ValidationContext } from "./validationContext.js"
import { build as buildSchemaCondition, SchemaError, execute, SchemaCondition } from "./schemaConditions.js"


function tpl<T1, T2>(x: T1, y: T2): [T1, T2] {
    return [x, y]
}

function isReadOnlyArray<T, U>(xs: readonly T[] | (U extends any[] ? never : U)): xs is readonly T[] {
    return Array.isArray(xs)
}

/** Adds errors to a mutable accumulator and returns it */
function pushErrors(
    accumulator: SchemaError[] | null, 
    errors: SchemaError | readonly SchemaError[] | null,
    f?: (e: SchemaError) => SchemaError): SchemaError[] | null {

    if (errors === null) return accumulator

    if (!isReadOnlyArray(errors)) {
        accumulator = accumulator || []
        accumulator.push(f && f(errors) || errors)
        return accumulator
    }

    if (!errors.length) return accumulator
    accumulator = accumulator || []
    for (let err of errors)
        accumulator.push(f && f(err) || err)

    return accumulator
}

/** Adds errors to a mutable accumulator and returns it */
function concat2<T>(xs: readonly T[], ys: readonly T[]): readonly T[] {
    if (!xs.length) return ys
    if (!ys.length) return xs

    return [...xs, ...ys]
}

function checkType(type: SchemaType, data: any) {
    switch (type) {
        case null:
        case undefined: return emptyErrors

        case "object": return typeof data === "object" && !Array.isArray(data) && data !== null
        case "array": return Array.isArray(data)
        case "string": return typeof data === "string"
        case "number": return typeof data === "number" || typeof data === "bigint"
        case "integer": return Number.isInteger(data)
        case "boolean": return typeof data === "boolean"
        case "null": return data === null
        default: throw new Error("???T")
    }
}

function checkTypes(type: SchemaType | readonly SchemaType[], data: any) {
    if (typeof type === "string") return checkType(type, data)
    for (let x of type) {
        if (checkType(x, data)) return true
    }

    return false
}

const typeString: readonly string[] = ["type"]
function validateType(context: ValidationContext, schema: TypedSchema, data: any): readonly SchemaError[] {

    return !schema.type || checkTypes(schema.type, data)
        ? emptyErrors
        : [{
            schemaPath: typeString,
            fieldPath: emptyStrings,
            message: `Invalid type. Expected: ${schema.type}, actual: ${typeof data}`
        }]
}

function deepEquality(x: any, y: any) {
    if (x === y) return true

    if (x == null 
        || y == null 
        || typeof x !== "object" 
        || typeof y !== "object") return false

    if (Array.isArray(x)) {
        if (!Array.isArray(y)) return false
        if (x.length !== y.length) return false
        for (let i = 0; i < x.length; i++) {
            if (!deepEquality(x[i], y[i])) return false
        }

        return true
    }

    if (Array.isArray(y)) return false

    const xKeys = Object.keys(x)
    const yKeys = Object.keys(y)

    if (xKeys.length !== yKeys.length) return false

    xKeys.sort()
    yKeys.sort()
    for (let i = 0; i < xKeys.length; i++) {
        if (xKeys[i] !== yKeys[i]) return false
        if (!deepEquality(x[xKeys[i]], y[xKeys[i]])) return false
    }

    return true
}

function checkEnums(enums: readonly any[], data: any) {
    for (let e of enums) {
        if (deepEquality(e, data)) return true
    }

    return false
}

const enumString: readonly string[] = ["enum"]
function validateEnum(context: ValidationContext, schema: TypedSchema, data: any): readonly SchemaError[] {

    return !schema.enum || checkEnums(schema.enum, data)
        ? emptyErrors
        : [{
            schemaPath: enumString,
            fieldPath: emptyStrings,
            message: "Invalid enum"
        }]
}

const constString: readonly string[] = ["const"]
function validateConst(context: ValidationContext, schema: TypedSchema, data: any): readonly SchemaError[] {

    return schema.const === undefined || deepEquality(schema.const, data)
        ? emptyErrors
        : [{
            schemaPath: constString,
            fieldPath: emptyStrings,
            message: "Invalid const"
        }]
}

function *propertySchemas(schema: ObjectSchema, property: string) {
    let found = false
    if (schema.properties?.[property] != null) {
        found = true
        yield tpl(["properties", property], schema.properties[property])
    }

    for (let rx in schema.patternProperties) {
        // todo regex cache
        if (!new RegExp(rx).test(property)) continue
        
        found = true
        yield tpl(["patternProperties", rx], schema.patternProperties[rx])
    }

    if (!found && schema.additionalProperties != null) {
        yield tpl(["additionalProperties"], schema.additionalProperties)
    }
}

function hasAtLeastOneProp<T>(object: NonNullable<T>, props: readonly (keyof T)[]) {
    for (let prop of props) {
        if (object.hasOwnProperty(prop)) return true
    }

    return false
}

const emptyStrings: readonly string[] = []
const emptyErrors: readonly SchemaError[] = []
const containsError: SchemaError = {
    fieldPath: emptyStrings,
    schemaPath: ["contains"],
    message: "Array does not contain element which matches constraint"
}

const containsErrors: readonly SchemaError[] = [containsError]

function validateObjectSchema(context: ValidationContext, schema: ObjectSchema, data: any): readonly SchemaError[] {
    if (!checkType("object", data) || !hasAtLeastOneProp(schema, ObjectSchemaTemplate)) return emptyErrors
    
    let errs: SchemaError[] | null = null
    for (let req of schema.required || emptyStrings) {
        if (data[req] != null) continue

        errs = pushErrors(errs, {
            message: "###Err_m1",
            fieldPath: [req],
            schemaPath: ["required", req]
        })
    }

    let patternPropertiesCache: Record<string, SchemaCondition> | null = null
    let additionalPropertiesCache: SchemaCondition | null = null
    for (let property in data) {
        for (let sch of propertySchemas(schema, property)) {

            let cachedSchemaCondition: SchemaCondition | null = null;
            if (sch[0][0] === "additionalProperties") {
                cachedSchemaCondition = 
                    additionalPropertiesCache = 
                        additionalPropertiesCache || buildSchemaCondition(context, sch[1])
            } else if (sch[0][0] === "patternProperties") {
                patternPropertiesCache = patternPropertiesCache || {}
                if (!patternPropertiesCache[sch[0][1]]) {
                    patternPropertiesCache[sch[0][1]] = buildSchemaCondition(context, sch[1])
                }

                cachedSchemaCondition = patternPropertiesCache[sch[0][1]]
            }

            errs = pushErrors(
                errs, 
                validateSchema(
                    context, 
                    cachedSchemaCondition || buildSchemaCondition(context, sch[1]), 
                    data[property]), 
                e => ({
                    ...e,
                    schemaPath: concat2(sch[0], e.schemaPath),
                    fieldPath: [property, ...e.fieldPath]
                })
            );
        }
    }

    return errs || emptyErrors
}

function validateArraySchema(context: ValidationContext, schema: ArraySchema, data: any): readonly SchemaError[] {
    if (!checkType("array", data) || !hasAtLeastOneProp(schema, ArraySchemaTemplate)) return emptyErrors

    if (!schema.contains && !data.length) return emptyErrors
    if (schema.contains && !data.length) return containsErrors

    let contains = schema.contains && buildSchemaCondition(context, schema.contains) || null
    let items: SchemaCondition | null | undefined = null
    let errs: SchemaError[] | null = null

    for (let i = 0; i < data.length; i++) {
        
        const itemSchema = schema.prefixItems && i < schema.prefixItems.length
        ? buildSchemaCondition(context, schema.prefixItems[i])
        : (items = items || (schema.items && buildSchemaCondition(context, schema.items)))

        if (!itemSchema && !contains) break

        if (itemSchema) {
            errs = pushErrors(
                errs, 
                validateSchema(context, itemSchema, data[i]), 
                e => ({
                    ...e,
                    schemaPath: items
                        ? ["items", ...e.schemaPath]
                        : ["prefixItems", i.toString(), ...e.schemaPath],
                    fieldPath: [i.toString(), ...e.fieldPath]
                }));
        }

        if (contains && validateSchema(context, contains, data[i]).length === 0) {
            contains = null
        }
    }

    if (contains) {
        errs = pushErrors(errs, containsErrors)
    }

    return errs || emptyErrors
}

const maxLengthString: readonly string[] = ["maxLength"]
const minLengthString: readonly string[] = ["minLength"]
const patternString: readonly string[] = ["pattern"]
function validateStringSchema(context: ValidationContext, schema: StringSchema, data: any): readonly SchemaError[] {
    if (!checkType("string", data) || !hasAtLeastOneProp(schema, StringSchemaTemplate)) return emptyErrors

    let errs: SchemaError[] | null = null
    if (schema.maxLength != null && data.length > schema.maxLength) {
        errs = pushErrors(errs, {
            message: `String max length ${schema.maxLength}`,
            schemaPath: maxLengthString,
            fieldPath: emptyStrings
        });
    }

    if (schema.minLength != null && data < schema.minLength) {
        errs = pushErrors(errs, {
            message: `String min length ${schema.minLength}`,
            schemaPath: minLengthString,
            fieldPath: emptyStrings
        });
    }

    if (schema.pattern != null && !new RegExp(schema.pattern).test(data)) {
        errs = pushErrors(errs, {
            message: `String pattern does not match: ${schema.pattern}`,
            schemaPath: patternString,
            fieldPath: emptyStrings
        });
    }

    return errs || emptyErrors
}

const exclusiveMaximumString: readonly string[] = ["exclusiveMaximum"]
const maximumString: readonly string[] = ["maximum"]
const exclusiveMinimumString: readonly string[] = ["exclusiveMinimum"]
const minimumString: readonly string[] = ["minimum"]
const multipleOfString: readonly string[] = ["multipleOf"]
function validateNumericSchema(context: ValidationContext, schema: NumericSchema, data: any): readonly SchemaError[] {
    if (!checkType("number", data) || !hasAtLeastOneProp(schema, NumericSchemaTemplate)) return emptyErrors

    let errs: SchemaError[] | null = null
    if (schema.exclusiveMaximum != null && data >= schema.exclusiveMaximum) {
        errs = pushErrors(errs, {
            message: `Numeric exclusive maximum ${schema.exclusiveMaximum}`,
            schemaPath: exclusiveMaximumString,
            fieldPath: emptyStrings
        });
    }

    if (schema.maximum != null && data > schema.maximum) {
        errs = pushErrors(errs, {
            message: `Numeric maximum ${schema.maximum}`,
            schemaPath: maximumString,
            fieldPath: emptyStrings
        });
    }

    if (schema.exclusiveMinimum != null && data <= schema.exclusiveMinimum) {
        errs = pushErrors(errs, {
            message: `Numeric exclusive minimum ${schema.exclusiveMinimum}`,
            schemaPath: exclusiveMinimumString,
            fieldPath: emptyStrings
        });
    }

    if (schema.minimum != null && data < schema.minimum) {
        errs = pushErrors(errs, {
            message: `Numeric minimum ${schema.minimum}`,
            schemaPath: minimumString,
            fieldPath: emptyStrings
        });
    }

    if (schema.multipleOf != null && data % schema.multipleOf !== 0) {
        errs = pushErrors(errs, {
            message: `Numeric multiple of ${schema.multipleOf}`,
            schemaPath: multipleOfString,
            fieldPath: emptyStrings
        });
    }

    return errs || emptyErrors
}

function validateBooleanSchema(context: ValidationContext, schema: BooleanSchema, data: any): readonly SchemaError[] {
    if (!checkType("boolean", data) || !hasAtLeastOneProp(schema, BooleanSchemaTemplate)) return emptyErrors

    return emptyErrors
}

function validateNullSchema(context: ValidationContext, schema: NullSchema, data: any): readonly SchemaError[] {
    if (!checkType("null", data) || !hasAtLeastOneProp(schema, NullSchemaTemplate)) return emptyErrors

    return emptyErrors
}

const validators: readonly (typeof validateType)[] = [
    validateType,
    validateEnum,
    validateConst,
    validateArraySchema,
    validateObjectSchema,
    validateStringSchema,
    validateNumericSchema,
    validateBooleanSchema,
    validateNullSchema
]

const noPathFailAllErrors: readonly SchemaError[] = [{fieldPath: [], schemaPath: [], message: "Condition failed"}]
function validateConcreteSchema(context: ValidationContext, schema: TypedSchema, data: any): readonly SchemaError[] {

    if (schema === true) return emptyErrors
    if (schema === false) return noPathFailAllErrors

    return validators
        .reduce((s, f) => pushErrors(s, f(context, schema, data)), null as null | SchemaError[]) || emptyErrors
}

function logAnd<T>(x: T, ...msg: any[]) {
    console.log(x, ...msg)
    return x
}

function validateSchema(context: ValidationContext, schema: SchemaCondition, data: any): readonly SchemaError[] {

    return execute(schema, (schema) => validateConcreteSchema(context, schema, data))
}

export type ValidationError = Readonly<{
    field: string
    schema: string
    message: string
}>

export function validateDocument(document: JsonDocument, data: any, retreivalUri?: URL): ValidationError[] {

    const ctxt = buildValidationContext(document, retreivalUri)
    return validateSchema(ctxt, buildSchemaCondition(ctxt, document), data)
        .map(e => ({
            field: e.fieldPath.join("/"),
            schema: `#/${e.schemaPath.join("/")}`,
            message: e.message
        }))
}