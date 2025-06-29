// ✅ First: Convert RGB to HSL — must be on top
export function rgbToHsl(
  r: number,
  g: number,
  b: number
): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h = 0,
    s = 0,
    l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return [h * 360, s, l];
}

// ✅ Now safe: getPalette can use rgbToHsl
export const getPalette = (img: HTMLImageElement, count = 10): string[] => {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = 100;
  canvas.height = (img.height / img.width) * 100;
  ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);

  const imageData = ctx?.getImageData(0, 0, canvas.width, canvas.height);
  const colorMap: Record<string, number> = {};

  if (!imageData) return [];

  for (let i = 0; i < imageData.data.length; i += 40) {
    const r = imageData.data[i];
    const g = imageData.data[i + 1];
    const b = imageData.data[i + 2];
    const a = imageData.data[i + 3];

    if (a < 100) continue;

    const [h, s, l] = rgbToHsl(r, g, b);

    if (
      (r > 240 && g > 240 && b > 240) || // white
      (r < 20 && g < 20 && b < 20) || // black
      s < 0.15 ||
      l < 0.15 ||
      l > 0.85
    ) {
      continue;
    }

    const key = `${Math.round(r / 10)}-${Math.round(g / 10)}-${Math.round(
      b / 10
    )}`;
    colorMap[key] = (colorMap[key] || 0) + 1;
  }

  const sortedColors = Object.entries(colorMap)
    .sort((a, b) => b[1] - a[1])
    .map(([key]) => {
      const [r, g, b] = key.split("-").map((v) => parseInt(v) * 10);
      return `rgb(${r}, ${g}, ${b})`;
    });

  const uniqueColors: string[] = [];
  for (const color of sortedColors) {
    const [r1, g1, b1] = color.match(/\d+/g)!.map(Number);
    const isSimilar = uniqueColors.some((existing) => {
      const [r2, g2, b2] = existing.match(/\d+/g)!.map(Number);
      const dist = Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
      return dist < 60;
    });
    if (!isSimilar) uniqueColors.push(color);
    if (uniqueColors.length >= count) break;
  }

  return uniqueColors;
};

// ✅ Suggest pastel background
export const suggestBackground = (palette: string[]): string => {
  if (palette.length === 0) return "#f4f4f4";

  let hTotal = 0,
    sTotal = 0,
    lTotal = 0;

  palette.forEach((color) => {
    const rgb = color
      .replace(/[^\d,]/g, "")
      .split(",")
      .map(Number);
    const [h, s, l] = rgbToHsl(rgb[0], rgb[1], rgb[2]);
    hTotal += h;
    sTotal += s;
    lTotal += l;
  });

  const count = palette.length;
  const avgH = hTotal / count;
  const avgS = Math.min(sTotal / count, 0.3);
  const avgL = 0.9;

  return hslToRgb(avgH, avgS, avgL);
};

// ✅ Convert HSL to pastel-style RGB
export const hslToRgb = (h: number, s: number, l: number): string => {
  let r: number, g: number, b: number;

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  h /= 360;

  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(
    b * 255
  )})`;
};
