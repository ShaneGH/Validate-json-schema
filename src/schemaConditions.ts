import { Schema, ConcreteSchema, TypedSchema } from "./jsonSchema"
import { ValidationContext } from "./validationContext"
import {
    tpl,
    logAnd,
    concat2
} from "./utils.js"

const emptyReadOnlyList: readonly any[] = []
const emptyRefPaths: readonly RefPath[] = []
const emptyStrings: readonly string[] = []

type RefPath = Readonly<{
    type: "ref" | "dynamicRef",
    url: URL
}>

type SchemaPath = 
    | "$ref"
    | "$dynamicRef"
    | "anyOf"
    | "allOf"
    | "oneOf"
    | "not"

function resolveRef(
    context: ValidationContext, 
    ref: string, 
    type: "ref" | "dynamicRef",
    path: readonly string[],
    refPath: readonly RefPath[]): SchemaCondition {

    const loc = URL.parse(ref, context.location)
    if (!loc) throw new Error("???2")

    if (loc.protocol !== context.location.protocol
        || loc.host !== context.location.host
        || loc.port !== context.location.port
        || loc.pathname !== context.location.pathname
    ) throw new Error("???3")

    if (refPath) {
        for (const ref of refPath) {
            if (ref.type == type && ref.url.toString() === loc.toString()) {
                throw new Error("??? circular reference")
            }
        }
    }

    refPath = [...(refPath || emptyRefPaths), { type: type, url: loc }]

    const anchorName = /^#([A-Za-z_][-A-Za-z0-9._]*)$/.exec(loc.hash)?.[1]
    if (anchorName) {
        const anchor = context.anchors[type][anchorName]
        if (!anchor) {
            throw new Error("???4")
        }

        return _build(context, anchor, [...path, loc.hash], refPath)
    }

    if (loc.hash.length > 1 && loc.hash[1] !== "/") {
        throw new Error("???5")
    }

    const parts = loc.hash.substring(2).split("/")
    let target = context.document as any
    for (let part of parts) {
        target = target[part]
        if (target == null) {
            throw new Error("???6")
        }
    }

    return _build(context, target, [...path, loc.hash], refPath)
}

export type AllOfCondition = Readonly<{
    $type: "allOf"
    conditions: readonly SchemaCondition[]
}>
function allOf(schemaCondition: AllOfCondition, f: (x: TypedSchema) => readonly SchemaError[]): readonly SchemaError[] {
    return schemaCondition.conditions.reduce((s, x) => {
        const result = execute(x, f)
        if (result.length) {
            if (s == null) s = [...result]
            else s.push(...result)
        }

        return s
    }, null as SchemaError[] | null) || emptyReadOnlyList
}

const anyOfStrings: readonly string[] = ["anyOf"]
export type AnyOfCondition = Readonly<{
    $type: "anyOf"
    conditions: readonly SchemaCondition[]
}>
function anyOf(schemaCondition: AnyOfCondition, f: (x: TypedSchema) => readonly SchemaError[]): readonly SchemaError[] {
    let errs: SchemaError[] | null = null
    for (let x of schemaCondition.conditions) {
        const result = execute(x, f)
        if (!result.length) return result

        errs = errs || []
        errs.push(...result)
    }
    
    return errs || [{
        fieldPath: emptyStrings,
        schemaPath: anyOfStrings,
        message: "No schemas match in anyOf condition"
    }]
}

export type OneOfCondition = Readonly<{
    $type: "oneOf"
    conditions: readonly SchemaCondition[]
}>
const oneOfStrings: readonly string[] = ["oneOf"]
function oneOf(schemaCondition: OneOfCondition, f: (x: TypedSchema) => readonly SchemaError[]): readonly SchemaError[] {
    const [falseCount, errors] = schemaCondition.conditions.reduce((s, x) => {
        const result = execute(x, f)
        if (result.length) {
            s[0] += 1
            if (s[1] == null) s[1] = [...result]
            else s[1].push(...result)
        }

        return s
    }, tpl(0, null as SchemaError[] | null))

    const trueCount = schemaCondition.conditions.length - falseCount
    if (trueCount === 1) return emptyReadOnlyList

    return [{
            fieldPath: emptyStrings,
            schemaPath: oneOfStrings,
            message: `Incorrect schema matches in oneOf condition: matched ${trueCount}, not matched ${falseCount}`
        },
        ...(errors || emptyReadOnlyList)
    ]
}

