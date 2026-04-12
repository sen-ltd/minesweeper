/**
 * main.js — DOM, events, rendering.
 * Depends on minesweeper.js (game logic) and i18n.js (translations).
 */

import {
  DIFFICULTIES,
  createBoard,
  revealCell,
  toggleFlag,
  checkWin,
  countRemainingMines,
} from './minesweeper.js';

import { t, getLang, setLang } from './i18n.js';

// ── State ────────────────────────────────────────────────────────────────────

let board = null;
let gameState = 'idle'; // idle | playing | won | lost
let difficulty = 'Beginner';
let customConfig = { rows: 9, cols: 9, mines: 10 };
let timerInterval = null;
let elapsedSeconds = 0;
let firstClick = true;
let focusRow = 0;
let focusCol = 0;

// ── DOM refs ─────────────────────────────────────────────────────────────────

const $ = id => document.getElementById(id);

// ── Init ─────────────────────────────────────────────────────────────────────

function init() {
  renderI18n();
  bindDifficultyButtons();
  bindCustomForm();
  bindSmiley();
  bindLangToggle();
  bindKeyboard();
  startNewGame();
}

// ── i18n ─────────────────────────────────────────────────────────────────────

function renderI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  $('lang-toggle').textContent = t('lang');
}

function bindLangToggle() {
  $('lang-toggle').addEventListener('click', () => {
    setLang(getLang() === 'ja' ? 'en' : 'ja');
    renderI18n();
    renderBestTimes();
  });
}

// ── Difficulty ────────────────────────────────────────────────────────────────

function bindDifficultyButtons() {
  document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      difficulty = btn.dataset.diff;
      document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      $('custom-form').style.display = difficulty === 'Custom' ? 'flex' : 'none';
      startNewGame();
    });
  });
}

function bindCustomForm() {
  $('custom-apply').addEventListener('click', () => {
    const rows = Math.max(5, Math.min(30, parseInt($('custom-rows').value) || 9));
    const cols = Math.max(5, Math.min(50, parseInt($('custom-cols').value) || 9));
    const maxMines = Math.max(1, rows * cols - 9);
    const mines = Math.max(1, Math.min(maxMines, parseInt($('custom-mines').value) || 10));
    customConfig = { rows, cols, mines };
    $('custom-rows').value = rows;
    $('custom-cols').value = cols;
    $('custom-mines').value = mines;
    startNewGame();
  });
}

// ── Game control ──────────────────────────────────────────────────────────────

function getConfig() {
  if (difficulty === 'Custom') return customConfig;
  return DIFFICULTIES[difficulty];
}

function startNewGame() {
  stopTimer();
  elapsedSeconds = 0;
  firstClick = true;
  gameState = 'idle';

  const { rows, cols } = getConfig();
  focusRow = 0;
  focusCol = 0;

  // Create a board without safe zone yet (mines placed on first click)
  board = null;

  updateTimerDisplay();
  updateSmiley();
  renderEmptyBoard(rows, cols);
  renderMineCounter(getConfig().mines);
  renderBestTimes();
}

function renderEmptyBoard(rows, cols) {
  const grid = $('grid');
  grid.style.setProperty('--cols', cols);
  grid.innerHTML = '';

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = document.createElement('button');
      cell.className = 'cell unrevealed';
      cell.dataset.row = r;
      cell.dataset.col = c;
      cell.setAttribute('tabindex', r === 0 && c === 0 ? '0' : '-1');
      cell.setAttribute('aria-label', `cell ${r},${c}`);
      cell.addEventListener('click', onCellClick);
      cell.addEventListener('contextmenu', onCellRightClick);
      cell.addEventListener('touchstart', onTouchStart, { passive: true });
      cell.addEventListener('touchend', onTouchEnd);
      cell.addEventListener('focus', () => { focusRow = r; focusCol = c; });
      grid.appendChild(cell);
    }
  }
}

function onCellClick(e) {
  if (gameState === 'won' || gameState === 'lost') return;
  const row = parseInt(e.currentTarget.dataset.row);
  const col = parseInt(e.currentTarget.dataset.col);
  handleReveal(row, col);
}

function onCellRightClick(e) {
  e.preventDefault();
  if (gameState === 'won' || gameState === 'lost') return;
  if (gameState === 'idle') return; // can't flag before first click
  const row = parseInt(e.currentTarget.dataset.row);
  const col = parseInt(e.currentTarget.dataset.col);
  handleFlag(row, col);
}

// ── Touch support (long press = flag) ────────────────────────────────────────

let touchTimer = null;
let touchMoved = false;

function onTouchStart(e) {
  touchMoved = false;
  const row = parseInt(e.currentTarget.dataset.row);
  const col = parseInt(e.currentTarget.dataset.col);
  touchTimer = setTimeout(() => {
    if (!touchMoved) {
      handleFlag(row, col);
    }
  }, 500);
}

function onTouchEnd() {
  clearTimeout(touchTimer);
}

// ── Core actions ──────────────────────────────────────────────────────────────

function handleReveal(row, col) {
  if (gameState === 'won' || gameState === 'lost') return;

  const config = getConfig();

  if (firstClick) {
    // Place mines now, guaranteeing safety around first click
    board = createBoard(config.rows, config.cols, config.mines, row, col);
    firstClick = false;
    gameState = 'playing';
    startTimer();
  }

  if (!board[row][col].revealed && board[row][col].flagged) return;

  const result = revealCell(board, row, col);
  board = result.board;

  if (result.hitMine) {
    gameState = 'lost';
    stopTimer();
    revealAllMines();
    showWrongFlags();
    updateSmiley();
    return;
  }

  renderBoard();
  updateMineCounter();

  if (checkWin(board)) {
    gameState = 'won';
    stopTimer();
    saveBestTime();
    updateSmiley();
    renderBestTimes();
  }
}

