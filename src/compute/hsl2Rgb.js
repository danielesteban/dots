const _hue2Rgb = (p, q, t) => {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
};

export default (h, s, l) => {
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    _hue2Rgb(p, q, h + 1 / 3),
    _hue2Rgb(p, q, h),
    _hue2Rgb(p, q, h - 1 / 3),
  ];
};
