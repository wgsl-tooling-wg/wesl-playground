import { createSignal, onCleanup, onMount } from 'solid-js'
import { filesSchema, schema, State } from './state'
import { getLocal, initFiles, initOptions } from './storage'

// TODO: move that to wesl-lang.dev
const SHARE_URL = 'https://wesl.thissma.fr/share'

const [state, setState] = createSignal<State | null>()

function getCurrentState(): State {
  const state = {
    files: getLocal('files', initFiles(), filesSchema),
    linker: getLocal('linker', 'wesl-rs'),
    options: getLocal('options', initOptions()),
  }
  return state
}

function pushHistory(hash: string | null) {
  if (hash) {
    const state = getCurrentState()
    const url = new URL(`${window.location.origin}/s/${hash}`)
    window.history.pushState(state, '', url)
  } else {
    window.history.pushState(null, '', '/')
  }
}

async function saveSharedState(state: State): Promise<string> {
  console.debug('saving state', state)
  const json = JSON.stringify(state)
  const response = await fetch(SHARE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ data: json }),
  })

  if (!response.ok) {
    throw new Error(`POST to sharing server error: ${response.status}`)
  }

  const hash = await response.text()
  console.debug('saved state', state, hash)
  pushHistory(hash)
  return hash
}

async function loadSharedState(hash: string): Promise<State> {
  console.debug('loading hash', hash)
  const response = await fetch(`${SHARE_URL}/${hash}`, {
    method: 'GET',
  })

  if (!response.ok) {
    alert(`failed to load shared sandbox: ${response.status}`)
    throw new Error(`POST to sharing server error: ${response.status}`)
  }

  const json = JSON.parse(await response.text())
  const state = schema.parse(json)
  console.debug('loaded hash', hash, state)
  return state
}

function clearSharedState() {
  let hash = getHashFromUrl()
  if (hash) {
    pushHistory(null)
    console.debug('cleared shared state', hash)
  }
}

function getHashFromUrl() {
  const match = window.location.pathname.match(/^\/s\/([a-f0-9]+)$/)
  if (match) {
    return match[1]
  } else {
    return null
  }
}

async function loadHashState(hash: string | null) {
  if (hash) {
    try {
      const state = await loadSharedState(hash)
      window.history.replaceState(state, '')
      setState(state)
    } catch (e) {
      console.error('failed to load hash', hash, e)
      alert('Failed to load shared playground')
      setState(null)
    }
  }
}

function onPopState(e: PopStateEvent) {
  if (typeof e.state === 'string') {
    loadHashState(e.state)
  } else if (e.state === null) {
    setState(null)
  } else {
    try {
      const state = schema.parse(e.state)
      setState(state)
    } catch (_) {
      setState(null)
    }
  }
}

onMount(() => {
  window.addEventListener('popstate', onPopState)
  loadHashState(getHashFromUrl())
})

onCleanup(() => {
  window.removeEventListener('popstate', onPopState)
})

export { state as sharedState, saveSharedState, clearSharedState }
