import { Accessor, For, Setter, Show } from 'solid-js'
import type { Options, Files } from './state'
import { SetStoreFunction } from 'solid-js/store'

function strFeatures(features: { [name: string]: boolean }): string {
  return Object.entries(features)
    .map(([name, enabled]) => `${name}=${enabled}`)
    .join(', ')
}
function parseFeatures(str: string): { [name: string]: boolean } {
  return Object.fromEntries(
    str
      .split(',')
      .map((f) => f.split('=', 2).map((x) => x.trim()))
      .filter((f) => f[0] !== '')
      .map((f) =>
        f.length === 1
          ? [f[0], true]
          : [f[0], !!f[1] && !['false', '0'].includes(f[1])],
      ),
  )
}

function strEntrypoints(entrypoints: string[] | undefined): string {
  return (entrypoints ?? []).join(', ')
}
function parseEntrypoints(str: string): string[] | undefined {
  let res = str
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s !== '')
  if (res.length) {
    return res
  }
}

export type OptionsProps = {
  files: Files
  options: Options
  setOptions: SetStoreFunction<Options>
  linker: Accessor<string>
  setLinker: Setter<string>
  autorun: Accessor<boolean>
  setAutorun: Setter<boolean>
}

export const WeslJsFeatures = (props: OptionsProps) => {
  if (
    !['escape', 'minimal', 'lengthprefix', 'none'].includes(
      props.options.mangler,
    )
  ) {
    props.setOptions('mangler', 'escape')
  }

  return (
    <>
      <span>Features</span>
      <label>
        <input
          type="checkbox"
          checked={props.options.binding_structs}
          onchange={(e) =>
            props.setOptions('binding_structs', e.currentTarget.checked)
          }
        />
        <span>binding structs</span>
      </label>
      <span>Configuration</span>
      <label>
        <span>root file</span>
        <select
          value={props.options.root}
          onchange={(e) => props.setOptions('root', e.currentTarget.value)}
        >
          <For each={props.files}>
            {(file) => <option value={file.name}>{file.name}</option>}
          </For>
        </select>
      </label>
      <label>
        <span>mangler</span>
        <select
          value={props.options.mangler}
          onchange={(e) => props.setOptions('mangler', e.currentTarget.value)}
        >
          <option value="escape">Escape underscores</option>
          <option value="minimal">Minimal</option>
          <option value="lengthprefix">Length prefix</option>
          <option value="none">None</option>
        </select>
      </label>
      <label classList={{ disabled: !props.options.condcomp }}>
        <span>cond. comp. features</span>
        <input
          type="text"
          value={strFeatures(props.options.features)}
          onchange={(e) => {
            props.setOptions(({ features, ...opts }) => ({
              ...opts,
              features: parseFeatures(e.currentTarget.value),
            }))
          }}
        />
      </label>
    </>
  )
}

