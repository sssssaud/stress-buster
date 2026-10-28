// lines.js — everything he says. {her} = player's name, {him} = his name.
// Edit freely: add your own inside jokes to any list.

// HP above 60%: full annoying mode.
export const TAUNTS = [
  'Actually, {her}, let me explain that to you. Slowly.',
  "You're pretty smart… for a girl.",
  'Smile more, {her}! You look prettier when you smile.',
  "Women can't drive. It's basically science.",
  'Why do you need a career? Just marry rich.',
  'Relax, {her}. You are being way too emotional.',
  "I'm not sexist. My mom is literally a woman.",
  'Cooking is a woman thing. I just do the eating part.',
  'Did your dad help you with that?',
  'Engineering? Isn’t that a lot of maths for you?',
  'Make me a sandwich. Please. See, I said please.',
  "I let my girlfriend have hobbies. I'm very generous.",
  'Women are too sensitive to be leaders.',
  "You're not like other girls. That's a compliment.",
  'I read half an article once, so I know more than you.',
  'Calm down. Is it that time of the month?',
  'A woman’s place is in the kitchen. Kidding! Unless…?',
  'I don’t see colour. Or chores. Mostly chores.',
  'Equal pay? But I said “wow” in meetings louder.',
  'Feminism? So you hate men or what?',
];

// Said instantly when hit (short, so they don't block the bigger lines).
export const OUCH = [
  'OW!', 'Not the face!', 'HEY! That’s assault!', 'I’m telling my mom!', 'Ouchie!',
  'My hair! I just did it!', 'Okay, OKAY!', 'Why are you like this?!', 'Owww, my ego!', 'Rude!',
];

// HP 25%–60%: defensive but still clueless.
export const DEFENSIVE = [
  'Not ALL men, {her}! Not ALL men!',
  'Okay maybe I’m 2% wrong. Maximum 3%.',
  'I was just playing devil’s advocate!',
  'I have a sister! I can’t be sexist!',
  'Can we just discuss this… rationally? Ow!',
  'Fine! I’ll fold ONE shirt. One.',
  'This is why… okay, I don’t know why anymore.',
  'My therapist is going to hear about this, {her}.',
  'Let me finish my point— OW—never mind.',
  'Is this… what accountability feels like?',
];

// HP below 25%: he has finally learned.
export const REDEMPTION = [
  'Okay {her}… you were right. You were always right.',
  'Your career matters exactly as much as mine.',
  'I’ll cook tonight. And wash up. And not ask for applause.',
  'From now on I’ll listen first and explain… never.',
  'Your ambition isn’t “too much”. I was just too little.',
  'Equal pay. Equal chores. Equal respect. Got it.',
  'You don’t owe anyone a smile, {her}.',
  'I’m sorry for every “calm down” I ever said.',
  'I’ll respect your “no” the first time. Every time.',
  'Women are smart, strong… and terrifying with a slipper.',
  'You can be anything you want, {her}. Even my boss.',
  'I’ll stop interrupting wom— sorry. Go ahead.',
];

// Last words on knock-out, one per level (then repeats in free play).
export const FINAL_WORDS = [
  '{her}… I’m a changed man. I’ll do my own laundry.',
  'Respect. Equality. And never, ever mansplaining again.',
  'You’re not “bossy”, {her}. You’re the BOSS.',
  'Thank you for the lesson, Queen {her}. 👑',
];

// When he gets back up for a new level.
export const RESPAWN = [
  'I’m back! Did you miss my opinions?',
  'New day, new hot takes, {her}!',
  'That didn’t count. I wasn’t ready.',
  'Okay but hear me out…',
];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
let lastLine = '';

// Returns a line that isn't the same as the previous one.
export function fresh(arr) {
  let line = pick(arr);
  for (let i = 0; i < 5 && line === lastLine; i++) line = pick(arr);
  lastLine = line;
  return line;
}

export function fill(line, her, him) {
  return line.replaceAll('{her}', her).replaceAll('{him}', him);
}

// Which pool to use given HP fraction (0..1).
export function poolFor(hpFrac) {
  if (hpFrac > 0.6) return { pool: TAUNTS, mood: 'smug' };
  if (hpFrac > 0.25) return { pool: DEFENSIVE, mood: 'defensive' };
  return { pool: REDEMPTION, mood: 'sorry' };
}
