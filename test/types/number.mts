
import { test } from 'node:test';
import { assertValidation, validate } from "../shared.mjs"
import { JsonDocument } from '../../src/jsonSchema.js';

test('number', { concurrency: true }, t => {

    const schema: Partial<JsonDocument> = {
        properties: {
            "prop": {
                "type": "number"
            }
        }
    }

    t.test(`Success`, () => assertValidation(() => 
        validate(schema, { prop: 333.44 })));

    t.test(`Incorrect data type`, () => assertValidation(() => 
        validate(schema, { prop: "333" }),
        [{schema: "#/properties/prop/type", field: "prop"}]));

    t.test(`null`, () => assertValidation(() => 
        validate(schema, { prop: null }),
        [{schema: "#/properties/prop/type", field: "prop"}]));
});