export const WeslRsFeatures = (props: OptionsProps) => {
  if (!['escape', 'hash', 'unicode', 'none'].includes(props.options.mangler)) {
    props.setOptions('mangler', 'escape')
  }

  return (
    <>
      <span>Features</span>
      <label>
        <input
          type="checkbox"
          checked={props.options.imports}
          onchange={(e) => props.setOptions('imports', e.currentTarget.checked)}
        />
        <span>imports</span>
      </label>
      <label>
        <input
          type="checkbox"
          checked={props.options.condcomp}
          onchange={(e) =>
            props.setOptions('condcomp', e.currentTarget.checked)
          }
        />
        <span>conditional translation</span>
      </label>
      <label>
        <input
          type="checkbox"
          checked={props.options.generics}
          onchange={(e) =>
            props.setOptions('generics', e.currentTarget.checked)
          }
        />
        <span>generics</span>
      </label>
      <label>
        <input
          type="checkbox"
          checked={props.options.strip}
          onchange={(e) => props.setOptions('strip', e.currentTarget.checked)}
        />
        <span>strip dead code</span>
      </label>
      <label>
        <input
          type="checkbox"
          checked={props.options.lower}
          onchange={(e) => props.setOptions('lower', e.currentTarget.checked)}
        />
        <span>polyfills</span>
      </label>
      <label>
        <input
          type="checkbox"
          checked={props.options.validate}
          onchange={(e) =>
            props.setOptions('validate', e.currentTarget.checked)
          }
        />
        <span>validation</span>
      </label>
      <label>
        <input
          type="checkbox"
          checked={props.options.naga}
          onchange={(e) => props.setOptions('naga', e.currentTarget.checked)}
        />
        <span>naga validation</span>
      </label>
      <span>Configuration</span>
      <label>
        <span>root file</span>
        <select
          value={props.options.root}
          onchange={(e) => props.setOptions('root', e.currentTarget.value)}
        >
          <For each={props.files}>
            {(file) => <option value={file.name}>{file.name}</option>}
          </For>
        </select>
      </label>
      <label>
        <span>mangler</span>
        <select
          value={props.options.mangler}
          onchange={(e) => props.setOptions('mangler', e.currentTarget.value)}
        >
          <option value="escape">Escape underscores</option>
          <option value="hash">Hash suffix</option>
          <option value="unicode">Unicode confusables</option>
          <option value="none">None</option>
        </select>
      </label>
      <label>
        <input
          type="checkbox"
          checked={props.options.mangle_root}
          onchange={(e) =>
            props.setOptions('mangle_root', e.currentTarget.checked)
          }
        />
        <span>mangle root declarations</span>
      </label>
      <label classList={{ disabled: !props.options.condcomp }}>
        <span>cond. comp. features</span>
        <input
          type="text"
          disabled={!props.options.condcomp}
          value={strFeatures(props.options.features)}
          onchange={(e) => {
            props.setOptions(({ features, ...opts }) => ({
              ...opts,
              features: parseFeatures(e.currentTarget.value),
            }))
          }}
        />
      </label>
      <label
        classList={{
          disabled: !props.options.strip || props.options.keep_root,
        }}
      >
        <span>strip: keep declarations</span>
        <input
          type="text"
          disabled={!props.options.strip || props.options.keep_root}
          value={strEntrypoints(props.options.keep)}
          onchange={(e) =>
            props.setOptions('keep', () =>
              parseEntrypoints(e.currentTarget.value),
            )
          }
        />
      </label>
      <label classList={{ disabled: !props.options.strip }}>
        <input
          type="checkbox"
          disabled={!props.options.strip}
          checked={props.options.keep_root}
          onchange={(e) =>
            props.setOptions('keep_root', e.currentTarget.checked)
          }
        />
        <span>strip: keep root declarations</span>
      </label>
    </>
  )
}

export const OptionsForm = (props: OptionsProps) => (
  <div id="options">
    <label>
      <input
        type="checkbox"
        name="auto-recompile"
        checked={props.autorun()}
        onChange={(e) => props.setAutorun(e.currentTarget.checked)}
      />
      <span>auto recompile</span>
    </label>
    <label>
      <input
        type="radio"
        name="linker"
        value="wesl-rs"
        checked={props.linker() === 'wesl-rs'}
        onchange={(e) => props.setLinker(e.currentTarget.value)}
      />
      <span>wesl-rs</span>
    </label>
    <label>
      <input
        type="radio"
        name="linker"
        value="wesl-js"
        checked={props.linker() === 'wesl-js'}
        onchange={(e) => props.setLinker(e.currentTarget.value)}
      />
      <span>wesl-js</span>
    </label>
    <Show when={props.linker() === 'wesl-rs'}>
      <WeslRsFeatures {...props} />
    </Show>
    <Show when={props.linker() === 'wesl-js'}>
      <WeslJsFeatures {...props} />
    </Show>
  </div>
)
