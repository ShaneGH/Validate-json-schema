
import { test } from 'node:test';
import { assertValidation, validate } from "../shared.mjs"

test('any', { concurrency: true }, t => {

    for (const x of [true, {}]) {
        t.test(`Any: ${x}, number`, () => assertValidation(() => 
            validate({
                properties: { prop: x } 
            }, { "t_string": "xxx", prop: 333 })));

        t.test(`Any: ${x}, object`, () => assertValidation(() => 
            validate({
                properties: { prop: x } 
            }, { "t_string": "xxx", prop: {} })));
    }

    t.test(`None, number`, () => assertValidation(() => 
        validate({
            properties: { prop: false } 
        }, { "t_string": "xxx", prop: 333 }),
        [{schema: "#/properties/prop", field: "prop"}]));
});