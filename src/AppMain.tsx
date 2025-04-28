import monaco, { editorWorker } from './monaco'

import {
  For,
  type Component,
  createSignal,
  createEffect,
  onMount,
  onCleanup,
  on,
  createReaction,
} from 'solid-js'
import { createStore, type SetStoreFunction, type Store } from 'solid-js/store'
import { trackStore } from '@solid-primitives/deep'

import './style.scss'
import * as wesl from './wesl-web/wesl_web'
import './app'
import { DropButton } from './DropButton'
import GithubLogo from './assets/github-mark.svg'
import WeslLogo from './assets/logo-horizontal-light.svg'
import GithubLogoDark from './assets/github-mark-white.svg'
import WeslLogoDark from './assets/logo-horizontal-dark.svg'
import * as WeslJs from 'wesl'

const [dark, setDark] = createSignal(
  window.matchMedia('(prefers-color-scheme: dark)').matches,
)
window
  .matchMedia('(prefers-color-scheme: dark)')
  .addEventListener('change', (e) => setDark(e.matches))

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

// TODO: move that to wesl-lang.dev
const SHARE_URL = 'https://wesl.thissma.fr/share'

const DEFAULT_FILES = () => [
  {
    name: 'main',
    source:
      'import super::util::my_fn;\nfn main() -> u32 {\n    return my_fn();\n}\n',
  },
  { name: 'util', source: 'fn my_fn() -> u32 { return 42; }' },
]

// /!\ remember to bump the storage version when you modify this struct!
const DEFAULT_OPTIONS = () => ({
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
})

const DEFAULT_MESSAGE =
  `Visit <a href="https://wesl-lang.dev">wesl-lang.dev</a> to learn about WESL.<br/>
<br/>
Options:
<ul>
  <li>imports — enable/disable the <a href="https://wesl-lang.dev/spec/Imports">import extension</a></li>
  <li>conditionals — enable/disable the <a href="https://wesl-lang.dev/spec/ConditionalTranslation">conditional translation extension</a>
    <ul>
      <li>features — comma-separated list of features to enable/disable. Syntax: feat1=true,feat2=false,...</li>
    </ul>
  </li>
  <li>mangler — choose the <a href="https://wesl-lang.dev/spec/NameMangling">name mangling scheme</a>
    <ul>
      <li>None — no mangling is performed. Name collisions can happen</li>
      <li>Hash — mangling based on a hash of the fully-qualified name</li>
      <li>Escape — fully-qualified name, with underscores escaped (recommended)</li>
    </ul>
  </li>
  <li>root — select the root file</li>
  <li>strip — remove unused declarations
    <ul>
      <li>keep — comma-separated list of declarations in the root to keep when strip is enabled</li>
    </ul>
  </li>
  <li>eval — if set, evaluate a const-expression and output the result</a>
  <ly
</ul>
`.replaceAll(/\s*\n\s*/g, '')

const URL_PARAMS = new URLSearchParams(window.location.search)

function getHashFromUrl() {
  const match = window.location.pathname.match(/^\/s\/([a-f0-9]+)$/)
  if (match) {
    return match[1]
  } else {
    return null
  }
}

function removeHash() {
  if (hasHash) {
    window.history.pushState({}, '', '/')
    hasHash = false
  }
}

function onPopState(_e: PopStateEvent) {
  const hash = getHashFromUrl()
  if (hash) {
    console.log(`share hash: ${hash}`)
    setShare(hash)
  }
}

let hasHash = false

onMount(() => {
  const hash = getHashFromUrl()
  if (hash) {
    setShare(hash)
  }
  window.addEventListener('popstate', onPopState)
})

onCleanup(() => {
  window.removeEventListener('popstate', onPopState)
})

