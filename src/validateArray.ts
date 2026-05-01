import { 
    ArraySchema, 
    ArraySchemaTemplate,
    Schema} from "./jsonSchema.js"
import { MutableValidationState, ValidationContext } from "./validationContext.js"
import { build as buildSchemaCondition, SchemaError, SchemaCondition } from "./schemaConditions.js"
import {
    pushIfAppropriate,
    hasAtLeastOneProp,
    checkType
} from "./utils.js"
import { 
    addToRange,
    advanceRangeCursor, 
    create as createRange,
    enumerateMissing} from "./rangeCollection.js"

const emptyStrings: readonly string[] = []
const emptyErrors: readonly SchemaError[] = []

type ValidateSchema = (context: ValidationContext, schema: SchemaCondition, data: any) => readonly SchemaError[]

const containsErrors: readonly SchemaError[] = [{
    fieldPath: emptyStrings,
    schemaPath: ["contains"],
    message: "Array does not contain element which matches constraint"
}]

const maxContainsError = {
    fieldPath: emptyStrings,
    schemaPath: ["maxContains"]
}

const minContainsError = {
    fieldPath: emptyStrings,
    schemaPath: ["minContains"]
}

const maxItemsError = {
    fieldPath: emptyStrings,
    schemaPath: ["maxItems"]
}

const minItemsError = {
    fieldPath: emptyStrings,
    schemaPath: ["minItems"]
}

function buildArraySchema(
    context: ValidationContext,
    schema: undefined | Schema | Schema[]): undefined | SchemaCondition | SchemaCondition[] {

    if (!schema) return undefined

    if (Array.isArray(schema)) return schema.map(s => buildSchemaCondition(context, s))

    return buildSchemaCondition(context, schema)
}

export function validateArraySchema(validateSchema: ValidateSchema, 
    context: ValidationContext, schema: ArraySchema, data: any, validationState: MutableValidationState): readonly SchemaError[] {
    if (!checkType("array", data) || !hasAtLeastOneProp(schema, ArraySchemaTemplate)) return emptyErrors

    if (!data.length && (schema.minItems || 0) == 0) return schema.contains ? containsErrors : emptyErrors

    validationState.visitedItems = validationState.visitedItems || { visited: createRange() }

    if (schema.unevaluatedItems) {
        validationState.visitedItems.unevaluated = validationState.visitedItems.unevaluated || []
        validationState.visitedItems.unevaluated.push(schema.unevaluatedItems)
    }

    let contains = schema.contains && buildSchemaCondition(context, schema.contains) || null
    let containsCount = 0
    let items: SchemaCondition | SchemaCondition[] | null | undefined = null
    let errs: SchemaError[] | null = null

    if (data.length < (schema.minItems || 0)) {
        errs = pushIfAppropriate(errs, {
            ...minItemsError,
            message: `Array contains less than the minItems value ${schema.minItems}`
        })
    }

    if (data.length > (schema.maxItems || Number.MAX_SAFE_INTEGER)) {
        errs = pushIfAppropriate(errs, {
            ...maxItemsError,
            message: `Array contains more than the maxItems value ${schema.maxItems}`
        })
    }

    for (let i = 0; i < data.length; i++) {
        
        let itemSchema = schema.prefixItems && i < schema.prefixItems.length
            ? buildSchemaCondition(context, schema.prefixItems[i])
            : (items = items || buildArraySchema(context, schema.items))

        let schemaI: null | number = null
        if (Array.isArray(itemSchema)) {
            schemaI = i - (schema.prefixItems?.length || 0)
            itemSchema = itemSchema[schemaI]
        }

        if (!itemSchema && !contains) break

        if (itemSchema) {
            errs = pushIfAppropriate(
                errs, 
                validateSchema(context, itemSchema, data[i]), 
                e => ({
                    ...e,
                    schemaPath: items
                        ? schemaI == null 
                            ? ["items", ...e.schemaPath]
                            : ["items", schemaI.toString(), ...e.schemaPath]
                        : ["prefixItems", i.toString(), ...e.schemaPath],
                    fieldPath: [i.toString(), ...e.fieldPath]
                }));

            addToRange(validationState.visitedItems.visited, i)
        }

        if (contains && validateSchema(context, contains, data[i]).length === 0) {
            containsCount += 1

            // no need to evaluate contains any more
            if (schema.maxContains == null && containsCount >= (schema.minContains || 0)) {
                contains = null
            }
        }
    }

    if (!contains)
        return errs || emptyErrors
    
    if (containsCount > (schema.maxContains || Number.MAX_SAFE_INTEGER)) {
        errs = pushIfAppropriate(errs, {
            ...maxContainsError,
            message: `Array contains more than the maxContains value ${schema.maxContains}`
        })
    }
    
    if (containsCount < (schema.minContains || 0)) {
        errs = pushIfAppropriate(errs, {
            ...minContainsError,
            message: `Array contains less than the minContains value ${schema.minContains}`
        })
    }

    if (schema.minContains == null && containsCount == 0) {
        errs = pushIfAppropriate(errs, containsErrors)
    }
    
    return errs || emptyErrors
}

export function completeArrayValidationState(validateSchema: ValidateSchema, 
    context: ValidationContext, data: any, validationState: MutableValidationState): readonly SchemaError[] {
    if (!validationState.visitedItems || !checkType("array", data)) return emptyErrors
    if (!validationState.visitedItems.unevaluated?.length) return emptyErrors
    if (!data.length) return emptyErrors

    let errs: SchemaError[] | null = null
    let unevaluatedConditions: SchemaCondition[] | null = null
    for (const i of enumerateMissing(validationState.visitedItems.visited, 0, data.length)) {
        unevaluatedConditions = unevaluatedConditions || validationState.visitedItems.unevaluated
            .map(s => buildSchemaCondition(context, s))

        for (const c of unevaluatedConditions) {
            errs = pushIfAppropriate(
                errs, 
                validateSchema(context, c, data[i]), e => ({
                    ...e,
                    // TODO: schema path is not correct 
                    // if unevaluatedItems is in a sub schema
                    fieldPath: [...e.fieldPath, i.toString()],
                    schemaPath: ["unevaluatedItems", ...e.fieldPath]
                }))
        }
    }
    
    return errs || emptyErrors
}
