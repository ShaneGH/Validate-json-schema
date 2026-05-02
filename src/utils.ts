import { SchemaType } from "./jsonSchema.js"

export function tpl<T1, T2>(x1: T1, x2: T2): [T1, T2]
export function tpl<T1, T2, T3>(x1: T1, x2: T2, x3: T3): [T1, T2, T3]
export function tpl<T1, T2, T3, T4>(x1: T1, x2: T2, x3: T3, x4: T4): [T1, T2, T3, T4]
export function tpl(): any {
    return [...arguments]
}

export function isReadOnlyArray<T, U>(xs: readonly T[] | (U extends any[] ? never : U)): xs is readonly T[] {
    return Array.isArray(xs)
}

/** Adds items to a mutable accumulator and returns it. 
 * Creates the accumulator if required and there is something to push */
export function pushIfAppropriate<T>(
    accumulator: T[] | null, 
    items: T | readonly T[] | null,
    f?: ((e: T) => T) | null): T[] | null {

    if (items == null) return accumulator

    if (!Array.isArray(items)) {
        const nonArrayItems = items as any   // typescipt having difficulties here
        accumulator = accumulator || []
        accumulator.push(f && f(nonArrayItems) || nonArrayItems)
        return accumulator
    }

    if (!items.length) return accumulator
    accumulator = accumulator || []
    for (let err of items)
        accumulator.push(f && f(err) || err)

    return accumulator
}

export function concat2<T>(xs: readonly T[], ys: readonly T[]): readonly T[] {
    if (!xs.length) return ys
    if (!ys.length) return xs

    return [...xs, ...ys]
}

export function hasAtLeastOneProp<T>(object: NonNullable<T>, props: readonly (keyof T)[]) {
    for (let prop of props) {
        if (object.hasOwnProperty(prop)) return true
    }

    return false
}

export function logAnd<T>(x: T, ...msg: any[]) {
    console.log(x, ...msg)
    return x
}

export function dirAnd<T>(data: T, context: any = null, depth = 10) {
    console.dir({
        data,
        context
    }, {depth})

    return data
}

export function deepEquality(x: any, y: any) {
    if (x === y) return true

    if (x == null 
        || y == null 
        || typeof x !== "object" 
        || typeof y !== "object") return false

    if (Array.isArray(x)) {
        if (!Array.isArray(y)) return false
        if (x.length !== y.length) return false
        for (let i = 0; i < x.length; i++) {
            if (!deepEquality(x[i], y[i])) return false
        }

        return true
    }

    if (Array.isArray(y)) return false

    const xKeys = Object.keys(x)
    const yKeys = Object.keys(y)

    if (xKeys.length !== yKeys.length) return false

    xKeys.sort()
    yKeys.sort()
    for (let i = 0; i < xKeys.length; i++) {
        if (xKeys[i] !== yKeys[i]) return false
        if (!deepEquality(x[xKeys[i]], y[xKeys[i]])) return false
    }

    return true
}

export function checkType(type: SchemaType, data: any) {
    switch (type) {
        case null:
        case undefined: return true

        case "object": return typeof data === "object" && !Array.isArray(data) && data !== null
        case "array": return Array.isArray(data)
        case "string": return typeof data === "string"
        case "number": return typeof data === "number" || typeof data === "bigint"
        case "integer": return Number.isInteger(data)
        case "boolean": return typeof data === "boolean"
        case "null": return data === null
        default: throw new Error("???T")
    }
}

export function* map<T1, T2>(xs: Generator<T1> | T1[], f: (x: T1) => T2) {
    for (const x of xs) {
        yield f(x)
    }
}

export function* filter<T>(xs: Generator<T> | T[], f: (x: T) => boolean) {
    for (const x of xs) {
        if (f(x)) yield x
    }
}

// const trueHash = Math.floor(Math.random() * 2^32)
// const falseHash = Math.floor(Math.random() * 2^32)
// const nullHash = Math.floor(Math.random() * 2^32)
// const emptyArrayHash = Math.floor(Math.random() * 2^32)
// const emptyObjectHash = Math.floor(Math.random() * 2^32)
// const emptyStringHash = Math.floor(Math.random() * 2^32)

// // TODO: quick and dirty
// const stringHash = (function stringHash() {
//     return function (str: string) {
//         let crc = emptyStringHash;
//         for(let i = 0; i < str.length; i++) {
//             crc = hashCombine(crc, str.charCodeAt(i))
//         }

//         return (crc ^ (-1)) >>> 0;
//     };
// }())

// function hashCombine(x: number, y: number) {
//     return (x >>> 8) ^ y
// }

// /** Returns null if x is undefined. 
//  * Complex object (e.g. Regexp, Date are treated like POJOs)
//  * 
//  * Hashes are only comparably valid on this thread, 
//  * i.e. the same data in different processes or workers will hash to different values
//  */
// export function deepHash(x: any): number | null {
//     if (typeof x === "string") return stringHash(x)
//     if (typeof x === "number") return x
//     if (typeof x === "boolean") return x ? trueHash : falseHash
//     if (typeof x === "undefined") return null
//     if (x === null) return nullHash

//     if (Array.isArray(x)) {
//         let h = emptyArrayHash
//         for (const y of x) {
//             h = (h >>> 8) ^ (deepHash(y) || 1) & 0xFF;
//         }

//         return h
//     }

//     let h = emptyObjectHash
//     for (const p in x) {
//         const result = deepHash(x[p])
//         if (result === null) continue

//         h = (h >>> 8) ^ (stringHash(p) || 1) & 0xFF;
//         h = (h >>> 8) ^ (result || 1) & 0xFF;
//     }

//     return h
// }