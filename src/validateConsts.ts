import { TypedSchema} from "./jsonSchema.js"
import { ValidationContext } from "./validationContext.js"
import { SchemaError } from "./schemaConditions.js"
import { deepEquality } from "./utils.js"

const emptyStrings: readonly string[] = []
const emptyErrors: readonly SchemaError[] = []

function checkEnums(enums: readonly any[], data: any) {
    for (let e of enums) {
        if (deepEquality(e, data)) return true
    }

    return false
}

const enumString: readonly string[] = ["enum"]
export function validateEnum(context: ValidationContext, schema: TypedSchema, data: any): readonly SchemaError[] {

    return !schema.enum || checkEnums(schema.enum, data)
        ? emptyErrors
        : [{
            schemaPath: enumString,
            fieldPath: emptyStrings,
            message: "Invalid enum"
        }]
}

const constString: readonly string[] = ["const"]
export function validateConst(context: ValidationContext, schema: TypedSchema, data: any): readonly SchemaError[] {

    return schema.const === undefined || deepEquality(schema.const, data)
        ? emptyErrors
        : [{
            schemaPath: constString,
            fieldPath: emptyStrings,
            message: "Invalid const"
        }]
}