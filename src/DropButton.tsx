import {
  children,
  Component,
  createEffect,
  createSignal,
  mergeProps,
  ParentComponent,
  Show,
} from 'solid-js'

export const DropButton: ParentComponent<{ label: string }> = (p) => {
  const [open, setOpen] = createSignal(false)
  const c = children(() => p.children)
  let self: HTMLDivElement

  function onClick(e: MouseEvent) {
    if (!self.contains(e.target as HTMLElement)) {
      setOpen(false)
    }
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  createEffect(() => {
    if (open()) {
      document.body.addEventListener('click', onClick)
      document.addEventListener('keydown', onKeydown)
    } else {
      document.body.removeEventListener('click', onClick)
      document.removeEventListener('keydown', onKeydown)
    }
  })

  return (
    <div ref={self}>
      <button class="drop" onclick={() => setOpen(!open())}>
        {p.label}
        <span>▼</span>
      </button>
      <div
        style={{
          position: 'relative',
          bottom: 0,
          left: 0,
          'z-index': 100,
          width: 'max-content',
        }}
      >
        <Show when={open()}>{c()}</Show>
      </div>
    </div>
  )
}
