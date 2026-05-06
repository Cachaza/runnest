export function hexToRgbTriplet(hex: string) {
  const normalized = hex.replace('#', '');
  const value = Number.parseInt(normalized, 16);

  return `${(value >> 16) & 255} ${(value >> 8) & 255} ${value & 255}`;
}

export function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace('#', '');
  const value = Number.parseInt(normalized, 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;

  return `rgba(${red},${green},${blue},${alpha})`;
}
