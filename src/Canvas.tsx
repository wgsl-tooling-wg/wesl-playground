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
  let uniformBuffer: GPUBuffer
  let bindGroup: GPUBindGroup
  let frameHandle = 0
  let mouse = { x: 0, y: 0 }
  let time = 0

  const [message, setMessage] = createSignal('')

  async function createPipeline(frag: string, entrypoint: string) {
    const code = frag
    const fragModule = device.createShaderModule({ code })

    setMessage('')
    const info = await fragModule.getCompilationInfo()
    if (info.messages.some((m) => m.type === 'error')) {
      const err = info.messages.map((m) => m.message).join('\n')
      setMessage(err)
      return
    }

    uniformBuffer = device.createBuffer({
      label: 'uniforms buffer',
      size: 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })

    const bindGroupLayout = device.createBindGroupLayout({
      label: 'uniforms bind group layout',
      entries: [
        {
          // uniforms
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform' },
        },
      ],
    })

    bindGroup = device.createBindGroup({
      label: 'uniforms bind group',
      layout: bindGroupLayout,
      entries: [
        {
          // uniforms
          binding: 0,
          resource: { buffer: uniformBuffer },
        },
      ],
    })

    const pipelineLayout = device.createPipelineLayout({
      label: 'render pipeline layout',
      bindGroupLayouts: [bindGroupLayout],
    })

    pipeline = device.createRenderPipeline({
      label: 'render pipeline',
      layout: pipelineLayout,
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

    setMessage('')
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
    pass.setBindGroup(0, bindGroup)
    pass.draw(6)
    pass.end()
    device.queue.submit([commandEncoder.finish()])
  }

  function clear() {
    const commandEncoder = device.createCommandEncoder();
    const pass = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: context.getCurrentTexture().createView(),
        loadOp: 'clear',
        storeOp: 'store',
        clearValue: [0, 0, 0, 1],
      }]
    });

    pass.end();
    device.queue.submit([commandEncoder.finish()]);
  }

  function frame() {
    canvas.width = canvas.clientWidth
    canvas.height = canvas.clientHeight

    const timestamp = performance.now() / 1000
    const bufferData = new Float32Array(8)
    const vp = canvas.getBoundingClientRect()
    bufferData[0] = vp.width
    bufferData[1] = vp.height
    bufferData[2] = mouse.x - vp.left
    bufferData[3] = mouse.y - vp.top
    bufferData[4] = timestamp
    bufferData[5] = timestamp - time
    time - timestamp
    device.queue.writeBuffer(uniformBuffer, 0, bufferData.buffer)

    render()
    frameHandle = requestAnimationFrame(frame)
  }

  onMount(async () => {
    if (!navigator.gpu) {
      return
    }

    window.addEventListener('mousemove', onMouseMove)

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
      if (device && props.frag) {
      }
      if (!navigator.gpu) {
        setMessage('WebGPU is not supported in your navigator')
      }
      else if (!device) {
        setMessage('WebGPU is not initialized')
      }
      else if (!props.frag) {
        setMessage('Shader compilation error')
      }
      else {
        setMessage('Updating shader…')
        clear()
        await createPipeline(props.frag, props.entrypoint)
        time = performance.now()
      }
    }),
  )

  onCleanup(() => {
    window.removeEventListener('mousemove', onMouseMove)
    cancelAnimationFrame(frameHandle)
  })

  function onMouseMove(e: MouseEvent) {
    mouse.x = e.clientX
    mouse.y = e.clientY
  }

  return (
    <div class="render">
      <Show when={message()}>
        <div class="error">{message()}</div>
      </Show>
      <canvas ref={canvas} />
    </div>
  )
}
