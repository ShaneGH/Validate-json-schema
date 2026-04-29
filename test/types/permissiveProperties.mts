
import { test } from 'node:test';
import { assertValidation, validate } from "../shared.mjs"
import { JsonDocument } from '../../src/jsonSchema.js';
import { tpl } from '../../src/utils.js';

test('permissiveProperties', { concurrency: true }, t => {

    const schema: Partial<JsonDocument> = {
        properties: {
            "true": {
                "type": "object",
                "properties": {
                    "prop": { "type": "string" }
                },
                "additionalProperties": true
            },
            "false": {
                "type": "object",
                "properties": {
                    "prop": { "type": "string" }
                },
                "additionalProperties": false
            },
            "number": {
                "type": "object",
                "properties": {
                    "prop": { "type": "string" }
                },
                "additionalProperties": { "type": "number" }
            },
            "nullable": {
                "type": "object",
                "properties": {
                    "prop": { "type": "string" }
                },
                "additionalProperties": { 
                    "anyOf": [
                        { "type": "number" },
                        { "type": "null" }
                    ]
                }
            },
            "fallthrough": {
                "type": "object",
                "properties": {
                    "prop": { "type": "string" }
                },
                "patternProperties": {
                    "^prop": { "type": "number" }
                },
                "additionalProperties": { "type": "null" }
            }
        }
    }

    t.test(`No additions`, t => {
        for (let name in schema.properties) {
            // this case is designed to always fail
            if (name === "fallthrough") continue

            t.test(`${name}`, () => 
                assertValidation(() => validate(schema, { 
                    [name]: { "prop": "xxx" }
                })))

        }
    })

    t.test(`Good additions`, t => {
        for (let [name, values] of [
            tpl("true", {x: 8, y: "a", z: null}),
            tpl("number", {x: 8}),
            tpl("nullable", {x: 8, y: null})]) {

            t.test(`${name}`, t =>
                assertValidation(() => validate(schema, { 
                    [name]: { "prop": "xxx", ...values }
                })))
        }

        t.test(`fallthrough`, t =>
            assertValidation(() => validate(schema, { 
                "fallthrough": { "Xprop": null }
            })))
    })

    t.test(`Bad additions`, t => {
        for (let [name, values, errors] of [
            tpl(
                "false", 
                {x: 8}, 
                { schema: '#/properties/false/additionalProperties', field: 'false/x' }),

            tpl(
                "number", 
                {x: null, y: "t"}, 
                [
                    { schema: '#/properties/number/additionalProperties/type', field: 'number/x' },
                    { schema: '#/properties/number/additionalProperties/type', field: 'number/y' },
                ]),

            tpl(
                "nullable", 
                {x: null, y: "t"}, 
                [
                    { schema: '#/properties/nullable/additionalProperties/anyOf/0/type', field: 'nullable/y' },
                    { schema: '#/properties/nullable/additionalProperties/anyOf/1/type', field: 'nullable/y' }
                ]),

            tpl(
                "fallthrough", 
                {}, 
                [
                    { schema: '#/properties/fallthrough/patternProperties/^prop/type', field: 'fallthrough/prop' }
                ])
        ]) {

            t.test(`${name}`, () =>
                assertValidation(() => validate(schema, { 
                    [name]: { "prop": "xxx", ...values }
                }),
                errors))
        }
    })
});