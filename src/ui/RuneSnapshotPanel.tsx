import { useEffect, useRef } from 'react';
import type { RuneSnapshot } from '../analysis/RuneSnapshots';

function Snapshot({ item }: { item: RuneSnapshot }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = canvas.current!;
    c.width = item.image.width; c.height = item.image.height;
    c.getContext('2d')?.putImageData(new ImageData(new Uint8ClampedArray(item.image.data), c.width, c.height), 0, 0);
  }, [item]);
  return <figure style={{ margin: 0, padding: 12, border: '1px solid #596070', borderRadius: 8 }}>
    <figcaption>{new Date(item.time).toLocaleString()}<br />{item.hidden ? '백그라운드' : item.returned ? '복귀 후 첫 분석' : '전경'} · {item.found ? '룬 검출' : '룬 미검출'} · {item.image.width} × {item.image.height}</figcaption>
    <canvas ref={canvas} style={{ display: 'block', maxWidth: '100%', height: 'auto', imageRendering: 'pixelated', margin: '8px 0' }} />
    <button onClick={() => {
      const link = document.createElement('a');
      link.href = canvas.current!.toDataURL('image/png');
      link.download = `rune-${item.time.replace(/[:.]/g, '-')}-${item.hidden ? 'background' : 'foreground'}-${item.found ? 'found' : 'missing'}.png`;
      link.click();
    }}>PNG 저장</button>
  </figure>;
}
export function RuneSnapshotPanel({ items, clear }: { items: RuneSnapshot[]; clear: () => void }) {
  return <details style={{ marginTop: 16 }}>
    <summary>룬 진단 이미지 ({items.length}/10)</summary>
    <p>실제 검사에 사용한 미니맵입니다. 백그라운드에서 약 5초마다, 복귀 후 첫 분석 때 보관합니다. 전경에서는 계속 덮어쓰지 않습니다. 브라우저 메모리에만 보관하며 새로고침하면 지워집니다.</p>
    <button onClick={clear} disabled={!items.length}>기록 지우기</button>
    {!items.length && <p>미니맵을 지정하고 룬 감지를 켠 뒤 화면을 공유하세요.</p>}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginTop: 12 }}>
      {[...items].reverse().map(item => <Snapshot key={item.time} item={item} />)}
    </div>
  </details>;
}
