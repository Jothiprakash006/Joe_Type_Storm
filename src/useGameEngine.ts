import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FallingWord, Particle, ScorePopup, HighScore,
  getRandomWord, getDifficultyForLevel, getDifficultyForWord, randomNeonColor,
  saveHighScore, loadHighScores,
} from './gameData';
import {
  playTypeSound, playWordComplete, playMissSound,
  playComboSound, playGameOver, playLevelUp,
} from './useSound';

export type GameState = 'menu' | 'playing' | 'paused' | 'gameover';

let nextId = 0;
function uid() { return `${++nextId}`; }

const BASE_SPAWN_INTERVAL = 2500;
const MIN_SPAWN_INTERVAL = 600;
const BASE_SPEED = 5; // % per second
const MAX_WORDS = 15;
const WORDS_PER_LEVEL = 8;
const LIVES = 5;

export function useGameEngine() {
  const [gameState, setGameState] = useState<GameState>('menu');
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [lives, setLives] = useState(LIVES);
  const [wordsTyped, setWordsTyped] = useState(0);
  const [totalChars, setTotalChars] = useState(0);
  const [highScores, setHighScores] = useState<HighScore[]>(loadHighScores());
  const [shakeScreen, setShakeScreen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [wpm, setWpm] = useState(0);

  const wordsRef = useRef<FallingWord[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const popupsRef = useRef<ScorePopup[]>([]);
  const [, forceRender] = useState(0);

  // Custom words support
  const customWordsRef = useRef<string[]>([]);
  const customWordIndexRef = useRef(0);
  const [isCustomMode, setIsCustomMode] = useState(false);

  // Username support
  const usernameRef = useRef('');

  const gameStartTime = useRef(0);
  const lastSpawnTime = useRef(0);
  const animFrameRef = useRef(0);
  const lastFrameTime = useRef(0);
  const levelWordsRef = useRef(0);
  const scoreRef = useRef(0);
  const levelRef = useRef(1);
  const comboRef = useRef(0);
  const livesRef = useRef(LIVES);
  const wordsTypedRef = useRef(0);
  const totalCharsRef = useRef(0);
  const gameStateRef = useRef<GameState>('menu');
  const maxComboRef = useRef(0);

  // Sync refs with state
  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { levelRef.current = level; }, [level]);
  useEffect(() => { comboRef.current = combo; }, [combo]);
  useEffect(() => { livesRef.current = lives; }, [lives]);
  useEffect(() => { wordsTypedRef.current = wordsTyped; }, [wordsTyped]);
  useEffect(() => { totalCharsRef.current = totalChars; }, [totalChars]);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { maxComboRef.current = maxCombo; }, [maxCombo]);

  const spawnWord = useCallback(() => {
    let text: string;
    let diff: FallingWord['difficulty'];

    if (customWordsRef.current.length > 0) {
      // Custom mode: cycle through user's words, shuffled
      text = customWordsRef.current[customWordIndexRef.current % customWordsRef.current.length];
      customWordIndexRef.current++;
      diff = getDifficultyForWord(text);
    } else {
      diff = getDifficultyForLevel(levelRef.current);
      text = getRandomWord(diff);
    }

    // Avoid spawning duplicate active words
    if (wordsRef.current.some(w => w.text === text && w.active)) return;
    
    const speedMult = 1 + (levelRef.current - 1) * 0.15;
    const word: FallingWord = {
      id: uid(),
      text,
      x: 5 + Math.random() * 80, // 5-85%
      y: -5,
      speed: (BASE_SPEED + Math.random() * 2) * speedMult,
      typed: '',
      active: true,
      difficulty: diff,
      spawnTime: Date.now(),
    };
    wordsRef.current.push(word);
  }, []);

  const spawnParticles = useCallback((x: number, y: number, color: string, count: number, chars?: string[]) => {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const speed = 80 + Math.random() * 160;
      particlesRef.current.push({
        id: uid(),
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 50,
        life: 0.6 + Math.random() * 0.4,
        maxLife: 1,
        color,
        size: 3 + Math.random() * 4,
        char: chars ? chars[i % chars.length] : undefined,
      });
    }
  }, []);

  const addPopup = useCallback((x: number, y: number, text: string, color: string) => {
    popupsRef.current.push({
      id: uid(),
      x, y, text, color,
      spawnTime: Date.now(),
    });
  }, []);

  const triggerShake = useCallback(() => {
    setShakeScreen(true);
    setTimeout(() => setShakeScreen(false), 400);
  }, []);

  const handleWordComplete = useCallback((word: FallingWord) => {
    const newCombo = comboRef.current + 1;
    setCombo(newCombo);
    comboRef.current = newCombo;
    if (newCombo > maxComboRef.current) {
      setMaxCombo(newCombo);
      maxComboRef.current = newCombo;
    }

    // Score: base points * combo multiplier * difficulty bonus
    const diffBonus = word.difficulty === 'easy' ? 1 : word.difficulty === 'medium' ? 2 : 3;
    const comboMult = 1 + (newCombo - 1) * 0.25;
    const wordScore = Math.round(word.text.length * 10 * diffBonus * comboMult);
    const newScore = scoreRef.current + wordScore;
    setScore(newScore);
    scoreRef.current = newScore;

    const newWordsTyped = wordsTypedRef.current + 1;
    setWordsTyped(newWordsTyped);
    wordsTypedRef.current = newWordsTyped;

    const newTotalChars = totalCharsRef.current + word.text.length;
    setTotalChars(newTotalChars);
    totalCharsRef.current = newTotalChars;

    levelWordsRef.current++;
    if (levelWordsRef.current >= WORDS_PER_LEVEL) {
      levelWordsRef.current = 0;
      const newLevel = levelRef.current + 1;
      setLevel(newLevel);
      levelRef.current = newLevel;
      playLevelUp();
      addPopup(50, 40, `LEVEL ${newLevel}!`, '#ffff00');
    }

    // Calculate WPM
    const elapsed = (Date.now() - gameStartTime.current) / 1000 / 60;
    if (elapsed > 0) {
      setWpm(Math.round((newTotalChars / 5) / elapsed));
    }

    // Juicy effects
    const color = randomNeonColor();
    spawnParticles(word.x, word.y, color, 16, word.text.split(''));
    
    const comboText = newCombo > 1 ? ` x${newCombo}` : '';
    addPopup(word.x, word.y - 3, `+${wordScore}${comboText}`, color);
    
    playWordComplete();
    if (newCombo > 1) playComboSound(newCombo);
    
    word.active = false;
  }, [spawnParticles, addPopup]);

  const endGame = useCallback(() => {
    setGameState('gameover');
    gameStateRef.current = 'gameover';
    cancelAnimationFrame(animFrameRef.current);
    playGameOver();

    const elapsed = (Date.now() - gameStartTime.current) / 1000 / 60;
    const finalWpm = elapsed > 0 ? Math.round((totalCharsRef.current / 5) / elapsed) : 0;
    setWpm(finalWpm);

    const newScores = saveHighScore({
      username: usernameRef.current,
      score: scoreRef.current,
      level: levelRef.current,
      wpm: finalWpm,
      date: new Date().toLocaleDateString(),
    });
    setHighScores(newScores);
  }, []);

  const handleWordMissed = useCallback((word: FallingWord) => {
    const newLives = livesRef.current - 1;
    setLives(newLives);
    livesRef.current = newLives;
    setCombo(0);
    comboRef.current = 0;

    // Reset any active typing on this word
    word.active = false;

    spawnParticles(word.x, 95, '#ff0044', 8);
    addPopup(word.x, 90, 'MISS!', '#ff0044');
    triggerShake();
    playMissSound();

    if (newLives <= 0) {
      endGame();
    }
  }, [spawnParticles, addPopup, triggerShake, endGame]);

  const gameLoop = useCallback((timestamp: number) => {
    if (gameStateRef.current !== 'playing') return;

    if (!lastFrameTime.current) lastFrameTime.current = timestamp;
    const dt = Math.min((timestamp - lastFrameTime.current) / 1000, 0.1);
    lastFrameTime.current = timestamp;

    // Spawn words
    const spawnInterval = Math.max(
      MIN_SPAWN_INTERVAL,
      BASE_SPAWN_INTERVAL - (levelRef.current - 1) * 200
    );
    if (timestamp - lastSpawnTime.current > spawnInterval && wordsRef.current.filter(w => w.active).length < MAX_WORDS) {
      spawnWord();
      lastSpawnTime.current = timestamp;
    }

    // Update words
    for (const word of wordsRef.current) {
      if (!word.active) continue;
      word.y += word.speed * dt;
      if (word.y > 98) {
        handleWordMissed(word);
      }
    }

    // Remove inactive words
    wordsRef.current = wordsRef.current.filter(w => w.active);

    // Update particles
    for (const p of particlesRef.current) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 120 * dt; // gravity
      p.life -= dt;
    }
    particlesRef.current = particlesRef.current.filter(p => p.life > 0);

    // Remove old popups
    const now = Date.now();
    popupsRef.current = popupsRef.current.filter(p => now - p.spawnTime < 1000);

    forceRender(n => n + 1);
    animFrameRef.current = requestAnimationFrame(gameLoop);
  }, [spawnWord, handleWordMissed]);

  const startGame = useCallback((customWords?: string[], username?: string) => {
    nextId = 0;
    wordsRef.current = [];
    particlesRef.current = [];
    popupsRef.current = [];
    setScore(0);
    scoreRef.current = 0;
    setLevel(1);
    levelRef.current = 1;
    setCombo(0);
    comboRef.current = 0;
    setMaxCombo(0);
    maxComboRef.current = 0;
    setLives(LIVES);
    livesRef.current = LIVES;
    setWordsTyped(0);
    wordsTypedRef.current = 0;
    setTotalChars(0);
    totalCharsRef.current = 0;
    setWpm(0);
    setInputValue('');
    levelWordsRef.current = 0;
    gameStartTime.current = Date.now();
    lastSpawnTime.current = 0;
    lastFrameTime.current = 0;

    // Set username
    if (username) {
      usernameRef.current = username;
    }

    // Set custom words
    if (customWords && customWords.length > 0) {
      // Shuffle the custom words
      const shuffled = [...customWords].sort(() => Math.random() - 0.5);
      customWordsRef.current = shuffled;
      customWordIndexRef.current = 0;
      setIsCustomMode(true);
    } else {
      customWordsRef.current = [];
      customWordIndexRef.current = 0;
      setIsCustomMode(false);
    }

    setGameState('playing');
    gameStateRef.current = 'playing';
    animFrameRef.current = requestAnimationFrame(gameLoop);
  }, [gameLoop]);

  const pauseGame = useCallback(() => {
    if (gameStateRef.current === 'playing') {
      setGameState('paused');
      gameStateRef.current = 'paused';
      cancelAnimationFrame(animFrameRef.current);
    }
  }, []);

  const resumeGame = useCallback(() => {
    if (gameStateRef.current === 'paused') {
      setGameState('playing');
      gameStateRef.current = 'playing';
      lastFrameTime.current = 0;
      animFrameRef.current = requestAnimationFrame(gameLoop);
    }
  }, [gameLoop]);

  const quitToMenu = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    wordsRef.current = [];
    particlesRef.current = [];
    popupsRef.current = [];
    setInputValue('');
    setScore(0);
    scoreRef.current = 0;
    setCombo(0);
    comboRef.current = 0;
    setGameState('menu');
    gameStateRef.current = 'menu';
  }, []);

  const handleInput = useCallback((value: string) => {
    const v = value.toLowerCase().trim();
    setInputValue(v);

    if (!v) {
      // Clear all typed progress
      for (const w of wordsRef.current) {
        if (w.active) w.typed = '';
      }
      return;
    }

    playTypeSound();

    // Find best matching word
    let bestMatch: FallingWord | null = null;
    let bestMatchLen = 0;

    for (const word of wordsRef.current) {
      if (!word.active) continue;
      if (word.text.startsWith(v)) {
        if (v.length > bestMatchLen) {
          bestMatch = word;
          bestMatchLen = v.length;
        }
        word.typed = v;
      } else {
        word.typed = '';
      }
    }

    // Check if word is complete
    if (bestMatch && v === bestMatch.text) {
      handleWordComplete(bestMatch);
      setInputValue('');
      // Clear typing from other words
      for (const w of wordsRef.current) {
        if (w.active) w.typed = '';
      }
    }
  }, [handleWordComplete]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  return {
    gameState,
    score,
    level,
    combo,
    maxCombo,
    lives,
    wordsTyped,
    wpm,
    highScores,
    shakeScreen,
    inputValue,
    isCustomMode,
    currentUsername: usernameRef.current,
    words: wordsRef.current,
    particles: particlesRef.current,
    popups: popupsRef.current,
    startGame,
    pauseGame,
    resumeGame,
    quitToMenu,
    handleInput,
    setHighScores,
    LIVES,
  };
}
