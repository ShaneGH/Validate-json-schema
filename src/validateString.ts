import { StringSchema, StringSchemaTemplate} from "./jsonSchema.js"
import { ValidationContext } from "./validationContext.js"
import { SchemaError } from "./schemaConditions.js"
import {
    pushIfAppropriate,
    hasAtLeastOneProp,
    checkType
} from "./utils.js"

const emptyStrings: readonly string[] = []
const emptyErrors: readonly SchemaError[] = []
const maxLengthString: readonly string[] = ["maxLength"]
const minLengthString: readonly string[] = ["minLength"]
const patternString: readonly string[] = ["pattern"]

export function validateStringSchema(context: ValidationContext, schema: StringSchema, data: any): readonly SchemaError[] {
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