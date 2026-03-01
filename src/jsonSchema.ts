export type Draft04 = "http://json-schema.org/draft-04/schema#"

export type SchemaVersions =
    | Draft04

export type Metadata = Readonly<Partial<{
    "$comment": string
    "$defs": Record<string, Schema>
    "$anchor": string
    "$dynamicAnchor": string
}>>

export type Extensions = Readonly<Partial<{
    "anyOf": readonly Schema[]
    "allOf": readonly Schema[]
    "oneOf": readonly Schema[]
    "not": Schema
}>>

export type SchemaType = "object" | "array" | "string" | "number" | "integer" | "boolean" | "null"

export type Typed = Readonly<Partial<{
    type: SchemaType | readonly SchemaType[]
}>>

export type Enum = Readonly<Partial<{
    enum: readonly any[]
}>>

export type Const = Readonly<Partial<{
    const: any
}>>

export const ObjectSchemaTemplate = ["properties", "additionalProperties", "patternProperties", "required", "unevaluatedProperties"] as const
export type ObjectSchema = Readonly<Partial<Pick<{
    "properties": Record<string, Schema>,
    "additionalProperties": Schema,
    "unevaluatedProperties": Schema,
    "patternProperties": Record<string, Schema>,
    "required": readonly string[]
}, typeof ObjectSchemaTemplate[number]>>>

export const ArraySchemaTemplate = ["items", "prefixItems", "contains", "unevaluatedItems"] as const
export type ArraySchema = Readonly<Partial<Pick<{
    "items": Schema
    "prefixItems": readonly Schema[]
    "contains": Schema,
    "unevaluatedItems": Schema,
}, typeof ArraySchemaTemplate[number]>>>

export const StringSchemaTemplate = ["maxLength", "minLength", "pattern"] as const
export type StringSchema =  Readonly<Partial<Pick<{
    maxLength: number
    minLength: number
    pattern: string
}, typeof StringSchemaTemplate[number]>>>

export const BooleanSchemaTemplate = [] as const
export type BooleanSchema =  Readonly<Partial<Pick<{}, typeof BooleanSchemaTemplate[number]>>>

export const NumericSchemaTemplate = ["multipleOf", "maximum", "exclusiveMinimum", "minimum", "exclusiveMaximum"] as const
export type NumericSchema =  Readonly<Partial<Pick<{
    "multipleOf": number,
    "maximum": number, 
    "exclusiveMinimum": number,
    "minimum": number,
    "exclusiveMaximum": number,
}, typeof NumericSchemaTemplate[number]>>>

export const NullSchemaTemplate = [] as const
export type NullSchema =  Readonly<Partial<Pick<{}, typeof NullSchemaTemplate[number]>>>

export const RefSchemaTemplate = ["$ref"] as const
export type RefSchema = Readonly<Partial<Pick<{
    "$ref": string
}, typeof RefSchemaTemplate[number]>>>

export const DynamicRefSchemaTemplate = ["$dynamicRef"] as const
export type DynamicRefSchema = Readonly<Partial<Pick<{
    "$dynamicRef": string
}, typeof DynamicRefSchemaTemplate[number]>>>

export type TypedSchema = 
    & Typed 
    & Enum
    & Const
    & ObjectSchema
    & ArraySchema
    & StringSchema
    & NumericSchema
    & BooleanSchema
    & NullSchema

export type TypedSchemaWithMedatata = 
    & TypedSchema
    & Metadata

export type ConcreteSchema = 
    | TypedSchemaWithMedatata
    | boolean

export type Schema = 
    & ConcreteSchema
    & Extensions
    & RefSchema
    & DynamicRefSchema

export type JsonDocumentMetadata = Readonly<Partial<{
    "$id": string,
    "$schema": string,
    "$vocabulary": Readonly<Record<string, any>>
}>> & TypedSchemaWithMedatata

// https://json-schema.org/draft/2020-12/meta/core
// https://json-schema.org/understanding-json-schema/structuring
export type JsonDocument = 
    // | RefSchema TODO
    | JsonDocumentMetadata