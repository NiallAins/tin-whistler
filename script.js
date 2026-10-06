let
  renderSize,
  keyNote = 'D',
  keyAcc = '',
  showBeat = true,
  showNote = true,
  showFrame = false;

const
  INTERVALS = [0, 2, 4, 5, 7, 9, 11],
  WHISTLE_NOTES = {D: 0, E: 2, F: 3, G: 5, A: 7, B: 9, C: 10},
  // [cover, uncover]
  FINGERS = [
    [6], [5.5], [5], [4.5], [4],
    [3], [6, 3], [2], [6, 2], [1], [3,1], [0],
    [6, 1], [5.5], [5], [4.5], [4],
    [3], [6, 3], [2], [6, 2], [1], [3,1], [0],
    [3, 1]
  ],
  NOTES = [
    ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#'],
    ['Ab', 'A', 'Bb', 'B', 'C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G']
  ],
  FIFTHS = [
    ['F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'A#'],
    ['B', 'E', 'A', 'D', 'G', 'C', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb']
  ],
  MODES = ['major', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'minor', 'locrian'];

function updateSize(newValue = 0) {
  if (!newValue) {
    renderSize = Math.min(16, Math.floor(window.innerWidth / 41));
  }
  renderSize = Math.min(56, Math.max(6, renderSize + newValue));
  document.body.style.setProperty('--size', renderSize + 'px');
}
window.onresize = () => updateSize();

function render() {
  if (!document.getElementById('input').value) {
    document.getElementById('output').innerHTML = '';
    return;
  }
  
  updateSize();
  const SONG = parseABC(document.getElementById('input').value);
  
  document.getElementById('output').innerHTML = 
    SONG[0] === 'ERR'
      ? SONG[1]
      : `
        <h3 class="song__title">${SONG.T} ${SONG.C}</h3>
        <h4 class="song__details">
          ${keyNote !== 'D' || keyAcc
              ? `${keyNote}${keyAcc} whistle<br/>`
          : ''}
          ${SONG.K} <br/>
          ${SONG.M} ${SONG.R} <br/>
          Parts ${SONG.P}
        </h4>
        ${
          SONG.notes.reduce((htmlP, p, i) => htmlP + `
            <h4 class="song__part-label">
              ${String.fromCharCode(65 + i)}
            </h4>
            <div
              class="
                song__part
                ${showBeat && p.some(b => b.some(n => n.dt))
                  ? 'song__part--tuple'
                : ''}
                ${p.some(b => b.some(n => n.v))
                  ? ' song__part--repeat'
                : ''}
              "
              style="--grace: ${SONG.maxGrace}"
            >
              ${p.reduce((htmlB, b) => htmlB + `
                <div class="
                  song__bar
                  ${showBeat ? ' song__bar--beat' : ''}
                  ${showNote ? ' song__bar--note' : ''}
                  ${showFrame ? ' song__bar--frame' : ''}
                ">
                  ${b.reduce((htmlN, n) => htmlN + renderWhistle(n, SONG.minNote), '')}
                </div>
              `, '')}
            </div>
          `, '')
        }
        <div class="print-footer">
          ${SONG.T} ${SONG.C} |
          Generated on nialldesign.dev/tin-whistler
        </div>
      `;
}

function parseABC(input) {
  // Set default song parameters
  const SONG = {
    T: '',
    C: '',
    K: 'D',
    M: '4/4',
    R: 'reel',
    P: ''
  };
  
  // Extract song parameters
  input = input
    .replace(/^I:/, '')
    .replace(/\nP:[ \t]*\*?vari.*/i, '')
    .replace(
      /(^|\n)[ \t]*([A-Z]):[ \t]*(.*)/ig,
      (a, b, c, d) => {
        if (d) {
          SONG[c] = d;
        }
        return '';
      }
    );
  
  // Get notes in scale
  const KEY = getKey(SONG.K);
  if (!KEY) {
    return ['ERR', 'Invalid key'];
  }
  SONG.K = KEY.key + ' ' + KEY.keyType;
  
  // Set part names
  input = input
    // Replace 'thin-thick' bar lines with normal double lines
    .replace(/(\[\|})|(\|\])/g, '||')
    // Replace repeat ends with normal bars
    .replace(/[:|]{2,}([1-9])/g, '|$1')
  // Replace bar repeats with generic repeats
    .replace(/\|([0-9])/g, '|[$1');
  if (SONG.P) {
    SONG.P = SONG.P
      .toUpperCase()
      .replace(
        /(.|\([^()]*\))([0-9])/g,
        (a, b, c) => new Array(parseInt(c))
          .fill(b.replace(/[()]/g, ''))
          .join('')
      );
  } else {
    const INPUT = input.replace(/\s/g, '');
    SONG.P = INPUT
      .split(/[|:]{2,}/)
      .filter(p => p.length)
      .map((p, i) => {
        let repeat = INPUT.indexOf(p);
        repeat =
          INPUT[repeat - 1] === ':' ||
          INPUT[repeat + p.length] === ':'
            ? 2 : 1;
        return ''.padStart(
          Math.max(
            repeat,
            ...(p.match(/\[[2-9]/g) || []).map(m => parseInt(m[1]))
          ),
          String.fromCharCode(65 + i)
        )
      })
      .join(' ');
  }
  if (!SONG.P || SONG.P === 'A') {
    SONG.P = 'AA';
  }
  
  // Get song notes
  SONG.notes = parseABCNotes(input, KEY.scale);
  if (SONG.notes[0] === 'ERR') {
    return ['ERR', SONG.notes[1]];
  }
  
  // Get minimum note duration
  SONG.minNote = Infinity;
  SONG.maxGrace = 0;
  SONG.notes.forEach(p => p.forEach(b => b.forEach(n => {
    SONG.minNote = Math.min(SONG.minNote, n.d);
    SONG.maxGrace = Math.max(SONG.maxGrace, n.g);
  })));
  
  return SONG;
}

function getKey(key) {
  // Set key
  key = key
    .replace(/\s/g, '')
    .replace(/sharp/i, '#')
    .replace(/flat/i, 'b');

  const KEY_NAME = (key.match(/[a-g][#b]?/i) || [])[0];
  key = key.replace(KEY_NAME, '');

  const MODE =
    !key
      ? 0
      : MODES.findIndex(m =>
        m.substring(0, 3) === key.substring(0, 3)
          .replace(/M$/, 'maj')
          .replace(/m$/, 'min')
          .toLowerCase()
          .replace('ion', 'maj')
          .replace('aeo', 'min')
      );

  if (!KEY_NAME || MODE === -1) {
    return;
  } 

  let acc = KEY_NAME[1] === 'b' ? 1 : 0;
  const
    KEY_INDEX = NOTES[acc].indexOf(KEY_NAME),
    REL_MAJ = (KEY_INDEX - INTERVALS[MODE] + 12) % 12,
    SCALE = {};

  let accCount = FIFTHS[acc].indexOf(NOTES[acc][REL_MAJ]) - [1, 5][acc];
  accCount = (accCount + 12) % 12;

  if (accCount >= 7) {
    acc = acc ? 0 : 1
    accCount = 12 - accCount;
  }

  for (let i = 0; i < 7; i++) {
    SCALE[FIFTHS[acc][i]] = i < accCount ? ['#', 'b'][acc] : '';
  }

  return {
    key: KEY_NAME,
    keyType: MODES[MODE],
    scale: SCALE
  };
}

function parseABCNotes(notes, scale) {
  notes = notes
    .replace(/\s/g, '')
    // Replace junk symbols
    .replace(/[#\*;\?@]/g, '')
    // Replace chords
    .replace(/\[([a-g])[^\]]*\]/gi, '$1')
    .replace(/"[^"]*"/g, '')
    // Remove part metas
    .replace(/(\|[0-9]+)|(\|\[[^\[\]]\]{2,})/g, '|')
    // Remove ties, slurs
    .replace(/\(([^\)\(]*)\)/g, '$1')
    // Replace rests
    .replace(/x/gi, 'z')
    // Set grace notes
    .replace(
      /\{([_=^]?[a-g][',\/0-9]*)+\}/gi,
      m => m
        .substring(1, m.length - 1)
        .replace(/([_=^]?[a-g][',]?)/gi, '{$1')
    )
    // Remove bow ornaments, coda, segno
    .replace(/[uvOS]/g, '')
    // Replace mordents
    .replace(/[MP]/g, '~')
    // Replace fermata with 2 * duration
    .replace(
      /H([_=^]?[a-g])([0-9])?/gi,
      (a, b, c) => b + (parseInt(c || 1) * 2)
    )
    // Replace accent mark with roll
    .replace(/L/g, '~');
  
  // Error
  const ERR = notes.match(/[^\[a-gz',_\^=1-9\/~:|><\(\{T\.\-]/i, '');
  if (ERR) {
    return ['ERR', 'Invalid character ' + ERR[0]];
  }
  
  let minOctave = Infinity;
  const WHISTLE_OCTAVE = (
    NOTES[0].indexOf(keyNote) +
    (keyAcc === 'b' ? -0.5 : 0) + 
    (keyAcc === '#' ? 0.5 : 0) +
  9) % 12;
 
  let 
    tuple = [0, 0],
    tie = false;
  const SONG = notes
    .split(/[:|]{2,}/)
    .filter(part => part)
    .map(part => part
      .split('|')
      .filter(bar => bar) 
      .map((bar, bi) =>
        [...bar.matchAll(
          /(\[[1-9])?(\([3-9])?(\{)?([\.~T]+)?([_=\^])?([a-gz])('+|,+)?([1-9])?(\/[1-9]?)?(\<|\>)?(-)?/gi
        )].map((m, i, arr) => {
          // Duration
          if (m[2]) {
            tuple[0] = parseInt(m[2][1]);
            tuple[1] = tuple[0];
          } else if (tuple[1]) {
            tuple[1] -= 1;
          }
          let duration = 1;
          if (tuple[1]) {
            duration *= (tuple[0] - 1) / tuple[0];
          }
          if (m[10] === '>' || (i && arr[i - 1][10] === '<')) {
            duration *= 1.5;
          } else if (m[10] === '<' || (i && arr[i - 1][10] === '>')) {
            duration *= 0.5;
          }
          if (m[8]) {
            duration *= parseInt(m[8]);
          }
          if (m[9]) {
            duration /= parseInt(m[9][1] || 2);
          }
      
          // Rests and ties
          if (m[6].toUpperCase() === 'Z' || tie) {
            tie = !!m[11];
            return {
              n: 'Z',
              d: duration,
              g: 0
            }
          }
          tie = !!m[11];

          // Octave
          let
            note = m[6].toUpperCase(),
            octave = m[7]
              ? (m[7][0] === ',' ? m[7].length * -1 : m[7].length + 1)
              : (m[6].match(/[a-z]/) ? 1 : 0),
            noteValue = (
              (m[5] === '_' ? NOTES[1] : NOTES[0]).indexOf(note) +
              (m[5] === '_' ? -0.5 : 0) + 
              (m[5] === '^' ? 0.5 : 0) +
              9) % 12;
          if (noteValue < WHISTLE_OCTAVE) {
            octave -= 1;
          }
          minOctave = Math.min(octave, minOctave);
      
          // Grace note order
          let grace = 0;
          for (let ii = i; ii < arr.length; ii += 1) {
            if (arr[ii][3]) {
              grace += 1;
            } else {
              break;
            }
          }
      
          // Note
          return {
            n: note + (
                m[5] === '_' ? 'b'
                : m[5] === '=' ? ''
                : m[5] === '^' ? '#'
                : scale[note]
            ),
            o: octave,
            d: duration,
            dt: m[2] ? parseInt(m[2][1]) : 0,
            g: grace,
            r: m[4] && m[4].includes('~'),
            t: m[4] && m[4].includes('T'),
            s: m[4] && m[4].includes('.'),
            v: m[1] ? parseInt(m[1][1]) : 0
          }
        })
      ));
  
  SONG.forEach(p => p.forEach(b => b.forEach(n => n.o -= minOctave)));
  return SONG;
}

// Convert note and key into interval value
function getNoteValue(n, key = 0) {
  let note = WHISTLE_NOTES[n[0].toUpperCase()] - key;
  if (n[1] === 'b') {
    note -= 1;
  } else if (n[1] === '#') {
    note += 1;
  }
  return (note + 12) % 12;
}

function renderWhistle(note, minWidth) {
  // Rest
  if (note.n === 'Z') {
    return new Array(Math.ceil(note.d / minWidth))
      .fill('')
      .map(i => `<div
          class="comp-whistle__beat"
          style="--meter: ${
            (note.d / minWidth) - i < 1
              ? (note.d / minWidth) % 1
              : 1
          }"
        ></div>`)
      .join('');
  }
  
  // Note
  const KEY = getNoteValue(keyNote + keyAcc);
  let f = getNoteValue(note.n, KEY) + (note.o * 12);
  f = FINGERS[f >= FINGERS.length ? (f % 12) + 12 : f];
  const
    STATE = Array(6).fill(0)
      .map((n, i) =>
        i >= f[0] || f.indexOf(i + 1) > 0
           ? 0
           : i === f[0] - 0.5
           ? 1 : 2
      ),
    ROLL = !note.r
      ? -1
      : f[0] === 6 && !(f[1] - 1)
      ? 5
      : Math.floor(Math.max(0, (f[1] || f[0]) - 1));
  
  return `
    <div
      class="
        comp-whistle${
          showFrame ? ' comp-whistle--frame' : ''
        }${
          showNote ? ' comp-whistle--note' : ''
        }${
          note.g ? ' comp-whistle--grace' : ''
        }"
      style="
        --tuple: ${(note.d / minWidth) * note.dt};
        right: ${
          note.g ? `calc(var(--size) * ${note.g - 1})` : 0
        };"
    >
      ${note.v ? `
        <div class="comp-whistle__repeat">
          ${  note.v === 1 ? '1st repeat' : ''
          }${ note.v === 2 ? '2nd repeat' : ''
          }${ note.v === 3 ? '3rd repeat' : ''
          }${ note.v > 3 ? note.v + 'th repeat' : ''}
        </div>
      ` : ''}
      <span class="comp-whistle__effect">
        ${note.t ? '<span class="comp-whistle__effect--trill">~</span>': ''}
        ${note.s ? '<span class="comp-whistle__effect--stoca">·</span>': ''}
        ${note.o ? `<span class="comp-whistle__effect--octave">
          <span>${
            Array(note.o).fill('^').join('<br/>')
          }</span>
        </span>` : ''}
      </span>
      ${STATE.reduce((str, s, si) => str + `
        <span class="
          comp-whistle__hole
          ${[
            '',
            'comp-whistle__hole--half',
            'comp-whistle__hole--closed'
          ][s]}
        ">${
          ROLL === si ? '~' : ''
        }</span>
      `, '')}
      <div class="comp-whistle__label">
        ${showNote
          ? note.n[0].toUpperCase() +
            (note.n[1] || '') +
            '<span>' +
              Array(note.o).fill('^').join('') +
            '</span>'
        : '&nbsp'}
      </div>
      ${note.dt ?
        `<div class="comp-whistle__tuple">
          ${ note.dt }
         </div>`
      : ''}
    </div>
    ${
      note.g
        ? ''
        : new Array(
            Math.ceil((note.d / minWidth) - 1)
          ).fill('').map((e, i) => `<div
            class="comp-whistle__beat"
            style="--meter: ${
              (note.d / minWidth) - 1 - i < 1
                ? (note.d / minWidth) % 1
                : 1
            }"
          ></div>`).join('')
    }`;
}

render();


//
// Pre-loaded tunes
//

const TUNES = [
  `X: 1
T: Cooley's
R: reel
M: 4/4
L: 1/8
K: Edor
|:D2|EBBA B2 EB|B2 AB dBAG|FDAD BDAD|FDAD dAFD|
EBBA B2 EB|B2 AB defg|afec dBAF|DEFD E2:|
|:gf|eB B2 efge|eB B2 gedB|A2 FA DAFA|A2 FA defg|
eB B2 eBgB|eB B2 defg|afec dBAF|DEFD E2:|`,
  `X: 1
T: The Pride Of Petravore
R: hornpipe
M: 4/4
L: 1/8
K: Emin
|:E3 F G3 A|BcBA G2 E2|D3 E F3 G|ABAG F2 D2|
E3 F G3 A|BcBA G2 A2|B2Bc BAGF|E2D2 E4:|
|:e2 e2 e2 e2|dBGA B2Bc|BAFG A2 AB|AGED E2 Bd|
e2 e2 gfge|dBGA B2 GA|B2Bc BAGF|E2D2 E4:|`,
  `X: 4
T: The Laird Of Drumblair
R: strathspey
M: 4/4
L: 1/8
K: Amaj
|:A2c>A E>Ac<A|a2g>a f>ae>c|(3def (3efg (3aed (3cBA|(3Bcd (3cBA (3GFE (3dcB|
A2c>A E>Ac>e|a2g>a f>ae>c|(3def (3efg (3aed (3cBA|1 (3GFE (3dcB A3 E:|2 (3GFE (3dcB A2 e>g||
|:a2e>a c>aA>a|c<Ae>A a>ec>e|b2f>b d>bB>b|d<Bf>B b<Bf>b|
a2e>a c>aA>a|c<Ae>A a>ec>e|(3def (3efg (3aed (3cBA|1 (3GFE (3dcB A2 e>g:|2 (3GFE (3dcB A3E||`,
  `X: 2
T: Mazurka La Pleau
R: mazurka
M: 3/4
L: 1/8
K: Gmaj
|:D>G|B2 B>d B>G|B>^A B>d (3B=AG|A2 A>c B>A|B2 G2 D>G|
B2 B>d B>G|B2 B>d B>G|A2 A>c B>A|G4:|
|:d>B|G>D G>B (3dcB|c2 A2 c>A|F>D F>A (3cBA|B2 G>D d>B|
G2 D>G d>B|c2 A2 c>A|F2- F>A (3cBA|G4:|`,
  `X: 1
T: The Butterfly
R: slip jig
M: 9/8
L: 1/8
K: Emin
|:B2E G2E F3|B2E G2E FED|B2E G2E F3|B2d d2B AFD:|
|:B2d e2f g3|B2d g2e dBA|B2d e2f g2a|b2a g2e dBA:|
|:B3 B2A G2A|B3 BAB dBA|B3 B2A G2A|B2d g2e dBA:|`,
  `X: 1
T: The Belll
R: reel
M: 4/4
L: 1/8
K: Amaj
Bcdc ~F2EF|ABcA Bcdc|~F2ce ~f2ec|
Bcdc ~F2EF|ABcA BdcA|~F2 B/c/d edcA:|
|:Bcde f2fe|fac2 Bcdc|~F2ce ~f2ec|
Bcde f2fe|fac2 BdcA|~F2 B/c/d edcA:|
|:deBc- cAEF|~F2 A/B/c d2Bc-|cA~f2 e2 A/B/c|
deBc- cAEF|~F2 A/B/c dcBd|cEFA ~A2cA:|
|:~f2ef a2~f2|efc2 BcBA|F2Bc BAce|
~f2ef a2~f2|efc2 ~a2fe|faBA FcAF:|`,
  `X: 6
T: Cutting Bracken
R: strathspey
M: 4/4
L: 1/8
K: Ador
|:B/|A<A {f}a2 g<e {f}g2|{f}e>d(TB>A) {F}G>AB>G|A<A {f}a2 g<e {f}g2|e<dB>g {^c}B<A A3/2:|
|:g/|e>d(TB>A) {F}G>AB>G|e>d(TB>A) TB2 B>g|e>d(TB>A) {F}G>AB>d|e>d{f}g>B {B}A2 A3/2:|`,
  `X: 1
T: The Rocky Road To Dublin
R: slip jig
M: 9/8
L: 1/8
K: Ador
efe d2B ~A3|E2A A2A Bcd|efe d2B A2c|B2G G2A Bcd:|
e2a a2f ~g3|e2a a2f g2d|e2a a2f g2e|d2B G2A Bcd|
e2a a2f ~g3|e2a a2A Bcd|efg fga g2e|d2B G2A Bcd||`,
  `X: 1
T: The Wind That Shakes The Barley
R: reel
M: 4/4
L: 1/8
K: Dmaj
A2AB AFED|B2BA BcdB|A2AB AFED|gfed BcdB|
A2AB AFED|B2BA BcdB|A2AB AFED|gfed Bcde||
f2fd g2ge|f2fd Bcde|f2fd g2fg|afed Bcde|
f2fd g2ge|f2fd Bcde|defg a2ab|afed BcdB||`,
  `X: 2
T: Merrily Kissed The Quaker
R: slide
M: 12/8
L: 1/8
K: Gmaj
GAB DED ~c2A BGE|GAB DED ~A2B AGE|
GAB DED ~c2A BGE|GAB DED ~G3 G3:|
|:G2B ~d3 edB d2B|G2B d2B ~A3 AGE|
~G2B ~d3 edB d2B|GAB ~D3 ~G3 G2D:|
|:~G2B d2d edB ~g2e|dBA GBd ~e2f g2g|
ged BAB d2B AGE|GAB DED ~G3 G2D:|`
];

let randomIndex = Math.floor(Math.random() * TUNES.length);
function loadRandom() {
  input.value = TUNES[randomIndex];
  randomIndex = (randomIndex + 1) % TUNES.length;
  render();
}