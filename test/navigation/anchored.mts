
import { test } from 'node:test';
import { failure, success, validate } from "../shared.mjs"
import { JsonDocument } from '../../src/jsonSchema.js';

test('anchored', { concurrency: true }, t => {

    const schema: Partial<JsonDocument> = {
        properties: {
            "prop": {
                "$ref": "#anchored_array"
            },
            "anchor": {
                "type": "array",
                "$anchor": "anchored_array",
                "items": {
                    "type": "boolean"
                }
            }
        }
    }

    t.test(`Success`, () => success(() =>
        validate(schema, { prop: [true] })));

    t.test(`Failure`, () => failure(() =>
        validate(schema, { prop: 333 }),
        [{ schema: "#/properties/prop/#anchored_array/type", field: "prop" }]));
});