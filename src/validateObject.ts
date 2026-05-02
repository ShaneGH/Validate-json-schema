import { ObjectSchema, ObjectSchemaTemplate} from "./jsonSchema.js"
import { MutableValidationState, ValidationContext } from "./validationContext.js"
import { build as buildSchemaCondition, SchemaError, SchemaCondition } from "./schemaConditions.js"
import {
    tpl,
    pushIfAppropriate,
    concat2,
    hasAtLeastOneProp,
    checkType
} from "./utils.js"
import { create, get, put, NOT_FOUND, getOrPut } from "./rotatingCache.js"

const emptyStrings: readonly string[] = []
const emptyErrors: readonly SchemaError[] = []

type ValidateSchema = (context: ValidationContext, schema: SchemaCondition, data: any) => readonly SchemaError[]

// TODO: magic number
const rxCache = create<RegExp>(256)

function newRegex(rx: string) {
    return new RegExp(rx)
}

function *propertySchemas(schema: ObjectSchema, property: string) {
    let found = false
    if (schema.properties?.[property] != null) {
        found = true
        yield tpl(["properties", property], schema.properties[property])
    }

    for (let rx in schema.patternProperties) {
        if (!getOrPut(rxCache, rx, newRegex).test(property)) continue
        
        found = true
        yield tpl(["patternProperties", rx], schema.patternProperties[rx])
    }

    if (!found && schema.additionalProperties != null) {
        yield tpl(["additionalProperties"], schema.additionalProperties)
    }
}

const maxPropertiesError = {
    fieldPath: emptyStrings,
    schemaPath: ["maxProperties"]
}

const minPropertiesError = {
    fieldPath: emptyStrings,
    schemaPath: ["minProperties"]
}

export function validateObjectSchema(validateSchema: ValidateSchema, context: ValidationContext, schema: ObjectSchema, data: any, 
    validationState: MutableValidationState): readonly SchemaError[] {

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

    
    if (!validationState.visitedProperties) {
        validationState.visitedProperties = {visited: {}}
    }
    
    if (schema.unevaluatedProperties) {
        validationState.visitedProperties.unevaluated = 
        validationState.visitedProperties.unevaluated || []
        
        validationState.visitedProperties.unevaluated.push(schema.unevaluatedProperties)
    }
    
    let props = 0
    let propertyNames: SchemaCondition | null = null
    let patternPropertiesCache: Record<string, SchemaCondition> | null = null
    let additionalPropertiesCache: SchemaCondition | null = null
    for (let property in data) {
        props += 1

        propertyNames = propertyNames 
            || (schema.propertyNames && buildSchemaCondition(context, schema.propertyNames))
            || null

        if (propertyNames) {
            errs = pushIfAppropriate(
                errs, 
                validateSchema(context, propertyNames, property),
            e => ({
                ...e,
                schemaPath: ["propertyNames", ...e.schemaPath]
            }))
        }

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

    if (schema.maxProperties != null && props > schema.maxProperties) {
        errs = pushIfAppropriate(
            errs, {
                ...maxPropertiesError,
                message: `Object contains more than the maxProperties value ${schema.maxProperties}`
            });
    }

    if (schema.minProperties != null && props < schema.minProperties) {
        errs = pushIfAppropriate(
            errs, {
                ...minPropertiesError,
                message: `Object contains less than the minProperties value ${schema.minProperties}`
            });
    }

    return errs || emptyErrors
}

export function completeObjectValidationState(validateSchema: ValidateSchema, context: ValidationContext, data: any, 
    validationState: MutableValidationState): readonly SchemaError[] {

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
                    fieldPath: [...e.fieldPath, property],
                    schemaPath: ["unevaluatedProperties", ...e.fieldPath]
                })), errs as SchemaError[] | null)
    }
    
    return errs || emptyErrors
}