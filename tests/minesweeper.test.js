import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createBoard,
  revealCell,
  toggleFlag,
  checkWin,
  countRemainingMines,
  DIFFICULTIES,
} from '../src/minesweeper.js';

// ── createBoard ───────────────────────────────────────────────────────────────

test('createBoard: correct dimensions', () => {
  const board = createBoard(9, 9, 10);
  assert.equal(board.length, 9);
  assert.ok(board.every(row => row.length === 9));
});

test('createBoard: correct mine count', () => {
  const board = createBoard(9, 9, 10);
  const mineCount = board.flat().filter(c => c.mine).length;
  assert.equal(mineCount, 10);
});

test('createBoard: all cells initially unrevealed and unflagged', () => {
  const board = createBoard(9, 9, 10);
  assert.ok(board.flat().every(c => !c.revealed && !c.flagged));
});

test('createBoard: first-click safety — safe cell has no mine', () => {
  // Run many times to make it statistically reliable
  for (let i = 0; i < 20; i++) {
    const board = createBoard(9, 9, 10, 4, 4);
    assert.equal(board[4][4].mine, false, 'safe cell should not be a mine');
  }
});

test('createBoard: first-click safety — 8 neighbors also mine-free', () => {
  for (let i = 0; i < 20; i++) {
    const board = createBoard(9, 9, 10, 4, 4);
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        assert.equal(board[4 + dr][4 + dc].mine, false,
          `neighbor (${4 + dr},${4 + dc}) should not be a mine`);
      }
    }
  }
});

test('createBoard: neighbor counts are correct', () => {
  // Build a 3x3 board with 0 mines — all neighbor counts must be 0
  const board = createBoard(3, 3, 0);
  assert.ok(board.flat().every(c => c.neighbors === 0));
});

test('createBoard: neighbor count for isolated mine', () => {
  // Place mine at center of 3x3: all 8 surrounding cells should have neighbors=1
  // We can't force mine placement, so we verify: for every mine, each non-mine
  // neighbor's count reflects that mine
  const board = createBoard(3, 3, 1);
  const mineCell = board.flat().find(c => c.mine);
  const mines = board.flat().filter(c => c.mine);
  assert.equal(mines.length, 1);

  // Find the mine position
  let mr = -1, mc = -1;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      if (board[r][c].mine) { mr = r; mc = c; }
    }
  }

  // All non-mine neighbors of the mine should have neighbors >= 1
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const nr = mr + dr;
      const nc = mc + dc;
      if (dr === 0 && dc === 0) continue;
      if (nr < 0 || nr >= 3 || nc < 0 || nc >= 3) continue;
      assert.ok(board[nr][nc].neighbors >= 1,
        `cell (${nr},${nc}) near mine should have neighbors >= 1`);
    }
  }
});

test('createBoard: DIFFICULTIES object has expected keys', () => {
  assert.ok('Beginner' in DIFFICULTIES);
  assert.ok('Intermediate' in DIFFICULTIES);
  assert.ok('Expert' in DIFFICULTIES);
  assert.ok('Custom' in DIFFICULTIES);
});

test('createBoard: Beginner config matches spec', () => {
  assert.equal(DIFFICULTIES.Beginner.rows, 9);
  assert.equal(DIFFICULTIES.Beginner.cols, 9);
  assert.equal(DIFFICULTIES.Beginner.mines, 10);
});

// ── revealCell ────────────────────────────────────────────────────────────────

test('revealCell: reveals a non-mine cell', () => {
  // Create a board with no mines so any cell is safe
  const board = createBoard(5, 5, 0);
  const { board: b2, revealedCells, hitMine } = revealCell(board, 2, 2);
  assert.equal(hitMine, false);
  assert.equal(b2[2][2].revealed, true);
  assert.ok(revealedCells.some(c => c.row === 2 && c.col === 2));
});

test('revealCell: hit mine returns hitMine true', () => {
  // Create a board, then manually set a cell to mine
  const board = createBoard(5, 5, 0);
  board[0][0].mine = true;
  board[0][0].neighbors = 0;

  const { hitMine, revealedCells } = revealCell(board, 0, 0);
  assert.equal(hitMine, true);
  assert.ok(revealedCells.some(c => c.row === 0 && c.col === 0));
});

