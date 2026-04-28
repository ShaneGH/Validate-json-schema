
import { test } from 'node:test';
import { failure, success, validate } from "../shared.mjs"

test('any', { concurrency: true }, t => {

    for (const x of [true, {}]) {
        t.test(`Any: ${x}, number`, () => success(() => 
            validate({
                properties: { prop: x } 
            }, { "t_string": "xxx", prop: 333 })));

        t.test(`Any: ${x}, object`, () => success(() => 
            validate({
                properties: { prop: x } 
            }, { "t_string": "xxx", prop: {} })));
    }

    t.test(`None, number`, () => failure(() => 
        validate({
            properties: { prop: false } 
        }, { "t_string": "xxx", prop: 333 }),
        [{schema: "#/properties/prop", field: "prop"}]));
});