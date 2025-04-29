import { z } from 'zod'

export const schema = z.object({
  files: z.array(
    z.object({
      name: z.string(),
      source: z.string(),
    }),
  ),
  linker: z.string(),
  options: z.object({
    command: z.string(),
    root: z.string(),
    mangler: z.string(),
    sourcemap: z.boolean(),
    imports: z.boolean(),
    condcomp: z.boolean(),
    generics: z.boolean(),
    strip: z.boolean(),
    lower: z.boolean(),
    validate: z.boolean(),
    naga: z.boolean(),
    lazy: z.boolean(),
    keep: z.array(z.string()).optional(),
    features: z.object({}).catchall(z.boolean()),
    runtime: z.boolean(),
    expr: z.string(),
    overrides: z.object({}).catchall(z.string()),
  }),
})

export const filesSchema = schema.shape.files
export const optionsSchema = schema.shape.options

export type State = z.infer<typeof schema>
export type Files = z.infer<typeof filesSchema>
export type Options = z.infer<typeof optionsSchema>
