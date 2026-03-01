import { Schema, ConcreteSchema, TypedSchema } from "./jsonSchema"
import { ValidationContext } from "./validationContext"
import { tpl, logAnd, dirAnd, pushIfAppropriate, isReadOnlyArray } from "./utils.js"

const emptyReadOnlyList: readonly any[] = []
const emptyRefPaths: readonly RefPath[] = []
const emptyStrings: readonly string[] = []

type RefPath = Readonly<{
    type: "ref" | "dynamicRef",
    url: URL
}>

export type RefCondition = Readonly<{
    $type: "ref"
    name: string,
    condition: SchemaCondition
}>
function resolveRef(
    context: ValidationContext, 
    ref: string, 
    type: "ref" | "dynamicRef",
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

        return {
            $type: "ref",
            name: loc.hash,
            condition: _build(context, anchor, refPath)
        }
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

    return {
        $type: "ref",
        name: loc.hash,
        condition: _build(context, target, refPath)
    }
}

function ref(schemaCondition: RefCondition, f: ExecuteFunction) {
    return prependSchemaPath(
        execute(schemaCondition.condition, f),
        schemaCondition.name)
}

export type RootCondition = Readonly<{
    $type: "root"
    conditions: readonly SchemaCondition[]
}>
function root(schemaCondition: RootCondition, f: ExecuteFunction): readonly SchemaError[] {
    return _allOf(schemaCondition.conditions, f, false)
}

export type AllOfCondition = Readonly<{
    $type: "allOf"
    conditions: readonly SchemaCondition[]
}>
function _allOf(schemaConditions: readonly SchemaCondition[], f: ExecuteFunction, addPathToErrors = true): readonly SchemaError[] {
    return schemaConditions.reduce((s, x, i) => {
        const result = execute(x, f)
        if (!result.length) return s

        s = pushIfAppropriate(s, result, (addPathToErrors || null) && (e => ({
            ...e,
            schemaPath: ["allOf", i.toString(), ...e.schemaPath]
        })))

        return s
    }, null as SchemaError[] | null) || emptyReadOnlyList
}

function allOf(schemaCondition: AllOfCondition, f: ExecuteFunction): readonly SchemaError[] {
    return _allOf(schemaCondition.conditions, f, true)
}

const anyOfString = "anyOf"
const anyOfStrings: readonly string[] = [anyOfString]
export type AnyOfCondition = Readonly<{
    $type: "anyOf"
    conditions: readonly SchemaCondition[]
}>
function anyOf(schemaCondition: AnyOfCondition, f: ExecuteFunction): readonly SchemaError[] {
    let errs: SchemaError[] | null = null
    for (let i = 0; i < schemaCondition.conditions.length; i++) {
        const result = execute(schemaCondition.conditions[i], f)
        if (!result.length) return result

        errs = pushIfAppropriate(errs, result, e => ({
            ...e,
            schemaPath: [anyOfString, i.toString(), ...e.schemaPath]
        }))
    }
    
    return errs || [{
        fieldPath: emptyStrings,
        schemaPath: anyOfStrings,
        message: "No schemas match in anyOf condition"
    }]
}

const oneOfString = "oneOf"
const oneOfStrings: readonly string[] = [oneOfString]
export type OneOfCondition = Readonly<{
    $type: "oneOf"
    conditions: readonly SchemaCondition[]
}>
function oneOf(schemaCondition: OneOfCondition, f: ExecuteFunction): readonly SchemaError[] {
    const [falseCount, errors] = schemaCondition.conditions.reduce((s, x, i) => {
        const result = execute(x, f)
        if (!result.length) return s
        
        s[0] += 1
        s[1] = pushIfAppropriate(s[1], result, e => ({
            ...e,
            schemaPath: [oneOfString, i.toString(), ...e.schemaPath]
        }))

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
function not(schemaCondition: NotCondition, f: ExecuteFunction): readonly SchemaError[] {
    const result = execute(schemaCondition.condition, f)
    return result.length && emptyReadOnlyList || [{
        fieldPath: emptyStrings,
        schemaPath: notStrings,
        message: "Schema matches in not condition"
    }]
}

export type Leaf = Readonly<{
    $type: "leaf"
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
    | RootCondition
    | RefCondition

function prependSchemaPath(
    errors: readonly SchemaError[], 
    schemaPath: readonly string[] | string): readonly SchemaError[] {

    if (typeof schemaPath !== "string" && !errors.length || !schemaPath.length) return errors

    return errors.map(typeof schemaPath === "string"
        ? (x => ({
            ...x,
            schemaPath: [schemaPath, ...x.schemaPath]
        }))
        : (x => ({
            ...x,
            schemaPath: [...schemaPath, ...x.schemaPath]
        })))
}

type ExecuteFunction = (x: TypedSchema) => readonly SchemaError[]

export function execute(
    schemaCondition: SchemaCondition,
    f: ExecuteFunction): readonly SchemaError[] {

    switch (schemaCondition.$type) {
        case "anyOf": return anyOf(schemaCondition, f)
        case "allOf": return allOf(schemaCondition, f)
        case "oneOf": return oneOf(schemaCondition, f)
        case "not": return not(schemaCondition, f)
        case "root": return root(schemaCondition, f)
        case "ref":return ref(schemaCondition, f)
        default: return f(schemaCondition.schema)
    }
}

/** Converts the conditions to an array if required, pushes the new condition and returns
 * the new or old array
 */
function pushCondition(conditions: SchemaCondition | SchemaCondition[], condition: SchemaCondition) {
    if (!Array.isArray(conditions)) conditions = [conditions]
    conditions.push(condition)
    return conditions
}

function _build(context: ValidationContext, schema: Schema, refPath: readonly RefPath[]): SchemaCondition {
    if (typeof schema === "boolean") return {$type: "leaf", schema: schema}

    let topLevel: SchemaCondition | SchemaCondition[] = { $type: "leaf", schema }

    if (schema.$ref) {
        topLevel = pushCondition(topLevel, resolveRef(context, schema.$ref, "ref", refPath))
    }

    if (schema.$dynamicRef) {
        topLevel = pushCondition(topLevel, resolveRef(context, schema.$dynamicRef, "dynamicRef", refPath))
    }

    if (schema.allOf && schema.allOf.length) {
        topLevel = pushCondition(topLevel, {
            $type: "allOf",
            conditions: schema.allOf.map(x => _build(context, x, refPath))
        })
    }

    if (schema.anyOf) {
        topLevel = pushCondition(topLevel, {
            $type: "anyOf",
            conditions: schema.anyOf.map(x => _build(context, x, refPath))
        })
    }

    if (schema.oneOf) {
        topLevel = pushCondition(topLevel, {
            $type: "oneOf",
            conditions: schema.oneOf.map(x => _build(context, x, refPath))
        })
    }

    if (schema.not) {
        topLevel = pushCondition(topLevel, {
            $type: "not",
            condition: _build(context, schema.not, refPath)
        })
    }

    if (Array.isArray(topLevel)) {
        return {
            $type: "root",
            conditions: topLevel
        }
    }

    return topLevel
}

export function build(context: ValidationContext, schema: Schema): SchemaCondition {
    return _build(context, schema, emptyRefPaths)
}

