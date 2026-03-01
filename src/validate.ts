import { 
    BooleanSchema, 
    BooleanSchemaTemplate, 
    JsonDocument, 
    NullSchema, 
    NullSchemaTemplate,
    TypedSchema} from "./jsonSchema.js"
import { build as buildValidationContext, MutableValidationState, ValidationContext } from "./validationContext.js"
import { build as buildSchemaCondition, SchemaError, execute, SchemaCondition } from "./schemaConditions.js"
import {
    pushIfAppropriate,
    concat2,
    hasAtLeastOneProp,
    checkType
} from "./utils.js"
import { completeObjectValidationState, validateObjectSchema } from "./validateObject.js"
import { completeArrayValidationState, validateArraySchema } from "./validateArray.js"
import { validateType } from "./validateType.js"
import { validateConst, validateEnum } from "./validateConsts.js"
import { validateNumericSchema } from "./validateNumeric.js"
import { validateStringSchema } from "./validateString.js"

const emptyErrors: readonly SchemaError[] = []

function validateBooleanSchema(context: ValidationContext, schema: BooleanSchema, data: any, mutableState: MutableValidationState): readonly SchemaError[] {
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
            completeObjectValidationState(validateSchema, context, data, validationState)),
        completeArrayValidationState(validateSchema, context, data, validationState)) || emptyErrors
}

const validators: readonly (typeof validateBooleanSchema)[] = [
    validateType,
    validateEnum,
    validateConst,
    validateArraySchema.bind(null, validateSchema),
    validateObjectSchema.bind(null, validateSchema),
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