function createLocalStore<T extends object>(
  name: string,
  init: T,
): [Store<T>, SetStoreFunction<T>] {
  const VERSION = '2'
  const version = localStorage.getItem('version')

  if (localStorage.getItem(name) !== null && version === VERSION) {
    try {
      const parsed = JSON.parse(localStorage.getItem(name))
      if (typeof parsed === typeof init) {
        init = parsed
      } else {
        localStorage.removeItem(name)
      }
    } catch (_) {}
  }

  if (version !== VERSION) {
    localStorage.clear()
    localStorage.setItem('version', VERSION)
  }

  const [state, setState] = createStore<T>(init)

  createEffect(() => {
    // changing any setting invalidates the playground url
    removeHash()
    localStorage.setItem(name, JSON.stringify(state))
  })

  return [state, setState]
}

function removeIndex<T>(array: readonly T[], index: number): T[] {
  return [...array.slice(0, index), ...array.slice(index + 1)]
}

const newFile = () => {
  setFiles(files.length, { name: `tab${files.length + 1}`, source: '' })
}

const delFile = (i: number) => {
  setFiles((files) => removeIndex(files, i))
}

const renameFile = (i: number, name: string) => {
  setFiles(i, (old) => ({ name, source: old.source }))
}

const initialLinker = URL_PARAMS.get('linker') ?? 'wesl-rs'
const initialOptions = DEFAULT_OPTIONS()
for (const key in DEFAULT_OPTIONS)
  if (URL_PARAMS.has(key)) initialOptions[key] = URL_PARAMS.get(key)

const [files, setFiles] = createLocalStore('files', DEFAULT_FILES())
const [options, setOptions] = createLocalStore('options', initialOptions)
const [linker, setLinker] = createSignal(initialLinker)
const [tab, setTab] = createSignal(0)
const [diagnostics, setDiagnostics] = createSignal<wesl.Diagnostic[]>([])
const [output, setOutput] = createSignal('')
const [message, setMessage] = createSignal(DEFAULT_MESSAGE)

const setSource = (source: string) =>
  setFiles(tab(), { name: files[tab()].name, source })
const source = () => files[tab()]?.source ?? ''

// this effect ensures that there is always at least 1 tab open.
createEffect(() => {
  if (files.length == 0) {
    setFiles([
      { name: 'main.wgsl', source: 'fn main() -> u32 {\n    return 0u;\n}\n' },
    ])
  }
})

createEffect(on(linker, removeHash))

let runTimeout = 0

function toggleAutoRun(toggle: boolean) {
  clearTimeout(runTimeout)
  runTimeout = 0
  if (toggle) {
    function loop() {
      if (runTimeout) {
        track(() => {
          trackStore(options)
          source()
        })
        run()
      }
    }
    const track = createReaction(() => {
      runTimeout = setTimeout(loop, 500)
    })

    track(() => {
      trackStore(options)
      source()
    })
    run()
  }
}

async function run() {
  const command = {
    ...options,
    files: Object.fromEntries(
      files.map(({ name, source }) => ['./' + name + '.wesl', source]),
    ),
  } as wesl.Command

  setMessage('')
  setDiagnostics([])

  if (linker() === 'wesl-rs') {
    console.log('compiling', command)
    try {
      const res = wesl.run(command)
      console.log('compilation result', { source: res })
      setOutput(res)
    } catch (e) {
      console.error('compilation failure', e)
      const err = e as wesl.Error
      setMessage(err.message)
      setOutput(err.source ?? '')
      setDiagnostics(err.diagnostics)
    }
  } else if (linker() === 'wesl-js') {
    if (command.command === 'Compile') {
      const params: WeslJs.LinkParams = {
        weslSrc: command.files,
        rootModuleName: './' + command.root + '.wesl',
        // debugWeslRoot?: string;
        conditions: command.features,
        // libs?: WgslBundle[];
        // virtualLibs?: Record<string, VirtualLibraryFn>;
        // config?: LinkConfig;
        // constants?: Record<string, string | number>;
        mangler:
          command.mangler === 'escape'
            ? underscoreMangle
            : command.mangler === 'hash'
              ? underscoreMangle
              : undefined,
      }
      console.log('compiling', params)
      try {
        const sourcemap = await WeslJs.link(params)
        console.log(sourcemap)
        setOutput(sourcemap.dest)
      } catch (e) {
        console.error('compilation failure', e)
        const err = e as Error
        setOutput(err.message)
      }
    } else {
      throw 'TODO'
    }
  }
}

