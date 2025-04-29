import monaco, { editorWorker } from './monaco'

import { createEffect } from 'solid-js'
import { Diagnostic } from './wesl-web/wesl_web'
import { dark } from './Theme'

// update dark/light monaco theme
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

interface EditorProps {
  content: string
  diagnostics?: Diagnostic[]
  readonly?: true
  onchange?: (content: string) => void
}

export const Editor = (props: EditorProps) => {
  function setupMonaco(elt: HTMLElement) {
    self.MonacoEnvironment = {
      getWorker: function (_workerId, _label) {
        return new editorWorker()
      },
    }

    const editor = monaco.editor.create(elt, {
      value: props.content,
      theme: 'theme',
      language: 'wgsl',
      mouseWheelZoom: true,
      automaticLayout: true,
      readOnly: props.readonly ?? false,
      renderValidationDecorations: 'on',
    })

    // keeping track of the editor content avoids calling editor.setValue() when source()
    // changed as a result of editing.
    let currentContent = props.content

    editor.getModel()!.onDidChangeContent(() => {
      currentContent = editor.getValue()
      props.onchange?.(currentContent)
    })

    createEffect(() => {
      if (props.content !== currentContent) {
        editor.setValue(props.content)
        editor.setScrollTop(0)
      }
    })

    createEffect(() => {
      const model = editor.getModel()!
      const markers = (props.diagnostics ?? []).map((d) => {
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
      monaco.editor.setModelMarkers(model, 'wesl', markers)
    })
  }

  return <div class="editor" ref={setupMonaco}></div>
}
