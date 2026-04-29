
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addToRange, advanceRangeCursor, create, forceCompact, itemFrom, itemTo } from "../src/rangeCollection.js"

// rangeCollection is a private component, but has sufficient complexity to require testing

test('rangeCollection', { concurrency: true }, () => {

    /** Check the integrity of the range */
    function rangeCheck(shouldBeAdded: ((x: number) => boolean), name: string) {
        let i = 0
        let cursor = 0 as "NOT_FOUND" | "EXHAUSTED_CURSOR" | number
        while (typeof cursor === "number") {
            cursor = advanceRangeCursor(range, cursor, i)
            assert(typeof cursor === "number"
                ? shouldBeAdded(i)
                : cursor === "EXHAUSTED_CURSOR"
                    ? i === numbers.length
                    : !shouldBeAdded(i), 
                `CURSOR_NAVIGATION${name}, ${cursor}, ${i}, ${JSON.stringify(range, null, 2)}`)

            i++
        }

        for (let i = 1; i < range.items.length; i++) {
            assert(
                itemTo(range.items[i - 1]) <= itemFrom(range.items[i]),
                `RANGE_CHECK${name}, ${i}, ${JSON.stringify([range.items[i - 1], range.items[i]], null, 2)}`)
        }
    }

    const range = create()

    const numbers = [...Array(500).keys()]
        .map((_, i) => [Math.random(), i])
        .sort((x, y) => x[0] - y[0])
        .map(x => x[1]);

    // add every third number
    const added: Record<number, true> = {}
    for (let n of numbers) {
        if (n % 3 !== 0) continue

        assert(addToRange(range, n), `FIRST_ADD", ${n}`)
        added[n] = true
    }

    rangeCheck(x => !!added[x], "1")

    // add numbers until just before compaction is required
    for (let n of numbers) {
        
        assert.equal(addToRange(range, n), n % 3 !== 0, `SECOND_ADD ${n}`)
        added[n] = true

        if (range.compaction >= 100 && range.compaction / range.items.length >= 0.7) break
    }

    rangeCheck(x => !!added[x], "2")

    const length = range.items.length
    assert(range.compaction > 0)

    // add + force compaction
    for (let n of numbers) {
        if (addToRange(range, n)) {
            added[n] = true
            break
        }
    }

    // TODO:
    // add tests for unevaluated properties

    assert(range.items.length < length, `THIRD_ADD_1 ${range.items.length}, ${range.compaction}`)
    assert(range.compaction <= 1, `THIRD_ADD_2 ${range.items.length}, ${range.compaction}`)

    rangeCheck(x => !!added[x], "3")

    // add everything else
    for (let n of numbers) {
        assert.equal(addToRange(range, n), !added[n], `FOURTH_ADD ${n}, was there already: ${added[n]}`)
        added[n] = true
    }

    forceCompact(range)
    assert.equal(range.items.length, 1, `FINAL_LENGTH ${range.items.length}, ${range.compaction}`)

    rangeCheck(x => x < numbers.length, "4")
});