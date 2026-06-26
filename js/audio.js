/* =====================================================================
   PaDi Shooter 89 - Retro Audio Engine
   A tiny chiptune sound engine built on the Web Audio API.
   No audio files needed: every sound is generated in code.
   A first game by Carlos & Diogo Sardo.
   ===================================================================== */
(function () {
  'use strict';
  const PADI = (window.PADI = window.PADI || {});

  // Convert a MIDI note number to a frequency in Hz.
  function midiToFreq(m) {
    return 440 * Math.pow(2, (m - 69) / 12);
  }

  class AudioEngine {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.musicGain = null;
      this.sfxGain = null;
      this.crowdGain = null;
      this.muted = false;
      this.musicEnabled = true;
      this.musicPlaying = false;
      this._noiseBuffer = null;
      this._musicTimer = null;
      this._step = 0;
      this._crowdBase = 0.05;
    }

    // Create the AudioContext. Must be called from a user gesture (a click/tap).
    init() {
      if (this.ctx) {
        this.resume();
        return;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return; // very old browser - game still works, just silent
      this.ctx = new AC();

      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.9;
      this.master.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.18;
      this.musicGain.connect(this.master);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.7;
      this.sfxGain.connect(this.master);

      this.crowdGain = this.ctx.createGain();
      this.crowdGain.gain.value = this._crowdBase;
      this.crowdGain.connect(this.master);

      this._noiseBuffer = this._makeNoise(2);
      this._startCrowdBed();
    }

    resume() {
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    }

    get ready() {
      return !!this.ctx;
    }

    // ---- master controls -------------------------------------------------
    toggleMute() {
      this.muted = !this.muted;
      if (this.master) {
        this.master.gain.setTargetAtTime(this.muted ? 0 : 0.9, this._now(), 0.02);
      }
      return this.muted;
    }

    toggleMusic() {
      this.musicEnabled = !this.musicEnabled;
      if (this.musicEnabled) this.startMusic();
      else this.stopMusic();
      return this.musicEnabled;
    }

    _now() {
      return this.ctx ? this.ctx.currentTime : 0;
    }

    // ---- noise helper ----------------------------------------------------
    _makeNoise(seconds) {
      const len = Math.floor(this.ctx.sampleRate * seconds);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      return buf;
    }

    _noiseSource() {
      const src = this.ctx.createBufferSource();
      src.buffer = this._noiseBuffer;
      src.loop = true;
      return src;
    }

    // ---- the constant crowd murmur --------------------------------------
    _startCrowdBed() {
      const src = this._noiseSource();
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 440;
      bp.Q.value = 0.5;
      src.connect(bp);
      bp.connect(this.crowdGain);
      src.start();
      this._crowdFilter = bp;
    }

    // ---- low level tone --------------------------------------------------
    _tone(freq, start, dur, type, gain, dest) {
      type = type || 'square';
      gain = gain == null ? 0.3 : gain;
      dest = dest || this.sfxGain;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, start);
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(gain, start + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      o.connect(g);
      g.connect(dest);
      o.start(start);
      o.stop(start + dur + 0.03);
      return o;
    }

    // =====================================================================
    //  SOUND EFFECTS
    // =====================================================================

    // Ball being kicked.
    kick() {
      if (!this.ctx) return;
      const t = this._now();
      // low thump
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(180, t);
      o.frequency.exponentialRampToValueAtTime(60, t + 0.12);
      g.gain.setValueAtTime(0.6, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      o.connect(g);
      g.connect(this.sfxGain);
      o.start(t);
      o.stop(t + 0.18);
      // noise "thwack"
      const n = this._noiseSource();
      const ng = this.ctx.createGain();
      const nf = this.ctx.createBiquadFilter();
      nf.type = 'lowpass';
      nf.frequency.value = 1800;
      ng.gain.setValueAtTime(0.5, t);
      ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
      n.connect(nf);
      nf.connect(ng);
      ng.connect(this.sfxGain);
      n.start(t);
      n.stop(t + 0.1);
    }

    // Referee whistle - a few sharp toots with a trill.
    whistle(toots) {
      if (!this.ctx) return;
      toots = toots || 2;
      let t = this._now();
      for (let i = 0; i < toots; i++) {
        const dur = i === toots - 1 ? 0.32 : 0.16;
        const o = this.ctx.createOscillator();
        const o2 = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        const lfo = this.ctx.createOscillator();
        const lfoG = this.ctx.createGain();
        o.type = 'square';
        o2.type = 'square';
        o.frequency.setValueAtTime(2350, t);
        o2.frequency.setValueAtTime(2680, t);
        lfo.frequency.setValueAtTime(28, t); // trill
        lfoG.gain.setValueAtTime(60, t);
        lfo.connect(lfoG);
        lfoG.connect(o.frequency);
        lfoG.connect(o2.frequency);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
        g.gain.setValueAtTime(0.25, t + dur - 0.04);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g);
        o2.connect(g);
        g.connect(this.sfxGain);
        lfo.start(t);
        o.start(t);
        o2.start(t);
        lfo.stop(t + dur + 0.02);
        o.stop(t + dur + 0.02);
        o2.stop(t + dur + 0.02);
        t += dur + 0.08;
      }
    }

    // GOAL! Triumphant rising arpeggio + crowd eruption.
    goal() {
      if (!this.ctx) return;
      const t = this._now();
      const notes = [60, 64, 67, 72, 76, 79]; // C major run up
      notes.forEach((m, i) => {
        const st = t + i * 0.09;
        this._tone(midiToFreq(m), st, 0.18, 'square', 0.32);
        this._tone(midiToFreq(m + 12), st, 0.18, 'triangle', 0.12);
      });
      // final shining chord
      const ct = t + notes.length * 0.09 + 0.02;
      [72, 76, 79, 84].forEach((m) =>
        this._tone(midiToFreq(m), ct, 0.5, 'square', 0.2)
      );
      this.cheer(1.0);
    }

    // Keeper SAVE - a solid thud and a short descending tone.
    save() {
      if (!this.ctx) return;
      const t = this._now();
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(140, t);
      o.frequency.exponentialRampToValueAtTime(70, t + 0.18);
      g.gain.setValueAtTime(0.5, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      o.connect(g);
      g.connect(this.sfxGain);
      o.start(t);
      o.stop(t + 0.24);
      this._tone(midiToFreq(67), t + 0.02, 0.12, 'square', 0.18);
      this._tone(midiToFreq(60), t + 0.12, 0.16, 'square', 0.18);
      this.cheer(0.6);
    }

    // MISS - a comedic descending "wah-wah" and a crowd groan.
    miss() {
      if (!this.ctx) return;
      const t = this._now();
      const seq = [58, 55, 51, 47];
      seq.forEach((m, i) => {
        this._tone(midiToFreq(m), t + i * 0.13, 0.16, 'sawtooth', 0.2);
      });
      this.groan();
    }

    // Ball hits the post/bar.
    post() {
      if (!this.ctx) return;
      const t = this._now();
      this._tone(1200, t, 0.05, 'square', 0.3);
      this._tone(1500, t + 0.015, 0.12, 'square', 0.22);
    }

    // ---- crowd reactions -------------------------------------------------
    cheer(intensity) {
      if (!this.ctx) return;
      intensity = intensity == null ? 1 : intensity;
      const t = this._now();
      const peak = this._crowdBase + 0.5 * intensity;
      this.crowdGain.gain.cancelScheduledValues(t);
      this.crowdGain.gain.setValueAtTime(this.crowdGain.gain.value, t);
      this.crowdGain.gain.linearRampToValueAtTime(peak, t + 0.12);
      this.crowdGain.gain.setTargetAtTime(this._crowdBase, t + 0.4, 0.6);
      if (this._crowdFilter) {
        this._crowdFilter.frequency.cancelScheduledValues(t);
        this._crowdFilter.frequency.setValueAtTime(500, t);
        this._crowdFilter.frequency.linearRampToValueAtTime(1400, t + 0.2);
        this._crowdFilter.frequency.setTargetAtTime(440, t + 0.5, 0.6);
      }
      // a few bright "voices"
      for (let i = 0; i < 5 * intensity; i++) {
        const st = t + Math.random() * 0.4;
        this._tone(
          600 + Math.random() * 700,
          st,
          0.1 + Math.random() * 0.1,
          'triangle',
          0.05,
          this.crowdGain
        );
      }
    }

    groan() {
      if (!this.ctx) return;
      const t = this._now();
      this.crowdGain.gain.cancelScheduledValues(t);
      this.crowdGain.gain.setValueAtTime(this.crowdGain.gain.value, t);
      this.crowdGain.gain.linearRampToValueAtTime(this._crowdBase + 0.18, t + 0.1);
      this.crowdGain.gain.setTargetAtTime(this._crowdBase, t + 0.5, 0.7);
      // low disappointed "ohhh"
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(220, t);
      o.frequency.exponentialRampToValueAtTime(120, t + 0.7);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.12, t + 0.1);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
      o.connect(g);
      g.connect(this.crowdGain);
      o.start(t);
      o.stop(t + 0.85);
    }

    // ---- UI blips --------------------------------------------------------
    uiClick() {
      if (!this.ctx) return;
      this._tone(420, this._now(), 0.05, 'square', 0.18);
    }
    uiSelect() {
      if (!this.ctx) return;
      const t = this._now();
      this._tone(520, t, 0.05, 'square', 0.2);
      this._tone(780, t + 0.05, 0.07, 'square', 0.2);
    }
    powerLock() {
      if (!this.ctx) return;
      const t = this._now();
      this._tone(880, t, 0.04, 'square', 0.22);
      this._tone(1170, t + 0.04, 0.08, 'square', 0.22);
    }

    // =====================================================================
    //  BACKGROUND MUSIC - a looping 8-bit stadium anthem
    // =====================================================================
    startMusic() {
      if (!this.ctx || !this.musicEnabled || this.musicPlaying) return;
      this.musicPlaying = true;
      this._step = 0;

      // 16-step loop, cheerful major key.
      const lead = [
        76, 0, 79, 76, 72, 0, 74, 76, 77, 0, 76, 74, 72, 0, 67, 0,
      ];
      const bass = [
        48, 48, 55, 48, 53, 53, 60, 53, 52, 52, 59, 52, 53, 55, 57, 59,
      ];
      const bpm = 132;
      const stepDur = 60 / bpm / 2; // eighth notes

      const tick = () => {
        if (!this.musicPlaying) return;
        const t = this._now() + 0.02;
        const s = this._step % 16;
        const ln = lead[s];
        const bn = bass[s];
        if (ln) this._tone(midiToFreq(ln), t, stepDur * 0.9, 'square', 0.16, this.musicGain);
        if (bn) this._tone(midiToFreq(bn), t, stepDur * 0.95, 'triangle', 0.22, this.musicGain);
        // soft hat on offbeats
        if (s % 2 === 1) {
          const n = this._noiseSource();
          const ng = this.ctx.createGain();
          const hf = this.ctx.createBiquadFilter();
          hf.type = 'highpass';
          hf.frequency.value = 6000;
          ng.gain.setValueAtTime(0.05, t);
          ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
          n.connect(hf);
          hf.connect(ng);
          ng.connect(this.musicGain);
          n.start(t);
          n.stop(t + 0.06);
        }
        this._step++;
      };

      tick();
      this._musicTimer = setInterval(tick, stepDur * 1000);
    }

    stopMusic() {
      this.musicPlaying = false;
      if (this._musicTimer) {
        clearInterval(this._musicTimer);
        this._musicTimer = null;
      }
    }
  }

  PADI.audio = new AudioEngine();
})();
