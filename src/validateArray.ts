import { 
    ArraySchema, 
    ArraySchemaTemplate} from "./jsonSchema.js"
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
    create as createRange} from "./rangeCollection.js"

const emptyStrings: readonly string[] = []
const emptyErrors: readonly SchemaError[] = []

type ValidateSchema = (context: ValidationContext, schema: SchemaCondition, data: any) => readonly SchemaError[]

const containsErrors: readonly SchemaError[] = [{
    fieldPath: emptyStrings,
    schemaPath: ["contains"],
    message: "Array does not contain element which matches constraint"
}]

export function validateArraySchema(validateSchema: ValidateSchema, 
    context: ValidationContext, schema: ArraySchema, data: any, validationState: MutableValidationState): readonly SchemaError[] {
    if (!checkType("array", data) || !hasAtLeastOneProp(schema, ArraySchemaTemplate)) return emptyErrors

    if (!data.length) return schema.contains ? containsErrors : emptyErrors

    validationState.visitedItems = validationState.visitedItems || { visited: createRange() }

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

export function completeArrayValidationState(validateSchema: ValidateSchema, 
    context: ValidationContext, data: any, validationState: MutableValidationState): readonly SchemaError[] {
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
