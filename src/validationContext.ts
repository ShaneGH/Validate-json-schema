
import {
    JsonDocument, Schema
} from "./jsonSchema"

type Nil = null | undefined

export type Anchors = Readonly<{
    ref: Readonly<Record<string, Schema>>,
    dynamicRef: Readonly<Record<string, Schema>>
}>

export type ValidationContext = Readonly<{
    document: JsonDocument
    location: URL
    anchors: Anchors
}>

const defaultBaseUrl = URL.parse("schema-parser://missing-root")!
function resolveUri(uri: string, alternateRoot?: URL | Nil): URL | null {
    const p = URL.parse(uri)
    if (p) return p

    return URL.parse(uri, alternateRoot || defaultBaseUrl)
}

function buildAnchors(schema: Schema, accumulator: Anchors): Anchors {

    if (typeof schema === "boolean") {
        return accumulator
    }

    // TODO: validate anchor name and value
    if (schema.$anchor) {
        if (accumulator.ref[schema.$anchor]) {
            throw new Error("???8")
        }

        accumulator = {
            ...accumulator,
            ref: {
                ...accumulator.ref,
                [schema.$anchor]: schema
            }
        }
    }

    if (schema.$dynamicAnchor) {
        if (accumulator.dynamicRef[schema.$dynamicAnchor]) {
            throw new Error("???9")
        }

        accumulator = {
            ...accumulator,
            dynamicRef: {
                ...accumulator.dynamicRef,
                [schema.$dynamicAnchor]: schema
            }
        }
    }
    
    if (schema.type === "object" && schema.properties) {
        for (let child in schema.properties) {
            accumulator = buildAnchors(schema.properties[child], accumulator)
        }
    }

    if (schema.type === "array" && schema.items) {
        accumulator = buildAnchors(schema.items, accumulator)
    }
    
    return accumulator

}

export function build(document: JsonDocument, retreivalUri?: URL): ValidationContext {
    return {
        document,
        anchors: buildAnchors(document, {ref: {}, dynamicRef: {}}),
        location: document.$id != null && resolveUri(document.$id, retreivalUri)
            || retreivalUri
            || defaultBaseUrl
    };
}