/**
 * minesweeper.js — Pure game logic. No DOM dependencies.
 */

export const DIFFICULTIES = {
  Beginner: { rows: 9, cols: 9, mines: 10 },
  Intermediate: { rows: 16, cols: 16, mines: 40 },
  Expert: { rows: 16, cols: 30, mines: 99 },
  Custom: { rows: 9, cols: 9, mines: 10 }, // defaults, overridden by user
};

/**
 * Create a fresh board, placing mines randomly while keeping
 * (safeRow, safeCol) and its 8 neighbors mine-free.
 *
 * @param {number} rows
 * @param {number} cols
 * @param {number} mineCount
 * @param {number|null} safeRow  - row of the first click (or null to skip safe zone)
 * @param {number|null} safeCol  - col of the first click (or null to skip safe zone)
 * @returns {Array<Array<{mine:boolean, revealed:boolean, flagged:boolean, neighbors:number}>>}
 */
export function createBoard(rows, cols, mineCount, safeRow = null, safeCol = null) {
  // Build flat list of all positions
  const positions = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      positions.push([r, c]);
    }
  }

  // Determine safe zone cells
  const safeSet = new Set();
  if (safeRow !== null && safeCol !== null) {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = safeRow + dr;
        const nc = safeCol + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
          safeSet.add(nr * cols + nc);
        }
      }
    }
  }

  // Eligible positions (not in safe zone)
  let eligible = positions.filter(([r, c]) => !safeSet.has(r * cols + c));

  // If not enough eligible positions, expand to all positions
  const actualMineCount = Math.min(mineCount, eligible.length);

  // Fisher-Yates shuffle eligible, take first actualMineCount as mines
  for (let i = eligible.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [eligible[i], eligible[j]] = [eligible[j], eligible[i]];
  }

  const mineSet = new Set();
  for (let i = 0; i < actualMineCount; i++) {
    const [r, c] = eligible[i];
    mineSet.add(r * cols + c);
  }

  // Build board grid
  const board = [];
  for (let r = 0; r < rows; r++) {
    board[r] = [];
    for (let c = 0; c < cols; c++) {
      board[r][c] = {
        mine: mineSet.has(r * cols + c),
        revealed: false,
        flagged: false,
        neighbors: 0,
      };
    }
  }

  // Calculate neighbor counts
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (board[r][c].mine) continue;
      let count = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && board[nr][nc].mine) {
            count++;
          }
        }
      }
      board[r][c].neighbors = count;
    }
  }

  return board;
}

/**
 * Reveal a cell. If it's a mine, returns hitMine: true.
 * If it has 0 mine neighbors, flood-fills adjacent empty cells.
 *
 * Returns a new board (deep copy) and a list of revealed cells.
 *
 * @param {Array} board
 * @param {number} row
 * @param {number} col
 * @returns {{ board: Array, revealedCells: Array<{row:number,col:number}>, hitMine: boolean }}
 */
export function revealCell(board, row, col) {
  const rows = board.length;
  const cols = board[0].length;

  // Deep copy
  const newBoard = board.map(r => r.map(c => ({ ...c })));
  const cell = newBoard[row][col];

  // Already revealed or flagged — no-op
  if (cell.revealed || cell.flagged) {
    return { board: newBoard, revealedCells: [], hitMine: false };
  }

  if (cell.mine) {
    cell.revealed = true;
    return { board: newBoard, revealedCells: [{ row, col }], hitMine: true };
  }

  // BFS flood fill
  const revealedCells = [];
  const queue = [[row, col]];
  const visited = new Set();
  visited.add(row * cols + col);

  while (queue.length > 0) {
    const [r, c] = queue.shift();
    const cur = newBoard[r][c];
    if (cur.revealed || cur.flagged || cur.mine) continue;

    cur.revealed = true;
    revealedCells.push({ row: r, col: c });

    if (cur.neighbors === 0) {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr;
          const nc = c + dc;
          if (
            nr >= 0 && nr < rows &&
            nc >= 0 && nc < cols &&
            !visited.has(nr * cols + nc)
          ) {
            visited.add(nr * cols + nc);
            queue.push([nr, nc]);
          }
        }
      }
    }
  }

  return { board: newBoard, revealedCells, hitMine: false };
}

/**
 * Toggle flag on an unrevealed cell.
 *
 * @param {Array} board
 * @param {number} row
 * @param {number} col
 * @returns {Array} new board
 */
export function toggleFlag(board, row, col) {
  const newBoard = board.map(r => r.map(c => ({ ...c })));
  const cell = newBoard[row][col];
  if (!cell.revealed) {
    cell.flagged = !cell.flagged;
  }
  return newBoard;
}

/**
 * Check if the player has won: every non-mine cell is revealed.
 *
 * @param {Array} board
 * @returns {boolean}
 */
export function checkWin(board) {
  for (const row of board) {
    for (const cell of row) {
      if (!cell.mine && !cell.revealed) return false;
    }
  }
  return true;
}

/**
 * Count remaining mines = total mines - number of flagged cells.
 *
 * @param {Array} board
 * @returns {number}
 */
export function countRemainingMines(board) {
  let totalMines = 0;
  let flagged = 0;
  for (const row of board) {
    for (const cell of row) {
      if (cell.mine) totalMines++;
      if (cell.flagged) flagged++;
    }
  }
  return totalMines - flagged;
}
