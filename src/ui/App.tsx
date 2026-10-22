import { useCallback, useEffect, useRef, useState } from 'react';
import { ScreenCapture } from '../capture/ScreenCapture';
import { AlertAudio } from '../audio/AlertAudio';
import { loadSettings, saveSettings } from '../settings/storage';
import { validRegion, type Region, type RegionKey } from '../domain/regions';
import { Preview } from './Preview';
const labels = { yanus: '솔 야누스 : 새벽', rune: '미니맵 룬' };
export default function App() {
  const [settings, setSettings] = useState(loadSettings);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [active, setActive] = useState<RegionKey>('yanus');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [saved, setSaved] = useState(true);
  const capture = useRef(new ScreenCapture());
  const audio = useRef(new AlertAudio());
  const alive = useRef(true);
  const report = useCallback((text: string) => setMessage(text), []);
  useEffect(() => { setSaved(saveSettings(settings)); }, [settings]);
  useEffect(() => { alive.current = true; const c = capture.current; const a = audio.current; return () => { alive.current = false; c.stop(); a.close(); }; }, []);
  useEffect(() => () => { if (imageUrl) URL.revokeObjectURL(imageUrl); }, [imageUrl]);
  async function start() {
    setMessage(''); setPending(true);
    try {
      const next = await capture.current.start(() => { setStream(null); setMessage('화면 공유가 종료되었습니다. 프레임 처리를 중단했습니다.'); });
      if (next && alive.current) { setImageUrl(null); setStream(next); }
    } catch (error) {
      if (alive.current) setMessage(error instanceof DOMException && error.name === 'NotAllowedError' ? '화면 선택을 취소했거나 공유 권한이 허용되지 않았습니다.' : error instanceof Error ? error.message : '화면 공유를 시작하지 못했습니다.');
    } finally { if (alive.current) setPending(false); }
  }
  function stop() { capture.current.stop(); setStream(null); }
  function select(region: Region) { setSettings(s => ({ ...s, regions: { ...s.regions, [active]: region } })); setMessage(''); }
  return <div className="app">
    <header><a className="brand" href="./"><span className="logo">M</span><span>Maple Alert<small>LOCAL HUNTING COMPANION</small></span></a><span className="privacy"><i /> 브라우저 내부 처리</span></header>
    <main>
      <div className="intro"><div><span className="eyebrow">WORKSPACE / 01</span><h1>사냥에 집중하는 시간</h1><p>화면을 연결하고, 알림을 받을 영역을 설정하세요.</p></div><span className="phase">1단계 · 화면 및 영역 설정</span></div>
      <div className="notice">현재 화면 공유와 영역 저장을 사용할 수 있습니다. <strong>솔 야누스·룬 자동 감지는 실제 샘플 확보 후 구현됩니다.</strong></div>
      {message && <div className="message" role="status">{message}<button onClick={() => setMessage('')} aria-label="메시지 닫기">×</button></div>}
      <div className="layout"><section className="panel main-panel">
        <div className="panel-title"><div><h2>01 <span>화면 연결</span></h2><p>{stream ? '공유 중 · 미리보기에서 관심 영역을 지정하세요.' : imageUrl ? '로컬 이미지 테스트 · 실시간 감지는 실행되지 않습니다.' : '게임 창 또는 모니터를 직접 선택합니다.'}</p></div><span className={`status ${stream ? 'live' : ''}`}>{stream ? '● 공유 중' : imageUrl ? '이미지 모드' : '대기 중'}</span></div>
        <div className="toolbar"><button className="primary" disabled={pending || !!stream} onClick={start}>{pending ? '화면 선택 중…' : '화면 공유 시작'}</button><button disabled={!stream && !pending} onClick={stop}>중지</button><label className={`file-button ${pending ? 'disabled' : ''}`}>이미지로 테스트<input type="file" accept="image/png,image/jpeg,image/webp" disabled={pending} onChange={e => {
          const file = e.target.files?.[0]; e.target.value = ''; if (!file) return;
          if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 20 * 1024 * 1024) { setMessage('20MB 이하의 PNG, JPEG, WebP 이미지를 선택해 주세요.'); return; }
          stop(); setMessage(''); setImageUrl(URL.createObjectURL(file));
        }} /></label>{imageUrl && <button onClick={() => setImageUrl(null)}>이미지 닫기</button>}</div>
        <Preview stream={stream} imageUrl={imageUrl} regions={settings.regions} active={active} onSelect={select} onError={report} />
        <div className="tip">화면 크기가 바뀌면 영역은 같은 비율로 조정됩니다. 게임 UI 배치가 달라졌다면 다시 지정해 주세요.</div>
      </section><aside>
        <section className="panel"><div className="panel-title"><h2>02 <span>관심 영역</span></h2><span className={saved ? 'save' : 'unsaved'}>{saved ? '자동 저장됨' : '저장 실패'}</span></div>
          {!saved && <p role="alert">브라우저 저장 공간을 사용할 수 없습니다. 새로고침하면 설정이 사라질 수 있습니다.</p>}
          <p className="muted">대상을 선택하고 미리보기 위에서 드래그하세요.</p>
          <div className="tabs">{(['yanus', 'rune'] as const).map(key => <button aria-pressed={active === key} className={active === key ? `selected ${key}` : ''} onClick={() => setActive(key)} key={key}>{key === 'yanus' ? '솔 야누스' : '미니맵'}</button>)}</div>
          <div className="region-info"><span className={`dot ${active}`} /><strong>{labels[active]}</strong><span>{settings.regions[active] ? '지정 완료' : '미지정'}</span></div>
          <p className="muted">{active === 'yanus' ? '솔 야누스 아이콘과 남은 시간이 포함된 버프 영역을 선택하세요.' : '룬 아이콘이 나타날 수 있는 미니맵 영역을 선택하세요.'}</p>
          <RegionFields key={`${active}-${JSON.stringify(settings.regions[active])}`} region={settings.regions[active]} onSave={select} />
          <button className="subtle" disabled={!settings.regions[active]} onClick={() => setSettings(s => ({ ...s, regions: { ...s.regions, [active]: null } }))}>이 영역 초기화</button>
        </section>
        <section className="panel"><h2>03 <span>감지 및 알림</span></h2>{(['yanus', 'rune'] as const).map(key => <div className="detector" key={key}><div><strong>{labels[key]}</strong><p>{settings.enabled[key] ? '샘플 필요 · 감지 미구현' : '사용 안 함'}{key === 'yanus' ? ' / 남은 시간 —' : ''}</p></div><input type="checkbox" role="switch" aria-label={`${labels[key]} 감지 사용 설정`} checked={settings.enabled[key]} onChange={e => setSettings(s => ({ ...s, enabled: { ...s.enabled, [key]: e.target.checked } }))} /></div>)}
          <label className="volume">알림 음량 <span>{Math.round(settings.volume * 100)}%</span><input type="range" min="0" max="1" step="0.05" value={settings.volume} onChange={e => setSettings(s => ({ ...s, volume: Number(e.target.value) }))} /></label>
          <button className="sound" onClick={() => { void audio.current.test(settings.volume).catch(() => setMessage('오디오를 재생하지 못했습니다. 브라우저 음소거 설정을 확인해 주세요.')); }}>♫ 알림음 테스트</button><small className="muted">ON/OFF 설정은 저장되며, 감지 구현 후 적용됩니다.</small>
        </section>
      </aside></div>
      <footer><span>MAPLE ALERT <b> / </b> 로컬 전용 · v0.1.0</span><span>화면 전송 없음 · 게임 입력 제어 없음</span></footer>
    </main>
  </div>;
}
function RegionFields({ region, onSave }: { region: Region | null; onSave: (r: Region) => void }) {
  const [values, setValues] = useState(() => ({ x: (region?.x ?? 0) * 100, y: (region?.y ?? 0) * 100, width: (region?.width ?? 0) * 100, height: (region?.height ?? 0) * 100 }));
  const r = { x: values.x / 100, y: values.y / 100, width: values.width / 100, height: values.height / 100 };
  return <form onSubmit={e => { e.preventDefault(); if (validRegion(r)) onSave(r); }}><div className="coordinates">{(['x', 'y', 'width', 'height'] as const).map((key, i) => <label key={key}>{['X (%)', 'Y (%)', '너비 (%)', '높이 (%)'][i]}<input type="number" min="0" max="100" step="any" required value={Number.isFinite(values[key]) ? Number(values[key].toFixed(4)) : ''} onChange={e => setValues(s => ({ ...s, [key]: e.target.valueAsNumber }))} /></label>)}</div><button className="subtle" disabled={!validRegion(r)}>좌표 적용</button></form>;
}