function reset() {
  setFiles(DEFAULT_FILES())
  setOptions(DEFAULT_OPTIONS())
  setMessage(DEFAULT_MESSAGE)
  setOutput('')
  setTab(0)
}

async function share() {
  const data = JSON.stringify({
    files: files,
    linker: linker(),
    options: options,
  })
  try {
    const response = await fetch(SHARE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ data }),
    })

    if (!response.ok) {
      alert(`failed to share sandbox: ${response.status}`)
      throw new Error(`POST to sharing server error: ${response.status}`)
    }

    const hash = await response.text()
    const url = new URL(`${window.location.origin}/s/${hash}`)
    window.history.pushState(hash, '', url)
    setMessage(
      `copy the URL below share this playground.\n<a href="${url}">${url}</a>`,
    )
    setOutput('')
    hasHash = true
  } catch (error) {
    console.error(error)
  }
}

async function setShare(hash: String) {
  try {
    console.log(`loading hash ${hash}`)
    const response = await fetch(`${SHARE_URL}/${hash}`, {
      method: 'GET',
    })

    if (!response.ok) {
      alert(`failed to load shared sandbox: ${response.status}`)
      throw new Error(`POST to sharing server error: ${response.status}`)
    }

    const data = JSON.parse(await response.text())
    console.log('data:', data)
    hasHash = false

    if (Array.isArray(data.files)) {
      const files = []
      for (const file of data.files) {
        if (typeof file.name === 'string' && typeof file.source === 'string') {
          files.push({ name: file.name, source: file.source })
        }
      }
      setFiles(files)
    }
    if (typeof data.linker === 'string') {
      setLinker(data.linker)
    }
    if (typeof data.options === 'object') {
      const curOptions = linker() === 'wesl-rs' ? { ...options } : {}
      for (const key in data.options) {
        if (
          key in curOptions &&
          typeof data.options[key] === typeof curOptions[key]
        ) {
          curOptions[key] = data.options[key]
        }
      }
      if (linker() === 'wesl-rs') setOptions(curOptions)
    }

    const url = new URL(`${window.location.origin}/s/${hash}`)
    setMessage(`loaded shared playground.\n<a href="${url}">${url}</a>`)
    setOutput('')
    hasHash = true
  } catch (error) {
    console.error(error)
  }
}

createEffect(() => {
  monaco.editor.defineTheme('theme', {
    base: dark() ? 'vs-dark' : 'vs',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': dark() ? '#262a2f' : '#efefef',
    },
  })
})

function setupMonacoInput(elt: HTMLElement) {
  self.MonacoEnvironment = {
    getWorker: function (_workerId, _label) {
      return new editorWorker()
    },
  }
  const editor = monaco.editor.create(elt, {
    theme: 'theme',
    value: source(),
    language: 'wgsl',
    mouseWheelZoom: true,
    automaticLayout: true,
  })

  // keeping track of the editor value() avoids calling editor.setValue() when source()
  // changed as a result of editing.
  let currentValue = ''

  editor.getModel().onDidChangeContent(() => {
    currentValue = editor.getValue()
    setSource(currentValue)
  })

  createEffect(() => {
    if (source() !== currentValue) {
      currentValue = source()
      editor.setValue(currentValue)
    }
  })

  createEffect(() => {
    const model = editor.getModel()
    const markers = diagnostics()
      .filter((d) => d.file === files[tab()].name)
      .map((d) => {
        const p1 = model.getPositionAt(d.span.start)
        const p2 = model.getPositionAt(d.span.end)
        return {
          startLineNumber: p1.lineNumber,
          startColumn: p1.column,
          endLineNumber: p2.lineNumber,
          endColumn: p2.column,
          message: d.title,
          severity: monaco.MarkerSeverity.Error,
        }
      })
    monaco.editor.setModelMarkers(editor.getModel(), 'wesl', markers)
  })
}

