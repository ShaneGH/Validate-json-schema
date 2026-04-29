
import { test } from 'node:test';
import { assertValidation, validate } from "../shared.mjs"
import { JsonDocument } from '../../src/jsonSchema.js';

test('string', { concurrency: true }, t => {

    const schema: Partial<JsonDocument> = {
        properties: {
            "prop": {
                "type": "string"
            }
        },
        required: ["prop"]
    }

    t.test(`Success`, () => assertValidation(() => 
        validate(schema, { prop: "333" })));

    t.test(`Incorrect data type`, () => assertValidation(() => 
        validate(schema, { prop: 333 }),
        [{schema: "#/properties/prop/type", field: "prop"}]));

    t.test(`Missing`, () => assertValidation(() => 
        validate(schema, {  }),
        [{schema: "#/required/prop", field: "prop"}]));
});