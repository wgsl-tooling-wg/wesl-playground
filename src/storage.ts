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
      source: `import package::bindings::uniforms;

@fragment
fn main(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  if (distance(pos.xy, uniforms.mouse) < 10) {
    return vec4(1.0, cos(uniforms.time), sin(uniforms.time), 1.0);
  }

  let uv = pos.xy / uniforms.size;
  let color = package::mandelbrot::mandelbrot(uv.xy * 3.0 - vec2f(2.0, 1.5));    
  return vec4(vec3f(color), 1.0);
}`,
    },
    {
      name: 'mandelbrot',
      source: `/// A point in the complex plane
alias Complex = vec2f;

/// The function z -> z^2 + c
fn quadraticMap(z: Complex, c: Complex) -> Complex {
    return vec2f(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
}

/// Evaluates the mandelbrot set, and returns how long it takes to escape
/// 0 => escapes instantly
/// 1 => did not escape
fn mandelbrot(position: Complex) -> f32 {
    const maxIterations: u32 = 100;

    var current: Complex = vec2f(0.0);
    for(var i: u32 = 0; i < maxIterations; i++) {
        current = quadraticMap(current, position);
        if(dot(current, current) > 4.0) {
            return f32(i)/f32(maxIterations);
        }
    }
    return 1.0;
}`
    },
    {
      name: 'bindings',
      source: `// These bindings are available in the renderer.

struct Uniforms {
  /// canvas dimensions, in pixels
  size: vec2f,
  /// mouse position on the canvas, in pixels
  mouse: vec2f,
  /// timestamp, in seconds
  time: f32,
  /// delta since previous frame, in seconds
  delta: f32,
}

@group(0) @binding(0)
var<uniform> uniforms: Uniforms;
`
    }
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
