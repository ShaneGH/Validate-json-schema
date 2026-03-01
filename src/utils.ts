import { SchemaType } from "./jsonSchema"

export function tpl<T1, T2>(x: T1, y: T2): [T1, T2] {
    return [x, y]
}

export function isReadOnlyArray<T, U>(xs: readonly T[] | (U extends any[] ? never : U)): xs is readonly T[] {
    return Array.isArray(xs)
}

/** Adds items to a mutable accumulator and returns it. 
 * Creates the accumulator if required and there is something to push */
export function pushIfAppropriate<T>(
    accumulator: T[] | null, 
    errors: T | readonly T[] | null,
    f?: ((e: T) => T) | null): T[] | null {

    if (errors == null) return accumulator

    if (!Array.isArray(errors)) {
        const nonArrayErr = errors as any   // typescipt having difficulties here
        accumulator = accumulator || []
        accumulator.push(f && f(nonArrayErr) || nonArrayErr)
        return accumulator
    }

    if (!errors.length) return accumulator
    accumulator = accumulator || []
    for (let err of errors)
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