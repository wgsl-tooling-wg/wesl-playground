import { Options, Files } from './state'

import * as WeslRs from './wesl-web/wesl_web'
import * as WeslJs from 'wesl'

export async function compileRs(files: Files, options: Options) {
  const params = {
    ...options,
    files: Object.fromEntries(
      files.map(({ name, source }) => ['./' + name + '.wesl', source]),
    ),
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

  const params: WeslJs.LinkParams = {
    weslSrc: Object.fromEntries(
      files.map(({ name, source }) => ['./' + name + '.wesl', source]),
    ),
    rootModuleName: './' + options.root + '.wesl',
    // debugWeslRoot?: string;
    conditions: options.features,
    // libs?: WgslBundle[];
    // virtualLibs?: Record<string, VirtualLibraryFn>;
    // config?: LinkConfig;
    // constants?: Record<string, string | number>;
    mangler:
      options.mangler === 'escape'
        ? underscoreMangle
        : options.mangler === 'hash'
          ? underscoreMangle
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

// TODO: copy-pasted from wesl-js
function underscoreMangle(decl: any, srcModule: any): string {
  const { modulePath } = srcModule
  return [...modulePath.split('::'), decl.originalName]
    .map((v) => {
      const underscoreCount = (v.match(/_/g) ?? []).length
      if (underscoreCount > 0) {
        return '_' + underscoreCount + v
      } else {
        return v
      }
    })
    .join('_')
}
