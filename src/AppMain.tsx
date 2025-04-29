import { createSignal, createEffect, createReaction } from 'solid-js'
import { trackStore } from '@solid-primitives/deep'
import {
  BsPlayFill as RunIcon,
  BsTrashFill as ResetIcon,
  BsShareFill as ShareIcon,
  BsGearFill as OptionsIcon,
  BsGithub as GithubIcon,
} from 'solid-icons/bs'

import './style.scss'
import * as wesl from './wesl-web/wesl_web'
import './app'
import { DropButton } from './DropButton'
import WeslLogo from './assets/logo/logo-horizontal-light.svg'
import WeslLogoDark from './assets/logo/logo-horizontal-dark.svg'
import { sharedState, saveSharedState, clearSharedState } from './share'
import { filesSchema, optionsSchema } from './state'
import {
  createLocalSignal,
  createLocalStore,
  initFiles,
  initLinker,
  initOptions,
} from './storage'
import { OptionsForm } from './Options'
import { Tabs } from './Tabs'
import { dark, ThemeButton } from './Theme'
import { Editor } from './Editor'
import { compile } from './wesl'

const DEFAULT_MESSAGE = `Visit <a href="https://wesl-lang.dev">wesl-lang.dev</a> to learn WESL.`

const [files, setFiles] = createLocalStore('files', initFiles(), filesSchema)
const [options, setOptions] = createLocalStore(
  'options',
  initOptions(),
  optionsSchema,
)
const [linker, setLinker] = createLocalSignal('linker', initLinker())
const [autorun, setAutorun] = createSignal(false)
const [tab, setTab] = createSignal(0)
const [diagnostics, setDiagnostics] = createSignal<wesl.Diagnostic[]>([])
const [output, setOutput] = createSignal('')
const [message, setMessage] = createSignal(DEFAULT_MESSAGE)

const setSource = (source: string) =>
  setFiles(tab(), { name: files[tab()].name, source })
const source = () => files[tab()]?.source ?? ''

const trackState = () => {
  trackStore(options)
  trackStore(files)
  linker()
}

// load state from url hash param
createEffect(() => {
  const state = sharedState()
  if (state) {
    setFiles(state.files)
    setLinker(state.linker)
    setOptions(state.options)

    // changing any of the `trackState` signals invalidates the shared state.
    const track = createReaction(clearSharedState)
    track(trackState)
  }
})

// ensure that there is always at least 1 tab open.
createEffect(() => {
  if (files.length == 0) {
    setFiles([
      { name: 'main', source: 'fn main() -> u32 {\n    return 0u;\n}\n' },
    ])
  }
})

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

let autorunTimeout = 0

function toggleAutoRun(toggle: boolean) {
  clearTimeout(autorunTimeout)
  autorunTimeout = 0

  if (toggle) {
    const track = createReaction(() => {
      autorunTimeout = setTimeout(loop, 500)
    })

    function loop() {
      if (autorunTimeout) {
        track(trackState)
        run()
      }
    }

    track(trackState)
    run()
  }
}

createEffect(() => {
  toggleAutoRun(autorun())
})

async function run() {
  setMessage(`[${linker()}] Compiling...`)
  setDiagnostics([])

  try {
    const res = await compile(files, options, linker())
    setMessage('')
    setOutput(res)
  } catch (e: any) {
    setMessage(e.message ?? e)
    setOutput(e.source ?? '')
    setDiagnostics(e.diagnostics ?? [])
  }
}

function reset() {
  setFiles(initFiles())
  setOptions(initOptions())
  setMessage(DEFAULT_MESSAGE)
  setOutput('')
  setTab(0)
}

async function share() {
  const state = {
    files: files,
    linker: linker(),
    options: options,
  }
  try {
    await saveSharedState(state)
    const url = window.location.href
    setMessage(`
        <span>copy the URL below share this playground.</span>
        <br />
        <a href="${url}">${url}</a>`)
    setOutput('')
  } catch (error) {
    console.error(error)
    alert('Failed to save the sandbox.')
  }
}

const Header = () => (
  <div id="header">
    <a id="wesl-logo" href="https://wesl-lang.dev">
      <img src={dark() ? WeslLogoDark : WeslLogo} alt="WESL website" />
    </a>
    <h2>Playground</h2>
    <button class="button" id="btn-run" onclick={run}>
      <RunIcon class="icon" />
      Run
    </button>
    <button class="button" id="btn-reset" onclick={reset}>
      <ResetIcon class="icon" />
      reset
    </button>
    <button class="button" id="btn-share" onclick={share}>
      <ShareIcon class="icon" />
      share
    </button>
    <DropButton
      dropdown=<OptionsForm
        files={files}
        options={options}
        setOptions={setOptions}
        linker={linker}
        setLinker={setLinker}
        autorun={autorun}
        setAutorun={setAutorun}
      />
    >
      <OptionsIcon class="icon" />
      options
    </DropButton>
    <div class="right">
      <ThemeButton />
      <a
        id="github-logo"
        href="https://github.com/wgsl-tooling-wg/wesl-playground"
      >
        <GithubIcon class="icon" />
      </a>
    </div>
  </div>
)

const LeftPane = () => (
  <div id="left">
    <div class="wrap">
      <Tabs
        labels={files.map((f) => f.name)}
        selected={tab()}
        onselect={setTab}
        ondelete={delFile}
        onrename={renameFile}
        oncreate={newFile}
      />
      <Editor
        content={source()}
        diagnostics={diagnostics().filter((d) => d.file === files[tab()].name)}
        onchange={setSource}
      />
    </div>
  </div>
)

const RightPane = () => (
  <div id="right">
    <div class="wrap">
      <div id="message" style={{ display: message() ? 'initial' : 'none' }}>
        <pre innerHTML={message()}></pre>
      </div>
      <Editor
        content={output()}
        diagnostics={diagnostics().filter((d) => d.file === 'output')}
        readonly
      />
    </div>
  </div>
)

const App = () => (
  <div id="app">
    <Header />
    <LeftPane />
    <RightPane />
  </div>
)

export default App
