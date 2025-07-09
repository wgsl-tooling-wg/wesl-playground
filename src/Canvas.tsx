import {
  createEffect,
  createSignal,
  on,
  onCleanup,
  onMount,
  Show,
} from 'solid-js'

const vert = `
  @vertex
  fn main(@builtin(vertex_index) VertexIndex: u32) -> @builtin(position) vec4f {
    var pos = array<vec2f, 6>(
      vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0),
      vec2f(-1.0, 1.0), vec2f(1.0, -1.0), vec2f(1.0, 1.0)
    );
    return vec4f(pos[VertexIndex], 0.0, 1.0);
  }
`

export interface RenderProps {
  frag: string
  entrypoint: string
}

export function Render(props: RenderProps) {
  let canvas!: HTMLCanvasElement
  let device: GPUDevice
  let context: GPUCanvasContext
  let pipeline: GPURenderPipeline
  let frameHandle = 0

  const [error, setError] = createSignal('')

  async function createPipeline(frag: string, entrypoint: string) {
    const fragModule = device.createShaderModule({ code: frag })

    setError('')
    const info = await fragModule.getCompilationInfo()
    if (info.messages.some((m) => m.type === 'error')) {
      const err = info.messages.map((m) => m.message).join('\n')
      setError(err)
    }

    pipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: device.createShaderModule({ code: vert }),
        entryPoint: 'main',
      },
      fragment: {
        module: fragModule,
        entryPoint: entrypoint,
        targets: [{ format: navigator.gpu.getPreferredCanvasFormat() }],
      },
      primitive: { topology: 'triangle-list' },
    })
    console.log('Created render pipeline')
  }

  function render() {
    const commandEncoder = device.createCommandEncoder()
    const pass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: context.getCurrentTexture().createView(),
          loadOp: 'clear',
          storeOp: 'store',
          clearValue: [0, 0, 0, 1],
        },
      ],
    })
    pass.setPipeline(pipeline)
    pass.draw(6)
    pass.end()
    device.queue.submit([commandEncoder.finish()])
  }

  function frame() {
    canvas.width = canvas.clientWidth
    canvas.height = canvas.clientHeight
    render()
    frameHandle = requestAnimationFrame(frame)
  }

  onMount(async () => {
    if (!navigator.gpu) {
      setError('WebGPU is not supported in your navigator.')
      return
    }

    const adapter = await navigator.gpu.requestAdapter()
    device = await adapter!.requestDevice()
    context = canvas.getContext('webgpu')!
    context.configure({
      device,
      format: navigator.gpu.getPreferredCanvasFormat(),
      alphaMode: 'premultiplied',
    })

    await createPipeline(props.frag, props.entrypoint)
    frame()
  })

  createEffect(
    on([() => props.frag, () => props.entrypoint], async () => {
      console.log('Updating render pipeline')
      if (device) {
        await createPipeline(props.frag, props.entrypoint)
      }
    }),
  )

  onCleanup(() => cancelAnimationFrame(frameHandle))

  return (
    <div class="render">
      <Show when={error()}>
        <div class="error">{error()}</div>
      </Show>
      <canvas ref={canvas} />
    </div>
  )
}
