import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { clamp, regionFromPoints, type Point, type Region, type RegionKey } from '../domain/regions';
import { CanvasFrameSource } from '../capture/CanvasFrameSource';
import { IDLE_YANUS, YanusSession, type YanusStatus } from '../analysis/YanusSession';
const names = { yanus: '솔 야누스', rune: '미니맵' };
interface Props { stream: MediaStream | null; imageUrl: string | null; regions: Record<RegionKey, Region | null>; active: RegionKey; onSelect: (region: Region) => void; onError: (message: string) => void; yanusEnabled: boolean; onDetection: (status: YanusStatus) => void; onAlert: () => void }
export function Preview({ stream, imageUrl, regions, active, onSelect, onError, yanusEnabled, onDetection, onAlert }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const image = useRef<HTMLImageElement>(null);
  const crop = useRef<HTMLCanvasElement>(null);
  const start = useRef<Point | null>(null);
  const [draft, setDraft] = useState<Region | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const ready = size.width > 0;
  useEffect(() => {
    setSize({ width: 0, height: 0 }); setDraft(null); start.current = null;
    const v = video.current;
    if (!v) return;
    v.srcObject = stream;
    if (stream) void v.play().catch(() => onError('미리보기를 재생하지 못했습니다. 공유를 다시 시작해 주세요.'));
    return () => { v.pause(); v.srcObject = null; };
  }, [stream, imageUrl, onError]);
  useEffect(() => { start.current = null; setDraft(null); }, [active]);
  useEffect(() => {
    const source = stream ? video.current : imageUrl ? image.current : null;
    if (!yanusEnabled || !source || !ready) { onDetection(IDLE_YANUS); return; }
    const session = new YanusSession(new CanvasFrameSource(source), !!stream, onDetection, onAlert);
    session.start();
    return () => session.stop();
  // A live resize must not reset the once-per-cycle alert latch.
  }, [stream, imageUrl, ready, yanusEnabled, onDetection, onAlert]);
  useEffect(() => {
    const source = stream ? video.current : image.current;
    const canvas = crop.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (!source || !size.width || !regions[active]) return;
    const frames = new CanvasFrameSource(source);
    const draw = () => {
      const frame = frames.read(regions[active]!);
      if (!frame) return;
      canvas.width = frame.image.width; canvas.height = frame.image.height;
      context.putImageData(frame.image, 0, 0);
    };
    draw();
    if (stream) { const timer = window.setInterval(draw, 250); return () => clearInterval(timer); }
  }, [stream, imageUrl, regions, active, size]);
  function point(e: PointerEvent<HTMLDivElement>): Point {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: clamp((e.clientX - rect.left) / rect.width), y: clamp((e.clientY - rect.top) / rect.height) };
  }
  const box = (r: Region) => ({ left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.width * 100}%`, height: `${r.height * 100}%` });
  return <>
    <div className="preview-heading"><span>공유 화면 미리보기</span><span>{size.width ? `${size.width} × ${size.height}` : '입력 대기'}</span></div>
    <div className="preview-well">
      {!stream && !imageUrl ? <div className="empty"><span className="screen-icon">▣</span><h2>게임 화면을 연결해 주세요</h2><p>화면 공유를 시작한 뒤 게임 창이나 모니터를 선택하세요.</p><small>이미지는 브라우저 내부에서만 처리됩니다.</small></div> :
      <div className="frame" style={{ aspectRatio: size.width ? `${size.width}/${size.height}` : '16/9' }}>
        {stream ? <video ref={video} muted playsInline onResize={() => { const v = video.current!; setSize({ width: v.videoWidth, height: v.videoHeight }); start.current = null; setDraft(null); }} /> : <img ref={image} src={imageUrl!} alt="로컬 테스트 이미지" onLoad={() => setSize({ width: image.current!.naturalWidth, height: image.current!.naturalHeight })} onError={() => onError('이미지를 읽을 수 없습니다. PNG 또는 JPEG 파일을 선택해 주세요.')} />}
        {!!size.width && <div className={`selection ${active === 'yanus' ? 'auto-selection' : ''}`} aria-label={active === 'yanus' ? '솔 야누스 자동 탐색 결과' : '미니맵 영역을 드래그하여 선택'} onPointerDown={e => { if (e.button !== 0 || active === 'yanus') return; start.current = point(e); setDraft(null); e.currentTarget.setPointerCapture(e.pointerId); }} onPointerMove={e => { if (start.current) setDraft(regionFromPoints(start.current, point(e))); }} onPointerUp={e => {
          if (!start.current) return;
          const r = regionFromPoints(start.current, point(e)); start.current = null; setDraft(null);
          if (r.width * size.width >= 4 && r.height * size.height >= 4) onSelect(r);
          else onError('영역의 가로와 세로를 각각 원본 기준 4픽셀 이상으로 지정해 주세요.');
        }} onPointerCancel={() => { start.current = null; setDraft(null); }} onLostPointerCapture={() => { start.current = null; setDraft(null); }}>
          {(['yanus', 'rune'] as const).map(key => regions[key] && <div key={key} className={`region ${key}`} style={box(regions[key]!)}><span>{names[key]}{key === 'yanus' ? ' · 자동' : ''}</span></div>)}
          {draft && <div className={`region draft ${active}`} style={box(draft)} />}
        </div>}
      </div>}
    </div>
    <div className="crop-row"><div><strong>{active === 'yanus' ? '자동 탐색 영역 확인' : '선택 영역 확인'}</strong><p>{names[active]} · {regions[active] ? size.width ? '원본 프레임에서 추출한 영역' : '저장된 영역 · 화면 입력 대기' : active === 'yanus' ? '현재 확정된 탐색 위치가 없습니다.' : '아직 영역을 지정하지 않았습니다.'}</p></div><canvas ref={crop} className={regions[active] && size.width ? 'crop' : 'crop hidden'} width="1" height="1" /></div>
  </>;
}
