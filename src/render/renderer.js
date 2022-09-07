import Postprocessing from './postprocessing.js';

class Renderer {
  constructor({
    adapter,
    camera,
    device,
    samples = 4,
  }) {
    const format = navigator.gpu.getPreferredCanvasFormat(adapter);
    this.camera = camera;
    this.device = device;
    this.samples = samples;
    this.canvas = document.createElement('canvas');
    {
      // I have no idea why but if I don't do this, sometimes it crashes with:
      // D3D12 reset command allocator failed with E_FAIL
      this.canvas.width = Math.floor(window.innerWidth * (window.devicePixelRatio || 1));
      this.canvas.height = Math.floor(window.innerHeight * (window.devicePixelRatio || 1));
    }
    this.context = this.canvas.getContext('webgpu');
    this.context.configure({ alphaMode: 'opaque', device, format });
    this.descriptor = {
      colorAttachments: [
        {
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    };
    this.postprocessing = new Postprocessing({ device, format });
    this.scene = [];
    this.size = new Float32Array(2);
    this.textures = new Map();
    this.time = device.createBuffer({
      size: Float32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
    });
  }

  render(command) {
    const {
      context,
      descriptor,
      postprocessing,
      scene,
    } = this;
    const pass = command.beginRenderPass(descriptor);
    scene.forEach((object) => object.render(pass));
    pass.end();
    postprocessing.render(command, context.getCurrentTexture().createView());
  }

  setSize(width, height) {
    const {
      camera,
      canvas,
      descriptor,
      postprocessing,
      size,
    } = this;
    const pixelRatio = window.devicePixelRatio || 1;
    canvas.width = size[0] = Math.floor(width * pixelRatio);
    canvas.height = size[1] = Math.floor(height * pixelRatio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    camera.aspect = width / height;

    this.updateTexture('color', 'rgba16float', descriptor.colorAttachments[0]);
    postprocessing.updateTextures({
      color: descriptor.colorAttachments[0].resolveTarget,
    });
  }

  updateTexture(key, format, target) {
    const { device, samples, size, textures } = this;
    const current = textures.get(key);
    if (current) {
      current.forEach((texture) => texture.destroy());
    }
    textures.set(key, [samples, 1].map((sampleCount) => {
      const texture = device.createTexture({
        format,
        sampleCount,
        size,
        usage: (
          GPUTextureUsage.RENDER_ATTACHMENT
          | (sampleCount === 1 ? GPUTextureUsage.TEXTURE_BINDING : 0)
        ),
      });
      if (sampleCount === 1) {
        target.resolveTarget = texture.createView();
      } else {
        target.view = texture.createView();
      }
      return texture;
    }));
  }
}

export default Renderer;
