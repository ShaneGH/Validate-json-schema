
import { test } from 'node:test';
import { assertValidation, validate } from "../shared.mjs"
import { JsonDocument } from '../../src/jsonSchema.js';
import { tpl } from '../../src/utils.js';

// not many tests here, most tests are on objects
test('object', { concurrency: true }, t => {

    t.test("dependantSchemas", t => {
        const schema: Partial<JsonDocument> = {
            properties: {
                prop: {
                    type: "object",
                    properties: {
                        "prop1": { "type": "string" }
                    },
                    dependantSchemas: { 
                        "enableDep": {
                            "propertyNames": {
                                "pattern": "^enableDep|prop1$"
                            }
                        } 
                    }
                }
            }
        }

        for (const prop of [{ "prop1": "xx", "prop2": "xx" }, { "prop1": "xx", "enableDep": "xx" }]) {
            t.test(`Success ${JSON.stringify(prop)}`, () => assertValidation(() =>
                validate(schema, {prop})));
        }

        t.test(`Failure`, () => assertValidation(() =>
            validate(schema, {prop: { "prop1": "xx", "prop2": "xx", "enableDep": "xx" }}),
            { field: `prop`, schema: `#/properties/prop/dependantSchemas/enableDep/propertyNames/pattern` }));
    })

    t.test("dependentRequired", t => {
        const schema: Partial<JsonDocument> = {
            properties: {
                prop: {
                    type: "object",
                    properties: {
                        "prop1": { "type": "string" }
                    },
                    dependentRequired: { 
                        "prop2": ["prop3", "prop4"]
                    }
                }
            }
        }

        for (const prop of [{}, { "prop1": "xx" }, { "prop1": "xx", "prop2": "xx", "prop3": "xx", "prop4": "xx" }]) {
            t.test(`Success ${JSON.stringify(prop)}`, () => assertValidation(() =>
                validate(schema, {prop})));
        }

        for (const [missing, prop] of [
            tpl([0, 1], { "prop2": "xx" }), 
            tpl([1], { "prop2": "xx", "prop3": "xx" }), 
            tpl([0], { "prop2": "xx", "prop4": "xx" })
        ]) {
            t.test(`Failure ${JSON.stringify(prop)}`, () => assertValidation(() =>
                validate(schema, {prop}), missing
                    .map(x => ({ 
                        field: `prop/prop2`, 
                        schema: `#/properties/prop/dependentRequired/prop2/${x}` 
                    }))));
        }
    })

    t.test("propertyNames", t => {
        const schema: Partial<JsonDocument> = {
            properties: {
                prop: {
                    type: "object",
                    properties: {
                        "prop1": { "type": "string" }
                    },
                    propertyNames: { "pattern": "^pr" }
                }
            },
            required: ["prop"]
        }

        for (const prop of [{ "prop1": "xx" }, { "prop2": true }]) {
            t.test(`Success ${JSON.stringify(prop)}`, () => assertValidation(() =>
                validate(schema, {prop})));
        }

        for (const [[fieldErr, schemaErr], prop] of [
            tpl(tpl("", "/propertyNames/pattern"), { "crop1": "xx" }), 
            tpl(tpl("/prop1", "/properties/prop1/type"), { "prop1": true })]) {
            t.test(`Failure ${JSON.stringify(prop)}`, () => assertValidation(() =>
                validate(schema, {prop}),
                { field: `prop${fieldErr}`, schema: `#/properties/prop${schemaErr}` }));
        }
    })

    t.test("patternProperties", t => {
        const schema: Partial<JsonDocument> = {
            properties: {
                prop: {
                    type: "object",
                    properties: {
                        "prop1": { "type": "string" }
                    },
                    patternProperties: { 
                        "^a": {
                            "type": "number" 
                        }
                    }
                }
            },
            required: ["prop"]
        }

        for (const prop of [{ "prop1": "xx" }, { "prop2": true }, { "aaa": 5 }]) {
            t.test(`Success ${JSON.stringify(prop)}`, () => assertValidation(() =>
                validate(schema, {prop})));
        }

        for (const [[fieldErr, schemaErr], prop] of [
            tpl(tpl("/aaa", "/patternProperties/^a/type"), { "aaa": "xx" }), 
            tpl(tpl("/prop1", "/properties/prop1/type"), { "prop1": true })]) {
                
            t.test(`Failure ${JSON.stringify(prop)}`, () => assertValidation(() =>
                validate(schema, {prop}),
                { field: `prop${fieldErr}`, schema: `#/properties/prop${schemaErr}` }));
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