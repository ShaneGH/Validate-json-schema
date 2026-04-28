
import { test } from 'node:test';
import { failure, success, validate } from "../shared.mjs"
import { JsonDocument } from '../../src/jsonSchema.js';

test('integer', { concurrency: true }, t => {

    const schema: Partial<JsonDocument> = {
        properties: {
            "prop": {
                "type": "integer"
            }
        }
    }

    t.test(`Success`, () => success(() => 
        validate(schema, { prop: 333 })));

    t.test(`Incorrect real number`, () => failure(() => 
        validate(schema, { prop: 333.44 }),
        [{schema: "#/properties/prop/type", field: "prop"}]));

    t.test(`Incorrect data type`, () => failure(() => 
        validate(schema, { prop: "333" }),
        [{schema: "#/properties/prop/type", field: "prop"}]));

    t.test(`null`, () => failure(() => 
        validate(schema, { prop: null }),
        [{schema: "#/properties/prop/type", field: "prop"}]));
});