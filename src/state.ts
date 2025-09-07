import { z } from 'zod'

export const filesSchema = z.array(
  z.object({
    name: z.string(),
    source: z.string(),
  }),
)

export const optionsSchema = z.object({
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
  keep_root: z.boolean(),
  mangle_root: z.boolean(),
  features: z.object({}).catchall(z.boolean()),
  runtime: z.boolean(),
  expr: z.string(),
  overrides: z.object({}).catchall(z.string()),
  binding_structs: z.boolean(),
})

export const schema = z.object({
  files: filesSchema,
  linker: z.string(),
  options: optionsSchema,
})

export const partialSchema = z
  .object({
    files: filesSchema,
    linker: z.string(),
    options: optionsSchema.partial(),
  })
  .partial()

export type State = z.infer<typeof schema>
export type Files = z.infer<typeof filesSchema>
export type Options = z.infer<typeof optionsSchema>
