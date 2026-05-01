
export type Compare<T> = (x: T, y: T) => number
export type OnIndexChange<T> = (x: T, newIndex: number) => void

function smallest<T>(compare: Compare<T>, ...values: T[]): number;
function smallest<T>(compare: Compare<T>): number {
    if (arguments.length === 1) return -1

    let smallest = 1
    for (let i = 2; i < arguments.length; i++) {
        if (compare(arguments[smallest], arguments[i]) > 0) {
            smallest = i
        }
    }

    return smallest - 1
}

function bubbleDown<T>(heap: T[], compare: Compare<T>, index: number, onIndexChange: OnIndexChange<T> | undefined)  {

    const l = index * 2 + 1
    if (l >= heap.length) return

    const r = l + 1
    const smallestVal = r < heap.length
        ? smallest(compare, heap[index], heap[l], heap[r])
        : smallest(compare, heap[index], heap[l])

    switch (smallestVal) {
        case 0: 
            return
        case 1: 
            swap(heap, index, l, onIndexChange)
            bubbleDown(heap, compare, l, onIndexChange)
            return
        case 2: 
            swap(heap, index, r, onIndexChange)
            bubbleDown(heap, compare, r, onIndexChange)
            return
        default: throw new Error()
    }
}

function swap<T>(xs: T[], i: number, j: number, onIndexChange: OnIndexChange<T> | undefined) {
    const tmp = xs[i]
    xs[i] = xs[j]
    xs[j] = tmp

    if(onIndexChange) {
        onIndexChange(xs[j], j)
        onIndexChange(xs[i], i)
    }
}

function bubbleUp<T>(heap: T[], compare: Compare<T>, index: number, onIndexChange: OnIndexChange<T> | undefined)  {
    const parentI = index === 0 ? null : Math.floor((index - 1) / 2)

    if (parentI == null) 
        return

    if (compare(heap[parentI], heap[index]) <= 0)
        return

    swap(heap, index, parentI, onIndexChange)
    bubbleUp(heap, compare, parentI, onIndexChange)
}

export function push<T>(heap: T[], compare: Compare<T>, x: T, onIndexChange?: OnIndexChange<T>)  {
    heap.push(x)
    if(onIndexChange) onIndexChange(x, heap.length - 1)

    bubbleUp(heap, compare, heap.length - 1, onIndexChange)
}

export const HEAP_EMPTY: unique symbol = Symbol("HEAP_EMPTY")
export function pop<T>(heap: T[], compare: Compare<T>, onIndexChange?: OnIndexChange<T>): T | (typeof HEAP_EMPTY)  {
    return heap.length === 0
        ? HEAP_EMPTY
        : popIndex(heap, compare, 0, onIndexChange)
}

export function popIndex<T>(heap: T[], compare: Compare<T>, index: number, onIndexChange?: OnIndexChange<T>): T  {
    if (index >= heap.length) throw new Error("Index out of bounds")

    const output = heap[index]
    if (heap.length === index + 1) {
        heap.pop()
        return output
    }

    heap[index] = heap.pop()!
    if (onIndexChange) {
        onIndexChange(heap[index], index)
    }
    
    if (compare(output, heap[index]) < 0) {
        bubbleDown(heap, compare, index, onIndexChange)
    } else {
        bubbleUp(heap, compare, index, onIndexChange)
    }

    return output
    
}