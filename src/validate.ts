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
    TypedSchema, 
    Schema} from "./jsonSchema.js"
import { build as buildValidationContext, ValidationContext } from "./validationContext.js"
import { build as buildSchemaCondition, SchemaError, execute, SchemaCondition } from "./schemaConditions.js"
import {
    tpl,
    logAnd,
    pushIfAppropriate,
    concat2,
    hasAtLeastOneProp
} from "./utils.js"

const emptyStrings: readonly string[] = []
const emptyErrors: readonly SchemaError[] = []

type NullableIndexRange = {
    from: number
    to: number
}

function deconstruct(range: number | NullableIndexRange) {
    return typeof range === "number" || typeof range === "bigint"
        ? [range, range + 1]
        : [range.from, range.to]
}

/**
 * Returns
 *  0 if the number is in the range
 *  Otherwise, how far outside the range it is. 
 *      Negative numbers are before the range
 */
function compare(x: number, range: number | NullableIndexRange) {
    if (typeof range === "number" || typeof range === "bigint") {
        return x - range
    }

    if (range.from > x) return x - range.from
    if (range.to <= x) return x - range.to + 1
    return 0
}

/** NO ERROR CHECKING */
function newUpperLimit(x: number, range: number | NullableIndexRange): NullableIndexRange {
    return {
        from: typeof range === "number" || typeof range === "bigint" ? range : range.from,
        to: x + 1
    }
}

/** NO ERROR CHECKING */
function newLowerLimit(x: number, range: number | NullableIndexRange): NullableIndexRange {
    return {
        from: x,
        to: typeof range === "number" || typeof range === "bigint" ? range + 1 : range.to,
    }
}

type MutableValidationState = {
    visitedProperties?: {
        visited: Record<string, true>,
        unevaluated?: Schema[]
    },
    visitedItems?: {
        visited: (number | NullableIndexRange)[],
        unevaluated?: Schema[]
    }
}

/** Returns true if inserted, false if it is already in the list */
function addToRange(haystack: (number | NullableIndexRange)[], needle: number): boolean {
    
    if (!haystack.length) {
        haystack.push(needle)
        return true
    }

    const cmp = compare(needle, haystack[haystack.length - 1])
    if (cmp === 1) {
        haystack[haystack.length - 1] = newUpperLimit(needle, haystack[haystack.length - 1])
        return true
    }

    if (cmp === 0) return false

    if (cmp === -1) {
        haystack[haystack.length - 1] = newLowerLimit(needle, haystack[haystack.length - 1])
        return true
    }

    let result = _addToRange(haystack, needle, 0, haystack.length)
    if (typeof result === "boolean") return result

    result = Math.min(result, haystack.length - 1)
    while (result > 0 && compare(needle, haystack[result]) > 0) result--
    while (result < haystack.length && compare(needle, haystack[result]) < 0) result--
    haystack.splice(result, 0, needle)
    return true
}

function _addToRange(haystack: (number | NullableIndexRange)[], needle: number, start: number, end: number): boolean | number {
    
    if (start >= end || start < 0 || end > haystack.length) return start

    const pivotI = start + Math.floor((end - start) / 2)
    const pivot = haystack[pivotI]

    const cmp = compare(needle, haystack[haystack.length - 1])
    if (cmp === 1) {
        haystack[pivotI] = newUpperLimit(needle, pivot)
        return true
    }

    if (cmp === -1) {
        haystack[pivotI] = newLowerLimit(needle, pivot)
        return true
    }

    if (cmp < 0) return _addToRange(haystack, needle, start, pivotI)
    if (cmp > 0) return _addToRange(haystack, needle, pivotI + 1, end)
    return false
}

