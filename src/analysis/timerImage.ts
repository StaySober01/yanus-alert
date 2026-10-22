import type { Region } from '../domain/regions';
import type { Pixels } from './yanusLocator';
function inkWidth(frame: Pixels, bounds: Region): number {
  let left = bounds.width, right = -1;
  for (let y = Math.floor(bounds.height * 0.28); y < bounds.height * 0.81; y++) for (let x = 0; x < bounds.width; x++) {
    const i = ((bounds.y + y) * frame.width + bounds.x + x) * 4;
    if (Math.min(frame.data[i], frame.data[i+1]) - frame.data[i+2] > 35) { left = Math.min(left,x); right = Math.max(right,x); }
  }
  return Math.max(0, right - left + 1);
}
export function hasWideTimer(frame: Pixels, bounds: Region): boolean { return inkWidth(frame,bounds) > bounds.width * 0.65; }

/** Isolate yellow glyphs rather than feeding the purple icon to OCR. No expected time enters this path. */
export function timerImage(frame: Pixels, bounds: Region): Pixels {
  const left = bounds.x, top = bounds.y + Math.floor(bounds.height * 0.28);
  const width = bounds.width, height = Math.ceil(bounds.height * 0.53);
  const scale = 8, pad = 20, outWidth = width * scale + pad * 2, outHeight = height * scale + pad * 2;
  const data = new Uint8ClampedArray(outWidth * outHeight * 4).fill(255);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const index = ((top + y) * frame.width + left + x) * 4;
    const difference = Math.min(frame.data[index], frame.data[index + 1]) - frame.data[index + 2];
    const ink = Math.min(frame.data[index], frame.data[index + 1]) > 70 ? Math.max(0, Math.min(255, (difference - 15) * 4)) : 0;
    const value = 255 - ink;
    for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
      const target = (((y * scale + pad + dy) * outWidth) + x * scale + pad + dx) * 4;
      data[target] = data[target + 1] = data[target + 2] = value;
    }
  }
  {
    // Bilinear enlargement avoids huge staircase edges on 5–8px glyphs.
    const original = data.slice();
    for (let y = pad; y < outHeight - pad; y++) for (let x = pad; x < outWidth - pad; x++) {
      const sx = (x - pad + 0.5) / scale - 0.5, sy = (y - pad + 0.5) / scale - 0.5;
      const x0 = Math.floor(sx), y0 = Math.floor(sy), fx = sx - x0, fy = sy - y0;
      const at = (ix: number, iy: number) => ix < 0 || iy < 0 || ix >= width || iy >= height ? 255 : original[((iy * scale + pad) * outWidth + ix * scale + pad) * 4];
      const value = at(x0,y0)*(1-fx)*(1-fy)+at(x0+1,y0)*fx*(1-fy)+at(x0,y0+1)*(1-fx)*fy+at(x0+1,y0+1)*fx*fy;
      const target=(y*outWidth+x)*4;data[target]=data[target+1]=data[target+2]=value;
    }
  }
  // Wider text can contain a faint narrow digit next to a strong one. Lift the faint ink;
  // doing this to a single glyph distorts its shape, so use the observed footprint width.
  if (inkWidth(frame,bounds) > bounds.width * 0.30) {
    for (let i=0;i<data.length;i+=4) data[i]=data[i+1]=data[i+2]=Math.floor(255-255*Math.pow((255-data[i])/255,0.65));
  }
  return { width: outWidth, height: outHeight, data };
}



