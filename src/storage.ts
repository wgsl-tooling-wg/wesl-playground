import { Accessor, createEffect, createSignal, Setter } from 'solid-js'
import { createStore, SetStoreFunction, Store } from 'solid-js/store'
import { z } from 'zod'
import { Options, schema, Files } from './state'

const urlParams = new URLSearchParams(window.location.search)

export function getLocal<T>(name: string, init: T, schema?: z.Schema<T>): T {
  const VERSION = '3'
  const version = localStorage.getItem('version')
  const storageItem = localStorage.getItem(name)

  if (storageItem && version === VERSION) {
    try {
      const json = JSON.parse(storageItem)
      init = schema ? schema.parse(json) : (json as T)
    } catch (_) {
      localStorage.removeItem(name)
    }
  } else if (version !== VERSION) {
    localStorage.clear()
    localStorage.setItem('version', VERSION)
  }

  return init
}

export function createLocalStore<T extends object>(
  name: string,
  init: T,
  schema: z.Schema<T>,
): [Store<T>, SetStoreFunction<T>] {
  const value = getLocal(name, init, schema)

  const [store, setStore] = createStore<T>(value)

  createEffect(() => {
    localStorage.setItem(name, JSON.stringify(store))
  })

  return [store, setStore]
}

export function createLocalSignal<T>(
  name: string,
  init: T,
  schema?: z.Schema<T>,
): [Accessor<T>, Setter<T>] {
  const value = getLocal(name, init, schema)

  const [signal, setSignal] = createSignal<T>(value)

  createEffect(() => {
    localStorage.setItem(name, JSON.stringify(signal()))
  })

  return [signal, setSignal]
}

export function initLinker(): string {
  return urlParams.get('linker') ?? 'wesl-rs'
}

export function initFiles(): Files {
  const defaultFiles = [
    {
      name: 'main',
      source:
        'import super::util::my_fn;\nfn main() -> u32 {\n    return my_fn();\n}\n',
    },
    { name: 'util', source: 'fn my_fn() -> u32 { return 42; }' },
  ]
  return defaultFiles
}

export function initOptions(): Options {
  const defaultOptions: Options = {
    command: 'Compile',
    // compile args
    root: 'main',
    mangler: 'escape',
    sourcemap: true,
    imports: true,
    condcomp: true,
    generics: false,
    strip: false,
    lower: true,
    validate: true,
    naga: false,
    lazy: true,
    keep: undefined,
    features: {},
    // eval args
    runtime: false,
    expr: '',
    // bindings: new Map(),
    overrides: {},
  }

  const urlOptions: Partial<Options> = Object.fromEntries(
    Object.entries(schema.shape.options.shape)
      .map(([key, schema]) => {
        const param = urlParams.get(key)
        try {
          const json = JSON.parse(param ?? 'null')
          const val = schema.parse(json)
          return [key, val]
        } catch (_) {
          return null
        }
      })
      .filter((k) => k !== null),
  )

  return Object.assign({}, defaultOptions, urlOptions)
}