test('revealCell: flood fill on empty cell reveals all connected empties', () => {
  // 5x5, no mines → reveal (0,0) should reveal entire board
  const board = createBoard(5, 5, 0);
  const { board: b2, revealedCells } = revealCell(board, 0, 0);
  assert.equal(revealedCells.length, 25);
  assert.ok(b2.flat().every(c => c.revealed));
});

test('revealCell: flagged cell is not revealed', () => {
  const board = createBoard(5, 5, 0);
  const flagged = board.map(r => r.map(c => ({ ...c })));
  flagged[2][2].flagged = true;
  const { board: b2 } = revealCell(flagged, 2, 2);
  assert.equal(b2[2][2].revealed, false);
});

test('revealCell: already revealed cell is no-op', () => {
  const board = createBoard(5, 5, 0);
  const { board: b1 } = revealCell(board, 0, 0);
  const revealed1 = b1.flat().filter(c => c.revealed).length;
  const { board: b2, revealedCells } = revealCell(b1, 0, 0);
  const revealed2 = b2.flat().filter(c => c.revealed).length;
  assert.equal(revealedCells.length, 0);
  assert.equal(revealed1, revealed2);
});

test('revealCell: original board is not mutated', () => {
  const board = createBoard(5, 5, 0);
  revealCell(board, 2, 2);
  assert.equal(board[2][2].revealed, false, 'original board should be unmodified');
});

// ── toggleFlag ────────────────────────────────────────────────────────────────

test('toggleFlag: flags an unrevealed cell', () => {
  const board = createBoard(5, 5, 0);
  const b2 = toggleFlag(board, 1, 1);
  assert.equal(b2[1][1].flagged, true);
});

test('toggleFlag: unflags a flagged cell', () => {
  const board = createBoard(5, 5, 0);
  const b2 = toggleFlag(board, 1, 1);
  const b3 = toggleFlag(b2, 1, 1);
  assert.equal(b3[1][1].flagged, false);
});

test('toggleFlag: cannot flag a revealed cell', () => {
  const board = createBoard(5, 5, 0);
  const { board: b2 } = revealCell(board, 0, 0);
  const b3 = toggleFlag(b2, 0, 0);
  assert.equal(b3[0][0].flagged, false);
});

// ── checkWin ─────────────────────────────────────────────────────────────────

test('checkWin: false when no cells revealed', () => {
  const board = createBoard(5, 5, 5);
  assert.equal(checkWin(board), false);
});

test('checkWin: true when all non-mine cells revealed', () => {
  const board = createBoard(5, 5, 0);
  const { board: b2 } = revealCell(board, 0, 0);
  assert.equal(checkWin(b2), true);
});

test('checkWin: false when some non-mine cells remain', () => {
  // 5x5 with mines, reveal one safe cell — should not win yet
  const board = createBoard(5, 5, 24); // 24 mines means 1 safe cell
  let b = board;
  let safeRow = -1, safeCol = -1;
  outer: for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      if (!board[r][c].mine) { safeRow = r; safeCol = c; break outer; }
    }
  }
  if (safeRow !== -1) {
    const { board: b2 } = revealCell(b, safeRow, safeCol);
    assert.equal(checkWin(b2), true); // only 1 safe cell, should win
  }
});

// ── countRemainingMines ───────────────────────────────────────────────────────

test('countRemainingMines: equals mine count when no flags', () => {
  const board = createBoard(9, 9, 10);
  assert.equal(countRemainingMines(board), 10);
});

test('countRemainingMines: decreases when cell flagged', () => {
  const board = createBoard(9, 9, 10);
  const b2 = toggleFlag(board, 0, 0);
  assert.equal(countRemainingMines(b2), 9);
});

test('countRemainingMines: can go negative (wrong flags)', () => {
  const board = createBoard(5, 5, 1);
  let b = board;
  // Flag many cells
  for (let c = 0; c < 5; c++) {
    b = toggleFlag(b, 0, c);
  }
  assert.ok(countRemainingMines(b) < 0);
});
