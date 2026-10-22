import { IDLE_RUNE, type RuneStatus } from '../analysis/RuneSession';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScreenCapture } from '../capture/ScreenCapture';
import { AlertAudio } from '../audio/AlertAudio';
import { loadSettings, saveSettings } from '../settings/storage';
import { validRegion, type Region, type RegionKey } from '../domain/regions';
import { Preview } from './Preview';
import { IDLE_YANUS, type YanusStatus } from '../analysis/YanusSession';
const labels = { yanus: '솔 야누스 : 새벽', rune: '미니맵 룬' };
export default function App() {
  const [settings, setSettings] = useState(loadSettings);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [active, setActive] = useState<RegionKey>('yanus');
  const [rune, setRune] = useState<RuneStatus>(IDLE_RUNE);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [saved, setSaved] = useState(true);
  const [yanus, setYanus] = useState<YanusStatus>(IDLE_YANUS);
  const displayRegions = useMemo(() => ({ yanus: yanus.region, rune: settings.regions.rune }), [yanus.region, settings.regions.rune]);
  const capture = useRef(new ScreenCapture());
  const audio = useRef(new AlertAudio());
  const volume = useRef(settings.volume); volume.current = settings.volume;
  const alive = useRef(true);
  const report = useCallback((text: string) => setMessage(text), []);
  const runeAlert = useCallback(() => { void audio.current.play(volume.current, 'rune').catch(error => setMessage(error instanceof Error ? error.message : '룬 알림음 재생 실패')); }, []);
  const alert = useCallback(() => { void audio.current.play(volume.current, 'yanus').catch(error => setMessage(error instanceof Error ? error.message : '알림음 재생에 실패했습니다.')); }, []);
  useEffect(() => { if (!settings.enabled.rune) audio.current.stop(); }, [settings.enabled.rune]);
  useEffect(() => { if (!settings.enabled.yanus) audio.current.stop(); }, [settings.enabled.yanus]);
  useEffect(() => { setSaved(saveSettings(settings)); }, [settings]);
  useEffect(() => { alive.current = true; const c = capture.current; const a = audio.current; return () => { alive.current = false; c.stop(); a.close(); }; }, []);
  useEffect(() => () => { if (imageUrl) URL.revokeObjectURL(imageUrl); }, [imageUrl]);
  async function start() {
    setMessage(''); setPending(true);
    void audio.current.prepare().catch(() => setMessage('알림음 테스트로 오디오를 활성화해 주세요.'));
    try {
      const next = await capture.current.start(() => { audio.current.stop(); setStream(null); setMessage('화면 공유가 종료되었습니다. 프레임 처리를 중단했습니다.'); });
      if (next && alive.current) { setImageUrl(null); setStream(next); }
    } catch (error) {
      if (alive.current) setMessage(error instanceof DOMException && error.name === 'NotAllowedError' ? '화면 선택을 취소했거나 공유 권한이 허용되지 않았습니다.' : error instanceof Error ? error.message : '화면 공유를 시작하지 못했습니다.');
    } finally { if (alive.current) setPending(false); }
  }
  function stop() { capture.current.stop(); audio.current.stop(); setStream(null); }
  function select(region: Region) { setSettings(s => ({ ...s, regions: { ...s.regions, [active]: region } })); setMessage(''); }
  return <div className="app">
    <header><a className="brand" href="./"><span className="logo">M</span><span>Maple Alert<small>LOCAL HUNTING COMPANION</small></span></a><span className="privacy"><i /> 브라우저 내부 처리</span></header>
    <main>
      <div className="intro"><div><span className="eyebrow">WORKSPACE / 03</span><h1>사냥에 집중하는 시간</h1><p>화면을 연결하면 솔 야누스 아이콘과 남은 시간을 읽습니다.</p></div><span className="phase">3단계 · 시간 판독 및 알림 실험</span></div>
      <div className="notice">솔 야누스는 자동 탐색하고 시간 흐름을 검증합니다. <strong>공유 영상에서 확인된 시간이 10초 이하이면 주기당 한 번 알립니다. 정지 이미지 테스트는 소리를 내지 않습니다. 미니맵을 지정하면 보라색 마름모 룬을 연속 확인하여 한 번 알립니다.</strong></div>
      {message && <div className="message" role="status">{message}<button onClick={() => setMessage('')} aria-label="메시지 닫기">×</button></div>}
      <div className="layout"><section className="panel main-panel">
        <div className="panel-title"><div><h2>01 <span>화면 연결</span></h2><p>{stream ? '공유 중 · 솔 야누스를 자동 탐색합니다.' : imageUrl ? '로컬 이미지 테스트 · 전체 이미지에서 아이콘을 찾습니다.' : '게임 창 또는 모니터를 직접 선택합니다.'}</p></div><span className={`status ${stream ? 'live' : ''}`}>{stream ? '● 공유 중' : imageUrl ? '이미지 모드' : '대기 중'}</span></div>
        <div className="toolbar"><button className="primary" disabled={pending || !!stream} onClick={start}>{pending ? '화면 선택 중…' : '화면 공유 시작'}</button><button disabled={!stream && !pending} onClick={stop}>중지</button><label className={`file-button ${pending ? 'disabled' : ''}`}>이미지로 테스트<input type="file" accept="image/png,image/jpeg,image/webp" disabled={pending} onChange={e => {
          const file = e.target.files?.[0]; e.target.value = ''; if (!file) return;
          if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 20 * 1024 * 1024) { setMessage('20MB 이하의 PNG, JPEG, WebP 이미지를 선택해 주세요.'); return; }
          stop(); setMessage(''); setImageUrl(URL.createObjectURL(file));
        }} /></label>{imageUrl && <button onClick={() => setImageUrl(null)}>이미지 닫기</button>}</div>
        <Preview stream={stream} imageUrl={imageUrl} regions={displayRegions} active={active} onSelect={select} onError={report} yanusEnabled={settings.enabled.yanus} onDetection={setYanus} onAlert={alert} runeEnabled={settings.enabled.rune} onRuneDetection={setRune} onRuneAlert={runeAlert} />
        <div className="tip">솔 야누스는 전체 화면에서 탐색합니다. 미니맵은 직접 지정하며, 게임 UI 배치가 바뀌면 다시 지정해 주세요.</div>
      </section><aside>
        <section className="panel"><div className="panel-title"><h2>02 <span>관심 영역</span></h2><span className={saved ? 'save' : 'unsaved'}>{saved ? '자동 저장됨' : '저장 실패'}</span></div>
          {!saved && <p role="alert">브라우저 저장 공간을 사용할 수 없습니다. 새로고침하면 설정이 사라질 수 있습니다.</p>}
          <p className="muted">솔 야누스는 자동 탐색, 미니맵은 드래그로 지정합니다.</p>
          <div className="tabs">{(['yanus', 'rune'] as const).map(key => <button aria-pressed={active === key} className={active === key ? `selected ${key}` : ''} onClick={() => setActive(key)} key={key}>{key === 'yanus' ? '솔 야누스' : '미니맵'}</button>)}</div>
          {active === 'yanus' ? <div className="auto-info"><div className="region-info"><img src={`${import.meta.env.BASE_URL}templates/sol-yanus.png`} alt="솔 야누스 기준 아이콘" /><strong>전체 화면 자동 탐색</strong></div><p role="status">{settings.enabled.yanus ? yanusText(yanus) : '솔 야누스 탐색이 꺼져 있습니다.'}</p><p className="muted">아이콘을 찾은 뒤 노란 숫자를 브라우저 내부 OCR로 판독합니다. 첫 실행에는 모델 준비 시간이 필요합니다.</p>{yanus.reading && <p>프레임 판독: {yanus.reading.seconds}초{yanus.reading.separatorInferred ? ' · 분·초 구분자 추정' : ''}<br /><small className="muted">OCR 원문: {yanus.reading.raw} · 점수 {yanus.reading.confidence}</small></p>}{yanus.score !== undefined && <p className="match-score">아이콘 매칭 {yanus.score.toFixed(3)} · 탐색 {Math.round(yanus.durationMs ?? 0)}ms</p>}<small className="muted">제공 샘플 기반 실험 기능입니다. 점수는 정확도를 보장하지 않습니다.</small></div> : <>
          <div className="region-info"><span className="dot rune" /><strong>{labels.rune}</strong><span>{settings.regions.rune ? '지정 완료' : '미지정'}</span></div>
          <p className="muted">룬 아이콘이 나타날 수 있는 미니맵 영역을 선택하세요.</p>
          <RegionFields key={JSON.stringify(settings.regions.rune)} region={settings.regions.rune} onSave={select} />
          <button className="subtle" disabled={!settings.regions.rune} onClick={() => setSettings(s => ({ ...s, regions: { ...s.regions, rune: null } }))}>이 영역 초기화</button></>}
        </section>
        <section className="panel"><h2>03 <span>감지 및 알림</span></h2>{(['yanus', 'rune'] as const).map(key => <div className="detector" key={key}><div><strong>{labels[key]}</strong><p>{settings.enabled[key] ? key === 'yanus' ? `남은 시간 ${yanus.tracking ? yanus.tracking.seconds ?? '—' : yanus.reading?.seconds ?? '—'}초${imageUrl ? ' · 이미지 판독' : ''}` : (rune.error ?? ({ idle: '미니맵 지정 및 화면 입력 대기', absent: '룬 미검출', confirming: '룬 상태 연속 확인 중', present: '룬 발견', error: '분석 오류' })[rune.state]) : '사용 안 함'}</p>{key === 'yanus' && yanus.tracking && <small className="muted">주기 {yanus.tracking.cycle} · {yanus.tracking.alerted ? '이번 주기 알림 처리됨' : '알림 대기'}</small>}</div><input type="checkbox" role="switch" aria-label={`${labels[key]} 감지 사용 설정`} checked={settings.enabled[key]} onChange={e => setSettings(s => ({ ...s, enabled: { ...s.enabled, [key]: e.target.checked } }))} /></div>)}
          <label className="volume">알림 음량 <span>{Math.round(settings.volume * 100)}%</span><input type="range" min="0" max="1" step="0.05" value={settings.volume} onChange={e => setSettings(s => ({ ...s, volume: Number(e.target.value) }))} /></label>
          {(['yanus', 'rune'] as const).map(kind => <button key={kind} className="sound" onClick={() => { audio.current.stop(); void audio.current.test(settings.volume, kind).catch(error => setMessage(error instanceof Error ? error.message : '오디오를 재생하지 못했습니다. 브라우저 음소거 설정을 확인해 주세요.')); }}>♫ {kind === 'yanus' ? '야누스' : '룬'} 알림음 테스트</button>)}<small className="muted">룬은 3회 연속 검출 시 알리며, 2초 이상 미검출 후 다시 알릴 수 있습니다. 정지 이미지에서는 소리가 나지 않습니다. 감지를 끄면 해당 분석과 재생 중인 소리를 중단합니다.</small>
        </section>
      </aside></div>
      <footer><span>MAPLE ALERT <b> / </b> 로컬 전용 · v0.1.0</span><span>화면 전송 없음 · 게임 입력 제어 없음</span></footer>
    </main>
  </div>;
}
function yanusText(status: YanusStatus): string {
  if (status.tracking?.estimated && status.tracking.seconds !== null) return status.tracking.seconds > 0 ? '마지막 확인 시간 기준 카운트다운 · 재탐색 중' : '추정 시간 만료 · 재탐색 중';
  if (status.tracking) return ({ confirming: '연속 판독 확인 중', active: '남은 시간 추적 중', renewing: '버프 갱신 확인 중', uncertain: '판독 불확실 · 알림 보류', absent: '아이콘 미검출 지속 · 소멸 추정' })[status.tracking.phase];
  switch (status.state) {
    case 'idle': return '화면 공유 또는 테스트 이미지를 기다리는 중';
    case 'searching': return '전체 화면에서 솔 야누스를 찾는 중…';
    case 'found': return status.reading ? '솔 야누스 시간 판독 완료' : '아이콘 발견 · 시간 판독 불확실';
    case 'not-found': return '시간 표시가 있는 아이콘을 찾지 못했습니다.';
    case 'ambiguous': return '유사한 후보가 여러 개여서 위치를 확정하지 않았습니다.';
    case 'error': return status.error ?? '탐색 중 오류가 발생했습니다.';
  }
}
function RegionFields({ region, onSave }: { region: Region | null; onSave: (r: Region) => void }) {
  const [values, setValues] = useState(() => ({ x: (region?.x ?? 0) * 100, y: (region?.y ?? 0) * 100, width: (region?.width ?? 0) * 100, height: (region?.height ?? 0) * 100 }));
  const r = { x: values.x / 100, y: values.y / 100, width: values.width / 100, height: values.height / 100 };
  return <form onSubmit={e => { e.preventDefault(); if (validRegion(r)) onSave(r); }}><div className="coordinates">{(['x', 'y', 'width', 'height'] as const).map((key, i) => <label key={key}>{['X (%)', 'Y (%)', '너비 (%)', '높이 (%)'][i]}<input type="number" min="0" max="100" step="any" required value={Number.isFinite(values[key]) ? Number(values[key].toFixed(4)) : ''} onChange={e => setValues(s => ({ ...s, [key]: e.target.valueAsNumber }))} /></label>)}</div><button className="subtle" disabled={!validRegion(r)}>좌표 적용</button></form>;
}
