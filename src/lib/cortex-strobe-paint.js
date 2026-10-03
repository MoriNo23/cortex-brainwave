/* Pintado puro de la superficie estroboscópica.

   Todo lo que vive aquí es autocontenido a propósito: la ventana flotante
   (Picture-in-Picture) necesita ejecutar exactamente este mismo pintado dentro
   de un Worker, y para eso se inyecta el fuente de estas funciones tal cual
   (`fn.toString()`). Si una función de aquí pasa a depender de algo del módulo,
   el Worker se rompe: no hay closures disponibles al otro lado. */

export const STROBE_PALETTE = Object.freeze({
  backdrop: '#05060A',
  idle: [17, 19, 26],
  pulse: [246, 185, 106],
  halo: [246, 185, 106],
});

export function strobeFillColor(intensity, palette) {
  const t = intensity < 0 ? 0 : intensity > 1 ? 1 : intensity;
  const from = palette.idle;
  const to = palette.pulse;
  const r = Math.round(from[0] + (to[0] - from[0]) * t);
  const g = Math.round(from[1] + (to[1] - from[1]) * t);
  const b = Math.round(from[2] + (to[2] - from[2]) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

/* Un único punto de verdad para el fotograma: el canvas integrado, el canvas de
   la ventana flotante y el canvas del Worker pintan con esta función. */
export function paintStrobeSurface(ctx, width, height, intensity, palette) {
  const w = width;
  const h = height;
  const level = intensity < 0 ? 0 : intensity > 1 ? 1 : intensity;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = palette.backdrop;
  ctx.fillRect(0, 0, w, h);

  const halo = palette.halo;
  const haloAlpha = 0.08 + 0.26 * level;
  const gradient = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.55);
  gradient.addColorStop(0, `rgba(${halo[0]}, ${halo[1]}, ${halo[2]}, ${haloAlpha.toFixed(3)})`);
  gradient.addColorStop(1, 'rgba(5, 6, 10, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);

  const size = Math.min(w, h) * 0.48;
  const x = (w - size) / 2;
  const y = (h - size) / 2;

  ctx.fillStyle = strobeFillColor(level, palette);
  ctx.shadowBlur = 40 * level;
  ctx.shadowColor = `rgba(${halo[0]}, ${halo[1]}, ${halo[2]}, ${(0.12 + 0.63 * level).toFixed(3)})`;
  ctx.fillRect(x, y, size, size);
  ctx.shadowBlur = 0;

  ctx.strokeStyle = `rgba(255, 255, 255, ${(0.12 + 0.43 * level).toFixed(3)})`;
  ctx.lineWidth = Math.max(2, Math.round(size * 0.012));
  ctx.strokeRect(x, y, size, size);
}
