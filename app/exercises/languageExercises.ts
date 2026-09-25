import type { LanguageExerciseDefinition } from './types';

const alphabetAB = ['a', 'b'];

export const languageExercises: LanguageExerciseDefinition[] = [
  {
    id: 1, title: 'Termine par a', prompt: 'Ensemble des mots tels que le dernier symbole est un $a$.', alphabet: alphabetAB,
    accepted: ['a', 'ba', 'abba'], rejected: ['', 'b', 'aab'], initial: 'no',
    isFinal: (state) => state === 'a', transition: (_, symbol) => symbol === 'a' ? 'a' : 'no',
  },
  {
    id: 2, title: 'Contient le facteur ab', prompt: 'Ensemble des mots tels que le facteur $ab$ apparaît.', alphabet: alphabetAB,
    accepted: ['ab', 'aab', 'baba'], rejected: ['', 'a', 'bbaa'], initial: '0',
    isFinal: (state) => state === '2', transition: (state, symbol) => state === '2' ? '2' : state === '1' && symbol === 'b' ? '2' : symbol === 'a' ? '1' : '0',
  },
  {
    id: 3, title: 'Exactement deux a', prompt: 'Ensemble des mots tels que la lettre $a$ apparaît exactement deux fois.', alphabet: alphabetAB,
    accepted: ['aa', 'aba', 'bbaab'], rejected: ['', 'a', 'aaa'], initial: '0',
    isFinal: (state) => state === '2', transition: (state, symbol) => symbol === 'b' ? state : String(Math.min(3, Number(state) + 1)),
  },
  {
    id: 4, title: 'Jamais trois bits identiques', prompt: 'Ensemble des mots tels que ni $000$ ni $111$ n’apparaît comme facteur.', alphabet: ['0', '1'],
    accepted: ['', '0011', '01010', '1100'], rejected: ['000', '111', '10001'], initial: 'start',
    isFinal: (state) => state !== 'dead', transition: (state, symbol) => { if (state === 'dead' || state === symbol.repeat(2)) return 'dead'; return state.endsWith(symbol) ? symbol.repeat(2) : symbol; },
  },
  {
    id: 5, title: 'Deuxième bit depuis la fin', prompt: 'Ensemble des mots tels que le deuxième bit en partant de la fin est $1$.', alphabet: ['0', '1'],
    accepted: ['10', '11', '010', '1110'], rejected: ['', '1', '00', '101'], initial: '',
    isFinal: (state) => state.length >= 2 && state.at(-2) === '1', transition: (state, symbol) => (state + symbol).slice(-2),
  },
  {
    id: 6, title: 'Un seul des deux facteurs', prompt: 'Ensemble des mots contenant au moins une fois le facteur $aba$ ou au moins une fois le facteur $bab$, mais pas les deux.', alphabet: alphabetAB,
    accepted: ['aba', 'bab', 'aabaa', 'bbabb'], rejected: ['', 'abba', 'abab', 'baba'], initial: '0|',
    isFinal: (state) => state.startsWith('1|') || state.startsWith('2|'), transition: (state, symbol) => { const [rawMask, suffix] = state.split('|'); const word = suffix + symbol; const mask = Number(rawMask) | (word.endsWith('aba') ? 1 : 0) | (word.endsWith('bab') ? 2 : 0); return `${mask}|${word.slice(-2)}`; },
  },
  {
    id: 7, title: 'Lettres c assorties', prompt: 'Ensemble des mots tels que chaque $c$ est immédiatement précédé et suivi de la même lettre : $aca$ ou $bcb$.', alphabet: ['a', 'b', 'c'],
    accepted: ['', 'ab', 'aca', 'bcb', 'abcbaca'], rejected: ['c', 'ac', 'acb', 'cca'], initial: 'none',
    isFinal: (state) => state === 'none' || state.startsWith('last-'), transition: (state, symbol) => { if (state === 'dead') return 'dead'; if (state === 'need-a' || state === 'need-b') return symbol === state.at(-1) ? `last-${symbol}` : 'dead'; if (symbol === 'c') return state === 'last-a' ? 'need-a' : state === 'last-b' ? 'need-b' : 'dead'; return `last-${symbol}`; },
  },
  {
    id: 8, title: 'Parités opposées autour de #', prompt: 'Ensemble des mots tels que $\\#$ apparaît exactement une fois et que les nombres de $1$ avant et après $\\#$ ont des parités différentes.', alphabet: ['0', '1', '#'],
    accepted: ['#1', '1#', '10#11', '11#1'], rejected: ['', '#', '1#1', '#11', '1#0#'], initial: 'pre:0',
    isFinal: (state) => { const parts = state.split(':'); return parts[0] === 'post' && parts[1] !== parts[2]; }, transition: (state, symbol) => { if (state === 'dead') return 'dead'; const parts = state.split(':'); if (parts[0] === 'pre') { if (symbol === '#') return `post:${parts[1]}:0`; return `pre:${symbol === '1' ? 1 - Number(parts[1]) : parts[1]}`; } if (symbol === '#') return 'dead'; return `post:${parts[1]}:${symbol === '1' ? 1 - Number(parts[2]) : parts[2]}`; },
  },
  {
    id: 9, title: 'Première lettre inédite après #', prompt: 'Ensemble des mots tels que $\\#$ apparaît exactement une fois, est suivi d’au moins un bit, et que le premier bit après $\\#$ n’apparaît pas avant lui.', alphabet: ['0', '1', '#'],
    accepted: ['#0', '#101', '0#1', '000#1'], rejected: ['#', '0#0', '01#0', '0#1#'], initial: 'pre:0',
    isFinal: (state) => state === 'ok', transition: (state, symbol) => { if (state === 'dead') return 'dead'; if (state === 'ok') return symbol === '#' ? 'dead' : 'ok'; const [side, rawMask] = state.split(':'); const mask = Number(rawMask); if (side === 'pre') { if (symbol === '#') return `need:${mask}`; return `pre:${mask | (symbol === '0' ? 1 : 2)}`; } if (symbol === '#') return 'dead'; const bit = symbol === '0' ? 1 : 2; return mask & bit ? 'dead' : 'ok'; },
  },
  {
    id: 10, title: 'Multiples de trois en binaire', prompt: 'Ensemble des mots non vides tels que leur valeur binaire est divisible par $3$ ; les zéros initiaux sont autorisés.', alphabet: ['0', '1'],
    accepted: ['0', '11', '110', '1001'], rejected: ['', '1', '10', '101'], initial: 'start',
    isFinal: (state) => state === 'r0', transition: (state, symbol) => { const remainder = state === 'start' ? 0 : Number(state[1]); return `r${(remainder * 2 + Number(symbol)) % 3}`; },
  },
  {
    id: 11, title: 'Trois parités synchronisées', prompt: 'Ensemble des mots tels que les nombres de $a$, de $b$ et de $c$ ont tous la même parité.', alphabet: ['a', 'b', 'c'],
    accepted: ['', 'abc', 'aabbcc', 'abccba'], rejected: ['a', 'ab', 'abbc'], initial: '000',
    isFinal: (state) => state === '000' || state === '111', transition: (state, symbol) => { const index = ['a', 'b', 'c'].indexOf(symbol); return state.split('').map((bit, position) => position === index ? String(1 - Number(bit)) : bit).join(''); },
  },
  {
    id: 12, title: 'Double modulo trois', prompt: 'Ensemble des mots tels que le nombre de $a$ est congru au double du nombre de $b$ modulo $3$ ; la lettre $c$ est neutre.', alphabet: ['a', 'b', 'c'],
    accepted: ['', 'c', 'aab', 'bbb', 'aaaccc'], rejected: ['a', 'b', 'ab', 'aabb'], initial: '0',
    isFinal: (state) => state === '0', transition: (state, symbol) => String((Number(state) + (symbol === 'c' ? 0 : 1)) % 3),
  },
];
