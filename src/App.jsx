// App.jsx
import React, { useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";

/**
 * Typing Rush — Mobile Responsive + Per-Mode Highs + Easy Stages
 * - Mobile: sticky bottom typing bar (bigger keys), safe-area padding, larger buttons
 * - Desktop: small input inside playfield (as before)
 * - Per-mode highs (Easy/Medium/Hard/Extreme)
 * - Easy mode uses stage word lists; Extreme spawns double words like "car bike"
 * - Guaranteed power every 15 spawns: SLOW (bullet-time), POWER (+1 heart)
 * - SLOW doesn't drain while paused; true pause; confetti on new per-mode high
 */

const CLAMP = (n, a, b) => Math.min(Math.max(n, a), b);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const HS_MODES_KEY = "typing-invaders-highscores-v1"; // {easy,medium,hard,extreme}

/* ===== EASY mode: stage-based words ===== */
const EASY_STAGE_THRESHOLDS = [0, 15, 35, 60, 90]; // clears to reach stage 1..5
const EASY_STAGES = [
  ["at", "am", "an", "as", "be", "do", "go", "he", "hi", "in", "is", "it", "me", "my", "no", "of", "on", "or", "so", "to", "up", "us", "we", "you", "the"],
  ["cat", "dog", "sun", "run", "car", "bus", "cap", "map", "pen", "bed", "cup", "egg", "jam", "jar", "fox", "cow", "red", "box", "hat", "web", "log", "rug", "bug", "pig", "rat"],
  ["play", "star", "frog", "ship", "tree", "blue", "pink", "kite", "sand", "milk", "boat", "desk", "bird", "fish", "moon", "rain", "fire", "wind", "rock", "land"],
  ["apple", "tiger", "table", "water", "smile", "robot", "music", "pizza", "house", "grape", "light", "grass", "bread", "chair", "plane", "beach", "field", "story"],
  ["yellow", "silver", "planet", "garden", "rocket", "school", "friend", "window", "flower", "bridge", "bottle", "circle", "clouds", "dragon", "forest"],
];
function easyStageFromClears(clears) {
  let stage = 1;
  for (let i = 0; i < EASY_STAGE_THRESHOLDS.length; i++) {
    if (clears >= EASY_STAGE_THRESHOLDS[i]) stage = i + 1;
  }
  return CLAMP(stage, 1, EASY_STAGES.length);
}

/* ===== Procedural generator for other modes ===== */
const SYL = [
  "zo", "ra", "ve", "ka", "qua", "tri", "mon", "nel", "phi", "dex", "lum", "xen", "vex", "zor", "kai",
  "mi", "no", "ta", "po", "li", "ri", "su", "ne", "fi", "ga", "do", "hu", "shi", "tor", "lyn", "ark",
];
const POOLS = {
  animals: ["panda", "otter", "falcon", "badger", "mamba", "yak", "iguana", "viper", "heron", "puma", "ocelot", "tapir", "eagle", "emu", "koala", "stoat", "dingo"],
  tech: ["pixel", "socket", "kernel", "script", "buffer", "render", "shader", "driver", "module", "packet", "router", "cipher", "quartz", "bitrate", "quantum"],
  misc: ["ember", "groove", "tempo", "vortex", "tidal", "zephyr", "ripple", "blitz", "saffron", "nectar", "cobalt", "prism", "flume", "glimmer", "marble", "onyx"]
};
function makeWord(difficultySec) {
  const hard = Math.min(1, difficultySec / 120);
  if (Math.random() < 0.55) {
    const syllables = 2 + Math.floor(rand(0, 2 + hard * 2)); // 2..5
    let s = "";
    for (let i = 0; i < syllables; i++) s += pick(SYL);
    if (Math.random() < 0.25) s = pick(POOLS.misc) + s.slice(rand(1, 3));
    return s;
  } else {
    const pool = pick([POOLS.animals, POOLS.tech, POOLS.misc]);
    const base = pick(pool);
    if (hard > 0.7 && Math.random() < 0.35) {
      return base + pick(["ify", "tron", "ware", "scope", "craft", "core", "link", "flux"]);
    }
    return base;
  }
}

/* ===== Powers ===== */
const POWER_TYPES = [
  { key: "SLOW", weight: 6 },
  { key: "POWER", weight: 4 }, // +1 heart when typed fully
];
function pickPower() {
  const total = POWER_TYPES.reduce((a, b) => a + b.weight, 0);
  let r = Math.random() * total;
  for (const p of POWER_TYPES) {
    if ((r -= p.weight) <= 0) return p.key;
  }
  return "SLOW";
}

/* ===== Modes ===== */
const MODES = {
  easy: { label: "Easy", speedMul: 0.85, spawnRateMul: 0.90, extreme: false },
  medium: { label: "Medium", speedMul: 1.00, spawnRateMul: 1.00, extreme: false },
  hard: { label: "Hard", speedMul: 1.20, spawnRateMul: 1.15, extreme: false },
  extreme: { label: "Extreme", speedMul: 1.35, spawnRateMul: 1.35, extreme: true }, // double words
};

/* ===== Confetti ===== */
const fireConfetti = (big = false) => {
  confetti({ particleCount: big ? 180 : 120, spread: 70, origin: { y: 0.6 } });
  confetti({ particleCount: big ? 90 : 60, angle: 60, spread: 55, origin: { x: 0, y: 0.7 } });
  confetti({ particleCount: big ? 90 : 60, angle: 120, spread: 55, origin: { x: 1, y: 0.7 } });
};

export default function App() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800 text-slate-100">
      <Game />
      {/* <Footer /> */}
    </div>
  );
}

