import { 
    SchemaType, 
    TypedSchema} from "./jsonSchema.js"
import { MutableValidationState, ValidationContext } from "./validationContext.js"
import { SchemaError } from "./schemaConditions.js"
import {
    checkType
} from "./utils.js"

const emptyStrings: readonly string[] = []
const emptyErrors: readonly SchemaError[] = []

function checkTypes(type: SchemaType | readonly SchemaType[], data: any) {
    if (typeof type === "string") return checkType(type, data)
    for (let x of type) {
        if (checkType(x, data)) return true
    }

    return false
}

const typeString: readonly string[] = ["type"]
export function validateType(context: ValidationContext, schema: TypedSchema, data: any, validationState: MutableValidationState): readonly SchemaError[] {

    return !schema.type || checkTypes(schema.type, data)
        ? emptyErrors
        : [{
            schemaPath: typeString,
            fieldPath: emptyStrings,
            message: `Invalid type. Expected: ${schema.type}, actual: ${typeof data}`
        }]
}