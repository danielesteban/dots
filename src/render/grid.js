const Vertex = `
struct VertexInput {
  @location(0) position : vec2<f32>,
}

struct VertexOutput {
  @builtin(position) position : vec4<f32>,
  @location(0) grid : vec2<f32>,
}

@group(0) @binding(0) var<uniform> camera : mat4x4<f32>;

@vertex
fn main(vertex : VertexInput) -> VertexOutput {
  var out : VertexOutput;
  out.position = camera * vec4<f32>(vertex.position, -1, 1);
  out.grid = vertex.position * 0.5;
  return out;
}
`;

const Fragment = `
fn getLine(pos : vec2<f32>) -> vec3<f32> {
  let p : vec2<f32> = abs(fract(pos - 0.5) - 0.5) / fwidth(pos);
  let intensity : f32 = 1.0 - min(min(p.x, p.y), 1.0);
  return vec3<f32>(intensity * 0.5);
}

@group(0) @binding(1) var<uniform> time : f32;

@fragment
fn main(@location(0) grid : vec2<f32>) -> @location(0) vec4<f32> {
  let step = sin(time) * 0.1;
  return vec4<f32>(0.05 * (getLine(grid + vec2<f32>(sin(grid.y) * step, sin(grid.x) * step))), 1);
}
`;

const Plane = ({ device, size }) => {
  const buffer = device.createBuffer({
    mappedAtCreation: true,
    size: 12 * Float32Array.BYTES_PER_ELEMENT,
    usage: GPUBufferUsage.VERTEX,
  });
  new Float32Array(buffer.getMappedRange()).set([
    -0.1, size[1] + 0.1,
    size[0] + 0.1, size[1] + 0.1,
    size[0] + 0.1, -0.1,
    size[0] + 0.1, -0.1,
    -0.1, -0.1,
    -0.1, size[1] + 0.1,
  ]);
  buffer.unmap();
  return buffer;
};

class Grid {
  constructor({ renderer: { camera, device, samples, time }, size }) {
    this.device = device;
    this.geometry = Plane({ device, size });
    this.pipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        buffers: [
          {
            arrayStride: 2 * Float32Array.BYTES_PER_ELEMENT,
            attributes: [
              {
                shaderLocation: 0,
                offset: 0,
                format: 'float32x2',
              },
            ],
          },
        ],
        entryPoint: 'main',
        module: device.createShaderModule({
          code: Vertex,
        }),
      },
      fragment: {
        entryPoint: 'main',
        module: device.createShaderModule({
          code: Fragment,
        }),
        targets: [{ format: 'rgba16float' }],
      },
      primitive: {
        topology: 'triangle-list',
      },
      multisample: {
        count: samples,
      },
    });
    this.bindings = device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: { buffer: camera.buffer },
        },
        {
          binding: 1,
          resource: { buffer: time },
        },
      ],
    });
  }

  render(pass) {
    const { bindings, geometry, pipeline } = this;
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindings);
    pass.setVertexBuffer(0, geometry);
    pass.draw(6, 1, 0, 0);
  }
}

export default Grid;
