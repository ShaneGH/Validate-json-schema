
import { test } from 'node:test';
import { failure, success, validate } from "../shared.mjs"
import { JsonDocument } from '../../src/jsonSchema.js';

test('boolean', { concurrency: true }, t => {

    const schema: Partial<JsonDocument> = {
        properties: {
            "prop": {
                "type": "boolean"
            }
        }
    }

    t.test(`Success`, () => success(() => 
        validate(schema, { prop: false })));

    t.test(`Incorrect data type`, () => failure(() => 
        validate(schema, { prop: "333" }),
        [{schema: "#/properties/prop/type", field: "prop"}]));

    t.test(`null`, () => failure(() => 
        validate(schema, { prop: null }),
        [{schema: "#/properties/prop/type", field: "prop"}]));
});