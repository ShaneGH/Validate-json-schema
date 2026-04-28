
import { test } from 'node:test';
import { failure, success, validate } from "./shared.mjs"
import { JsonDocument } from '../src/jsonSchema.js';

test('conditionalSubSchema', { concurrency: true }, t => {

    function executeBothWays(f: (x: boolean) => void) {
        f(true)
        f(false)
    }

    function schema(x: {anyOf?: number, allOf?: number, oneOf?: number, not?: boolean, typeInSub: boolean}): JsonDocument {

        function addSubType(schema: any) {
            return x.typeInSub ? {type: "object", ...schema} : schema
        }

        function sub(subType: string, count: number, x: any) {
            if (!count) return x

            return {
                ...x,
                [subType]: [...Array(count).keys()].map(i => addSubType({
                    "properties": {
                        [`p_${subType}_${i}`]: {
                            "type": "string"
                        }
                    },
                    "required": [`p_${subType}_${i}`]
                }))
            }
        }

        const schema: any = sub("allOf", x.allOf || 0, 
            sub("oneOf", x.oneOf || 0,
                sub("anyOf", x.anyOf || 0, {
                    "$schema": "http://json-schema.org/draft-04/schema#",
                    "properties": {
                        "p1": {"type": "string"}
                    }
                })))

        if (x.not) {
            // TODO: add a validation rule here
            // so that it conditionally failable
            schema["not"] = addSubType({
                "properties": {
                    "p_not": {"type": "string"}
                }
            })
        }

        if (!x.typeInSub) {
            schema.type = "object"
        }
        
        return schema
    }

    executeBothWays((typeInSub: boolean) => 
        t.test(
            `baseline, success; typeInSub: ${typeInSub}`, 
            () => success(() => validate(schema({typeInSub,}), { "p1": "xxx" }))))

    t.test(`baseline, fail`, () => failure(() => validate(schema({typeInSub: false}), { "p1": 111 }), [
        {schema: "#/properties/p1/type", field: "p1"}]))


    executeBothWays((typeInSub: boolean) => t.test(`oneOf, success, 1; typeInSub: ${typeInSub}`, () => success(() => validate(schema({typeInSub,oneOf: 1}), { "p1": "xxx", "p_oneOf_0": "aaa" }))))
    executeBothWays((typeInSub: boolean) => t.test(`oneOf, success. 2; typeInSub: ${typeInSub}`, () => success(() => validate(schema({typeInSub,oneOf: 2}), { "p1": "xxx", "p_oneOf_0": "aaa", "p_oneOf_1": 444 }))))
    executeBothWays((typeInSub: boolean) => t.test(`oneOf, success, 3; typeInSub: ${typeInSub}`, () => success(() => validate(schema({typeInSub,oneOf: 2}), { "p1": "xxx", "p_oneOf_0": 444, "p_oneOf_1": "aaa" }))))
    executeBothWays((typeInSub: boolean) => t.test(`oneOf, fail, 1; typeInSub: ${typeInSub}`, () => failure(() => validate(schema({typeInSub,oneOf: 1}), { "p1": "xxx" }), 
        [{schema: "#/oneOf", field:""},
        {schema: "#/oneOf/0/required/p_oneOf_0", field: "p_oneOf_0"}])))
    executeBothWays((typeInSub: boolean) => t.test(`oneOf, fail, 2; typeInSub: ${typeInSub}`, () => failure(() => validate(schema({typeInSub,oneOf: 1}), { "p1": "xxx", "p_oneOf_0": 4 }), 
        [{schema: "#/oneOf", field:""},
        {schema: "#/oneOf/0/properties/p_oneOf_0/type", field: "p_oneOf_0"}])))
    executeBothWays((typeInSub: boolean) => t.test(`oneOf, fail, 3; typeInSub: ${typeInSub}`, () => failure(() => validate(schema({typeInSub,oneOf: 2}), { "p1": "xxx", "p_oneOf_0": "aaa", "p_oneOf_1": "aaa" }), 
        [{schema: "#/oneOf", field:""}])))

    executeBothWays((typeInSub: boolean) => t.test(`allOf, success; typeInSub: ${typeInSub}`, () => success(() => validate(schema({typeInSub,allOf: 2}), { "p1": "xxx", "p_allOf_0": "aaa", "p_allOf_1": "aaa" }))))
    executeBothWays((typeInSub: boolean) => t.test(`allOf, fail, 1; typeInSub: ${typeInSub}`, () => failure(() => validate(schema({typeInSub,allOf: 2}), { "p1": "xxx", "p_allOf_0": 111, "p_allOf_1": 222 }), [
        {schema: "#/allOf/0/properties/p_allOf_0/type", field: "p_allOf_0"},
        {schema: "#/allOf/1/properties/p_allOf_1/type", field: "p_allOf_1"}
    ])))
    executeBothWays((typeInSub: boolean) => t.test(`allOf, fail, 2; typeInSub: ${typeInSub}`, () => failure(() => validate(schema({typeInSub,allOf: 2}), { "p1": "xxx", "p_allOf_0": 111, "p_allOf_1": "aaa" }), [
        {schema: "#/allOf/0/properties/p_allOf_0/type", field: "p_allOf_0"}
    ])))
    executeBothWays((typeInSub: boolean) => t.test(`allOf, fail, 3; typeInSub: ${typeInSub}`, () => failure(() => validate(schema({typeInSub,allOf: 2}), { "p1": "xxx", "p_allOf_0": "aaa", "p_allOf_1": 222 }), [
        {schema: "#/allOf/1/properties/p_allOf_1/type", field: "p_allOf_1"}
    ])))

    executeBothWays((typeInSub: boolean) => t.test(`anyOf, success, 1; typeInSub: ${typeInSub}`, () => success(() => validate(schema({typeInSub,anyOf: 2}), { "p1": "xxx", "p_anyOf_0": "aaa", "p_anyOf_1": "aaa" }))))
    executeBothWays((typeInSub: boolean) => t.test(`anyOf, success, 2; typeInSub: ${typeInSub}`, () => success(() => validate(schema({typeInSub,anyOf: 2}), { "p1": "xxx", "p_anyOf_0": "aaa", "p_anyOf_1": 111 }))))
    executeBothWays((typeInSub: boolean) => t.test(`anyOf, success, 3; typeInSub: ${typeInSub}`, () => success(() => validate(schema({typeInSub,anyOf: 2}), { "p1": "xxx", "p_anyOf_0": 111, "p_anyOf_1": "aaa" }))))
    executeBothWays((typeInSub: boolean) => t.test(`anyOf, fail, 1; typeInSub: ${typeInSub}`, () => failure(() => validate(schema({typeInSub,anyOf: 2}), { "p1": "xxx", "p_anyOf_0": 111, "p_anyOf_1": 222 }), [
        {schema: "#/anyOf/0/properties/p_anyOf_0/type", field: "p_anyOf_0"},
        {schema: "#/anyOf/1/properties/p_anyOf_1/type", field: "p_anyOf_1"}
    ])))

    executeBothWays((typeInSub: boolean) => t.test(`not, success typeInSub: ${typeInSub}`, () => success(() => validate(schema({not: true, typeInSub}), { "p1": "xxx", "p_not": 111 }))))
    executeBothWays((typeInSub: boolean) => t.test(`not, fail; typeInSub: ${typeInSub}`, () => failure(() => validate(schema({typeInSub,not: true}), { "p1": "xxx", "p_not": "aaa" }),
        [{schema: "#/not", field:""}]
    )))
});