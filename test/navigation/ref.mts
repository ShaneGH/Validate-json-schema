
import { test } from 'node:test';
import { assertValidation, schemaError, validate } from "../shared.mjs"
import { JsonDocument } from '../../src/jsonSchema.js';
import { tpl } from '../../src/utils.js';

test('ref', { concurrency: true }, t => {

    for (let ref of ["bool", "double_bool"]) {

        const schema: Partial<JsonDocument> = {
            properties: {
                "prop": {
                    "$ref": `#/$defs/${ref}`
                }
            },
            "$defs": {
                "bool": {
                    "type": "boolean"
                },
                "double_bool": {
                    "type": "boolean"
                }
            }
        }

        t.test(`Success: ${ref}`, () => assertValidation(() =>
            validate(schema, { prop: true })));

        t.test(`Failure, invalid value: ${ref}`, () => assertValidation(() =>
            validate(schema, { prop: 333 }),
            [{ schema: `#/properties/prop/#/$defs/${ref}/type`, field: "prop" }]));

        t.test(`Failure, null: ${ref}`, () => assertValidation(() =>
            validate(schema, { prop: null }),
            [{ schema: `#/properties/prop/#/$defs/${ref}/type`, field: "prop" }]));
    }

    const schema: Partial<JsonDocument> = {
        properties: {
            "prop": {
                "$ref": `#/$defs/circular_reference`
            }
        },
        "$defs": {
            "circular_reference": {
                "$ref": "#/$defs/circular_reference2"
            },
            "circular_reference2": {
                "$ref": "#/$defs/circular_reference"
            }
        }
    }

    t.test(`Circular reference`, () => schemaError(() =>
        validate(schema, { prop: 333 }),
        "??? circular reference"));
});