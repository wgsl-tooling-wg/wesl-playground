import { createSignal, For } from 'solid-js'
import { BsX as CloseIcon, BsPlus as AddIcon } from 'solid-icons/bs'

export interface TabButtonProps {
  name: string
  selected: boolean
  onselect: () => void
  onrename: (name: string) => void
  ondelete: () => void
}

export const TabButton = (props: TabButtonProps) => {
  function setEditable(e: Event & { currentTarget: HTMLElement }) {
    e.currentTarget.contentEditable = 'true'
    e.currentTarget.focus()
  }

  function endEditable(e: Event & { currentTarget: HTMLElement }) {
    e.currentTarget.contentEditable = 'false'
    props.onrename(e.currentTarget.textContent!)
    e.currentTarget.blur()
  }

  function onkeydown(e: KeyboardEvent & { currentTarget: HTMLElement }) {
    if (['Enter', 'Escape', 'Tab'].includes(e.key)) {
      e.preventDefault()
      endEditable(e)
    }
  }

  function ondelete(e: Event & { currentTarget: HTMLElement }) {
    e.stopPropagation()
    props.ondelete()
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
        onkeydown={onkeydown}
        contenteditable={false}
      >
        {props.name}
      </div>
      <button onclick={ondelete}>
        <CloseIcon />
      </button>
    </div>
  )
}

export interface TabProps {
  labels: string[]
  selected?: number
  onselect?: (tab: number) => void
  onrename?: (tab: number, label: string) => void
  ondelete?: (tab: number) => void
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

  function onrename(n: number) {
    return (label: string) => {
      props.onrename?.(n, label)
    }
  }

  function ondelete(n: number) {
    return () => {
      props.ondelete?.(n)
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
            onrename={onrename(i())}
            ondelete={ondelete(i())}
          />
        )}
      </For>
      <div class="tab-btn" role="button" tabindex="0">
        <button tabindex="0" onclick={props.oncreate}>
          <AddIcon />
        </button>
      </div>
    </div>
  )
}
