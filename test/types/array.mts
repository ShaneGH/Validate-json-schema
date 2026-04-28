
import { test } from 'node:test';
import { failure, success, validate } from "../shared.mjs"
import { JsonDocument } from '../../src/jsonSchema.js';
import { tpl } from '../../src/utils.js';

test('array', { concurrency: true }, t => {

    const schema: Partial<JsonDocument> = {
        properties: {
            "prop": {
                "type": "array",
                "items": {
                    "type": "boolean"
                }
            }
        }
    }

    t.test(`Success`, () => success(() =>
        validate(schema, { prop: [true, false] })));

    t.test(`Success (empty)`, () => success(() =>
        validate(schema, { prop: [] })));

    t.test(`Incorrect data type`, () => failure(() =>
        validate(schema, { prop: 333 }),
        [{ schema: "#/properties/prop/type", field: "prop" }]));

    t.test(`null`, () => failure(() =>
        validate(schema, { prop: null }),
        [{ schema: "#/properties/prop/type", field: "prop" }]));

    t.test(`Good data and null`, () => failure(() =>
        validate(schema, { prop: [true, null] }),
        [{ schema: "#/properties/prop/items/type", field: "prop/1" }]));

    t.test(`Good and bad data`, () => failure(() =>
        validate(schema, { prop: ["", true] }),
        [{ schema: "#/properties/prop/items/type", field: "prop/0" }]));

    t.test("prefixItems", t => {
        const schema: Partial<JsonDocument> = {
            properties: {
                "prop": {
                    "type": "array",
                    "prefixItems": [{
                        "type": "string"
                    }, {
                        "type": "number"
                    }],
                    "items": {
                        "type": "boolean"
                    }
                }
            }
        }

        for (let i = 4; i >= 0; i--) {
            t.test(`${i}`, () => success(() =>
                validate(
                    schema, 
                    { prop: ["xx", 4, true, false].slice(0, i) })));
        }

        function replace<T>(xs: T[], i: number, x: any): any[] {
            xs = [...xs]
            xs[i] = x
            return xs
        }

        for (let i = 3; i >= 0; i--) {

            t.test(`invalid ${i}`, () => failure(() =>
                validate(
                    schema, 
                    { prop: replace(["xx", 4, true, false], i, {}) }),
                    { schema: i < 2 && `#/properties/prop/prefixItems/${i}/type`
                        || `#/properties/prop/items/type`, 
                      field: `prop/${i}`}));
        }
    })

    t.test("contains", t => {
        const schema: Partial<JsonDocument> = {
            properties: {
                "prop": {
                    "contains": {
                        "type": "string"
                    }
                }
            }
        }

        t.test(`Success`, () => success(() =>
            validate(schema, { prop: ["aa", "bb"] })));

        for (let [name, value] of [
            tpl("Empty", []), 
            tpl("Doesn't contain", [true])]) {

            t.test(name, () => failure(() =>
                validate(
                    schema, 
                    { prop: value }),
                { schema: "#/properties/prop/contains", field: `prop`}));
        }
    })
});