function setupMonacoOutput(elt: HTMLElement) {
  self.MonacoEnvironment = {
    getWorker: function (_workerId, _label) {
      return new editorWorker()
    },
  }
  const editor = monaco.editor.create(elt, {
    value: output(),
    theme: 'theme',
    language: 'wgsl',
    mouseWheelZoom: true,
    automaticLayout: true,
    readOnly: true,
    renderValidationDecorations: 'on',
  })

  createEffect(() => {
    editor.setValue(output())
  })

  createEffect(() => {
    const model = editor.getModel()
    const markers = diagnostics()
      .filter((d) => d.file === 'output')
      .map((d) => {
        const p1 = model.getPositionAt(d.span.start)
        const p2 = model.getPositionAt(d.span.end)
        return {
          startLineNumber: p1.lineNumber,
          startColumn: p1.column,
          endLineNumber: p2.lineNumber,
          endColumn: p2.column,
          message: d.title,
          severity: monaco.MarkerSeverity.Error,
        }
      })
    monaco.editor.setModelMarkers(editor.getModel(), 'wesl', markers)
  })
}

interface TabBtnProps {
  name: string
  selected: boolean
  onselect: () => void
  onrename: (name: string) => void
  ondelete: () => void
}

function TabBtn(props: TabBtnProps) {
  const setEditable = (e: { currentTarget: HTMLElement }) => {
    e.currentTarget.contentEditable = 'true'
    e.currentTarget.focus()
  }

  const endEditable = (e: { currentTarget: HTMLElement }) => {
    e.currentTarget.contentEditable = 'false'
    props.onrename(e.currentTarget.textContent)
    e.currentTarget.blur()
  }

  const onKeyDown = (e: KeyboardEvent & { currentTarget: HTMLElement }) => {
    if (['Enter', 'Escape', 'Tab'].includes(e.key)) {
      e.preventDefault()
      endEditable(e)
    }
  }

  return (
    <div
      class="tab-btn text"
      classList={{ selected: props.selected }}
      role="button"
      tabindex="0"
      onclick={props.onselect}
    >
      <div
        ondblclick={setEditable}
        onblur={endEditable}
        onkeydown={onKeyDown}
        contenteditable={false}
      >
        {props.name}
      </div>
      <button
        onclick={(e) => {
          e.stopPropagation()
          props.ondelete()
        }}
      >
        <svg viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M6 18L18 6M6 6l12 12"
          ></path>
        </svg>
      </button>
    </div>
  )
}

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

const Options: Component = () => (
  <div id="options">
    <span>Features</span>
    <label>
      <input
        type="checkbox"
        checked={options.imports}
        onchange={(e) => setOptions('imports', e.currentTarget.checked)}
      />
      <span>imports</span>
    </label>
    <label>
      <input
        type="checkbox"
        checked={options.condcomp}
        onchange={(e) => setOptions('condcomp', e.currentTarget.checked)}
      />
      <span>conditional translation</span>
    </label>
    <label>
      <input
        type="checkbox"
        checked={options.generics}
        onchange={(e) => setOptions('generics', e.currentTarget.checked)}
      />
      <span>generics</span>
    </label>
    <label>
      <input
        type="checkbox"
        checked={options.strip}
        onchange={(e) => setOptions('strip', e.currentTarget.checked)}
      />
      <span>strip dead code</span>
    </label>
    <label>
      <input
        type="checkbox"
        checked={options.lower}
        onchange={(e) => setOptions('lower', e.currentTarget.checked)}
      />
      <span>polyfills</span>
    </label>
    <label>
      <input
        type="checkbox"
        checked={options.validate}
        onchange={(e) => setOptions('validate', e.currentTarget.checked)}
      />
      <span>validation</span>
    </label>
    <label>
      <input
        type="checkbox"
        checked={options.naga}
        onchange={(e) => setOptions('naga', e.currentTarget.checked)}
      />
      <span>naga validation</span>
    </label>
    <span>Configuration</span>
    <label>
      <span>root file</span>
      <select
        value={options.root}
        onchange={(e) => setOptions('root', e.currentTarget.value)}
      >
        <For each={files}>
          {(file) => <option value={file.name}>{file.name}</option>}
        </For>
      </select>
    </label>
    <label>
      <span>mangler</span>
      <select
        value={options.mangler}
        onchange={(e) =>
          setOptions('mangler', e.currentTarget.value as wesl.ManglerKind)
        }
      >
        <option value="none">None</option>
        <option value="hash">Hash</option>
        <option value="escape">Escape</option>
      </select>
    </label>
    <label classList={{ disabled: !options.condcomp }}>
      <span>cond. comp. features</span>
      <input
        type="text"
        disabled={!options.condcomp}
        value={strFeatures(options.features)}
        onchange={(e) => {
          setOptions(({ features, ...opts }) => ({
            ...opts,
            features: parseFeatures(e.currentTarget.value),
          }))
        }}
      />
    </label>
    <label classList={{ disabled: !options.strip }}>
      <span>strip: keep declarations</span>
      <input
        type="text"
        disabled={!options.strip}
        value={strEntrypoints(options.keep)}
        onchange={(e) =>
          setOptions('keep', () => parseEntrypoints(e.currentTarget.value))
        }
      />
    </label>
  </div>
)

