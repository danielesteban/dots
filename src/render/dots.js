const Vertex = `
struct VertexInput {
  @location(0) position : vec2<f32>,
  @location(1) uv : vec2<f32>,
  @location(2) color : vec3<f32>,
  @location(3) radius : f32,
  @location(4) hit : f32,
  @location(5) instance : vec2<f32>,
}

struct VertexOutput {
  @builtin(position) position : vec4<f32>,
  @location(0) color : vec3<f32>,
  @location(1) light : f32,
  @location(2) uv : vec2<f32>,
}

@group(0) @binding(0) var<uniform> camera : mat4x4<f32>;

@vertex
fn main(vertex : VertexInput) -> VertexOutput {
  var out : VertexOutput;
  out.position = camera * vec4<f32>(vertex.position * vertex.radius + vertex.instance, 0, 1);
  out.color = vertex.color;
  out.light = vertex.hit;
  out.uv = (vertex.uv - 0.5) * 2;
  return out;
}
`;

const Fragment = `
struct FragmentInput {
  @location(0) color : vec3<f32>,
  @location(1) light : f32,
  @location(2) uv : vec2<f32>,
}

@fragment
fn main(fragment : FragmentInput) -> @location(0) vec4<f32> {
  let l = min(length(fragment.uv), 1);
  return vec4<f32>(fragment.color * (1 + fragment.light - l), 1 - smoothstep(0.8, 1, l));
}
`;

const Plane = ({ device, size = [2, 2] }) => {
  const buffer = device.createBuffer({
    mappedAtCreation: true,
    size: 24 * Float32Array.BYTES_PER_ELEMENT,
    usage: GPUBufferUsage.VERTEX,
  });
  new Float32Array(buffer.getMappedRange()).set([
    size[0] * -0.5, size[1] * 0.5,      0, 0,
    size[0] * 0.5, size[1] * 0.5,       1, 0,
    size[0] * 0.5, size[1] * -0.5,      1, 1,
    size[0] * 0.5, size[1] * -0.5,      1, 1,
    size[0] * -0.5, size[1] * -0.5,     0, 1,
    size[0] * -0.5, size[1] * 0.5,      0, 0,
  ]);
  buffer.unmap();
  return buffer;
};

class Dots {
  constructor({ renderer: { camera, device, samples }, simulation }) {
    this.device = device;
    this.geometry = Plane({ device });
    this.pipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        buffers: [
          {
            arrayStride: 4 * Float32Array.BYTES_PER_ELEMENT,
            attributes: [
              {
                shaderLocation: 0,
                offset: 0,
                format: 'float32x2',
              },
              {
                shaderLocation: 1,
                offset: 2 * Float32Array.BYTES_PER_ELEMENT,
                format: 'float32x2',
              },
            ],
          },
          {
            arrayStride: 8 * Float32Array.BYTES_PER_ELEMENT,
            stepMode: 'instance',
            attributes: [
              {
                shaderLocation: 2,
                offset: 0,
                format: 'float32x3',
              },
              {
                shaderLocation: 3,
                offset: 3 * Float32Array.BYTES_PER_ELEMENT,
                format: 'float32',
              },
              {
                shaderLocation: 4,
                offset: 4 * Float32Array.BYTES_PER_ELEMENT,
                format: 'float32',
              },
            ],
          },
          {
            arrayStride: 2 * Float32Array.BYTES_PER_ELEMENT,
            stepMode: 'instance',
            attributes: [
              {
                shaderLocation: 5,
                offset: 0,
                format: 'float32x2',
              },
            ],
          }
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
        targets: [{
          format: 'rgba16float',
          blend: {
            color: {
              srcFactor: 'src-alpha',
              dstFactor: 'one-minus-src-alpha',
              operation: 'add',
            },
            alpha: {
              srcFactor: 'src-alpha',
              dstFactor: 'one-minus-src-alpha',
              operation: 'add',
            },
          },
        }],
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
      ],
    });
    this.simulation = simulation;
  }

  render(pass) {
    const { bindings, geometry, pipeline, simulation } = this;
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindings);
    pass.setVertexBuffer(0, geometry);
    pass.setVertexBuffer(1, simulation.data);
    pass.setVertexBuffer(2, simulation.state[simulation.step]);
    pass.draw(6, simulation.count, 0, 0);
  }
}

export default Dots;