const notStrings: readonly string[] = ["not"]
export type NotCondition = Readonly<{
    $type: "not"
    condition: SchemaCondition
}>
function not(schemaCondition: NotCondition, f: (x: TypedSchema) => readonly SchemaError[]): readonly SchemaError[] {
    const result = execute(schemaCondition.condition, f)
    return result.length && emptyReadOnlyList || [{
        fieldPath: emptyStrings,
        schemaPath: notStrings,
        message: "Schema matches in not condition"
    }]
}

export type Leaf = Readonly<{
    $type: "leaf"
    path: readonly string[]
    schema: ConcreteSchema
}>

export type SchemaError = Readonly<{
    fieldPath: readonly string[]
    schemaPath: readonly string[]
    message: string
}>

export type SchemaCondition = 
    | Leaf
    | AllOfCondition
    | AnyOfCondition
    | OneOfCondition
    | NotCondition

function prependSchemaPath(errors: readonly SchemaError[], schemaPath: readonly string[]): readonly SchemaError[] {
    if (!errors.length || !schemaPath.length) return errors

    return errors.map(x => ({
        ...x,
        schemaPath: [...schemaPath, ...x.schemaPath]
    }))
}

export function execute(
    schemaCondition: SchemaCondition,
    f: (x: TypedSchema) => readonly SchemaError[]): readonly SchemaError[] {

    if (schemaCondition.$type === "anyOf") {
        return anyOf(schemaCondition, f)
    }

    if (schemaCondition.$type === "allOf") {
        return allOf(schemaCondition, f)
    }

    if (schemaCondition.$type === "oneOf") {
        return oneOf(schemaCondition, f)
    }

    if (schemaCondition.$type === "not") {
        return not(schemaCondition, f)
    }

    return prependSchemaPath(f(schemaCondition.schema), schemaCondition.path)
}

// /** Use quick pool of single paths -or- build a new path */
// function appendPath(path: readonly string[], next: SchemaPath): readonly string[] {
//     return (!path.length && cachedPaths[next]) || [...path, next]
// }

// const dynamicRefStrings: readonly string[] = ["$dynamicRef"]
// const refStrings: readonly string[] = ["$ref"]
// const allOfStrings: readonly string[] = ["allOf"]
function _build(context: ValidationContext, schema: Schema, path: readonly string[], refPath: readonly RefPath[]): SchemaCondition {
    if (typeof schema === "boolean") return {$type: "leaf", path, schema: schema}

    let topLevel: SchemaCondition | SchemaCondition[] = { $type: "leaf", path, schema }

    if (schema.$ref) {
        if (!Array.isArray(topLevel)) topLevel = [topLevel]
        topLevel.push(resolveRef(context, schema.$ref, "ref", path, refPath))
    }

    if (schema.$dynamicRef) {
        if (!Array.isArray(topLevel)) topLevel = [topLevel]
        topLevel.push(resolveRef(context, schema.$dynamicRef, "dynamicRef", path, refPath))
    }

    if (schema.allOf && schema.allOf.length) {
        if (!Array.isArray(topLevel)) topLevel = [topLevel]
        topLevel.push(...schema.allOf.map((x, i) => _build(context, x, [...path, "allOf", i.toString()], refPath)))
    }

    if (schema.anyOf) {
        if (!Array.isArray(topLevel)) topLevel = [topLevel]

        topLevel.push({
            $type: "anyOf",
            conditions: schema.anyOf.map((x, i) => _build(context, x, [...path, "anyOf", i.toString()], refPath))
        })
    }

    if (schema.oneOf) {
        if (!Array.isArray(topLevel)) topLevel = [topLevel]

        topLevel.push({
            $type: "oneOf",
            conditions: schema.oneOf.map((x, i) => _build(context, x, [...path, "oneOf", i.toString()], refPath))
        })
    }

    if (schema.not) {
        if (!Array.isArray(topLevel)) topLevel = [topLevel]

        topLevel.push({
            $type: "not",
            condition: _build(context, schema.not, notStrings, refPath)
        })
    }

    if (Array.isArray(topLevel)) {
        return {
            $type: "allOf",
            conditions: topLevel
        }
    }

    return topLevel
}

export function build(context: ValidationContext, schema: Schema): SchemaCondition {
    return _build(context, schema, emptyStrings, emptyRefPaths)
}