const App: Component = () => (
  <div id="app">
    <div id="header">
      <a id="wesl-logo" href="https://wesl-lang.dev">
        <picture>
          <source media="(prefers-color-scheme: dark)" srcset={WeslLogoDark} />
          <img src={WeslLogo} alt="WESL website" />
        </picture>
      </a>
      <h2>Playground</h2>
      <button id="btn-run" onclick={run}>
        compile
      </button>
      <button id="btn-reset" onclick={reset}>
        reset
      </button>
      <button id="btn-share" onclick={share}>
        share
      </button>
      <DropButton label="options">
        <Options />
      </DropButton>
      <label>
        <span>auto recompile</span>
        <input
          type="checkbox"
          name="auto-recompile"
          onChange={(e) => toggleAutoRun(e.currentTarget.checked)}
        />
      </label>
      <label>
        <span>wesl-rs</span>
        <input
          type="radio"
          name="linker"
          value="wesl-rs"
          checked={linker() === 'wesl-rs'}
          onchange={(e) => setLinker(e.currentTarget.value)}
        />
      </label>
      <label>
        <span>wesl-js</span>
        <input
          type="radio"
          name="linker"
          value="wesl-js"
          checked={linker() === 'wesl-js'}
          onchange={(e) => setLinker(e.currentTarget.value)}
        />
      </label>
      <a
        id="github-logo"
        href="https://github.com/wgsl-tooling-wg/wesl-playground"
      >
        <picture>
          <source
            media="(prefers-color-scheme: dark)"
            srcset={GithubLogoDark}
          />
          <img src={GithubLogo} alt="WESL-Sandbox GitHub repository" />
        </picture>
      </a>
    </div>
    <div id="left">
      <div class="wrap">
        <div class="head tabs">
          <For each={files}>
            {(file, i) => (
              <TabBtn
                name={file.name}
                selected={i() == tab()}
                onselect={() => setTab(i)}
                onrename={(name) => renameFile(i(), name)}
                ondelete={() => delFile(i())}
              />
            )}
          </For>
          <div class="tab-btn" role="button" tabindex="0" onclick={newFile}>
            <button tabindex="0">
              <svg viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 12L20 12M12 4L12 20"
                ></path>
              </svg>
            </button>
          </div>
        </div>
        <div id="input" ref={(elt) => setupMonacoInput(elt)}></div>
      </div>
    </div>
    <div id="right">
      <div class="wrap">
        <div id="message" style={{ display: message() ? 'initial' : 'none' }}>
          <pre innerHTML={message()}></pre>
        </div>
        <div
          id="output"
          style={{ display: output() ? 'initial' : 'none' }}
          ref={(elt) => setupMonacoOutput(elt)}
        ></div>
      </div>
    </div>
  </div>
)

export default App
