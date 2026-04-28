
import { test } from 'node:test';
import { failure, success, validate } from "../shared.mjs"
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

    t.test(`Success`, () => success(() => 
        validate(schema, { prop: "333" })));

    t.test(`Incorrect data type`, () => failure(() => 
        validate(schema, { prop: 333 }),
        [{schema: "#/properties/prop/type", field: "prop"}]));

    t.test(`Missing`, () => failure(() => 
        validate(schema, {  }),
        [{schema: "#/required/prop", field: "prop"}]));
});