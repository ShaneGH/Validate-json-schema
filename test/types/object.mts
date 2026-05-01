
import { test } from 'node:test';
import { assertValidation, validate } from "../shared.mjs"
import { JsonDocument } from '../../src/jsonSchema.js';
import { tpl } from '../../src/utils.js';

// not many tests here, most tests are on objects
test('object', { concurrency: true }, t => {

    const schema: Partial<JsonDocument> = {
        properties: {
            "prop": {
                "type": "object"
            }
        }
    }

    t.test("bounded length", t => {
        const schema: Partial<JsonDocument> = {
            properties: {
                "prop": {
                    "maxProperties": 3,
                    "minProperties": 1
                }
            }
        }

        for (const prop of [["x"], ["x","y"], ["x","y","z"]]) {
            t.test(`Success ${prop.length}`, () => assertValidation(() =>
                validate(schema, {prop: prop.reduce((s, x) => ({...s, [x]: x}), {}) })));
        }

        for (const [violation, prop] of [tpl("minProperties", []), tpl("maxProperties", ["x","y","z","X"])]) {
            t.test(`Failure ${prop.length}`, () => assertValidation(() =>
                validate(schema, {prop: prop.reduce((s, x) => ({...s, [x]: x}), {}) }),
                { field: 'prop', schema: `#/properties/prop/${violation}` }
            ));
        }
    })

    t.test("bounded length", t => {
        const schema: Partial<JsonDocument> = {
            properties: {
                "prop": {
                    "maxProperties": 3,
                    "minProperties": 1
                }
            }
        }

        for (const prop of [["x"], ["x","y"], ["x","y","z"]]) {
            t.test(`Success ${prop.length}`, () => assertValidation(() =>
                validate(schema, {prop: prop.reduce((s, x) => ({...s, [x]: x}), {}) })));
        }

        for (const [violation, prop] of [tpl("minProperties", []), tpl("maxProperties", ["x","y","z","X"])]) {
            t.test(`Failure ${prop.length}`, () => assertValidation(() =>
                validate(schema, {prop: prop.reduce((s, x) => ({...s, [x]: x}), {}) }),
                { field: 'prop', schema: `#/properties/prop/${violation}` }
            ));
        }
    })

    t.test("unevaluatedProperties", t => {
        const schema: Partial<JsonDocument> = {
            properties: {
                "prop": {
                    "type": "object",
                    "properties": {
                        "prop1": {
                            "type": "string"
                        },
                        "prop2": {},
                        "prop3": true,
                        "prop4": false
                    },
                    "unevaluatedProperties": {
                        "type": "number"
                    }
                }
            }
        }

        for (const prop of [{prop1: "x", prop2: "x", prop3: "x", propU: 4}]) {
            t.test(`Success ${JSON.stringify(prop)}`, () => assertValidation(() =>
                validate(schema, {prop })));
        }

        for (const [violations, prop] of [
            tpl([tpl("unevaluatedProperties", "propU")], {propU: "4"}), 
            tpl([tpl("properties/prop4", "prop4")], {prop4: "4"}),
            tpl([
                tpl("unevaluatedProperties", "propU"),
                tpl("properties/prop4", "prop4")
            ], {propU: "4", prop4: "4"}) 
        ]) {
            t.test(`Failure ${JSON.stringify(prop)}`, () => assertValidation(() =>
                validate(schema, {prop}),
                violations.map(v => ({
                    field: `prop/${v[1]}`, 
                    schema: `#/properties/prop/${v[0]}`
                }))
            ));
        }
    })
});