// function Footer() {
//   return (
//     <div className="text-center py-4 text-xs text-slate-400">
//       Tip: on phones, use the big typing bar at the bottom. On desktop, type anywhere.
//     </div>
//   );
// }

function Game() {
  /* ----- Refs (engine) ----- */
  const containerRef = useRef(null);
  const inputRef = useRef(null);         // desktop input
  const mobileInputRef = useRef(null);   // mobile sticky input
  const rafId = useRef(0);
  const lastTs = useRef(0);
  const renderAccumulator = useRef(0);
  const spawnAccumulator = useRef(0);
  const gameClock = useRef(0);
  const pausedRef = useRef(false);
  const pausedAtRef = useRef(0);
  const celebratedRef = useRef(false);
  const modeRef = useRef("easy");
  const sincePowerRef = useRef(0); // spawns since last power
  const clearsRef = useRef(0);     // words destroyed (for easy stages)

  /* ----- UI state ----- */
  const [ui, setUi] = useState({
    started: false,
    paused: false,
    score: 0,
    highs: (() => {
      try {
        const saved = JSON.parse(localStorage.getItem(HS_MODES_KEY) || "{}");
        const base = { easy: 0, medium: 0, hard: 0, extreme: 0 };
        return { ...base, ...saved };
      } catch { return { easy: 0, medium: 0, hard: 0, extreme: 0 }; }
    })(),
    lives: 3,
    combo: 0,
    gameOver: false,
    slowUntil: 0,
    mode: "easy",
  });

  useEffect(() => { pausedRef.current = ui.paused; }, [ui.paused]);
  useEffect(() => { modeRef.current = ui.mode; }, [ui.mode]);

  /* ----- Game state ----- */
  const [typed, setTyped] = useState("");
  const wordsRef = useRef([]);        // { id, text, power:null|'SLOW'|'POWER', xPercent, y, speed }
  const selectedIdRef = useRef(null);
  const [fx, setFx] = useState([]);   // particles

  /* ----- Helpers ----- */
  const focusInputs = () =>
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      mobileInputRef.current?.focus(); // on phones this opens the keyboard
    });

  const difficultyFactor = (t) => 1 + Math.min(1.2, t / 120); // 1..2.2 over 2 min
  const slowActive = () => performance.now() < ui.slowUntil;
  const slowSpeedFactor = () => (slowActive() ? 0.2 : 1.0);
  const slowSpawnBoost = () => (slowActive() ? 3.0 : 1.0);
  const spawnIntervalBase = (t) => CLAMP(1.2 / difficultyFactor(t), 0.35, 2.0);

  const currentModeLabel = MODES[ui.mode].label;
  const currentHigh = ui.highs[ui.mode] || 0;

  /* ----- Start/Restart ----- */
  const startGame = () => {
    celebratedRef.current = false;
    sincePowerRef.current = 0;
    clearsRef.current = 0;
    wordsRef.current = [];
    selectedIdRef.current = null;
    gameClock.current = 0;
    lastTs.current = 0;
    renderAccumulator.current = 0;
    spawnAccumulator.current = 0;
    setTyped("");
    setFx([]);
    setUi((s) => ({
      ...s,
      score: 0,
      lives: 3,
      combo: 0,
      started: true,
      paused: false,
      gameOver: false,
      slowUntil: 0,
    }));
    cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(loop);
    focusInputs();
  };

  /* ----- Pause / Resume ----- */
  const pauseToggle = () => {
    if (!ui.started || ui.gameOver) return;
    const now = performance.now();
    setUi((s) => {
      const paused = !s.paused;
      if (paused) {
        pausedAtRef.current = now;
        cancelAnimationFrame(rafId.current);
      } else {
        const delta = now - pausedAtRef.current; // keep SLOW from draining
        lastTs.current = 0;
        rafId.current = requestAnimationFrame(loop);
        focusInputs();
        return { ...s, paused, slowUntil: s.slowUntil + delta };
      }
      return { ...s, paused };
    });
  };

  /* ----- End ----- */
  const endGame = () => {
    const isNewHigh = ui.score > currentHigh;
    if (isNewHigh) fireConfetti(true);
    setUi((s) => {
      const prev = s.highs[s.mode] || 0;
      const highs = { ...s.highs, [s.mode]: Math.max(prev, s.score) };
      localStorage.setItem(HS_MODES_KEY, JSON.stringify(highs));
      return { ...s, highs, gameOver: true, started: false, paused: false };
    });
    cancelAnimationFrame(rafId.current);
  };

  /* ----- Loop ----- */
  const loop = (ts) => {
    if (pausedRef.current) { lastTs.current = ts; return; }

    const container = containerRef.current;
    if (!container) { rafId.current = requestAnimationFrame(loop); return; }

    if (!lastTs.current) lastTs.current = ts;
    const dt = (ts - lastTs.current) / 1000;
    lastTs.current = ts;

    const height = container.clientHeight || 560;
    const width = container.clientWidth || 800;

    // time
    gameClock.current += dt;

    // MODE config
    const modeCfg = MODES[modeRef.current];

    // spawn (slower when SLOW, faster for harder modes)
    spawnAccumulator.current += dt;
    const interval = (spawnIntervalBase(gameClock.current) / modeCfg.spawnRateMul) * slowSpawnBoost();
    if (spawnAccumulator.current >= interval) {
      spawnAccumulator.current = 0;
      spawnWord(width, { extremeCombine: modeCfg.extreme }); // EXTREME → "car bike"
    }

    // update words (speed scales with difficulty & mode; slowed by SLOW)
    const dyScale = 60 * difficultyFactor(gameClock.current) * modeCfg.speedMul * slowSpeedFactor(); // px/sec
    let missed = 0;
    wordsRef.current.forEach((w) => { w.y += (w.speed * dyScale) * dt; });

    // remove that hit bottom
    const margin = 48;
    const bottom = height - margin;
    wordsRef.current = wordsRef.current.filter((w) => {
      const alive = w.y < bottom;
      if (!alive) missed++;
      return alive;
    });

    if (missed > 0) {
      setUi((s) => {
        const lives = s.lives - missed;
        const dead = lives <= 0;
        if (dead) cancelAnimationFrame(rafId.current);
        return { ...s, lives, combo: 0 };
      });
      setTyped("");
    }

    if (ui.lives - missed <= 0) { endGame(); return; }

    // throttle UI re-render
    renderAccumulator.current += dt;
    if (renderAccumulator.current >= 1 / 30) {
      renderAccumulator.current = 0;
      setUi((s) => ({ ...s })); // tick
      setFx((old) => old.filter((p) => p.until > ts));
    }

    rafId.current = requestAnimationFrame(loop);
  };

  /* ----- Spawning ----- */
  const spawnWord = (width, { extremeCombine } = { extremeCombine: false }) => {
    const id = crypto.randomUUID();

    // Guaranteed power: every 15th spawn is power
    sincePowerRef.current += 1;
    let power = null;
    if (sincePowerRef.current >= 15) {
      power = pickPower();
      sincePowerRef.current = 0;
    }

    // Text generation by mode + power
    let text;
    if (power) {
      text = power; // SLOW / POWER
    } else if (modeRef.current === "easy") {
      const stage = easyStageFromClears(clearsRef.current);
      const pool = EASY_STAGES[stage - 1];
      text = pick(pool);
    } else if (extremeCombine) {
      const w1 = makeWord(gameClock.current);
      const w2 = makeWord(gameClock.current);
      text = `${w1} ${w2}`; // double
    } else {
      text = makeWord(gameClock.current);
    }

    const wEm = CLAMP(text.length * 0.6, 2.5, 16);
    const leftPxPadding = 24;
    const rightPxPadding = 24 + wEm * 16;
    const x = rand(leftPxPadding, Math.max(leftPxPadding + 1, width - rightPxPadding));
    const xPercent = (x / Math.max(1, width)) * 100;

    const baseSpd = rand(0.9, 1.2);
    const diffBump = CLAMP(0.2 + gameClock.current / 80, 0, 1.2);
    const speed = baseSpd + diffBump;

    wordsRef.current.push({
      id,
      text,
      power, // null | 'SLOW' | 'POWER'
      xPercent,
      y: -40,
      speed,
      createdAt: performance.now(),
    });
  };

  /* ----- Typing (spaces allowed for "car bike") ----- */
  const handleTyped = (value) => {
    const val = value.replace(/[^a-zA-Z ]/g, "");
    setTyped(val);
    if (!val) { selectedIdRef.current = null; return; }

    const lower = val.toLowerCase();
    const matches = wordsRef.current.filter((w) =>
      w.text.toLowerCase().startsWith(lower)
    );
    if (matches.length === 0) { selectedIdRef.current = null; return; }

    const target = matches.reduce((a, b) => (a.y > b.y ? a : b));
    selectedIdRef.current = target.id;

    if (lower === target.text.toLowerCase()) {
      destroyWord(target);
      setTyped("");
    }
  };

  /* ----- Destroy word + powers + stage clears ----- */
  const destroyWord = (w) => {
    wordsRef.current = wordsRef.current.filter((x) => x.id !== w.id);
    selectedIdRef.current = null;

    const now = performance.now();
    setFx((old) => [
      ...old,
      { id: crypto.randomUUID(), xPercent: w.xPercent, y: w.y, until: now + 450 },
    ]);

    // increment clears (for easy stages)
    clearsRef.current += 1;

    setUi((s) => {
      const base = 10 + w.text.length * 5;
      const combo = s.combo + 1;
      const bonus = Math.floor((combo - 1) * 2.5);
      let gained = base + bonus;

      let slowUntil = s.slowUntil;
      let lives = s.lives;

      if (w.power === "SLOW") {
        slowUntil = Math.max(slowUntil, now) + 6000; // 6s
      } else if (w.power === "POWER") {
        lives = s.lives + 1; // +1 heart
        gained += 20;
        confetti({ particleCount: 60, spread: 60, origin: { y: 0.7 } });
      }

      const newScore = s.score + gained;
      const modeHigh = s.highs[s.mode] || 0;
      if (newScore > modeHigh && !celebratedRef.current) {
        fireConfetti(false);
        celebratedRef.current = true;
      }

      return { ...s, score: newScore, combo, slowUntil, lives };
    });
  };

  /* ----- Pointer focus ----- */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onDown = () => focusInputs();
    el.addEventListener("pointerdown", onDown);
    return () => el.removeEventListener("pointerdown", onDown);
  }, []);

  /* ----- Keyboard pause ----- */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); pauseToggle(); }
      if (e.key === " " && !ui.gameOver && ui.started) { e.preventDefault(); pauseToggle(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ui.started, ui.gameOver, ui.paused]);

  /* ----- Life watcher ----- */
  useEffect(() => {
    if (ui.lives <= 0 && !ui.gameOver) endGame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ui.lives]);

  /* ----- Cleanup ----- */
  useEffect(() => () => cancelAnimationFrame(rafId.current), []);

  const slowUiActive = slowActive();
  const currentStage = ui.mode === "easy" ? easyStageFromClears(clearsRef.current) : null;
  const nextStageClears =
    ui.mode === "easy" && currentStage < EASY_STAGES.length
      ? EASY_STAGE_THRESHOLDS[currentStage] - clearsRef.current
      : null;

  return (
    <>
      <div className="mx-auto max-w-4xl px-3 pt-4 md:pt-6">
        {/* HUD */}
        <div className="mb-2 md:mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center flex-wrap gap-2 md:gap-3">
            <Badge>Score: <strong>{ui.score}</strong></Badge>
            <Badge>Combo: x{ui.combo}</Badge>
            <Badge>
              High ({currentModeLabel}): {currentHigh}
              {celebratedRef.current && (
                <span className="ml-2 rounded bg-emerald-400/20 px-1 text-[10px] font-bold text-emerald-300">NEW</span>
              )}
            </Badge>
            {ui.mode === "easy" && (
              <Badge>
                Stage {currentStage}
                {nextStageClears != null && nextStageClears > 0 && (
                  <span className="ml-2 text-[10px] text-slate-300">(+{nextStageClears} clears)</span>
                )}
              </Badge>
            )}
          </div>

          {/* Settings: difficulty mode (locked during a run) */}
          <div className="flex items-center gap-2">
            <span className="hidden xs:inline text-xs text-slate-400">Mode:</span>
            <div className={"flex overflow-hidden rounded-md border border-slate-700 " + (ui.started ? "opacity-60 pointer-events-none" : "")}>
              {Object.keys(MODES).map((key) => {
                const active = ui.mode === key;
                return (
                  <button
                    key={key}
                    onClick={() => setUi((s) => ({ ...s, mode: key }))}
                    disabled={ui.started}
                    className={[
                      "px-2 py-1 text-xs md:px-2.5 md:py-1 font-semibold",
                      active ? "bg-indigo-500 text-white" : "bg-slate-800 hover:bg-slate-700 text-slate-200",
                    ].join(" ")}
                  >
                    {MODES[key].label}
                  </button>
                );
              })}
            </div>

            <div className="ml-2 md:ml-3 flex items-center gap-2">
              <Lives hearts={ui.lives} max={Math.max(3, ui.lives)} />
              <button
                onClick={ui.started ? pauseToggle : startGame}
                className="rounded-md bg-indigo-500 px-3 py-2 md:px-3 md:py-2 text-sm font-semibold hover:bg-indigo-400 active:scale-[0.98]"
              >
                {ui.started ? (ui.paused ? "Resume" : "Pause") : "Start"}
              </button>
              <button
                onClick={startGame}
                className="rounded-md bg-slate-700 px-3 py-2 md:px-3 md:py-2 text-sm font-semibold hover:bg-slate-600 active:scale-[0.98]"
              >
                Restart
              </button>
            </div>
          </div>
        </div>

        {/* Playfield */}
        <div
          ref={containerRef}
          className="relative h-[60vh] sm:h-[68vh] md:h-[72vh] min-h-[420px] md:min-h-[520px] w-full overflow-hidden rounded-xl border border-slate-700 bg-gradient-to-b from-slate-950 to-slate-900 shadow-2xl"
          style={{ paddingBottom: "max(0px, env(safe-area-inset-bottom))" }}
        >
          {/* ground */}
          <div className="absolute bottom-0 left-0 right-0 h-2 bg-gradient-to-r from-fuchsia-500/50 via-indigo-400/60 to-cyan-400/50 blur-sm" />

          {/* slow-mo glow */}
          {slowUiActive && (
            <div className="pointer-events-none absolute inset-0 animate-pulse bg-cyan-400/5" />
          )}

          {/* Words */}
          {wordsRef.current.map((w) => {
            const isSelected = selectedIdRef.current === w.id;
            const typedLen = isSelected ? typed.length : 0;
            const head = w.text.slice(0, typedLen);
            const tail = w.text.slice(typedLen);
            const isPower = !!w.power;
            return (
              <div
                key={w.id}
                className={[
                  "absolute select-none rounded-full border px-3 py-1 font-semibold shadow",
                  "text-[clamp(12px,3.2vw,16px)]", // responsive label size
                  isPower
                    ? "bg-amber-200 text-amber-950 border-amber-300"
                    : "bg-slate-200 text-slate-900 border-slate-300",
                  isSelected ? "ring-2 ring-indigo-400" : "ring-0",
                ].join(" ")}
                style={{
                  left: `${w.xPercent}%`,
                  transform: "translateX(-50%)",
                  top: `${w.y}px`,
                }}
              >
                <span className={isSelected ? "opacity-70" : ""}>{head}</span>
                <span>{tail}</span>
                {isPower && (
                  <span className="ml-2 inline-block rounded bg-black/10 px-1 text-[10px] md:text-[10px] font-bold uppercase tracking-wider">
                    {w.power}
                  </span>
                )}
              </div>
            );
          })}

          {/* FX */}
          {fx.map((p) => (
            <div
              key={p.id}
              className="pointer-events-none absolute aspect-square w-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-indigo-300 to-fuchsia-300 opacity-80 blur-[1px]"
              style={{
                left: `${p.xPercent}%`,
                top: `${p.y}px`,
                transition: "transform 450ms ease, opacity 450ms ease, filter 450ms ease",
                transform: "translate(-50%, -50%) scale(2.2)",
                opacity: 0,
                filter: "blur(6px)",
              }}
            />
          ))}

          {/* Overlays */}
          {!ui.started && !ui.gameOver && (
            <CenterOverlay>
              <h2 className="mb-2 text-2xl md:text-3xl font-extrabold tracking-tight">Typing Rush — Mobile Ready</h2>
              <p className="mb-5 text-slate-300">Use power words wisely. Try Extreme on a big screen!</p>
              <button
                onClick={startGame}
                className="rounded-lg bg-indigo-500 px-5 py-3 text-lg font-semibold shadow hover:bg-indigo-400 active:scale-[0.98]"
              >
                Start Game
              </button>
            </CenterOverlay>
          )}

          {ui.paused && ui.started && (
            <CenterOverlay>
              <h2 className="mb-2 text-2xl md:text-3xl font-extrabold">Paused</h2>
              <p className="mb-5 text-slate-300">Press Space / tap Resume.</p>
              <button
                onClick={pauseToggle}
                className="rounded-lg bg-indigo-500 px-5 py-3 text-lg font-semibold shadow hover:bg-indigo-400 active:scale-[0.98]"
              >
                Resume
              </button>
            </CenterOverlay>
          )}

          {ui.gameOver && (
            <CenterOverlay>
              <h2 className="mb-2 text-2xl md:text-3xl font-extrabold">Game Over</h2>
              <p className="mb-1 text-slate-300">
                Score: <span className="font-bold text-white">{ui.score}</span>
              </p>
              <p className="mb-5 text-slate-300">
                Best ({currentModeLabel}): <span className="font-bold text-white">{currentHigh}</span>
              </p>
              <button
                onClick={startGame}
                className="rounded-lg bg-indigo-500 px-5 py-3 text-lg font-semibold shadow hover:bg-indigo-400 active:scale-[0.98]"
              >
                Play Again
              </button>
            </CenterOverlay>
          )}

          {/* Desktop in-field input (hidden on small screens) */}
          <input
            ref={inputRef}
            value={typed}
            onChange={(e) => handleTyped(e.target.value)}
            className="hidden md:block absolute bottom-3 left-3 w-48 rounded-md bg-black/30 px-2 py-1 text-xs outline-none placeholder:text-slate-400"
            placeholder={ui.started ? "start typing..." : "click Start"}
            spellCheck={false}
          />
        </div>
      </div>

      {/* Mobile sticky typing bar */}
      <div
        className="md:hidden sticky bottom-0 inset-x-0 z-20 border-t border-slate-800 bg-slate-950/80 backdrop-blur"
        style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto max-w-4xl px-3 pt-2">
          <input
            ref={mobileInputRef}
            value={typed}
            onChange={(e) => handleTyped(e.target.value)}
            className="w-full rounded-lg bg-slate-800 text-slate-100 placeholder:text-slate-400 px-4 py-3 text-base outline-none"
            placeholder={ui.started ? "type here…" : "tap Start to play"}
            inputMode="text"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          <div className="flex justify-between pt-1 pb-1 text-[11px] text-slate-400">
            <span>Tip: spaces count on double words</span>
            <button
              onClick={ui.started ? pauseToggle : startGame}
              className="rounded bg-indigo-500 px-3 py-1 text-white font-semibold"
            >
              {ui.started ? (ui.paused ? "Resume" : "Pause") : "Start"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function Badge({ children }) {
  return (
    <div className="rounded-md border border-slate-700 bg-slate-800/70 px-2.5 py-1 text-xs shadow">
      {children}
    </div>
  );
}

function Lives({ hearts, max = 3 }) {
  const total = Math.max(max, 3);
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={[
            "inline-flex h-6 w-6 items-center justify-center rounded-full border text-sm shadow",
            i < hearts
              ? "border-rose-400 bg-rose-500/90"
              : "border-slate-600 bg-slate-700 text-slate-400",
          ].join(" ")}
        >
          ❤
        </span>
      ))}
    </div>
  );
}

function CenterOverlay({ children }) {
  return (
    <div className="pointer-events-auto absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/70 text-center backdrop-blur-sm">
      {children}
    </div>
  );
}
