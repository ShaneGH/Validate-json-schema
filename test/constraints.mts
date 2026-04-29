
import { test } from 'node:test';
import { assertValidation, validate } from "./shared.mjs"
import { JsonDocument } from '../src/jsonSchema.js';

test('constraints', { concurrency: true }, t => {
    
    t.test('string', t => {

        const schema: Partial<JsonDocument> = {
            properties: {
                "prop": {
                    "minLength": 1,
                    "maxLength": 3,
                    "pattern": "^\\d*$"
                }
            }
        }

        t.test(`Success`, () => assertValidation(() => 
            validate(schema, { prop: "123" })));

        t.test(`Failure, regex`, () => assertValidation(() => 
            validate(schema, { prop: "aaa" }),
            [{schema: "#/properties/prop/pattern", field: "prop"}]));

        t.test(`Failure, min`, () => assertValidation(() => 
            validate(schema, { prop: "" }),
            [{schema: "#/properties/prop/minLength", field: "prop"}]));

        t.test(`Failure, max`, () => assertValidation(() => 
            validate(schema, { prop: "1234" }),
            [{schema: "#/properties/prop/maxLength", field: "prop"}]));
    })
    
    t.test('numeric', t => {

        t.test('exclusive', t => {

            const schema: Partial<JsonDocument> = {
                properties: {
                    "prop": {
                        "multipleOf": 5,
                        "exclusiveMinimum": 5,
                        "exclusiveMaximum": 15,
                    }
                }
            }

            t.test(`Success`, () => assertValidation(() => 
                validate(schema, { prop: 10 })));

            t.test(`Failure, multiple`, () => assertValidation(() => 
                validate(schema, { prop: 11 }),
                [{schema: "#/properties/prop/multipleOf", field: "prop"}]));

            t.test(`Failure, min`, () => assertValidation(() => 
                validate(schema, { prop: 5 }),
                [{schema: "#/properties/prop/exclusiveMinimum", field: "prop"}]));

            t.test(`Failure, max`, () => assertValidation(() => 
                validate(schema, { prop: 15 }),
                [{schema: "#/properties/prop/exclusiveMaximum", field: "prop"}]));
        })

        t.test('inclusive', t => {

            const schema: Partial<JsonDocument> = {
                properties: {
                    "prop": {
                        "multipleOf": 5,
                        "minimum": 5,
                        "maximum": 15,
                    }
                }
            }

            t.test(`Success`, () => assertValidation(() => 
                validate(schema, { prop: 10 })));

            t.test(`Failure, min`, () => assertValidation(() => 
                validate(schema, { prop: 5 })));

            t.test(`Failure, max`, () => assertValidation(() => 
                validate(schema, { prop: 15 })));

            t.test(`Failure, multiple`, () => assertValidation(() => 
                validate(schema, { prop: 11 }),
                [{schema: "#/properties/prop/multipleOf", field: "prop"}]));

            t.test(`Failure, min`, () => assertValidation(() => 
                validate(schema, { prop: 4 }),
                [
                    {schema: "#/properties/prop/minimum", field: "prop"},
                    {schema: "#/properties/prop/multipleOf", field: "prop"}
                ]));

            t.test(`Failure, max`, () => assertValidation(() => 
                validate(schema, { prop: 16 }),
                [
                    {schema: "#/properties/prop/maximum", field: "prop"},
                    {schema: "#/properties/prop/multipleOf", field: "prop"}
                ]));
        })
    })
});