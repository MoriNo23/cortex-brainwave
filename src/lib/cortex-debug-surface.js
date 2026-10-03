export function mountDebugSurface({
  bindings,
  target = window,
}) {
  target.__CORTEX__ = bindings;
  return target.__CORTEX__;
}
