import { createSignal, For, Show } from 'solid-js'
import { BsX as CloseIcon, BsPlus as AddIcon } from 'solid-icons/bs'

export interface TabButtonProps {
  name: string
  selected: boolean
  onselect: () => void
  editable?: boolean
  onedit: (name: string) => void
  closable?: boolean
  onclose: () => void
}

export const TabButton = (props: TabButtonProps) => {
  function setEditable(e: Event & { currentTarget: HTMLElement }) {
    e.currentTarget.contentEditable = 'true'
    e.currentTarget.focus()
  }

  function endEditable(e: Event & { currentTarget: HTMLElement }) {
    e.currentTarget.contentEditable = 'false'
    props.onedit(e.currentTarget.textContent!)
    e.currentTarget.blur()
  }

  function onkeydown(e: KeyboardEvent & { currentTarget: HTMLElement }) {
    if (['Enter', 'Escape', 'Tab'].includes(e.key)) {
      e.preventDefault()
      endEditable(e)
    }
  }

  function onclose(e: Event & { currentTarget: HTMLElement }) {
    e.stopPropagation()
    props.onclose()
  }

  return (
    <div
      class="tab-btn"
      classList={{ selected: props.selected }}
      role="button"
      tabindex="0"
      onclick={props.onselect}
    >
      <div
        class="text"
        ondblclick={props.editable ? setEditable : undefined}
        onblur={endEditable}
        onkeydown={onkeydown}
        contenteditable={false}
      >
        {props.name}
      </div>
      <Show when={props.closable}>
      <button onclick={onclose}>
        <CloseIcon />
      </button>
      </Show>
    </div>
  )
}

export interface TabProps {
  labels: string[]
  selected?: number
  onselect?: (tab: number) => void
  editable?: boolean
  onedit?: (tab: number, label: string) => void
  closable?: boolean
  onclose?: (tab: number) => void
  creatable?: boolean
  oncreate?: () => void
}

export const Tabs = (props: TabProps) => {
  const [tab, setTab] = createSignal(0)

  function onselect(n: number) {
    return () => {
      setTab(n)
      props.onselect?.(n)
    }
  }

  function onedit(n: number) {
    return (label: string) => {
      props.onedit?.(n, label)
    }
  }

  function onclose(n: number) {
    return () => {
      props.onclose?.(n)
    }
  }

  return (
    <div class="head tabs">
      <For each={props.labels}>
        {(label, i) => (
          <TabButton
            name={label}
            selected={i() === tab()}
            onselect={onselect(i())}
            editable={props.editable}
            onedit={onedit(i())}
            closable={props.closable}
            onclose={onclose(i())}
          />
        )}
      </For>
      <Show when={props.closable}>
        <div class="tab-btn" role="button" tabindex="0">
          <button tabindex="0" onclick={props.oncreate}>
            <AddIcon />
          </button>
        </div>
      </Show>
    </div>
  )
}
