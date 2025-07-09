import { Accessor, createEffect, createSignal, Setter } from 'solid-js'
import { createStore, SetStoreFunction, Store } from 'solid-js/store'
import { z } from 'zod'
import { Options, schema, Files } from './state'

const urlParams = new URLSearchParams(window.location.search)

export function getLocal<T>(name: string, init: T, schema?: z.Schema<T>): T {
  const VERSION = '4'
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
      source: `import package::util::rand22;

@fragment
fn main(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  let r = rand22(pos.xy);
  return vec4f(r, r, r, 1.0);
}`,
    },
    {
      name: 'util',
      source: `// On generating random numbers, with help of y= [(a+x)sin(bx)] mod 1", W.J.J. Rey, 22nd European Meeting of Statisticians 1998
// from https://gist.github.com/munrocket/236ed5ba7e409b8bdf1ff6eca5dcdc39
fn rand11(n: f32) -> f32 {
    return fract(sin(n) * 43758.5453123);
}
fn rand22(n: vec2f) -> f32 {
    return fract(sin(dot(n, vec2f(12.9898, 4.1414))) * 43758.5453);
}`,
    },
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
    keep_root: true,
    mangle_root: false,
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
