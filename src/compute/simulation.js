const Compute = ({ count, size }) => `
struct Uniforms {
  cursor : vec2<f32>,
  button : u32,
  delta : f32,
}

struct Data {
  color : vec3<f32>,
  radius : f32,
  hit : f32,
  hitTarget : f32,
  velocity : vec2<f32>,
}

@group(0) @binding(0) var<uniform> uniforms : Uniforms;
@group(0) @binding(1) var<storage, read_write> data : array<Data, ${count}>;
@group(1) @binding(0) var<storage, read> input : array<vec2<f32>, ${count}>;
@group(1) @binding(1) var<storage, read_write> output : array<vec2<f32>, ${count}>;

const size : vec2<f32> = vec2<f32>(${size[0]}, ${size[1]});

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) id : vec3<u32>) {
  let index : u32 = id.x;
  if (index >= ${count}) {
    return;
  }
  let damp = 1 - exp(-20 * uniforms.delta);
  let radius = data[index].radius;
  var hit = data[index].hitTarget;
  var vel = data[index].velocity;
  var pos = input[index];

  for (var i : u32 = 0; i < ${count}; i++) {
    if (i == index) {
      continue;
    }
    let diff = pos - input[i];
    let dist = length(diff);
    let r = data[i].radius;
    if (dist <= (radius + r)) {
      // I dunno anything about physics but this looks cool
      vel = mix(vel, (diff / dist) * clamp(abs(radius - r), 0.2, 2.0) * 0.1, damp);
      hit = 1;
      break;
    }
  }

  if (uniforms.button != 0 && distance(pos, uniforms.cursor) <= radius + 2) {
    vel = mix(vel, (pos - uniforms.cursor) * 0.2, damp);
    hit = 2;
  }

  pos += vel * (140 - radius * 40) * uniforms.delta;

  if (pos.x < radius) {
    pos.x = radius;
    vel *= vec2<f32>(-1, 1);
  }
  if (pos.x > size.x - radius) {
    pos.x = size.x - radius;
    vel *= vec2<f32>(-1, 1);
  }
  if (pos.y < radius) {
    pos.y = radius;
    vel *= vec2<f32>(1, -1);
  }
  if (pos.y > size.y - radius) {
    pos.y = size.y - radius;
    vel *= vec2<f32>(1, -1);
  }

  data[index].hit = mix(data[index].hit, hit, 1 - exp(-10 * uniforms.delta));
  data[index].hitTarget = mix(hit, 0, damp);
  data[index].velocity = vel;
  output[index] = pos;
}
`;

class Simulation {
  constructor({ count, device, size, setup }) {
    this.count = count;
    this.step = 0;
    this.data = device.createBuffer({
      mappedAtCreation: true,
      size: count * 8 * Float32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX,
    });
    this.state = Array.from({ length: 2 }, (v, i) => device.createBuffer({
      mappedAtCreation: i === 0,
      size: count * 2 * Float32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX,
    }));
    setup(new Float32Array(this.data.getMappedRange()), new Float32Array(this.state[0].getMappedRange()));
    this.data.unmap();
    this.state[0].unmap();
    {
      const data = new Float32Array(4);
      this.uniforms = {
        buffer: device.createBuffer({
          size: data.byteLength,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
        }),
        data,
        cursor: data.subarray(0, 3),
        delta: data.subarray(3, 4),
      };
    }
    this.pipeline = device.createComputePipeline({
      layout: 'auto',
      compute: {
        entryPoint: 'main',
        module: device.createShaderModule({
          code: Compute({ count, size }),
        }),
      },
    });
    this.bindings = [
      device.createBindGroup({
        layout: this.pipeline.getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: { buffer: this.uniforms.buffer },
          },
          {
            binding: 1,
            resource: { buffer: this.data },
          },
        ],
      }),
      this.state.map((buffer, i) => device.createBindGroup({
        layout: this.pipeline.getBindGroupLayout(1),
        entries: [
          {
            binding: 0,
            resource: { buffer },
          },
          {
            binding: 1,
            resource: { buffer: this.state[(i + 1) % 2] },
          },
        ],
      })),
    ];
    this.workgroups = Math.ceil(count / 256);
  }

  compute(command) {
    const { bindings, pipeline, step, workgroups } = this;
    const pass = command.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindings[0]);
    pass.setBindGroup(1, bindings[1][step]);
    pass.dispatchWorkgroups(workgroups);
    pass.end();
    this.step = (this.step + 1) % 2;
  }
}

export default Simulation;
