import { createEffect, createSignal, ParentComponent, Show } from 'solid-js'
import { Transition } from 'solid-transition-group'

export const DropButton: ParentComponent<{ label: string }> = (p) => {
  const [open, setOpen] = createSignal(false)
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
    <div ref={self} class={open() ? 'visible' : 'hidden'}>
      <button class="dropdown-btn" onclick={() => setOpen(!open())}>
        {p.label}
        <span>▼</span>
      </button>
      <div
        class="dropdown-target"
        style={{
          position: 'relative',
          bottom: 0,
          left: 0,
          'z-index': 100,
          width: 'max-content',
        }}
      >
        <Transition name="fade">
          <Show when={open()}>{p.children}</Show>
        </Transition>
      </div>
    </div>
  )
}
