
import { test } from 'node:test';
import { shuffledNumbers } from "./shared.mjs"
import { HEAP_EMPTY as MIN_HEAP_EMPTY, pop as minPop, push as minPush, popIndex } from '../src/minHeap.js';
import assert from 'node:assert';

test('heaps', { concurrency: true }, t => {

    function verifyHeap(heap: number[], modifier: number) {
        for (let i = 0; i < heap.length; i++) {
            const l = i * 2 + 1
            const r = l + 1

            if (l >= heap.length) break
            assert(heap[i] * modifier < heap[l] * modifier)
                // , `${i}: ${heap[i]}, ${l}: ${heap[l]}; ${heap}`)

            if (r >= heap.length) continue
            assert(heap[i] * modifier < heap[r] * modifier) 
                // , `${i}: ${heap[i]}, ${r}: ${heap[r]}; ${heap}`)
        }
    }

    function compare(x: number, y: number) {
        return x - y
    }

    t.test("MinHeap", t => {
        t.test("basic", t => {
            const size = 500
            const heap: number[] = []
            for (let i of shuffledNumbers(size)) {
                minPush(heap, compare, i)

                if (i % 10 === 0) verifyHeap(heap, 1)
            }

            assert.equal(heap.length, size)
            verifyHeap(heap, 1)

            for (let i = 0; i < size; i++) {
                assert.equal(minPop(heap, compare), i)
                if (i % 10 === 0) verifyHeap(heap, 1)
            }

            assert.equal(minPop(heap, compare), MIN_HEAP_EMPTY)
            assert.equal(heap.length, 0)
        })

        t.test("onIndexChanged", t => {
            const size = 500
            const heap: number[] = []
            const numbers = shuffledNumbers(size * 2)

            for (let i of numbers.slice(0, size)) {
                const idx = {} as any
                minPush(heap, compare, i, (x, i) => idx[x] = i)

                for (const k in idx) {
                    assert.equal(parseInt(k), heap[idx[k]])
                }
            }

            while (heap.length > 0) {
                const idx = {} as any
                minPop(heap, compare, (x, i) => idx[x] = i)

                for (const k in idx) {
                    assert.equal(parseInt(k), heap[idx[k]])
                }
            }
        })

        t.test("popIndex", t => {
            const size = 500
            const heap: number[] = []
            const numbers = shuffledNumbers(size * 2)

            for (let i of numbers) {
                minPush(heap, compare, i)
            }

            while (heap.length > 0) {
                const i = Math.floor(Math.random() * heap.length)
                const expected = heap[i]

                assert.equal(expected, popIndex(heap, compare, i))
                verifyHeap(heap, 1)
                assert.equal(heap.indexOf(expected), -1,) // `${expected}, ${i}, heap`)
            }
        })
    })
});