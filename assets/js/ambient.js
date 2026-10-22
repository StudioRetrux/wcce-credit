// Calm, positive background sound, made live with the Web Audio API (no audio file to download).
// A slow pad walks through four warm chords in D major, with a few soft bell notes on top.

const hz = (n) => 440 * Math.pow(2, (n - 69) / 12);   // MIDI note to frequency

// Dmaj9 → Bm11 → Gmaj9 → Asus, eight seconds each
const CHORDS = [
  [50, 57, 61, 64, 66],
  [47, 54, 57, 62, 64],
  [43, 50, 54, 57, 59],
  [45, 52, 57, 59, 62],
];
const BELLS = [74, 76, 78, 81, 83, 86];               // D major pentatonic, up high
const BAR = 8;
const VOLUME = 0.7;

export function createAmbient() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();

  const master = ctx.createGain();
  master.gain.value = 0;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18; comp.ratio.value = 3;
  master.connect(comp).connect(ctx.destination);

  // A long, soft room made from decaying noise
  const verb = ctx.createConvolver();
  const len = ctx.sampleRate * 5;
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  }
  verb.buffer = ir;
  const wet = ctx.createGain(); wet.gain.value = 0.55;
  const dry = ctx.createGain(); dry.gain.value = 0.45;
  verb.connect(wet).connect(master);
  dry.connect(master);

  // The pad breathes: a slow filter sweep shared by every voice
  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass'; tone.frequency.value = 900; tone.Q.value = 0.4;
  const lfo = ctx.createOscillator(); lfo.frequency.value = 0.05;
  const lfoAmt = ctx.createGain(); lfoAmt.gain.value = 380;
  lfo.connect(lfoAmt).connect(tone.frequency); lfo.start();
  tone.connect(dry); tone.connect(verb);

  function pad(chord, t) {
    chord.forEach((n, i) => {
      const g = ctx.createGain();
      const peak = 0.05 / (1 + i * 0.15);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(peak, t + 3);
      g.gain.setValueAtTime(peak, t + BAR - 1);
      g.gain.linearRampToValueAtTime(0, t + BAR + 3);
      g.connect(tone);
      [['sine', -4], ['triangle', 5]].forEach(([type, cents]) => {
        const o = ctx.createOscillator();
        o.type = type; o.frequency.value = hz(n); o.detune.value = cents;
        o.connect(g); o.start(t); o.stop(t + BAR + 3.2);
      });
    });
  }

  function bell(n, t) {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = hz(n);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.035, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3.5);
    o.connect(g); g.connect(verb); g.connect(dry);
    o.start(t); o.stop(t + 3.6);
  }

  // Look ahead a little and book the next chord and its bells
  let next = 0, step = 0, timer = null;
  function schedule() {
    while (next < ctx.currentTime + 1) {
      pad(CHORDS[step % CHORDS.length], next);
      const count = 1 + Math.floor(Math.random() * 3);
      for (let k = 0; k < count; k++) {
        bell(BELLS[Math.floor(Math.random() * BELLS.length)], next + 1.5 + Math.random() * (BAR - 2));
      }
      next += BAR; step++;
    }
  }

  return {
    async play() {
      await ctx.resume();
      if (!timer) { next = ctx.currentTime + 0.1; schedule(); timer = setInterval(schedule, 250); }
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
      master.gain.linearRampToValueAtTime(VOLUME, ctx.currentTime + 3);
    },
    pause() {
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
      master.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.2);
      setTimeout(() => {
        if (master.gain.value > 0.001) return;   // turned back on during the fade
        clearInterval(timer); timer = null;
        ctx.suspend();
      }, 1400);
    },
  };
}
