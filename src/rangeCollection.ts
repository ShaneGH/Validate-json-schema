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
    return itemTo(item1) == itemFrom(item2)
}

function tryAdd(x: number, range: Range, index: number): "ADDED" | "ALREADY_EXISTS" | number {
    
    const cmp = compare(x, range.items[index])
    if (cmp > 0) {
        if (index < range.items.length - 1 && compare(x, range.items[index + 1]) === 0) {
            return "ALREADY_EXISTS"
        }

        if (cmp > 1) return cmp

        range.items[index] = { from: itemFrom(range.items[index]), to: x + 1 }

        if (index < range.items.length - 1 && adjacent(range.items[index], range.items[index + 1])) {
            range.compaction += 1
        }

        //return logAnd("ADDED")
        return "ADDED"
    }

    //if (cmp === 0) return logAnd("ALREADY_EXISTS")
    //if (cmp === 0) 

    if (cmp < 0) {
        if (index > 0 && compare(x, range.items[index - 1]) === 0) {
            return "ALREADY_EXISTS"
        }

        if (cmp < -1) return cmp

        range.items[index] = { from: x, to: itemTo(range.items[index]) }
        if (index > 0 && adjacent(range.items[index - 1], range.items[index])) {
            range.compaction += 1
        }

        //return logAnd("ADDED")
        return "ADDED"
    }

    //return logAnd(cmp)
    return "ALREADY_EXISTS"
}

function _addToRange(range: Range, needle: number, start: number, end: number): boolean | number {
    
    if (start >= end || start < 0 || end > range.items.length) return start

    const pivotI = start + Math.floor((end - start) / 2)

    const cmp = tryAdd(needle, range, pivotI)
    switch (cmp) {
        case "ADDED": return true
        case "ALREADY_EXISTS": return false
    }

    if (cmp < 0) return _addToRange(range, needle, start, pivotI)
    if (cmp > 0) return _addToRange(range, needle, pivotI + 1, end)
    return false
}

export function forceCompact(range: Range) {
    for (let i = 1; i < range.items.length; i++) {
        if (!adjacent(range.items[i - 1], range.items[i]))
            continue

        let j = i + 1
        for (; j < range.items.length; j++) {
            if (!adjacent(range.items[j - 1], range.items[j]))
                break
        }

        range.items[i - 1] = {
            from: itemFrom(range.items[i - 1]),
            to: itemTo(range.items[j - 1])
        }

        range.items.splice(i, j - 1)
    }

    range.compaction = 0
}

export function create(): Range {
    return {items: [], compaction: 0}
}

/** Returns true if inserted, false if it is already in the list */
export function addToRange(range: Range, needle: number): boolean {
    
    if (!range.items.length) {
        range.items.push(needle)
        return true
    }

    if (range.compaction >= 100 
        && range.compaction / range.items.length >= 0.7) {
        forceCompact(range)
    }

    switch (tryAdd(needle, range, range.items.length - 1)) {
        case "ADDED": return true
        case "ALREADY_EXISTS": return false
    }

    let result = _addToRange(range, needle, 0, range.items.length)
    if (typeof result === "boolean") return result

    result = Math.max(0, Math.min(result, range.items.length - 1))
    //console.log("### fst", needle, result)
    while (result > 0 && compare(needle, range.items[result]) < 0) result -= 1
    //console.log("### inter", needle, result)
    while (result < range.items.length && compare(needle, range.items[result]) > 0) result += 1
    
    //console.log("###", needle, result, result < range.items.length && range.items[result], result < range.items.length && compare(needle, range.items[result]))
    range.items.splice(result, 0, needle)
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