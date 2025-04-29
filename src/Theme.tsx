import { IconTypes } from 'solid-icons'
import { createEffect, createSignal } from 'solid-js'
import {
  BsSun as LightIcon,
  BsMoon as DarkIcon,
  BsCircleHalf as SystemIcon,
  BsGithub as GithubIcon,
} from 'solid-icons/bs'
import { createLocalSignal } from './storage'

export const [theme, setTheme] = createLocalSignal('theme', 'system')

export const [dark, setDark] = createSignal(
  window.matchMedia('(prefers-color-scheme: dark)').matches,
)
window
  .matchMedia('(prefers-color-scheme: dark)')
  .addEventListener('change', (e) => {
    if (theme() === 'system') setDark(e.matches)
  })

createEffect(() => {
  if (theme() === 'dark') {
    document.documentElement.classList.remove('light')
    document.documentElement.classList.add('dark')
    setDark(true)
  } else if (theme() === 'light') {
    document.documentElement.classList.remove('dark')
    document.documentElement.classList.add('light')
    setDark(false)
  } else {
    document.documentElement.classList.remove('dark')
    document.documentElement.classList.remove('light')
    setDark(window.matchMedia('(prefers-color-scheme: dark)').matches)
  }
})

function toggleTheme() {
  if (theme() === 'system') setTheme('dark')
  else if (theme() === 'dark') setTheme('light')
  else if (theme() === 'light') setTheme('system')
}

export const ThemeIcon: IconTypes = (props) => (
  <>
    {() =>
      theme() === 'dark' ? (
        <DarkIcon {...props} />
      ) : theme() === 'light' ? (
        <LightIcon {...props} />
      ) : (
        <SystemIcon {...props} />
      )
    }
  </>
)

export const ThemeButton = () => (
  <ThemeIcon class="icon" on:click={toggleTheme} />
)
