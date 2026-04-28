
import { test } from 'node:test';
import { failure, success, validate } from "../shared.mjs"
import { JsonDocument } from '../../src/jsonSchema.js';

test('Multiple types', { concurrency: true }, t => {

    const schema: Partial<JsonDocument> = {
        properties: {
            "prop": {
                "type": ["string", "number"]
            }
        }
    }

    t.test(`Success, string`, () => success(() => 
        validate(schema, { prop: "333.44" })));

    t.test(`Success, number`, () => success(() => 
        validate(schema, { prop: 333.44 })));

    t.test(`Incorrect data type`, () => failure(() => 
        validate(schema, { prop: {} }),
        [{schema: "#/properties/prop/type", field: "prop"}]));

    t.test(`null`, () => failure(() => 
        validate(schema, { prop: null }),
        [{schema: "#/properties/prop/type", field: "prop"}]));
});