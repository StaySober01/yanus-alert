export interface RuneSnapshot {
  image: ImageData;
  time: string;
  hidden: boolean;
  found: boolean;
  returned: boolean;
}
/** Bounded, in-memory copies of detector input. No storage or network writes. */
export class RuneSnapshots {
  items: RuneSnapshot[] = [];
  private lastAt = -Infinity;
  private wasHidden = false;
  add(image: ImageData, found: boolean, hidden: boolean, at: number, time: string) {
    const returned = this.wasHidden && !hidden;
    const entered = !this.wasHidden && hidden;
    this.wasHidden = hidden;
    if (this.items.length && !returned && !entered && (!hidden || at - this.lastAt < 5000)) return false;
    const copy = { width: image.width, height: image.height, colorSpace: image.colorSpace, data: new Uint8ClampedArray(image.data) } as ImageData;
    this.items = [...this.items.slice(-9), { image: copy, found, hidden, time, returned }];
    this.lastAt = at;
    return true;
  }
  clear() { this.items = []; this.lastAt = -Infinity; this.wasHidden = false; }
}
