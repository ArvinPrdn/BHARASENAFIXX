const blockedWords = [
  // Indonesian and common online spellings
  'anjeng', 'anjg', 'anjing', 'anjir', 'anjrit', 'asu', 'babi', 'babik', 'bacot', 'bajingan',
  'bangke', 'bangsat', 'bego', 'brengsek', 'dungu', 'goblok', 'goblog', 'jembot',
  'jembut', 'kampret', 'keparat', 'kntl', 'kontol', 'kontolmu', 'kontolnya', 'lonte',
  'memek', 'memekmu', 'meki', 'ngentod', 'ngentot', 'ngentotin', 'ngewe', 'pecun',
  'pecundang', 'pelacur', 'peler', 'perek', 'sialan', 'sontoloyo', 'sundal', 'tahi',
  'tai', 'taik', 'titit', 'toket', 'tolol',
  // Javanese
  'bajindul', 'cangkemmu', 'cocotmu', 'congormu', 'dancok', 'dancuk', 'diancok',
  'djancok', 'encuk', 'jamput', 'jancok', 'jancuk', 'jancokmu', 'lambemu', 'matane',
  'mbadog', 'ndasmu', 'ndhasmu', 'ngateli', 'nggatheli', 'ngloco', 'pekok', 'picek',
  'raimu', 'taek', 'telek',
  // Sundanese
  'anying', 'bagong', 'belegug', 'beungeut sia', 'borokokok', 'kehed', 'koplok',
  'koplak', 'lebok', 'sia gelo',
  // Minangkabau and Batak Toba
  'anjiang', 'pantek', 'bujang inam', 'bujanginam', 'loak ma ho', 'marlonte', 'takal ulum',
  // Balinese, Madurese, Makassarese, and Acehnese
  'basong cai', 'cicing', 'kleng', 'naniang', 'naskleng', 'pantet', 'cukimai', 'patek',
  'nassundala', 'sundala', 'suntili', 'tai laso', 'telaco', 'telaso',
  'aneuk bajeung', 'aneuk ramjadah', 'arakate paleh', 'binatang paleh',
  // Other common profanity
  'asshole', 'bastard', 'bitch', 'bitches', 'bullshit', 'cocksucker', 'cunt',
  'dickhead', 'dipshit', 'dumbass', 'fuck', 'fucked', 'fucker', 'fucking',
  'motherfucker', 'motherfucking', 'shit', 'shithead', 'shitty', 'whore',
  'anjay', 'bahlol', 'celaka kau', 'haram jadah', 'haramjadah', 'kimak', 'pukimak', 'pukimai',
];

const letterVariants = {
  a: '[a4@]', b: '[b8]', e: '[e3]', g: '[g9]', i: '[i1]', l: '[l1]',
  o: '[o0]', s: '[s5$]', t: '[t7]',
};
const punctuation = '[\\p{P}\\p{S}]';
const separator = '[\\s\\p{P}\\p{S}]';
const wordCharacter = '[\\p{L}\\p{M}\\p{N}]';

function normalize(value) {
  return value.normalize('NFKD').toLowerCase()
    .replace(/[\p{M}\p{Default_Ignorable_Code_Point}]/gu, '')
    .replace(/([a-z0-9])\1+/gu, '$1');
}

const patterns = blockedWords.flatMap((entry) => {
  const words = normalize(entry).split(' ');
  const letters = words.map((word) => Array.from(word, (letter) => letterVariants[letter] ?? letter));
  const joined = letters.map((word) => word.join(`${punctuation}*`)).join(`${separator}+`);
  // Require a separator between every letter for spaced spellings so ordinary
  // adjacent words such as "bab I" do not get joined into a blocked word.
  return words.length === 1 && words[0].length >= 4
    ? [joined, letters[0].join(`${separator}+`)]
    : [joined];
});
const blockedPattern = new RegExp(`(?<!${wordCharacter})(?:${patterns.join('|')})(?!${wordCharacter})`, 'u');

export function containsMessageProfanity({ body, nickname }) {
  return blockedPattern.test(normalize(body)) || blockedPattern.test(normalize(nickname));
}
