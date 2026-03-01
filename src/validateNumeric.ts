import { NumericSchema, NumericSchemaTemplate} from "./jsonSchema.js"
import { ValidationContext } from "./validationContext.js"
import { SchemaError } from "./schemaConditions.js"
import {
    pushIfAppropriate,
    hasAtLeastOneProp,
    checkType
} from "./utils.js"

const emptyStrings: readonly string[] = []
const emptyErrors: readonly SchemaError[] = []
const exclusiveMaximumString: readonly string[] = ["exclusiveMaximum"]
const maximumString: readonly string[] = ["maximum"]
const exclusiveMinimumString: readonly string[] = ["exclusiveMinimum"]
const minimumString: readonly string[] = ["minimum"]
const multipleOfString: readonly string[] = ["multipleOf"]

export function validateNumericSchema(context: ValidationContext, schema: NumericSchema, data: any): readonly SchemaError[] {
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