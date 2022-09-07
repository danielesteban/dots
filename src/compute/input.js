import { vec2 } from 'gl-matrix';

class Input {
  constructor({ camera, target }) {
    this.buttons = {
      primary: false,
      secondary: false,
    };
    this.camera = camera;
    this.pointer = vec2.fromValues(0, 0);
    window.addEventListener('blur', this.onBlur.bind(this), false);
    target.addEventListener('mousedown', this.onMouseDown.bind(this), false);
    window.addEventListener('mousemove', this.onMouseMove.bind(this), false);
    window.addEventListener('mouseup', this.onMouseUp.bind(this), false);

    {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = 20;
      canvas.height = 20;
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#111';
      ctx.arc(canvas.width * 0.5, canvas.height * 0.5, 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#eee';
      ctx.stroke();
      canvas.toBlob((blob) => {
        document.body.style.cursor = `url(${URL.createObjectURL(blob)}) 10 10, default`;
      });
    }
  }

  onBlur() {
    const { buttons } = this;
    buttons.primary = buttons.secondary = false;
  }

  onMouseDown({ button }) {
    const { buttons } = this;
    switch (button) {
      case 0:
        buttons.primary = true;
        break;
      case 2:
        buttons.secondary = true;
        break;
    }
  }

  onMouseMove({ clientX, clientY }) {
    const { pointer } = this;
    vec2.set(
      pointer,
      (clientX / window.innerWidth) * 2 - 1,
      -(clientY / window.innerHeight) * 2 + 1
    );
  }

  onMouseUp({ button }) {
    const { buttons } = this;
    switch (button) {
      case 0:
        buttons.primary = false;
        break;
      case 2:
        buttons.secondary = false;
        break;
    }
  }
}

export default Input;
