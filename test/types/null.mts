
import { test } from 'node:test';
import { failure, success, validate } from "../shared.mjs"
import { JsonDocument } from '../../src/jsonSchema.js';

test('null', { concurrency: true }, t => {

    const schema: Partial<JsonDocument> = {
        properties: {
            "prop": {
                "type": "null"
            }
        }
    }

    t.test(`Success`, () => success(() => 
        validate(schema, { prop: null })));

    t.test(`Incorrect data type`, () => failure(() => 
        validate(schema, { prop: 333 }),
        [{schema: "#/properties/prop/type", field: "prop"}]));
});