function handleFlag(row, col) {
  if (gameState !== 'playing') return;
  board = toggleFlag(board, row, col);
  updateMineCounter();
  renderBoard();
}

// ── Rendering ─────────────────────────────────────────────────────────────────

function renderBoard() {
  if (!board) return;
  const cells = document.querySelectorAll('.cell');
  const cols = board[0].length;

  cells.forEach(el => {
    const r = parseInt(el.dataset.row);
    const c = parseInt(el.dataset.col);
    const cell = board[r][c];
    renderCellElement(el, cell, r, c, cols);
  });
}

function renderCellElement(el, cell, r, c, cols) {
  el.className = 'cell';
  el.textContent = '';
  el.removeAttribute('data-num');

  if (cell.flagged && !cell.revealed) {
    el.classList.add('flagged');
    el.textContent = '🚩';
  } else if (!cell.revealed) {
    el.classList.add('unrevealed');
  } else if (cell.mine) {
    el.classList.add('mine');
    el.textContent = '💣';
  } else if (cell.neighbors > 0) {
    el.classList.add('revealed');
    el.classList.add(`n${cell.neighbors}`);
    el.dataset.num = cell.neighbors;
    el.textContent = cell.neighbors;
  } else {
    el.classList.add('revealed');
  }

  el.setAttribute('tabindex', r === focusRow && c === focusCol ? '0' : '-1');
}

function revealAllMines() {
  if (!board) return;
  const cells = document.querySelectorAll('.cell');
  const cols = board[0].length;

  cells.forEach(el => {
    const r = parseInt(el.dataset.row);
    const c = parseInt(el.dataset.col);
    const cell = board[r][c];

    if (cell.mine && !cell.flagged) {
      cell.revealed = true;
      el.className = 'cell mine';
      el.textContent = '💣';
    }
  });
}

function showWrongFlags() {
  if (!board) return;
  document.querySelectorAll('.cell').forEach(el => {
    const r = parseInt(el.dataset.row);
    const c = parseInt(el.dataset.col);
    const cell = board[r][c];
    if (cell.flagged && !cell.mine) {
      el.className = 'cell wrong-flag';
      el.textContent = '❌';
    }
  });
}

// ── Mine counter ──────────────────────────────────────────────────────────────

function updateMineCounter() {
  const count = board ? countRemainingMines(board) : getConfig().mines;
  renderMineCounter(count);
}

function renderMineCounter(count) {
  $('mine-count').textContent = String(count).padStart(3, '0');
}

// ── Timer ─────────────────────────────────────────────────────────────────────

function startTimer() {
  stopTimer();
  timerInterval = setInterval(() => {
    elapsedSeconds++;
    updateTimerDisplay();
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function updateTimerDisplay() {
  $('timer').textContent = String(Math.min(elapsedSeconds, 999)).padStart(3, '0');
}

// ── Smiley button ─────────────────────────────────────────────────────────────

function bindSmiley() {
  $('smiley').addEventListener('click', startNewGame);
}

function updateSmiley() {
  const map = { idle: '😊', playing: '😊', won: '😎', lost: '😵' };
  $('smiley').textContent = map[gameState] ?? '😊';
}

// ── Best times ────────────────────────────────────────────────────────────────

function bestTimeKey(diff) {
  return `minesweeper_best_${diff}`;
}

function saveBestTime() {
  if (difficulty === 'Custom') return;
  const key = bestTimeKey(difficulty);
  const prev = localStorage.getItem(key);
  if (prev === null || elapsedSeconds < parseInt(prev)) {
    localStorage.setItem(key, elapsedSeconds);
  }
}

function renderBestTimes() {
  const container = $('best-times');
  container.innerHTML = `<h3>${t('bestTimes')}</h3>`;

  ['Beginner', 'Intermediate', 'Expert'].forEach(diff => {
    const key = bestTimeKey(diff);
    const val = localStorage.getItem(key);
    const label = t(diff.toLowerCase());
    const time = val !== null ? `${val}${t('seconds')}` : t('noRecord');

    const row = document.createElement('div');
    row.className = 'best-row';
    row.innerHTML = `<span class="best-label">${label}</span><span class="best-val">${time}</span>`;
    container.appendChild(row);
  });
}

// ── Keyboard ──────────────────────────────────────────────────────────────────

function bindKeyboard() {
  document.addEventListener('keydown', e => {
    if (!board) return;

    const rows = board.length;
    const cols = board[0].length;

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        focusRow = Math.max(0, focusRow - 1);
        moveFocus(rows, cols);
        break;
      case 'ArrowDown':
        e.preventDefault();
        focusRow = Math.min(rows - 1, focusRow + 1);
        moveFocus(rows, cols);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        focusCol = Math.max(0, focusCol - 1);
        moveFocus(rows, cols);
        break;
      case 'ArrowRight':
        e.preventDefault();
        focusCol = Math.min(cols - 1, focusCol + 1);
        moveFocus(rows, cols);
        break;
      case ' ':
      case 'Enter':
        e.preventDefault();
        handleReveal(focusRow, focusCol);
        break;
      case 'f':
      case 'F':
        handleFlag(focusRow, focusCol);
        break;
      case 'r':
      case 'R':
        startNewGame();
        break;
    }
  });
}

function moveFocus(rows, cols) {
  document.querySelectorAll('.cell').forEach(el => {
    const r = parseInt(el.dataset.row);
    const c = parseInt(el.dataset.col);
    el.setAttribute('tabindex', r === focusRow && c === focusCol ? '0' : '-1');
  });
  const target = document.querySelector(`.cell[data-row="${focusRow}"][data-col="${focusCol}"]`);
  if (target) target.focus();
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', init);
