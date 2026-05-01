import { logAnd } from "./utils.js"

type RangeItem = {
    from: number
    to: number
} | number

export type Range = {
    compaction: number
    items: RangeItem[]
}

/**
 * Returns
 *  0 if the number is in the range
 *  Otherwise, how far outside the range it is. 
 *      Negative numbers are before the range
 */
function compare(x: number, rangeItem: RangeItem) {
    if (typeof rangeItem === "number" || typeof rangeItem === "bigint") {
        return x - rangeItem
    }

    let tmp = x - rangeItem.from
    if (tmp < 0) return tmp

    tmp = x - rangeItem.to + 1
    if (tmp > 0) return tmp
    
    return 0
}

export function itemFrom(item: RangeItem) {
    return typeof item === "number" || typeof item === "bigint" ? item : item.from
}

export function itemTo(item: RangeItem) {
    return typeof item === "number" || typeof item === "bigint" ? item + 1 : item.to
}

function adjacent(item1: RangeItem, item2: RangeItem) {
    return itemTo(item1) === itemFrom(item2)
}

function findBestPosition(range: Range, needle: number, start: number, end: number): number {
   
    if (start >= end) return start

    const pivotI = start + Math.floor((end - start) / 2)
    const cmp = compare(needle, range.items[pivotI])

    if (cmp < -1) return findBestPosition(range, needle, start, pivotI)
    if (cmp > 1) return findBestPosition(range, needle, pivotI + 1, end)

    if (pivotI > 0 && !compare(needle, range.items[pivotI - 1]))
        return pivotI - 1

    if (pivotI < range.items.length - 1 && !compare(needle, range.items[pivotI + 1]))
        return pivotI + 1

    return pivotI
}

function addAt(x: number, range: Range, index: number) {

    const addResult = _addAt(x, range, index)

    if ((addResult === "BEFORE" || addResult === "BOTH")
        && index > 0 
        && adjacent(range.items[index - 1], range.items[index]))
        range.compaction += 1

    if ((addResult === "AFTER" || addResult === "BOTH")
        && index < range.items.length - 1 
        && adjacent(range.items[index], range.items[index + 1]))
        range.compaction += 1
}

function _addAt(x: number, range: Range, index: number): "NONE" | "AFTER" | "BEFORE" | "BOTH" {
    if (index >= range.items.length) {
        range.items.push(x)
        return "AFTER"
    }

    const cmp = compare(x, range.items[index])
    
    if (cmp === 0) return "NONE"

    if (cmp === -1) {
        range.items[index] = {
            from: x,
            to: itemTo(range.items[index])
        }

        return "BEFORE"
    }

    if (cmp === 1) {
        range.items[index] = {
            from: itemFrom(range.items[index]),
            to: x + 1
        }

        return "AFTER"
    }

    if (cmp < -1) {
        if (index && compare(x, range.items[index - 1]) <= 0) throw new Error("Invalid add position")
    } else {
        // cmp > 1
        if (index < range.items.length - 1 && compare(x, range.items[index + 1]) >= 0) throw new Error("Invalid add position")
    }

    range.items.splice(index, 0, x)
    return "BOTH"
}

export function forceCompact(range: Range) {
    for (let i = 0; i < range.items.length - 1; i++) {
        if (!adjacent(range.items[i], range.items[i + 1]))
            continue

        let j = i + 1
        for (; j < range.items.length - 1; j++) {
            if (!adjacent(range.items[j], range.items[j + 1]))
                break
        }

        range.items[i] = {
            from: itemFrom(range.items[i]),
            to: itemTo(range.items[j])
        }

        range.items.splice(i + 1, j - i)
    }

    range.compaction = 0
}

export function create(): Range {
    return {items: [], compaction: 0}
}

export function contains(range: Range, needle: number): boolean {
    const pos = findBestPosition(range, needle, 0, range.items.length)
    if (pos >= range.items.length) return false

    return compare(needle, range.items[pos]) === 0

}

/** Returns true if inserted, false if it is already in the list */
export function addToRange(range: Range, needle: number): boolean {
    
    if (!range.items.length) {
        range.items.push(needle)
        return true
    }

    if (range.compaction >= 100 
        && range.compaction / range.items.length >= 0.7)
        forceCompact(range)

    const pos = findBestPosition(range, needle, 0, range.items.length)
    if (pos < range.items.length && !compare(needle, range.items[pos])) return false

    addAt(needle, range, pos)
    return true
}

/** Search from the cursor value onwards for the needle
 * Will not search backwards
 * The returned number is the next cursor value
 */
export function advanceRangeCursor(
    range: Range, cursor: number, needle: number): "NOT_FOUND" | "EXHAUSTED_CURSOR" | number {
    
    for (; cursor < range.items.length; cursor++) {
        const cmp = compare(needle, range.items[cursor])
        if (cmp === 0) return cursor
        if (cmp < 0) return "NOT_FOUND"
    }
    
    return "EXHAUSTED_CURSOR"
}

export function *enumerateRangeItem(range: RangeItem | number) {
    if (typeof range === "number") {
        yield range
        return
    }

    for (let i = range.from; i < range.to; i++) {
        yield i
    }

}

export function* enumerate(range: Range) {
    for (let i = 0; i < range.items.length; i++) {
        for (let x of enumerateRangeItem(range.items[i])) {
            yield x
        }
    }
}

export function* enumerateMissing(range: Range, start: number, endExclusive: number) {
    
    let beforeLast = start
    for (let i = 0; i < range.items.length; i++) {
        const itemStart = itemFrom(range.items[i])
        for (let j = beforeLast; j < itemStart; j++) {
            yield j
        }

        beforeLast = itemTo(range.items[i])
    }

    for (let i = beforeLast; i < endExclusive; i++) {
        yield i
    }
}