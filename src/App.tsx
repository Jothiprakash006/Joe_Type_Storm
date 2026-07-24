import { useCallback, useEffect, useRef, useState } from 'react';
import { useGameEngine } from './useGameEngine';
import { FallingWord, Particle, ScorePopup, HighScore, parseSentenceToWords, saveCustomSentence, loadCustomSentence, saveLastUsername, loadLastUsername } from './gameData';

// ─── Background Grid ───
function BackgroundGrid() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-dark-bg via-dark-bg to-[#0d0d2b]" />
      {/* Grid lines */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0,245,255,1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,245,255,1) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />
      {/* Scanline effect */}
      <div className="absolute inset-0 scanline" />
      {/* Vignette */}
      <div className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.6) 100%)',
        }}
      />
    </div>
  );
}

// ─── Particles Layer ───
function ParticlesLayer({ particles }: { particles: Particle[] }) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {particles.map(p => {
        const opacity = Math.max(0, p.life / p.maxLife);
        return p.char ? (
          <div
            key={p.id}
            className="absolute font-bold text-sm"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              color: p.color,
              opacity,
              transform: `translate(-50%, -50%) scale(${0.5 + opacity})`,
              textShadow: `0 0 8px ${p.color}`,
              willChange: 'transform, opacity',
            }}
          >
            {p.char}
          </div>
        ) : (
          <div
            key={p.id}
            className="absolute rounded-full"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: p.size,
              height: p.size,
              backgroundColor: p.color,
              opacity,
              transform: 'translate(-50%, -50%)',
              boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
              willChange: 'transform, opacity',
            }}
          />
        );
      })}
    </div>
  );
}

// ─── Score Popups Layer ───
function PopupsLayer({ popups }: { popups: ScorePopup[] }) {
  const now = Date.now();
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {popups.map(p => {
        const age = (now - p.spawnTime) / 1000;
        const opacity = Math.max(0, 1 - age);
        const yOffset = age * 60;
        return (
          <div
            key={p.id}
            className="absolute font-bold text-lg whitespace-nowrap"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              color: p.color,
              opacity,
              transform: `translate(-50%, -50%) translateY(-${yOffset}px) scale(${1 + age * 0.3})`,
              textShadow: `0 0 10px ${p.color}, 0 0 20px ${p.color}`,
              willChange: 'transform, opacity',
            }}
          >
            {p.text}
          </div>
        );
      })}
    </div>
  );
}

