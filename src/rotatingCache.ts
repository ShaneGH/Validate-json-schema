import { pop, popIndex, push} from "./minHeap.js"

type EvictionTracker = {
    key: string
    lastAccessed: number
    heapIndex?: number
}

type CacheItem<T> = {
    data: T
    evictionTracker: EvictionTracker
}

export type RotatingCache<T> = {
    items: Record<string, CacheItem<T>>
    evictionsHeap: EvictionTracker[]
    maxSize: number
}

function compareEvictions(x: EvictionTracker, y: EvictionTracker) {
    return x.lastAccessed - y.lastAccessed
}

export function create<T>(maxSize: number): RotatingCache<T> {
    return {
        maxSize,
        items: {},
        evictionsHeap: []
    }
}

function setIndex(x: EvictionTracker, i: number) {
    x.heapIndex = i
}

const rotatingFraction = (function () {
    const atom = 1 / (2^32)
    let fraction = atom

    return function() {
        fraction += atom
        if (fraction >= 1) fraction = atom
        return fraction
    }
}());

export function getOrPut<T>(cache: RotatingCache<T>, key: string, data: (k: string) => T): T;
export function getOrPut<T, S>(cache: RotatingCache<T>, key: string, data: (state: S, k: string) => T, state: S): T;
export function getOrPut<T, S>(cache: RotatingCache<T>, key: string, data: Function, state?: S): T {
    const result = get(cache, key)
    if (result !== NOT_FOUND) return result

    const built = arguments.length == 4 ? data(state, key) : data(key)
    put(cache, key, built)
    return built
}

export function put<T>(cache: RotatingCache<T>, key: string, data: T) {

    if (cache.items[key]) {
        cache.items[key].data = data
        return
    } 
    
    if (cache.evictionsHeap.length >= cache.maxSize) {
        const popped = pop(cache.evictionsHeap, compareEvictions, setIndex)
        if (typeof popped !== "symbol") delete cache.items[popped.key]
    }

    const evictionTracker: EvictionTracker = {
        key,
        lastAccessed: cache.evictionsHeap.length > 0
            // put the item half way down the eviction list
            ? cache.evictionsHeap[Math.floor(cache.evictionsHeap.length / 2)].lastAccessed
            : new Date().getTime()
    }

    push(cache.evictionsHeap, compareEvictions, evictionTracker, setIndex)
    cache.items[key] = {
        evictionTracker,
        data
    }
}

export const NOT_FOUND: unique symbol = Symbol("NOT_FOUND")
export function get<T>(cache: RotatingCache<T>, key: string): T | (typeof NOT_FOUND) {
    const found = cache.items[key]
    if (found === undefined) return NOT_FOUND

    if (found.evictionTracker.heapIndex === undefined) {
        throw new Error("Internal error")
    }

    const tracker = popIndex(cache.evictionsHeap, compareEvictions, found.evictionTracker.heapIndex, setIndex)
    console.assert(tracker == found.evictionTracker)

    // rotatingFraction allows for microsecond accuracy
    tracker.lastAccessed = new Date().getTime() + rotatingFraction()
    push(cache.evictionsHeap, compareEvictions, tracker, setIndex)

    return found.data
}