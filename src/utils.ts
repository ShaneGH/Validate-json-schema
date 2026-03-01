
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
    f?: (e: T) => T): T[] | null {

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

