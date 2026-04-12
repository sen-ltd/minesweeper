/**
 * i18n.js — Japanese / English translations.
 */

export const TRANSLATIONS = {
  ja: {
    title: 'マインスイーパ',
    beginner: '初級',
    intermediate: '中級',
    expert: '上級',
    custom: 'カスタム',
    newGame: '新しいゲーム',
    youWon: 'クリア！',
    youLost: 'ゲームオーバー',
    bestTime: 'ベストタイム',
    bestTimes: 'ベストタイム',
    rows: '行',
    cols: '列',
    mines: '地雷数',
    apply: '適用',
    seconds: '秒',
    noRecord: '記録なし',
    lang: 'EN',
    minesLeft: '残り地雷',
    time: '時間',
  },
  en: {
    title: 'Minesweeper',
    beginner: 'Beginner',
    intermediate: 'Intermediate',
    expert: 'Expert',
    custom: 'Custom',
    newGame: 'New Game',
    youWon: 'You Win!',
    youLost: 'Game Over',
    bestTime: 'Best Time',
    bestTimes: 'Best Times',
    rows: 'Rows',
    cols: 'Cols',
    mines: 'Mines',
    apply: 'Apply',
    seconds: 's',
    noRecord: 'No record',
    lang: 'JA',
    minesLeft: 'Mines',
    time: 'Time',
  },
};

let currentLang = 'ja';

export function getLang() {
  return currentLang;
}

export function setLang(lang) {
  if (TRANSLATIONS[lang]) currentLang = lang;
}

export function t(key) {
  return TRANSLATIONS[currentLang][key] ?? TRANSLATIONS['en'][key] ?? key;
}
