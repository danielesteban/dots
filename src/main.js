import './main.css';
import { vec3 } from 'gl-matrix';
import Camera from './render/camera.js';
import Dots from './render/dots.js';
import Grid from './render/grid.js';
import hsl2Rgb from './compute/hsl2Rgb.js';
import Input from './compute/input.js';
import Renderer from './render/renderer.js';
import Simulation from './compute/simulation.js';

const Main = ({ adapter, device }) => {
  const camera = new Camera({ device });
  const renderer = new Renderer({ adapter, camera, device });
  document.getElementById('renderer').appendChild(renderer.canvas);
  renderer.setSize(window.innerWidth, window.innerHeight);
  window.addEventListener('resize', () => (
    renderer.setSize(window.innerWidth, window.innerHeight)
  ), false);

  const size = new Float32Array([240, 135]);
  camera.position[0] = size[0] * 0.5;
  camera.position[1] = size[1] * 0.5;
  camera.zoom = 90;

  const simulation = new Simulation({
    count: 16384,
    device,
    size,
    setup: (data, state) => {
      for (let i = 0, j = 0, l = data.length; i < l; i += 8, j += 2) {
        const r = 1 - (i / l);
        data.set([
          // r g b
          ...hsl2Rgb(Math.random(), 0.2 + Math.random() * 0.6, 0.2 + Math.random() * 0.4),
          // radius
          0.2 + r * 0.8,
          // hit
          0,
          0,
          // velocity
          Math.random() - 0.5, Math.random() - 0.5
        ], i);
        state.set([
          // position
          Math.random() * size[0], Math.random() * size[1],
        ], j);
      }
    },
  });

  const grid = new Grid({ renderer, size });
  renderer.scene.push(grid);

  const dots = new Dots({ renderer, simulation });
  renderer.scene.push(dots);

  const input = new Input({ camera, target: renderer.canvas });

  const time = new Float32Array([performance.now() / 1000]);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      time[0] = performance.now() / 1000;
    }
  }, false);

  const animate = () => {
    requestAnimationFrame(animate);

    const clock = performance.now() / 1000;
    simulation.uniforms.delta[0] = Math.min(clock - time[0], 1);
    time[0] = clock;
    device.queue.writeBuffer(renderer.time, 0, time);

    const d = size[1] * 0.15;
    const t = time[0] * 0.1;
    camera.position[0] = size[0] * 0.5 + Math.sin(t) * d;
    camera.position[1] = size[1] * 0.5 + Math.cos(t) * d;
    camera.update();

    vec3.set(simulation.uniforms.cursor, input.pointer[0], input.pointer[1], 0.5);
    vec3.transformMat4(simulation.uniforms.cursor, simulation.uniforms.cursor, camera.matrixInverse);
    simulation.uniforms.cursor[2] = input.buttons.primary ? 1 : 0;
    device.queue.writeBuffer(simulation.uniforms.buffer, 0, simulation.uniforms.data);

    const command = device.createCommandEncoder();
    simulation.compute(command);
    renderer.render(command);
    device.queue.submit([command.finish()]);
  };

  requestAnimationFrame(animate);
};

const GPU = async () => {
  if (!navigator.gpu) {
    throw new Error('WebGPU support');
  }
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    throw new Error('WebGPU adapter');
  }
  const device = await adapter.requestDevice();
  const check = device.createShaderModule({
    code: `const checkConstSupport : f32 = 1;`,
  });
  const { messages } = await check.compilationInfo();
  if (messages.find(({ type }) => type === 'error')) {
    throw new Error('WGSL const support');
  }
  return { adapter, device };
};

GPU()
  .then(Main)
  .catch((e) => {
    console.error(e);
    document.getElementById('canary').classList.add('enabled');
  })
  .finally(() => document.getElementById('loading').classList.remove('enabled'));