function advanceRangeCursor(haystack: (number | NullableIndexRange)[], cursor: number, needle: number): "NOT_FOUND" | "EXHAUSTED_CURSOR" | number {
    
    for (; cursor < haystack.length; cursor++) {
        const cmp = compare(needle, haystack[cursor])
        if (cmp === 0) return cursor
        if (cmp < 0) return "NOT_FOUND"
        cursor += 1
    }
    
    return "EXHAUSTED_CURSOR"
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
function validateType(context: ValidationContext, schema: TypedSchema, data: any, validationState: MutableValidationState): readonly SchemaError[] {

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

const containsError: SchemaError = {
    fieldPath: emptyStrings,
    schemaPath: ["contains"],
    message: "Array does not contain element which matches constraint"
}

const containsErrors: readonly SchemaError[] = [containsError]

function validateObjectSchema(context: ValidationContext, schema: ObjectSchema, data: any, validationState: MutableValidationState): readonly SchemaError[] {
    if (!checkType("object", data) || !hasAtLeastOneProp(schema, ObjectSchemaTemplate)) return emptyErrors
    
    let errs: SchemaError[] | null = null
    for (let req of schema.required || emptyStrings) {
        if (data[req] != null) continue

        errs = pushIfAppropriate(errs, {
            message: "###Err_m1",
            fieldPath: [req],
            schemaPath: ["required", req]
        })
    }

    const firstIteration = !validationState.visitedProperties
    if (!validationState.visitedProperties) {
        validationState.visitedProperties = {visited: {}}
    }

    if (schema.unevaluatedProperties) {
        validationState.visitedProperties.unevaluated = 
            validationState.visitedProperties.unevaluated || []

        validationState.visitedProperties.unevaluated.push(schema.unevaluatedProperties)
    }

    let patternPropertiesCache: Record<string, SchemaCondition> | null = null
    let additionalPropertiesCache: SchemaCondition | null = null
    for (let property in data) {
        for (let sch of propertySchemas(schema, property)) {

            validationState.visitedProperties.visited[property] = true

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

            errs = pushIfAppropriate(
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

function completeObjectValidationState(context: ValidationContext, data: any, validationState: MutableValidationState): readonly SchemaError[] {
    if (!validationState.visitedProperties || !checkType("object", data)) return emptyErrors
    if (!validationState.visitedProperties.unevaluated?.length) return emptyErrors

    var unevaluated: SchemaCondition[] | null = null
    var errs: SchemaError[] | null = null
    for (let property in data) {
        if (validationState.visitedProperties.visited[property]) continue

        unevaluated = unevaluated || validationState.visitedProperties.unevaluated
            .map(s => buildSchemaCondition(context, s))

        errs = unevaluated.reduce((err, c) => 
            pushIfAppropriate(
                err, 
                validateSchema(context, c, data[property]), e => ({
                    ...e,
                    // TODO: schema path is not correct 
                    // if unevaluatedProperties is in a sub schema
                    schemaPath: ["unevaluatedProperties", ...e.fieldPath]
                })), errs as SchemaError[] | null)
    }
    
    return errs || emptyErrors
}

function validateArraySchema(context: ValidationContext, schema: ArraySchema, data: any, validationState: MutableValidationState): readonly SchemaError[] {
    if (!checkType("array", data) || !hasAtLeastOneProp(schema, ArraySchemaTemplate)) return emptyErrors

    if (!data.length) return schema.contains ? containsErrors : emptyErrors

    validationState.visitedItems = validationState.visitedItems || {
        visited: []
    }

    if (schema.unevaluatedItems) {
        validationState.visitedItems.unevaluated = validationState.visitedItems.unevaluated || []
        validationState.visitedItems.unevaluated.push(schema.unevaluatedItems)
    }

    let contains = schema.contains && buildSchemaCondition(context, schema.contains) || null
    let items: SchemaCondition | null | undefined = null
    let errs: SchemaError[] | null = null

    for (let i = 0; i < data.length; i++) {
        
        const itemSchema = schema.prefixItems && i < schema.prefixItems.length
            ? buildSchemaCondition(context, schema.prefixItems[i])
            : (items = items || (schema.items && buildSchemaCondition(context, schema.items)))

        if (!itemSchema && !contains) break

        if (itemSchema) {
            errs = pushIfAppropriate(
                errs, 
                validateSchema(context, itemSchema, data[i]), 
                e => ({
                    ...e,
                    schemaPath: items
                        ? ["items", ...e.schemaPath]
                        : ["prefixItems", i.toString(), ...e.schemaPath],
                    fieldPath: [i.toString(), ...e.fieldPath]
                }));

            addToRange(validationState.visitedItems.visited, i)
        }

        if (contains && validateSchema(context, contains, data[i]).length === 0) {
            contains = null
        }
    }

    if (contains) {
        errs = pushIfAppropriate(errs, containsErrors)
    }

    return errs || emptyErrors
}

function completeArrayValidationState(context: ValidationContext, data: any, validationState: MutableValidationState): readonly SchemaError[] {
    if (!validationState.visitedItems || !checkType("array", data)) return emptyErrors
    if (!validationState.visitedItems.unevaluated?.length) return emptyErrors
    if (!data.length) return emptyErrors

    const reduceState = {
        visited: validationState.visitedItems.visited,
        unevaluatedSchemas: validationState.visitedItems.unevaluated,
        rangeCursor: 0 as number | "EXHAUSTED_CURSOR",
        unevaluatedConditions: null as SchemaCondition[] | null,
        errs: null as SchemaError[] | null
    }

    return (data as {}[]).reduce<typeof reduceState>((s, x, i) => {
        
        if (s.rangeCursor !== "EXHAUSTED_CURSOR") {
            const adv = advanceRangeCursor(s.visited, s.rangeCursor, i)
            if (adv !== "NOT_FOUND") s.rangeCursor = adv

            if (typeof adv === "number") return s
        }

        s.errs = (s.unevaluatedConditions = s.unevaluatedConditions || s.unevaluatedSchemas
            .map(s => buildSchemaCondition(context, s)))
            .reduce((err, c) => 
                pushIfAppropriate(
                    err, 
                    validateSchema(context, c, x), e => ({
                        ...e,
                        // TODO: schema path is not correct 
                        // if unevaluatedItems is in a sub schema
                        schemaPath: ["unevaluatedItems", ...e.fieldPath]
                    })), s.errs)

        return s
    }, reduceState).errs || emptyErrors
}

const maxLengthString: readonly string[] = ["maxLength"]
const minLengthString: readonly string[] = ["minLength"]
const patternString: readonly string[] = ["pattern"]
function validateStringSchema(context: ValidationContext, schema: StringSchema, data: any): readonly SchemaError[] {
    if (!checkType("string", data) || !hasAtLeastOneProp(schema, StringSchemaTemplate)) return emptyErrors

    let errs: SchemaError[] | null = null
    if (schema.maxLength != null && data.length > schema.maxLength) {
        errs = pushIfAppropriate(errs, {
            message: `String max length ${schema.maxLength}`,
            schemaPath: maxLengthString,
            fieldPath: emptyStrings
        });
    }

    if (schema.minLength != null && data < schema.minLength) {
        errs = pushIfAppropriate(errs, {
            message: `String min length ${schema.minLength}`,
            schemaPath: minLengthString,
            fieldPath: emptyStrings
        });
    }

    // todo: regex cache
    if (schema.pattern != null && !new RegExp(schema.pattern).test(data)) {
        errs = pushIfAppropriate(errs, {
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
        errs = pushIfAppropriate(errs, {
            message: `Numeric exclusive maximum ${schema.exclusiveMaximum}`,
            schemaPath: exclusiveMaximumString,
            fieldPath: emptyStrings
        });
    }

    if (schema.maximum != null && data > schema.maximum) {
        errs = pushIfAppropriate(errs, {
            message: `Numeric maximum ${schema.maximum}`,
            schemaPath: maximumString,
            fieldPath: emptyStrings
        });
    }

    if (schema.exclusiveMinimum != null && data <= schema.exclusiveMinimum) {
        errs = pushIfAppropriate(errs, {
            message: `Numeric exclusive minimum ${schema.exclusiveMinimum}`,
            schemaPath: exclusiveMinimumString,
            fieldPath: emptyStrings
        });
    }

    if (schema.minimum != null && data < schema.minimum) {
        errs = pushIfAppropriate(errs, {
            message: `Numeric minimum ${schema.minimum}`,
            schemaPath: minimumString,
            fieldPath: emptyStrings
        });
    }

    if (schema.multipleOf != null && data % schema.multipleOf !== 0) {
        errs = pushIfAppropriate(errs, {
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

function completeValidationState(context: ValidationContext, data: any, validationState: MutableValidationState): readonly SchemaError[] {
    return pushIfAppropriate(
        pushIfAppropriate(
            null, 
            completeObjectValidationState(context, data, validationState)),
        completeArrayValidationState(context, data, validationState)) || emptyErrors
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
function validateConcreteSchema(context: ValidationContext, schema: TypedSchema, data: any, validationState: NonNullable<any> | null): readonly SchemaError[] {

    if (schema === true) return emptyErrors
    if (schema === false) return noPathFailAllErrors

    return validators
        .reduce((s, f) => pushIfAppropriate(s, f(context, schema, data, validationState)), null as null | SchemaError[]) || emptyErrors
}

function validateSchema(context: ValidationContext, schema: SchemaCondition, data: any): readonly SchemaError[] {
    const validationState: MutableValidationState = {}
    
    return concat2(
        execute(schema, (schema) => validateConcreteSchema(context, schema, data, validationState)), 
        completeValidationState(context, data, validationState))
}

// function validateStatefulSchema<TState>(
//     context: ValidationContext, schema: SchemaCondition, data: any, validationState?: any): readonly SchemaError[] {
//     return execute(schema, (s, schema) => validateConcreteSchema(context, schema, data), initialState)
// }

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