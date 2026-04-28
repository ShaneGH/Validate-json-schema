
import { test } from 'node:test';
import { failure, freakyObject, success, validate } from "../shared.mjs"
import { JsonDocument } from '../../src/jsonSchema.js';
import { tpl } from '../../src/utils.js';

test('const/enum', { concurrency: true }, t => {

    for (let [name, constraint] of [
        tpl("enum", [null, 1, "5", {...freakyObject}]),
        tpl("const", {...freakyObject})
    ]) {
        test(name, { concurrency: true }, t => {

            const schema: Partial<JsonDocument> = {
                properties: {
                    "prop": {
                        [name]: constraint
                    }
                }
            }

            if (!Array.isArray(constraint))
                constraint = [constraint]

            for (let prop of constraint) {
                t.test(`Success: ${JSON.stringify(prop)}`, () => success(() => 
                    validate(schema, { prop })));
            }

            for (let prop of [undefined, 2, "55"]) {
                t.test(`Failure: ${JSON.stringify(prop)}`, () => failure(() => 
                    validate(schema, { prop }),
                    {schema: `#/properties/prop/${name}`, field: "prop"}));
            }

            t.test("deep", t => {

                for (const f of [
                    (x: any) => {x.x = 2},
                    (x: any) => {x.ppp = 2},
                    (x: any) => {x.y[0] = 2},
                    (x: any) => {x.y.push(5)},
                    (x: any) => {x.y.pop()},
                    (x: any) => {delete x.z}
                ]) {
                    const cpy = JSON.parse(JSON.stringify(freakyObject))
                    f(cpy)

                    t.test(
                        `Failure: ${JSON.stringify(cpy)}`, 
                        () => failure(() => validate(
                            schema, 
                            { "t_string": "xxx", "prop": cpy }),
                            {schema: `#/properties/prop/${name}`, field: "prop"}))
                }
            })
        });

    }

})