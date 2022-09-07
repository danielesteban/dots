import { mat4, vec2 } from 'gl-matrix';

class Camera {
  constructor({ device }) {
    this.aspect = 1;
    this.near = -100;
    this.far = 100;
    this.zoom = 100;
    this.position = vec2.create();

    this.matrix = mat4.create();
    this.matrixInverse = mat4.create();

    this.device = device;
    this.buffer = device.createBuffer({
      size: this.matrix.byteLength,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
    });
  }

  update() {
    const {
      device, buffer,
      matrix, matrixInverse,
      aspect, near, far, zoom, position,
    } = this;
    const x = zoom * aspect * 0.5;
    const y = zoom * 0.5;
    mat4.ortho(
      matrix,
      position[0] - x, position[0] + x,
      position[1] - y, position[1] + y,
      near, far
    );
    mat4.invert(matrixInverse, matrix);
    device.queue.writeBuffer(buffer, 0, matrix);
  }
}

export default Camera;
