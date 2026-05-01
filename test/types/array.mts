
import { test } from 'node:test';
import { assertValidation, validate } from "../shared.mjs"
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

    t.test(`Success`, () => assertValidation(() =>
        validate(schema, { prop: [true, false] })));

    t.test(`Success (empty)`, () => assertValidation(() =>
        validate(schema, { prop: [] })));

    t.test(`Incorrect data type`, () => assertValidation(() =>
        validate(schema, { prop: 333 }),
        [{ schema: "#/properties/prop/type", field: "prop" }]));

    t.test(`null`, () => assertValidation(() =>
        validate(schema, { prop: null }),
        [{ schema: "#/properties/prop/type", field: "prop" }]));

    t.test(`Good data and null`, () => assertValidation(() =>
        validate(schema, { prop: [true, null] }),
        [{ schema: "#/properties/prop/items/type", field: "prop/1" }]));

    t.test(`Good and bad data`, () => assertValidation(() =>
        validate(schema, { prop: ["", true] }),
        [{ schema: "#/properties/prop/items/type", field: "prop/0" }]));

    
    t.test("various items and prefix items cases", t => {
        const schema: Partial<JsonDocument> = {
            properties: {
                "prop": {
                    "type": "array",
                    "items": [{
                        "type": "string"
                    }, {
                        "type": "number"
                    }]
                }
            }
        }

        for (const prop of [[], ["1"], ["1", 1, "1"]]) {
            t.test(`Success ${JSON.stringify(prop)}`, () => assertValidation(() =>
                validate(schema, {prop })));
        }

        for (const [prefixI, i, prop] of [tpl(0, 0, [1]), tpl(0, 1, ["1", "1"])]) {
            t.test(`Failure ${JSON.stringify(prop)}`, () => assertValidation(() =>
                validate(schema, {prop }),
            {
                field: `prop/${prefixI + i}`,
                schema: `#/properties/prop/items/${i}/type`
            }));
        }

        const schemaWithPrefix: Partial<JsonDocument> = {
            properties: {
                "prop": {
                    ...(schema.properties?.prop as any),
                    "prefixItems": [true]
                }
            }
        }

        for (const prop of [[], [1], [1, "1"], [1, "1", 1, "1"]]) {
            t.test(`Success ${JSON.stringify(prop)}`, () => assertValidation(() =>
                validate(schemaWithPrefix, {prop })));
        }

        for (const [prefixI, i, prop] of [tpl(1, 0, [1, 1]), tpl(1, 1, [1, "1", "1"])]) {
            t.test(`Failure ${JSON.stringify(prop)}`, () => assertValidation(() =>
                validate(schemaWithPrefix, {prop }),
            {
                field: `prop/${prefixI + i}`,
                schema: `#/properties/prop/items/${i}/type`
            }));
        }
    })

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
            t.test(`${i}`, () => assertValidation(() =>
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

            t.test(`invalid ${i}`, () => assertValidation(() =>
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

        t.test(`Success`, () => assertValidation(() =>
            validate(schema, { prop: ["aa", "bb"] })));

        for (let [name, value] of [
            tpl("Empty", []), 
            tpl("Doesn't contain", [true])]) {

            t.test(name, () => assertValidation(() =>
                validate(
                    schema, 
                    { prop: value }),
                { schema: "#/properties/prop/contains", field: `prop`}));
        }
    })

    t.test("bounded Contains", t => {
        const schema: Partial<JsonDocument> = {
            properties: {
                "prop": {
                    "maxContains": 3,
                    "minContains": 1,
                    "contains": {
                        "type": "string"
                    }
                }
            }
        }

        for (const x of [["aa", 1], ["aa", 1, "aa"], ["aa", "aa", 1, "aa"]]) {
            t.test(`Success`, () => assertValidation(() =>
                validate(schema, { prop: x })));
        }

        for (const [constraint, prop] of [tpl("minContains", [1]), tpl("maxContains", ["aa", "aa", 1, "aa", "aa"])]) {
            t.test(`Failure`, () => assertValidation(() =>
                validate(schema, { prop }),
                {schema: `#/properties/prop/${constraint}`, field: "prop"}));
        }
    })

    t.test("bounded length", t => {
        const schema: Partial<JsonDocument> = {
            properties: {
                "prop": {
                    "maxItems": 3,
                    "minItems": 1
                }
            }
        }

        for (const prop of [[1], [1, 2], [1,2,3]]) {
            t.test(`Success ${prop.length}`, () => assertValidation(() =>
                validate(schema, { prop })));
        }

        for (const [constraint, prop] of [tpl("minItems", []), tpl("maxItems", [1,2,3,4])]) {
            t.test(`Failure ${prop.length}`, () => assertValidation(() =>
                validate(schema, { prop }),
                {schema: `#/properties/prop/${constraint}`, field: "prop"}));
        }
    })

    t.test("unevaluated items", t => {
        const schema: Partial<JsonDocument> = {
            properties: {
                "prop": {
                    "type": "array",
                    "items": [{"type": "string"}, {"type": "number"}],
                    "unevaluatedItems": {"type": "boolean"}
                }
            }
        }

        for (const prop of [[], ["1"], ["1", 1, true, false]]) {
            t.test(`Success ${prop.length}`, () => assertValidation(() =>
                validate(schema, { prop })));
        }

        t.test(`Failure`, () => assertValidation(() =>
            validate(schema, { prop: ["1", 1, "1"] }),
            {schema: `#/properties/prop/unevaluatedItems`, field: "prop/2"}));
    })
});