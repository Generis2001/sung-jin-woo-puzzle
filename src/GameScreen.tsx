import { useState, useEffect, useRef, useCallback } from 'react';
import { useAccount, useSendTransaction } from 'wagmi';
import {
  GRID, TILES, generateGrid, findMatches, hasMove,
  applyGravity, fillEmpty, swapTiles, ms,
} from './lib/game';
import { LEVEL_DATA } from './lib/levels';
import { BUILDER_CODE, BASESCAN, publicClient } from './config';
import { toast } from './lib/toast';

interface Props { username: string; onBack: () => void; }

type Modal = 'checkin' | 'score' | 'complete' | 'gameover' | 'menu' | null;

interface TxUi { loading: boolean; msg: string; hash: string | null; }

interface Pop { id: number; text: string; left: string; top: string; }

interface GS {
  grid: number[][];
  score: number;
  moves: number;
  level: number;
  target: number;
  selected: { r: number; c: number } | null;
  active: boolean;
  animating: boolean;
  checkedIn: boolean;
}

const defaultTxUi = (): TxUi => ({ loading: false, msg: '', hash: null });
const fmtAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const fmtHash = (h: string) => `${h.slice(0, 8)}…`;

export default function GameScreen({ username, onBack }: Props) {
  const { address } = useAccount();
  const { sendTransactionAsync } = useSendTransaction();

  const ld0 = LEVEL_DATA[0];
  const gsRef = useRef<GS>({
    grid: generateGrid(),
    score: 0,
    moves: ld0.moves,
    level: 1,
    target: ld0.targetScore,
    selected: null,
    active: true,
    animating: false,
    checkedIn: false,
  });

  const [tick, setTick] = useState(0);
  const rerender = useCallback(() => setTick(k => k + 1), []);

  const [modal, setModal] = useState<Modal>(null);
  const [ciTx, setCiTx] = useState<TxUi>(defaultTxUi());
  const [scTx, setScTx] = useState<TxUi>(defaultTxUi());

  const [matchedKeys, setMatchedKeys] = useState(new Set<string>());
  const [shakeTiles, setShakeTiles]   = useState(new Set<string>());
  const [pops, setPops] = useState<Pop[]>([]);
  const popCounter = useRef(0);

  const [showLuf, setShowLuf] = useState(false);
  const [lufData, setLufData] = useState({ icon: '👑', title: 'LEVEL UP!', rank: '' });

  const [ts, setTs] = useState(48);

  const dragFrom   = useRef<{ r: number; c: number } | null>(null);
  const dragOrigin = useRef<{ x: number; y: number } | null>(null);
  const selRef     = useRef<{ r: number; c: number } | null>(null);

  // Always-fresh swap function via ref
  const attemptSwapRef = useRef<(r1: number, c1: number, r2: number, c2: number) => void>(() => {});

  // Initialize checkedIn from localStorage on mount
  useEffect(() => {
    if (!address) return;
    const today = new Date().toDateString();
    gsRef.current.checkedIn = localStorage.getItem(`sjw_ci_${address}_${today}`) === '1';
    rerender();
  }, [address, rerender]);

  // Tile size calculation
  useEffect(() => {
    const calc = () => {
      const availW = Math.min(window.innerWidth - 24, 520);
      const availH = window.innerHeight - 218;
      const tsW = Math.floor((availW - 22) / GRID) - 3;
      const tsH = Math.floor((availH - 22) / GRID) - 3;
      setTs(Math.min(tsW, tsH, 56));
    };
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, []);

  // Shake helper
  const shakeTile = useCallback((r: number, c: number) => {
    const key = `${r}-${c}`;
    setShakeTiles(prev => new Set([...prev, key]));
    setTimeout(() => setShakeTiles(prev => { const n = new Set(prev); n.delete(key); return n; }), 280);
  }, []);

  // Score pop helper
  const showScorePop = useCallback((text: string) => {
    const id = ++popCounter.current;
    setPops(prev => [...prev, {
      id, text,
      left: `${Math.random() * 60 + 20}%`,
      top:  `${Math.random() * 35 + 30}%`,
    }]);
    setTimeout(() => setPops(prev => prev.filter(p => p.id !== id)), 920);
  }, []);

  // Level-up flash
  const triggerLuf = useCallback((level: number) => {
    const ld = LEVEL_DATA[level - 1];
    setLufData({ icon: ld.avatar, title: `LEVEL ${level}!`, rank: `${ld.title} — Rank ${ld.rank}` });
    setShowLuf(true);
    setTimeout(() => setShowLuf(false), 2800);
  }, []);

  // Process matches (cascade)
  const processMatches = useCallback(async () => {
    const gs = gsRef.current;
    let cascade = 0;
    while (true) {
      const matches = findMatches(gs.grid);
      if (!matches.length) break;
      cascade++;
      const bonus = cascade > 1 ? 1 + (cascade - 1) * 0.4 : 1;
      const pts = Math.floor(matches.length * 60 * bonus);
      gs.score += pts;

      const mKeys = new Set(matches.map(m => `${m.r}-${m.c}`));
      matches.forEach(({ r, c }) => { gs.grid[r][c] = -1; });
      setMatchedKeys(mKeys);
      rerender();
      showScorePop('+' + pts);

      await ms(370);
      setMatchedKeys(new Set());
      applyGravity(gs.grid);
      fillEmpty(gs.grid);
      rerender();
      await ms(220);
    }

    if (!hasMove(gs.grid)) {
      toast('No moves! Shuffling board 🔀', 'inf');
      gs.grid = generateGrid();
      rerender();
    }
  }, [rerender, showScorePop]);

  // Check level end
  const checkLevelEnd = useCallback(() => {
    const gs = gsRef.current;
    if (gs.score >= gs.target) {
      gs.active = false;
      setModal('complete');
    } else if (gs.moves <= 0) {
      gs.active = false;
      setTimeout(() => setModal('gameover'), 350);
    }
  }, []);

  // Attempt swap
  const attemptSwap = useCallback(async (r1: number, c1: number, r2: number, c2: number) => {
    const gs = gsRef.current;
    if (!gs.active || gs.animating) return;
    const dr = Math.abs(r1 - r2), dc = Math.abs(c1 - c2);
    if (!((dr === 1 && dc === 0) || (dr === 0 && dc === 1))) return;

    gs.animating = true;
    gs.selected = null;
    selRef.current = null;
    rerender();

    swapTiles(gs.grid, r1, c1, r2, c2);
    if (findMatches(gs.grid).length) {
      gs.moves--;
      rerender();
      await ms(130);
      await processMatches();
    } else {
      swapTiles(gs.grid, r1, c1, r2, c2);
      rerender();
      shakeTile(r1, c1);
      shakeTile(r2, c2);
    }

    rerender();
    gs.animating = false;
    checkLevelEnd();
  }, [rerender, processMatches, shakeTile, checkLevelEnd]);

  // Keep attemptSwapRef fresh every render
  attemptSwapRef.current = attemptSwap;

  // Pointer event listeners
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!dragFrom.current || !dragOrigin.current) return;
      e.preventDefault();
      const dx = e.clientX - dragOrigin.current.x;
      const dy = e.clientY - dragOrigin.current.y;
      if (Math.abs(dx) < 18 && Math.abs(dy) < 18) return;

      let tr = dragFrom.current.r, tc = dragFrom.current.c;
      if (Math.abs(dx) > Math.abs(dy)) tc += dx > 0 ? 1 : -1;
      else                             tr += dy > 0 ? 1 : -1;

      if (tr >= 0 && tr < GRID && tc >= 0 && tc < GRID) {
        const from = { ...dragFrom.current };
        dragFrom.current   = null;
        dragOrigin.current = null;
        attemptSwapRef.current(from.r, from.c, tr, tc);
      }
    };

    const onUp = (e: PointerEvent) => {
      if (!dragFrom.current) { dragOrigin.current = null; return; }
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-r]');
      if (el) {
        const r = +(el.dataset.r ?? 0), c = +(el.dataset.c ?? 0);
        const sel = selRef.current;
        if (sel && (r !== sel.r || c !== sel.c)) {
          const from = { ...sel };
          dragFrom.current   = null;
          dragOrigin.current = null;
          selRef.current     = null;
          gsRef.current.selected = null;
          attemptSwapRef.current(from.r, from.c, r, c);
          return;
        }
      }
      dragFrom.current   = null;
      dragOrigin.current = null;
    };

    document.addEventListener('pointermove', onMove, { passive: false });
    document.addEventListener('pointerup', onUp);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };
  }, []);

  const handleTileDown = (e: React.PointerEvent, r: number, c: number) => {
    const gs = gsRef.current;
    if (gs.animating || !gs.active) return;
    e.preventDefault();
    dragFrom.current   = { r, c };
    dragOrigin.current = { x: e.clientX, y: e.clientY };
    selRef.current     = { r, c };
    gs.selected = { r, c };
    rerender();
  };

  // Level management
  const initLevel = useCallback((level: number) => {
    const gs  = gsRef.current;
    const ld  = LEVEL_DATA[level - 1];
    gs.level  = level;
    gs.moves  = ld.moves;
    gs.target = ld.targetScore;
    gs.selected  = null;
    gs.active    = true;
    gs.animating = false;
    gs.grid = generateGrid();
    selRef.current = null;
    rerender();
  }, [rerender]);

  const handleNextLevel = () => {
    const gs = gsRef.current;
    setModal(null);
    if (gs.level >= 30) {
      toast('🎉 All 30 dungeons cleared! You are the Shadow Monarch!', 'ok');
      onBack(); return;
    }
    const next = gs.level + 1;
    gs.score = 0;
    const ld = LEVEL_DATA[next - 1];
    toast(`Level ${next} — ${ld.title}`, 'inf');
    initLevel(next);
    if (next % 5 === 0) triggerLuf(next);
  };

  const handleResetLevel = () => {
    const gs = gsRef.current;
    gs.score = 0;
    setModal(null);
    initLevel(gs.level);
  };

  // Transactions
  const handleCheckin = async () => {
    const gs = gsRef.current;
    if (!address) { toast('Connect to Base first.', 'err'); return; }
    if (gs.checkedIn) { toast('Already checked in today!', 'inf'); return; }

    setCiTx({ loading: true, msg: 'Awaiting wallet confirmation…', hash: null });
    try {
      const hash = await sendTransactionAsync({
        to:    address,
        value: 0n,
        // dataSuffix (builder code) auto-appended by wagmi config
      });

      setCiTx({ loading: true, msg: `Confirming… ${fmtHash(hash)}`, hash });
      await publicClient.waitForTransactionReceipt({ hash });

      const today = new Date().toDateString();
      localStorage.setItem(`sjw_ci_${address}_${today}`, '1');
      gs.checkedIn = true;
      rerender();

      setCiTx({ loading: false, msg: '✅ Check-in confirmed on Base!', hash });
      toast('Daily check-in recorded! ☀️', 'ok');
      setTimeout(() => setModal(null), 3500);
    } catch (e: any) {
      const msg = e?.name === 'UserRejectedRequestError' || e?.code === 4001
        ? 'Rejected by user' : (e?.shortMessage ?? e?.message ?? 'Failed');
      setCiTx({ loading: false, msg: '❌ ' + msg, hash: null });
      toast('Check-in failed: ' + msg, 'err');
    }
  };

  const handleScoreSubmit = async () => {
    const gs = gsRef.current;
    if (!address) { toast('Connect to Base first.', 'err'); return; }

    const gameId   = '534d4d47';
    const scoreHex = gs.score.toString(16).padStart(8, '0');
    const levelHex = gs.level.toString(16).padStart(4, '0');
    const tsHex    = Math.floor(Date.now() / 1000).toString(16).padStart(8, '0');
    const data     = `0x${gameId}${scoreHex}${levelHex}${tsHex}` as `0x${string}`;

    setScTx({ loading: true, msg: 'Awaiting wallet confirmation…', hash: null });
    try {
      const hash = await sendTransactionAsync({
        to:    address,
        value: 0n,
        data,  // dataSuffix (builder code) auto-appended by wagmi config
      });

      setScTx({ loading: true, msg: `Confirming… ${fmtHash(hash)}`, hash });
      await publicClient.waitForTransactionReceipt({ hash });

      setScTx({ loading: false, msg: `✅ Score ${gs.score.toLocaleString()} submitted!`, hash });
      toast(`Score submitted on Base! Level ${gs.level} 📊`, 'ok');
      setTimeout(() => setModal(null), 3500);
    } catch (e: any) {
      const msg = e?.name === 'UserRejectedRequestError' || e?.code === 4001
        ? 'Rejected by user' : (e?.shortMessage ?? e?.message ?? 'Failed');
      setScTx({ loading: false, msg: '❌ ' + msg, hash: null });
      toast('Submit failed: ' + msg, 'err');
    }
  };

  const openModal = (m: Modal) => {
    if (m === 'checkin') setCiTx(defaultTxUi());
    if (m === 'score')   setScTx(defaultTxUi());
    setModal(m);
  };

  // Render
  const gs  = gsRef.current;
  const ld  = LEVEL_DATA[gs.level - 1];
  const pct = Math.min(100, (gs.score / gs.target) * 100);
  const gridWidth = ts * GRID + 3 * (GRID - 1);

  const TxBlock = ({ txUi, onAction, actionLabel, actionDisable }: {
    txUi: TxUi;
    onAction: () => void;
    actionLabel: string;
    actionDisable?: boolean;
  }) => (
    <>
      {txUi.msg && (
        <div className="tx-block show">
          <div className="tx-row">
            {txUi.loading && <div className="tx-spinner" />}
            <span>{txUi.msg}</span>
          </div>
          {txUi.hash && (
            <a className="tx-link" style={{ display: 'block' }}
               href={`${BASESCAN}/tx/${txUi.hash}`}
               target="_blank" rel="noopener noreferrer">
              View on BaseScan →
            </a>
          )}
        </div>
      )}
      <button
        className="btn btn-gold"
        onClick={onAction}
        disabled={txUi.loading || actionDisable}
      >
        {actionLabel}
      </button>
    </>
  );

  return (
    <div className="screen" id="screen-game">
      {/* HUD */}
      <div className="hud">
        <div className="hud-row1">
          <div className="player-id">
            <span className="player-ava">{ld.avatar}</span>
            <div>
              <div className="player-name">{username}</div>
              <div className="player-rank">Rank {ld.rank} — {ld.title}</div>
            </div>
          </div>
          <div className="hud-btns">
            <button
              className={`hud-btn${gs.checkedIn ? ' done' : ''}`}
              onClick={() => openModal('checkin')}
            >
              {gs.checkedIn ? '✅ Checked In' : '☀️ Check-In'}
            </button>
            <button className="hud-btn" onClick={() => openModal('menu')}>☰ Menu</button>
          </div>
        </div>

        <div className="stats-row">
          <div className="stat-box">
            <div className="stat-lbl">Score</div>
            <div className="stat-val val-purple">{gs.score.toLocaleString()}</div>
          </div>
          <div className="stat-box">
            <div className="stat-lbl">Moves</div>
            <div className={`stat-val ${gs.moves <= 5 ? 'val-red' : 'val-gold'}`}>{gs.moves}</div>
          </div>
          <div className="stat-box">
            <div className="stat-lbl">Level</div>
            <div className="stat-val val-blue">{gs.level}</div>
          </div>
        </div>

        <div className="prog-wrap">
          <div className="prog-meta">
            <span>Target: {gs.target.toLocaleString()}</span>
            <span>{Math.floor(pct)}%</span>
          </div>
          <div className="prog-bar">
            <div className="prog-fill" style={{ width: pct + '%' }} />
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="game-center">
        <div className="grid-outer">
          <div className="game-grid" style={{ width: gridWidth }}>
            {gs.grid.flatMap((row, r) =>
              row.map((t, c) => {
                const key = `${r}-${c}`;
                const isSelected = gs.selected?.r === r && gs.selected?.c === c;
                const isMatched  = matchedKeys.has(key);
                const isShaking  = shakeTiles.has(key);
                const cls = [
                  'tile', `t${t >= 0 ? t : 0}`,
                  isSelected ? 'selected' : '',
                  isMatched  ? 'matched'  : '',
                  isShaking  ? 'shake'    : '',
                ].filter(Boolean).join(' ');
                return (
                  <div
                    key={key}
                    className={cls}
                    style={{ width: ts, height: ts, fontSize: Math.floor(ts * 0.47) }}
                    data-r={r}
                    data-c={c}
                    onPointerDown={(e) => handleTileDown(e, r, c)}
                  >
                    {t >= 0 ? TILES[t].emoji : ''}
                  </div>
                );
              })
            )}
          </div>
          {pops.map(p => (
            <div key={p.id} className="score-pop" style={{ left: p.left, top: p.top }}>
              {p.text}
            </div>
          ))}
        </div>
      </div>

      {/* Level-up flash */}
      <div id="luf" className={showLuf ? 'show' : ''}>
        <div className="luf-icon">{lufData.icon}</div>
        <div className="luf-title">{lufData.title}</div>
        <div className="luf-rank">{lufData.rank}</div>
      </div>

      {/* Modal: Level Complete */}
      <div className={`modal-overlay${modal === 'complete' ? ' show' : ''}`}>
        <div className="modal-box">
          <span className="modal-icon">{ld.avatar}</span>
          <div className="modal-title">Level {gs.level} Complete!</div>
          <div className="modal-body">
            {gs.level >= 30 ? '🎉 Shadow Monarch achieved!' : `${ld.title} power gained!`}
          </div>
          <div className="modal-stats">
            <div className="mstat"><div className="mstat-val">{gs.score.toLocaleString()}</div><div className="mstat-lbl">Score</div></div>
            <div className="mstat"><div className="mstat-val">{gs.level}</div><div className="mstat-lbl">Level</div></div>
          </div>
          {gs.level < 30 && <button className="btn btn-gold" onClick={handleNextLevel}>⚔️ Next Level</button>}
          <button className="btn btn-ghost" onClick={() => { setModal('score'); setScTx(defaultTxUi()); }}>📊 Submit Score to Base</button>
        </div>
      </div>

      {/* Modal: Game Over */}
      <div className={`modal-overlay${modal === 'gameover' ? ' show' : ''}`}>
        <div className="modal-box">
          <span className="modal-icon">💀</span>
          <div className="modal-title">Dungeon Failed</div>
          <div className="modal-body">Out of moves. The shadows retreat… for now.</div>
          <div className="modal-stats">
            <div className="mstat"><div className="mstat-val">{gs.score.toLocaleString()}</div><div className="mstat-lbl">Final Score</div></div>
            <div className="mstat"><div className="mstat-val">{gs.level}</div><div className="mstat-lbl">Level</div></div>
          </div>
          <button className="btn btn-primary" onClick={handleResetLevel}>🔄 Try Again</button>
          <button className="btn btn-ghost" onClick={() => { setModal('score'); setScTx(defaultTxUi()); }}>📊 Submit Score to Base</button>
        </div>
      </div>

      {/* Modal: Daily Check-In */}
      <div className={`modal-overlay${modal === 'checkin' ? ' show' : ''}`}>
        <div className="modal-box">
          <span className="modal-icon">☀️</span>
          <div className="modal-title">Daily Check-In</div>
          <div className="modal-body">
            Record your daily hunter activity on Base. Each check-in is a real on-chain
            transaction attributed to the Shadow Monarch's Match builder code.
          </div>
          <TxBlock
            txUi={ciTx}
            onAction={handleCheckin}
            actionLabel={gs.checkedIn ? '✅ Already Checked In Today' : '✅ Check-In on Base'}
            actionDisable={gs.checkedIn}
          />
          <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
        </div>
      </div>

      {/* Modal: Score Submit */}
      <div className={`modal-overlay${modal === 'score' ? ' show' : ''}`}>
        <div className="modal-box">
          <span className="modal-icon">📊</span>
          <div className="modal-title">Submit Score</div>
          <div className="modal-body">
            Submit your score of {gs.score.toLocaleString()} at Level {gs.level} to Base.
          </div>
          <TxBlock
            txUi={scTx}
            onAction={handleScoreSubmit}
            actionLabel="📤 Submit to Base"
          />
          <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
        </div>
      </div>

      {/* Modal: Menu */}
      <div className={`modal-overlay${modal === 'menu' ? ' show' : ''}`}>
        <div className="modal-box">
          <span className="modal-icon">⚙️</span>
          <div className="modal-title">Menu</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 18, lineHeight: 1.8 }}>
            Wallet: <span style={{ fontFamily: 'monospace', color: 'var(--purple-300)' }}>{address ? fmtAddr(address) : '—'}</span><br />
            Network: <span style={{ color: 'var(--green)' }}>Base Mainnet</span><br />
            Builder: <span style={{ color: 'var(--text-muted)' }}>{BUILDER_CODE}</span>
          </div>
          <button className="btn btn-ghost" onClick={() => openModal('checkin')}>☀️ Daily Check-In</button>
          <button className="btn btn-ghost" onClick={() => openModal('score')}>📊 Submit Score</button>
          <button className="btn btn-ghost" onClick={() => { setModal(null); handleResetLevel(); }}>🔄 Restart Level</button>
          <button className="btn btn-ghost" onClick={() => { setModal(null); onBack(); }}>🚪 Main Menu</button>
          <button className="btn btn-ghost" onClick={() => setModal(null)}>✕ Close</button>
        </div>
      </div>
    </div>
  );
}
