const Vertex = `
const quad = array<vec2<f32>, 6>(
  vec2<f32>(-1, -1), vec2<f32>(1, -1), vec2<f32>(-1, 1),
  vec2<f32>(-1, 1), vec2<f32>(1, -1), vec2<f32>(1, 1)
);

@vertex
fn main(@builtin(vertex_index) index : u32) -> @builtin(position) vec4<f32> {
  return vec4<f32>(quad[index], 0, 1);
}
`;

const Fragment = `
@group(0) @binding(0) var noiseTexture : texture_2d<f32>;
@group(1) @binding(0) var colorTexture : texture_2d<f32>;

fn linearTosRGB(linear : vec3<f32>) -> vec3<f32> {
  if (all(linear <= vec3<f32>(0.0031308))) {
    return linear * 12.92;
  }
  return (pow(abs(linear), vec3<f32>(1.0/2.4)) * 1.055) - vec3<f32>(0.055);
}

@fragment
fn main(@builtin(position) uv : vec4<f32>) -> @location(0) vec4<f32> {
  let pixel : vec2<i32> = vec2<i32>(floor(uv.xy));
  let noise : f32 = textureLoad(noiseTexture, (pixel / 2) % vec2<i32>(256), 0).x;
  let color : vec3<f32> = textureLoad(colorTexture, pixel, 0).xyz;
  let dist : f32 = distance(uv.xy / vec2<f32>(textureDimensions(colorTexture, 0)), vec2<f32>(0.5));
  let vignette : f32 = 0.2 + smoothstep(-0.2, 0.2, 0.6 - dist) * 0.8;
  return vec4<f32>(linearTosRGB(color * vignette + mix(-0.005, 0.005, noise)), 1);
}
`;

const Noise = ({ device }) => {
  const texture = device.createTexture({
    format: 'r32float',
    size: [256, 256],
    usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
  });
  const data = new Float32Array(256 * 256);
  for (let i = 0; i < (256 * 256); i++) data[i] = Math.random();
  device.queue.writeTexture({ texture }, data, { bytesPerRow: 256 * Float32Array.BYTES_PER_ELEMENT }, [256, 256]);
  return texture.createView();
};

class Postprocessing {
  constructor({ device, format }) {
    this.device = device;
    this.descriptor = {
      colorAttachments: [{
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
    };
    this.pipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: {
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
        targets: [{ format }],
      },
      primitive: {
        topology: 'triangle-list',
      },
    });
    this.uniforms = device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: Noise({ device }),
        },
      ],
    });
  }

  render(command, output) {
    const { descriptor, pipeline, textures, uniforms } = this;
    descriptor.colorAttachments[0].view = output;
    const pass = command.beginRenderPass(descriptor);
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, uniforms);
    pass.setBindGroup(1, textures);
    pass.draw(6);
    pass.end();
  }

  updateTextures({ color }) {
    const { device, pipeline } = this;
    this.textures = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(1),
      entries: [
        {
          binding: 0,
          resource: color,
        },
      ],
    });
  }
}

export default Postprocessing;
