import { Options, Files } from './state'

import InitWeslRs, * as WeslRs from './wesl-web/wesl_web'
import * as WeslJs from 'wesl'

import bevy_wgsl from './packages/bevy_wgsl.json'
import lygia_wgsl from './packages/lygia_wgsl.json'

type Pkg = { [k: string]: string | Pkg }

function flattenPkgFiles(pkg: Pkg, parent: string): [string, string][] {
  return Object.entries(pkg).flatMap(([k, v]) => {
    const name = `${parent}::${k}`
    if (typeof v === 'string') {
      return [[name, v]]
    } else {
      return flattenPkgFiles(v, name)
    }
  })
}

export async function compileRs(files: Files, options: Options) {
  await InitWeslRs()

  const flatFiles = Object.fromEntries([
    ...files.map(({ name, source }) => ['package::' + name, source]),
    ...flattenPkgFiles(bevy_wgsl, 'bevy'),
    ...flattenPkgFiles(lygia_wgsl, 'lygia'),
  ])

  console.log('files', flatFiles)

  const params = {
    ...options,
    root: 'package::' + options.root,
    files: flatFiles,
  } as WeslRs.Command

  try {
    console.debug('[wesl-rs] run params', params)
    const res = WeslRs.run(params) as string // TODO
    console.log('[wesl-rs] compilation result', { source: res })
    return res
  } catch (e) {
    console.error('[wesl-rs] compilation failure', e)
    const err = e as WeslRs.Error
    throw err
  }
}

export async function compileJs(files: Files, options: Options) {
  if (options.command !== 'Compile') {
    throw new Error('wesl-js command not supported: ' + options.command)
  }

  const plugins = []
  if (options.binding_structs) {
    plugins.push(WeslJs.bindingStructsPlugin())
  }

  const params: WeslJs.LinkParams = {
    weslSrc: Object.fromEntries(
      files.map(({ name, source }) => ['./' + name + '.wesl', source]),
    ),
    rootModuleName: './' + options.root + '.wesl',
    // debugWeslRoot?: string;
    conditions: options.features,
    // libs?: WgslBundle[];
    // virtualLibs?: Record<string, VirtualLibraryFn>;
    config: { plugins },
    // constants?: Record<string, string | number>;
    mangler:
      options.mangler === 'minimal'
        ? WeslJs.minimalMangle
        : options.mangler === 'lengthprefix'
          ? WeslJs.lengthPrefixMangle
          : options.mangler === 'escape'
            ? WeslJs.underscoreMangle
            : undefined,
  }
  try {
    console.debug('[wesl-js] run params', params)
    const sourcemap = await WeslJs.link(params)
    console.log('[wesl-js] compilation result', sourcemap)
    return sourcemap.dest
  } catch (e) {
    console.error('compilation failure', e)
    const err = e as Error
    throw err
  }
}

export async function compile(files: Files, options: Options, linker: string) {
  console.log('compiling', linker, options, files)

  if (linker === 'wesl-rs') {
    return compileRs(files, options)
  } else if (linker === 'wesl-js') {
    return compileJs(files, options)
  } else {
    throw new Error('unsupported linker ' + linker)
  }
}
