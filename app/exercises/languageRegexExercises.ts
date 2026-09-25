import type { LanguageExerciseDefinition } from './types';

const alphabetAB = ['a', 'b'];

export const languageRegexExercises: LanguageExerciseDefinition[] = [
  {
    id: 1, title: 'Une seule occurrence de ab', prompt: 'Ensemble des mots tels que le facteur $ab$ apparaît exactement une fois.', alphabet: alphabetAB,
    accepted: ['ab', 'aab', 'abba', 'baba'], rejected: ['', 'a', 'bb', 'abab'], initial: '0:0',
    isFinal: (state) => state.startsWith('1:'),
    transition: (state, symbol) => { const [count, lastA] = state.split(':').map(Number); return `${Math.min(2, count + (lastA && symbol === 'b' ? 1 : 0))}:${symbol === 'a' ? 1 : 0}`; },
  },
  {
    id: 2, title: 'Un c toutes les trois lettres', prompt: 'Ensemble des mots tels que chaque lettre dont la position est un multiple de $3$ est un $c$ ; les positions commencent à $1$.', alphabet: ['a', 'b', 'c'],
    accepted: ['', 'a', 'cc', 'aac', 'abcaac'], rejected: ['aaa', 'abb', 'abcaba'], initial: '0',
    isFinal: (state) => state !== 'dead',
    transition: (state, symbol) => state === 'dead' || (state === '2' && symbol !== 'c') ? 'dead' : String((Number(state) + 1) % 3),
  },
  {
    id: 3, title: 'Termine par 0 sans 111', prompt: 'Ensemble des mots tels que le dernier symbole est $0$ et que le facteur $111$ n’apparaît pas.', alphabet: ['0', '1'],
    accepted: ['0', '10', '110', '1010'], rejected: ['', '1', '1110', '1101'], initial: 'start',
    isFinal: (state) => state === 'zero',
    transition: (state, symbol) => { if (state === 'dead') return 'dead'; if (symbol === '0') return 'zero'; if (state === 'one2') return 'dead'; return state === 'one1' ? 'one2' : 'one1'; },
  },
  {
    id: 4, title: 'Lettres à compléter', prompt: 'Ensemble des mots tels que chaque $b$ est immédiatement suivi d’un $a$, et chaque $c$ immédiatement suivi de $ba$.', alphabet: ['a', 'b', 'c'],
    accepted: ['', 'a', 'ba', 'cba', 'bacba'], rejected: ['b', 'cb', 'caa', 'bb'], initial: 'ready',
    isFinal: (state) => state === 'ready',
    transition: (state, symbol) => { if (state === 'ready') return symbol === 'a' ? 'ready' : symbol === 'b' ? 'need-a' : 'need-b'; if (state === 'need-b') return symbol === 'b' ? 'need-a' : 'dead'; if (state === 'need-a') return symbol === 'a' ? 'ready' : 'dead'; return 'dead'; },
  },
  {
    id: 5, title: 'Deux séparateurs espacés', prompt: 'Ensemble des mots tels que $\\#$ apparaît exactement deux fois, avec au moins un bit entre les deux occurrences.', alphabet: ['0', '1', '#'],
    accepted: ['#0#', '1#1#0', '#01#11'], rejected: ['', '##', '#0', '#0#1#'], initial: 'before',
    isFinal: (state) => state === 'after',
    transition: (state, symbol) => { if (state === 'before') return symbol === '#' ? 'gap-empty' : 'before'; if (state === 'gap-empty') return symbol === '#' ? 'dead' : 'gap'; if (state === 'gap') return symbol === '#' ? 'after' : 'gap'; if (state === 'after') return symbol === '#' ? 'dead' : 'after'; return 'dead'; },
  },
  {
    id: 6, title: 'Écart impair entre les b', prompt: 'Ensemble des mots tels qu’entre deux $b$ consécutifs, le nombre de $a$ est toujours impair.', alphabet: alphabetAB,
    accepted: ['', 'b', 'aba', 'bab', 'baaab'], rejected: ['bb', 'baab', 'bababb'], initial: 'none',
    isFinal: (state) => state !== 'dead',
    transition: (state, symbol) => { if (state === 'dead') return 'dead'; if (state === 'none') return symbol === 'b' ? 'even' : 'none'; if (symbol === 'a') return state === 'even' ? 'odd' : 'even'; return state === 'odd' ? 'even' : 'dead'; },
  },
  {
    id: 7, title: 'Deux parités de blocs', prompt: 'Ensemble des mots tels que chaque bloc maximal de $a$ est de longueur paire et chaque bloc maximal de $b$ de longueur impaire.', alphabet: alphabetAB,
    accepted: ['', 'aa', 'b', 'aabbb', 'baab'], rejected: ['a', 'bb', 'abb', 'aabb'], initial: 'start',
    isFinal: (state) => state === 'start' || state === 'a-even' || state === 'b-odd',
    transition: (state, symbol) => { if (state === 'dead') return 'dead'; if (state === 'start') return symbol === 'a' ? 'a-odd' : 'b-odd'; if (state === 'a-odd') return symbol === 'a' ? 'a-even' : 'dead'; if (state === 'a-even') return symbol === 'a' ? 'a-odd' : 'b-odd'; if (state === 'b-odd') return symbol === 'b' ? 'b-even' : 'a-odd'; return symbol === 'b' ? 'b-odd' : 'dead'; },
  },
  {
    id: 8, title: 'Alphabet autorisé après #', prompt: 'Ensemble des mots tels que $\\#$ apparaît exactement une fois et qu’après lui, seules des lettres déjà apparues avant lui sont utilisées.', alphabet: ['0', '1', '#'],
    accepted: ['#', '0#', '01#100', '10#111'], rejected: ['', '#0', '0#1', '0#0#'], initial: 'pre:0',
    isFinal: (state) => state.startsWith('post:'),
    transition: (state, symbol) => { if (state === 'dead') return 'dead'; const [side, rawMask] = state.split(':'); const mask = Number(rawMask); if (side === 'pre') { if (symbol === '#') return `post:${mask}`; return `pre:${mask | (symbol === '0' ? 1 : 2)}`; } if (symbol === '#') return 'dead'; const bit = symbol === '0' ? 1 : 2; return mask & bit ? state : 'dead'; },
  },
  {
    id: 9, title: 'Deux compteurs indépendants', prompt: 'Ensemble des mots tels que le nombre de $a$ est multiple de $3$ et le nombre de $b$ est pair ; la lettre $c$ est neutre.', alphabet: ['a', 'b', 'c'],
    accepted: ['', 'ccc', 'aaa', 'bb', 'aaabbc'], rejected: ['a', 'b', 'ab', 'aaab'], initial: '0:0',
    isFinal: (state) => state === '0:0',
    transition: (state, symbol) => { const [a, b] = state.split(':').map(Number); return symbol === 'a' ? `${(a + 1) % 3}:${b}` : symbol === 'b' ? `${a}:${1 - b}` : state; },
  },
  {
    id: 10, title: 'Congruence croisée modulo trois', prompt: 'Ensemble des mots tels que le nombre de $a$ est congru au double du nombre de $b$ modulo $3$ ; la lettre $c$ est neutre.', alphabet: ['a', 'b', 'c'],
    accepted: ['', 'c', 'aab', 'bbb', 'aaaccc'], rejected: ['a', 'b', 'ab', 'aabb'], initial: '0',
    isFinal: (state) => state === '0',
    transition: (state, symbol) => String((Number(state) + (symbol === 'c' ? 0 : 1)) % 3),
  },
];
