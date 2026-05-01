import { JsonDocument } from "../src/jsonSchema.js"
import { ValidationError } from "../src/validate.js"
import assert from 'node:assert/strict';
import { validateDocument } from "../src/validate.js";
import { tpl } from "../src/utils.js";

type Err = {field: string, schema: string}
export function assertValidation(f: (() => ValidationError[]), errs?: Err | Err[]) {
    if (!errs) errs = []
    if (!Array.isArray(errs)) errs = [errs]

    const result = f()
    result.sort((x, y) => x.field.localeCompare(y.field))
    errs.sort((x, y) => x.field.localeCompare(y.field))

    assert.deepEqual(
        result.map(x => ({
            field: x.field,
            schema: x.schema
        })),
        errs,
        "Errors do not match")
}

export function schemaError(f: (() => ValidationError[]), msg: string) {
    try {
        f()
        assert.fail("Expected error")
    } catch (e) {
        let err = e as Error
        assert.equal(err.message, msg)
    }
}

export const freakyObject = {
    "x": 1,
    "y": [null, true, {
        "p": {
            "q": null
        }
    }],
    "z": 3.4
}

export function delay(ms: number) {
    return new Promise(res => setTimeout(res, ms))
}

export function shuffledNumbers(toExclusive: number): number[]
export function shuffledNumbers(from: number, toExclusive: number): number[]
export function shuffledNumbers(x1: number, x2?: number): number[] {
    if (x2 == null) {
        x2 = x1
        x1 = 0
    }

    return shuffle([...Array(x2 - x1).keys()]
        .map((_, i) => i + x1));
}

export function shuffle<T>(xs: T[]): T[] {
    return xs
        .map(x => tpl(Math.random(), x))
        .sort((x, y) => x[0] - y[0])
        .map(x => x[1]);
}

export function validate(document: JsonDocument, data: any, retreivalUri?: URL): ValidationError[] {

    return validateDocument(schema(document), data, retreivalUri)
}

export function schema(schema: Partial<JsonDocument>): JsonDocument {
    return {
        "$schema": "http://json-schema.org/draft-04/schema#",
        "type": "object",
        ...schema
    }
}

export const schemaz: JsonDocument = {
    "$schema": "http://json-schema.org/draft-04/schema#",
    "type": "object",
    "properties": {
        "t_any1": {},
        "t_any2": true,
        "t_none": false,
        "t_string": {
            "type": "string"
        },
        "t_multi_type": {
            "type": ["string", "number"]
        },
        "t_null": {
            "type": "null"
        },
        "t_number": {
            "type": "number"
        },
        "t_integer": {
            "type": "integer"
        },
        "t_boolean": {
            "type": "boolean"
        },
        "t_array": {
            "type": "array",
            "$anchor": "anchored_array",
            "items": {
                "type": "boolean"
            }
        },
        "t_prefixed_array": {
            "type": "array",
            "prefixItems": [{
                "type": "string"
            }, {
                "type": "number"
            }],
            "items": {
                "type": "boolean"
            }
        },
        "t_contains_array": {
            "contains": {
                "type": "boolean"
            }
        },
        "t_defd_bool": {
            "$ref": "#/$defs/defd_bool"
        },
        "t_defd_anchor": {
            "$ref": "#anchored_array"
        },
        "t_defd_doublebool": {
            "$ref": "#/$defs/defd_double_bool"
        },
        "t_circular_reference": {
            "$ref": "#/$defs/circular_reference"
        },
        "t_enum_1": {
            "enum": [null, 1, "5", freakyObject]
        },
        "t_const_1": {
            "const": freakyObject
        },
        "constrained_number": {
            "multipleOf": 5,
            "exclusiveMinimum": 5,
            "exclusiveMaximum": 15,
        },
        "constrained_number2": {
            "minimum": 5,
            "maximum": 15,
        },
        "constrained_string": {
            "minLength": 1,
            "maxLength": 3,
            "pattern": "^d*$"
        }
    },
    "required": [
        "t_string"
    ],
    "$defs": {
        "defd_bool": {
            "type": "boolean"
        },
        "defd_double_bool": {
            "$ref": "#/$defs/defd_bool"
        },
        "circular_reference": {
            "$ref": "#/$defs/circular_reference2"
        },
        "circular_reference2": {
            "$ref": "#/$defs/circular_reference"
        }
    }
}