// ─── Word Component ───
function WordDisplay({ word }: { word: FallingWord }) {
  const isTargeted = word.typed.length > 0;
  const diffColor = word.difficulty === 'easy' ? '#00f5ff' : word.difficulty === 'medium' ? '#39ff14' : '#ff00aa';
  const dangerZone = word.y > 75;

  return (
    <div
      className="absolute animate-word-spawn"
      style={{
        left: `${word.x}%`,
        top: `${word.y}%`,
        transform: 'translate(-50%, -50%)',
        willChange: 'transform, top',
        zIndex: isTargeted ? 20 : 10,
      }}
    >
      {/* Glow background */}
      {isTargeted && (
        <div
          className="absolute inset-0 -m-2 rounded-lg opacity-30 animate-pulse"
          style={{ backgroundColor: diffColor, filter: `blur(12px)` }}
        />
      )}
      <div
        className={`
          relative px-3 py-1.5 rounded-lg border text-base sm:text-lg font-bold tracking-wider
          transition-all duration-150
          ${dangerZone ? 'border-red-500/80' : isTargeted ? 'border-white/60' : 'border-white/20'}
        `}
        style={{
          backgroundColor: dangerZone
            ? 'rgba(255, 0, 68, 0.15)'
            : isTargeted
            ? 'rgba(255,255,255,0.1)'
            : 'rgba(10, 10, 26, 0.85)',
          backdropFilter: 'blur(4px)',
          boxShadow: isTargeted
            ? `0 0 15px ${diffColor}40, 0 0 30px ${diffColor}20`
            : dangerZone
            ? '0 0 15px rgba(255,0,68,0.3)'
            : 'none',
        }}
      >
        {word.text.split('').map((char, i) => {
          const isTyped = i < word.typed.length;
          return (
            <span
              key={i}
              className="transition-colors duration-100"
              style={{
                color: isTyped ? diffColor : dangerZone ? '#ff6666' : 'rgba(255,255,255,0.7)',
                textShadow: isTyped ? `0 0 8px ${diffColor}, 0 0 16px ${diffColor}` : 'none',
              }}
            >
              {char}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ─── HUD ───
function HUD({ score, level, combo, lives, maxLives, wpm, isCustomMode, username }: {
  score: number; level: number; combo: number; lives: number; maxLives: number; wpm: number; isCustomMode: boolean; username: string;
}) {
  return (
    <div className="absolute top-0 left-0 right-0 z-30 pointer-events-none">
      <div className="flex items-start justify-between p-3 sm:p-4">
        {/* Score + Level */}
        <div className="flex flex-col gap-1">
          <div className="text-neon-cyan text-xl sm:text-2xl font-bold" style={{ textShadow: '0 0 10px #00f5ff' }}>
            {score.toLocaleString()}
          </div>
          <div className="text-white/50 text-xs sm:text-sm">
            LVL <span className="text-neon-yellow font-bold">{level}</span>
          </div>
          {wpm > 0 && (
            <div className="text-white/40 text-xs">
              {wpm} WPM
            </div>
          )}
          {isCustomMode && (
            <div
              className="text-neon-pink text-[10px] font-bold tracking-wider mt-0.5 px-1.5 py-0.5 rounded border border-neon-pink/30 bg-neon-pink/5 w-fit"
              style={{ textShadow: '0 0 6px #ff00aa' }}
            >
              ✏️ CUSTOM
            </div>
          )}
        </div>

        {/* Combo + Player Name */}
        <div className="flex flex-col items-center gap-1">
          {username && (
            <div className="text-neon-green/60 text-[10px] tracking-[0.2em] font-bold uppercase"
              style={{ textShadow: '0 0 6px rgba(57,255,20,0.3)' }}
            >
              ⚡ {username} ⚡
            </div>
          )}
          {combo > 1 && (
            <div
              className="text-neon-yellow text-lg sm:text-2xl font-bold animate-pulse"
              style={{ textShadow: '0 0 10px #ffff00, 0 0 20px #ffff00' }}
            >
              {combo}x COMBO
            </div>
          )}
        </div>

        {/* Lives */}
        <div className="flex gap-1">
          {Array.from({ length: maxLives }).map((_, i) => (
            <div
              key={i}
              className={`text-lg sm:text-xl transition-all duration-300 ${i < lives ? 'scale-100' : 'scale-75 opacity-30 grayscale'}`}
              style={{
                filter: i < lives ? 'drop-shadow(0 0 4px #ff0044)' : 'none',
              }}
            >
              {i < lives ? '❤️' : '🖤'}
            </div>
          ))}
        </div>
      </div>

      {/* Danger zone line */}
      <div className="absolute bottom-0 left-0 right-0" style={{ top: '85%' }}>
        <div className="w-full h-px bg-gradient-to-r from-transparent via-red-500/30 to-transparent" />
      </div>
    </div>
  );
}

// ─── Input Area ───
function InputArea({ value, onChange, onPause, gameState }: {
  value: string;
  onChange: (v: string) => void;
  onPause: () => void;
  gameState: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (gameState === 'playing') {
      inputRef.current?.focus();
    }
  }, [gameState]);

  // Refocus on click anywhere
  useEffect(() => {
    const handler = () => {
      if (gameState === 'playing') {
        inputRef.current?.focus();
      }
    };
    document.addEventListener('click', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('click', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [gameState]);

  return (
    <div className="absolute bottom-0 left-0 right-0 z-30 p-3 sm:p-4">
      <div className="flex gap-2 max-w-lg mx-auto">
        <div className="flex-1 relative">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={e => onChange(e.target.value)}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="Type the words..."
            className="w-full px-4 py-3 rounded-xl bg-dark-card/90 border border-neon-cyan/30 text-white text-lg
              focus:border-neon-cyan/70 focus:ring-2 focus:ring-neon-cyan/20
              placeholder:text-white/20 backdrop-blur-md transition-all"
            style={{
              boxShadow: value ? '0 0 20px rgba(0,245,255,0.15)' : 'none',
              caretColor: '#00f5ff',
            }}
          />
          {value && (
            <div
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neon-cyan/50 text-sm cursor-pointer pointer-events-auto"
              onClick={() => onChange('')}
            >
              ✕
            </div>
          )}
        </div>
        <button
          onClick={onPause}
          className="px-4 py-3 rounded-xl bg-dark-card/90 border border-white/10 text-white/60
            hover:border-white/30 hover:text-white/80 active:scale-95 transition-all pointer-events-auto"
        >
          ⏸
        </button>
      </div>
    </div>
  );
}

// ─── Personal Scores Panel ───
function LeaderboardPanel({ highScores, currentUsername, highlightScore, compact }: {
  highScores: HighScore[];
  currentUsername: string;
  highlightScore?: number;
  compact?: boolean;
}) {
  const myScores = highScores.filter(
    hs => hs.username.toLowerCase() === currentUsername.toLowerCase()
  );
  const limit = compact ? 7 : 10;

  if (myScores.length === 0) return null;

  return (
    <div className="bg-dark-card/60 border border-white/10 rounded-xl w-full backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className="px-3 pt-3 pb-2 border-b border-white/5">
        <h3 className="text-neon-green text-xs font-bold tracking-wider">
          👤 {currentUsername.toUpperCase()}'S BEST SCORES
        </h3>
      </div>

      {/* Score rows */}
      <div className="p-3 space-y-1">
        {myScores.slice(0, limit).map((hs, i) => {
          const isHighlighted = highlightScore !== undefined && hs.score === highlightScore;
          return (
            <div
              key={i}
              className={`flex items-center text-xs px-2 py-1 rounded transition-all ${
                isHighlighted
                  ? 'text-neon-yellow bg-neon-yellow/8 border border-neon-yellow/20'
                  : i === 0
                  ? 'text-neon-yellow bg-neon-yellow/5'
                  : 'text-white/50'
              }`}
            >
              <span className={`w-5 text-right mr-2 text-[10px] ${i === 0 ? 'opacity-100' : 'opacity-40'}`}>
                #{i + 1}
              </span>
              <span className="font-bold flex-1 text-right">{hs.score.toLocaleString()}</span>
              <span className="opacity-40 ml-2 w-7 text-right">L{hs.level}</span>
              <span className="opacity-35 ml-1.5 w-10 text-right text-[10px]">{hs.wpm}wpm</span>
              <span className="opacity-25 ml-1.5 w-14 text-right text-[10px] hidden sm:inline">{hs.date}</span>
            </div>
          );
        })}
        {myScores.length > limit && (
          <div className="text-white/15 text-[10px] text-center pt-1">
            +{myScores.length - limit} more
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Start Screen ───
function StartScreen({ onStart, onStartCustom, highScores, savedSentence, savedUsername }: {
  onStart: (username: string) => void;
  onStartCustom: (words: string[], username: string) => void;
  highScores: HighScore[];
  savedSentence: string;
  savedUsername: string;
}) {
  const [showScores, setShowScores] = useState(false);
  const [mode, setMode] = useState<'classic' | 'custom'>('classic');
  const [sentence, setSentence] = useState(savedSentence);
  const [username, setUsername] = useState(savedUsername);
  const parsedWords = parseSentenceToWords(sentence);

  const trimmedName = username.trim();

  const handleStartClassic = () => {
    if (trimmedName.length > 0) {
      saveLastUsername(trimmedName);
      onStart(trimmedName);
    }
  };

  const handleStartCustom = () => {
    if (parsedWords.length >= 3 && trimmedName.length > 0) {
      saveLastUsername(trimmedName);
      saveCustomSentence(sentence);
      onStartCustom(parsedWords, trimmedName);
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <BackgroundGrid />
      
      {/* Stars background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 50 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              width: `${1 + Math.random() * 2}px`,
              height: `${1 + Math.random() * 2}px`,
              opacity: 0.1 + Math.random() * 0.4,
              animation: `pulse-glow ${2 + Math.random() * 3}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 3}s`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 flex flex-col items-center gap-4 sm:gap-5 max-w-md w-full my-auto">
        {/* Title */}
        <div className="text-center">
          <div
            className="text-lg sm:text-xl font-bold text-neon-yellow tracking-[0.3em] mb-1"
            style={{ textShadow: '0 0 12px #ffff00, 0 0 24px #ffff0050' }}
          >
            JOE
          </div>
          <h1
            className="text-5xl sm:text-7xl font-bold text-neon-cyan animate-pulse-glow tracking-widest"
            style={{ textShadow: '0 0 20px #00f5ff, 0 0 40px #00f5ff, 0 0 80px #00f5ff50' }}
          >
            TYPE
          </h1>
          <h1
            className="text-5xl sm:text-7xl font-bold text-neon-pink -mt-1 sm:-mt-2 tracking-widest"
            style={{
              textShadow: '0 0 20px #ff00aa, 0 0 40px #ff00aa, 0 0 80px #ff00aa50',
              animation: 'pulse-glow 2s ease-in-out infinite 0.5s',
            }}
          >
            STORM
          </h1>
          <p className="text-white/40 text-sm sm:text-base mt-2 tracking-wide">
            Type falling words before they reach the bottom
          </p>
        </div>

        {/* Username Input */}
        <div className="w-full">
          <label className="block text-neon-green text-xs font-bold mb-1.5 tracking-wider">
            👤 ENTER YOUR NAME
          </label>
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="Your name..."
            maxLength={16}
            className="w-full px-4 py-3 rounded-xl bg-dark-card/80 border border-neon-green/30 text-white text-base
              placeholder:text-white/20 backdrop-blur-md transition-all
              focus:border-neon-green/60 focus:ring-2 focus:ring-neon-green/20"
            style={{ caretColor: '#39ff14', outline: 'none' }}
            onKeyDown={e => {
              if (e.key === 'Enter' && trimmedName.length > 0) {
                if (mode === 'classic') handleStartClassic();
                else if (parsedWords.length >= 3) handleStartCustom();
              }
            }}
          />
          {trimmedName.length === 0 && (
            <p className="text-neon-red/50 text-xs mt-1">Name is required to play</p>
          )}
        </div>

        {/* Mode Toggle */}
        <div className="flex w-full rounded-xl overflow-hidden border border-white/10">
          <button
            onClick={() => setMode('classic')}
            className={`flex-1 py-2.5 text-sm font-bold tracking-wider transition-all duration-200 ${
              mode === 'classic'
                ? 'bg-neon-cyan/15 text-neon-cyan border-r border-neon-cyan/30'
                : 'bg-dark-card/40 text-white/40 border-r border-white/10 hover:text-white/60'
            }`}
          >
            ⚡ CLASSIC
          </button>
          <button
            onClick={() => setMode('custom')}
            className={`flex-1 py-2.5 text-sm font-bold tracking-wider transition-all duration-200 ${
              mode === 'custom'
                ? 'bg-neon-pink/15 text-neon-pink'
                : 'bg-dark-card/40 text-white/40 hover:text-white/60'
            }`}
          >
            ✏️ CUSTOM WORDS
          </button>
        </div>

        {mode === 'classic' ? (
          <>
            {/* How to play */}
            <div className="bg-dark-card/60 border border-white/10 rounded-xl p-4 w-full backdrop-blur-sm">
              <div className="text-white/70 text-xs sm:text-sm space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-neon-cyan">⌨️</span>
                  <span>Type words as they fall</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-neon-green">⚡</span>
                  <span>Chain combos for bonus points</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-neon-pink">❤️</span>
                  <span>5 lives — don't let words reach the bottom</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-neon-yellow">🔥</span>
                  <span>Words get harder as you level up</span>
                </div>
              </div>
            </div>

            {/* Classic Play button */}
            <button
              onClick={handleStartClassic}
              disabled={trimmedName.length === 0}
              className={`group relative w-full py-4 rounded-xl font-bold text-xl tracking-wider transition-all duration-200
                ${trimmedName.length > 0
                  ? 'bg-gradient-to-r from-neon-cyan/20 to-neon-pink/20 border-2 border-neon-cyan/50 text-neon-cyan hover:border-neon-cyan hover:from-neon-cyan/30 hover:to-neon-pink/30 active:scale-[0.97]'
                  : 'bg-dark-card/30 border-2 border-white/10 text-white/20 cursor-not-allowed'
                }`}
              style={{
                boxShadow: trimmedName.length > 0 ? '0 0 30px rgba(0,245,255,0.1), inset 0 0 30px rgba(0,245,255,0.05)' : 'none',
              }}
            >
              <span className="relative z-10">▶ START GAME</span>
              {trimmedName.length > 0 && (
                <div className="absolute inset-0 rounded-xl bg-neon-cyan/5 group-hover:bg-neon-cyan/10 transition-all" />
              )}
            </button>
          </>
        ) : (
          <>
            {/* Custom sentence input */}
            <div className="bg-dark-card/60 border border-white/10 rounded-xl p-4 w-full backdrop-blur-sm">
              <label className="block text-neon-pink text-xs font-bold mb-2 tracking-wider">
                ✏️ ENTER YOUR SENTENCE OR WORDS
              </label>
              <p className="text-white/30 text-xs mb-3">
                Type a sentence, paragraph, or list of words. They'll become the falling words in your game!
              </p>
              <textarea
                value={sentence}
                onChange={e => setSentence(e.target.value)}
                placeholder="e.g. The quick brown fox jumps over the lazy dog..."
                rows={3}
                className="w-full px-3 py-2.5 rounded-lg bg-dark-bg/80 border border-white/10 text-white text-sm
                  placeholder:text-white/15 resize-none
                  focus:border-neon-pink/50 focus:ring-1 focus:ring-neon-pink/20 transition-all"
                style={{ caretColor: '#ff00aa', outline: 'none' }}
              />
              {/* Word preview */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {parsedWords.length > 0 ? (
                  <>
                    <span className="text-white/30 text-xs mr-1 self-center">
                      {parsedWords.length} word{parsedWords.length !== 1 ? 's' : ''}:
                    </span>
                    {parsedWords.slice(0, 20).map((w, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded-md text-xs font-bold border"
                        style={{
                          color: w.length <= 3 ? '#00f5ff' : w.length <= 6 ? '#39ff14' : '#ff00aa',
                          borderColor: w.length <= 3 ? 'rgba(0,245,255,0.2)' : w.length <= 6 ? 'rgba(57,255,20,0.2)' : 'rgba(255,0,170,0.2)',
                          backgroundColor: w.length <= 3 ? 'rgba(0,245,255,0.05)' : w.length <= 6 ? 'rgba(57,255,20,0.05)' : 'rgba(255,0,170,0.05)',
                        }}
                      >
                        {w}
                      </span>
                    ))}
                    {parsedWords.length > 20 && (
                      <span className="text-white/20 text-xs self-center">+{parsedWords.length - 20} more</span>
                    )}
                  </>
                ) : (
                  <span className="text-white/20 text-xs italic">
                    Enter at least 3 words to start...
                  </span>
                )}
              </div>
            </div>

            {/* Custom Play button */}
            <button
              onClick={handleStartCustom}
              disabled={parsedWords.length < 3 || trimmedName.length === 0}
              className={`group relative w-full py-4 rounded-xl font-bold text-xl tracking-wider transition-all duration-200
                ${parsedWords.length >= 3 && trimmedName.length > 0
                  ? 'bg-gradient-to-r from-neon-pink/20 to-neon-yellow/20 border-2 border-neon-pink/50 text-neon-pink hover:border-neon-pink hover:from-neon-pink/30 hover:to-neon-yellow/30 active:scale-[0.97]'
                  : 'bg-dark-card/30 border-2 border-white/10 text-white/20 cursor-not-allowed'
                }`}
              style={{
                boxShadow: parsedWords.length >= 3 && trimmedName.length > 0 ? '0 0 30px rgba(255,0,170,0.1), inset 0 0 30px rgba(255,0,170,0.05)' : 'none',
              }}
            >
              <span className="relative z-10">
                {trimmedName.length === 0
                  ? 'ENTER YOUR NAME FIRST'
                  : parsedWords.length >= 3
                  ? `▶ PLAY WITH ${parsedWords.length} WORDS`
                  : `NEED ${3 - parsedWords.length} MORE WORD${3 - parsedWords.length !== 1 ? 'S' : ''}`
                }
              </span>
              {parsedWords.length >= 3 && trimmedName.length > 0 && (
                <div className="absolute inset-0 rounded-xl bg-neon-pink/5 group-hover:bg-neon-pink/10 transition-all" />
              )}
            </button>
          </>
        )}

        {/* Leaderboard Toggle */}
        {highScores.length > 0 && (
          <button
            onClick={() => setShowScores(!showScores)}
            className="text-white/40 hover:text-white/70 text-sm transition-colors"
          >
            {showScores ? '▲ Hide' : '▼ Show'} My Best Scores
          </button>
        )}

        {/* Leaderboard */}
        {showScores && (
          <LeaderboardPanel
            highScores={highScores}
            currentUsername={trimmedName}
          />
        )}
      </div>
    </div>
  );
}

// ─── Pause Screen ───
function PauseScreen({ onResume, onQuit, username }: { onResume: () => void; onQuit: () => void; username: string }) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-dark-bg/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-6 p-8">
        <div className="text-white/30 text-xs font-bold tracking-[0.3em]">JOE TYPESTORM</div>
        <div className="text-neon-green/50 text-[10px] tracking-widest -mt-3"
          style={{ textShadow: '0 0 6px rgba(57,255,20,0.3)' }}
        >
          PLAYER: {username.toUpperCase()}
        </div>
        <h2
          className="text-4xl sm:text-5xl font-bold text-neon-cyan tracking-widest -mt-4"
          style={{ textShadow: '0 0 20px #00f5ff' }}
        >
          PAUSED
        </h2>
        <div className="flex flex-col gap-3 w-48">
          <button
            onClick={onResume}
            className="py-3 rounded-xl font-bold tracking-wider
              bg-neon-cyan/10 border-2 border-neon-cyan/50 text-neon-cyan
              hover:bg-neon-cyan/20 hover:border-neon-cyan
              active:scale-95 transition-all"
          >
            ▶ RESUME
          </button>
          <button
            onClick={onQuit}
            className="py-3 rounded-xl font-bold tracking-wider
              bg-white/5 border border-white/20 text-white/60
              hover:bg-white/10 hover:text-white/80
              active:scale-95 transition-all"
          >
            ✕ QUIT
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Game Over Screen ───
function GameOverScreen({ score, level, combo, wordsTyped, wpm, highScores, isCustomMode, username, onRestart, onMenu }: {
  score: number;
  level: number;
  combo: number;
  wordsTyped: number;
  wpm: number;
  highScores: HighScore[];
  isCustomMode: boolean;
  username: string;
  onRestart: () => void;
  onMenu: () => void;
}) {
  const myScores = highScores.filter(hs => hs.username.toLowerCase() === username.toLowerCase());
  const isNewBest = score > 0 && myScores.every(hs => hs.score <= score);

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-dark-bg/90 backdrop-blur-md p-4">
      <div className="flex flex-col items-center gap-4 sm:gap-6 max-w-sm w-full">
        <h2
          className="text-4xl sm:text-5xl font-bold text-neon-red tracking-widest"
          style={{ textShadow: '0 0 20px #ff0044, 0 0 40px #ff004460' }}
        >
          GAME OVER
        </h2>

        {isCustomMode && (
          <div
            className="text-neon-pink text-xs font-bold tracking-wider px-3 py-1 rounded-full border border-neon-pink/30 bg-neon-pink/5 -mt-2"
            style={{ textShadow: '0 0 6px #ff00aa' }}
          >
            ✏️ CUSTOM WORDS MODE
          </div>
        )}

        {isNewBest ? (
          <div
            className="text-neon-yellow text-lg font-bold animate-pulse-glow tracking-wider"
          >
            ★ NEW PERSONAL BEST! ★
          </div>
        ) : (
          <div className="text-white/30 text-sm tracking-wide -mt-2">
            Keep going {username}, you got this! 💪
          </div>
        )}

        {/* Stats */}
        <div className="bg-dark-card/60 border border-white/10 rounded-xl p-5 w-full backdrop-blur-sm">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-white/40 text-xs uppercase tracking-wider">Score</div>
              <div className="text-neon-cyan text-2xl font-bold" style={{ textShadow: '0 0 10px #00f5ff' }}>
                {score.toLocaleString()}
              </div>
            </div>
            <div className="text-center">
              <div className="text-white/40 text-xs uppercase tracking-wider">Level</div>
              <div className="text-neon-yellow text-2xl font-bold" style={{ textShadow: '0 0 10px #ffff00' }}>
                {level}
              </div>
            </div>
            <div className="text-center">
              <div className="text-white/40 text-xs uppercase tracking-wider">Words</div>
              <div className="text-neon-green text-2xl font-bold" style={{ textShadow: '0 0 10px #39ff14' }}>
                {wordsTyped}
              </div>
            </div>
            <div className="text-center">
              <div className="text-white/40 text-xs uppercase tracking-wider">Best Combo</div>
              <div className="text-neon-orange text-2xl font-bold" style={{ textShadow: '0 0 10px #ff6600' }}>
                {combo}x
              </div>
            </div>
            <div className="text-center col-span-2">
              <div className="text-white/40 text-xs uppercase tracking-wider">WPM</div>
              <div className="text-neon-pink text-2xl font-bold" style={{ textShadow: '0 0 10px #ff00aa' }}>
                {wpm}
              </div>
            </div>
          </div>
        </div>

        {/* Leaderboard */}
        <LeaderboardPanel
          highScores={highScores}
          currentUsername={username}
          highlightScore={score}
          compact
        />

        {/* Buttons */}
        <div className="flex flex-col gap-3 w-full">
          <button
            onClick={onRestart}
            className="py-3 rounded-xl font-bold text-lg tracking-wider
              bg-gradient-to-r from-neon-cyan/20 to-neon-pink/20
              border-2 border-neon-cyan/50 text-neon-cyan
              hover:border-neon-cyan hover:from-neon-cyan/30 hover:to-neon-pink/30
              active:scale-[0.97] transition-all"
            style={{ boxShadow: '0 0 20px rgba(0,245,255,0.1)' }}
          >
            ↻ PLAY AGAIN
          </button>
          <button
            onClick={onMenu}
            className="py-2.5 rounded-xl font-bold tracking-wider
              bg-white/5 border border-white/20 text-white/60
              hover:bg-white/10 hover:text-white/80
              active:scale-95 transition-all"
          >
            ← MENU
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main App ───
export default function App() {
  const engine = useGameEngine();
  const {
    gameState, score, level, combo, maxCombo, lives, wordsTyped, wpm,
    highScores, shakeScreen, inputValue, isCustomMode, currentUsername,
    words, particles, popups,
    startGame, pauseGame, resumeGame, quitToMenu, handleInput,
    LIVES: maxLives,
  } = engine;

  const [menuState, setMenuState] = useState<'menu' | 'game'>('menu');
  const lastCustomWordsRef = useRef<string[]>([]);
  const lastUsernameRef = useRef('');

  const handleStart = useCallback((username: string) => {
    setMenuState('game');
    lastCustomWordsRef.current = [];
    lastUsernameRef.current = username;
    startGame(undefined, username);
  }, [startGame]);

  const handleStartCustom = useCallback((words: string[], username: string) => {
    setMenuState('game');
    lastCustomWordsRef.current = words;
    lastUsernameRef.current = username;
    startGame(words, username);
  }, [startGame]);

  const handleRestart = useCallback(() => {
    if (lastCustomWordsRef.current.length > 0) {
      startGame(lastCustomWordsRef.current, lastUsernameRef.current);
    } else {
      startGame(undefined, lastUsernameRef.current);
    }
  }, [startGame]);

  const handleQuit = useCallback(() => {
    quitToMenu();
    setMenuState('menu');
    lastCustomWordsRef.current = [];
  }, [quitToMenu]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (gameState === 'playing') {
          pauseGame();
        } else if (gameState === 'paused') {
          resumeGame();
        }
      }
      if (e.key === 'Enter') {
        if (gameState === 'gameover') {
          handleRestart();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [gameState, pauseGame, resumeGame, handleRestart]);

  // Show start screen
  if (menuState === 'menu' || gameState === 'menu') {
    return (
      <StartScreen
        onStart={handleStart}
        onStartCustom={handleStartCustom}
        highScores={highScores}
        savedSentence={loadCustomSentence()}
        savedUsername={loadLastUsername()}
      />
    );
  }

  return (
    <div
      className={`relative w-full h-full overflow-hidden select-none ${shakeScreen ? 'animate-shake' : ''}`}
      style={{ touchAction: 'manipulation' }}
    >
      <BackgroundGrid />

      {/* Game area */}
      <div className="absolute inset-0">
        {/* Danger zone gradient at bottom */}
        <div
          className="absolute bottom-0 left-0 right-0 h-[20%] pointer-events-none z-[5]"
          style={{
            background: 'linear-gradient(to bottom, transparent, rgba(255,0,68,0.05) 50%, rgba(255,0,68,0.12))',
          }}
        />

        {/* Words */}
        {words.filter(w => w.active).map(word => (
          <WordDisplay key={word.id} word={word} />
        ))}

        {/* Particles */}
        <ParticlesLayer particles={particles} />

        {/* Popups */}
        <PopupsLayer popups={popups} />
      </div>

      {/* HUD */}
      <HUD
        score={score}
        level={level}
        combo={combo}
        lives={lives}
        maxLives={maxLives}
        wpm={wpm}
        isCustomMode={isCustomMode}
        username={currentUsername}
      />

      {/* Input */}
      {gameState === 'playing' && (
        <InputArea
          value={inputValue}
          onChange={handleInput}
          onPause={pauseGame}
          gameState={gameState}
        />
      )}

      {/* Pause overlay */}
      {gameState === 'paused' && (
        <PauseScreen onResume={resumeGame} onQuit={handleQuit} username={currentUsername} />
      )}

      {/* Game Over overlay */}
      {gameState === 'gameover' && (
        <GameOverScreen
          score={score}
          level={level}
          combo={maxCombo}
          wordsTyped={wordsTyped}
          wpm={wpm}
          highScores={highScores}
          isCustomMode={isCustomMode}
          username={currentUsername}
          onRestart={handleRestart}
          onMenu={handleQuit}
        />
      )}
    </div>
  );
}
