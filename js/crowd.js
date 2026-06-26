/* =====================================================================
   PaDi Shooter 89 - The Crowd
   Draws a stadium full of supportive pixel fans that bounce, cheer,
   boo and shout in reaction to every penalty.
   ===================================================================== */
(function () {
  'use strict';
  const PADI = (window.PADI = window.PADI || {});

  const SHIRT_COLORS = [
    '#ef233c', '#3a86ff', '#ffd23b', '#2ec4b6', '#ff7b00',
    '#8338ec', '#fb5607', '#06d6a0', '#e0e0e0', '#ff006e',
  ];
  const SKIN_COLORS = ['#ffd9b3', '#f1c27d', '#c68642', '#8d5524', '#ffe0bd'];

  const CHEERS = ['GOOOAL!', 'YES!!', 'WOOO!', 'GO PADI!', 'NICE!', 'AMAZING!'];
  const SAVES = ['SAVE!', 'GREAT!', 'WALL!', 'KEEPER!', 'DENIED!'];
  const BOOS = ['OOOH!', 'AWW...', 'SO CLOSE', 'MISS!', 'UNLUCKY'];
  const CHANTS = ['PA-DI!', 'SHOOT!', 'LETS GO', 'C\'MON!', 'GOAL?'];

  class Crowd {
    constructor(area) {
      this.area = area; // {x, y, w, h}
      this.people = [];
      this.shouts = [];
      this.confetti = [];
      this.time = 0;
      this._build();
    }

    _build() {
      const a = this.area;
      const cols = Math.max(14, Math.floor(a.w / 26));
      const rows = Math.max(3, Math.floor(a.h / 26));
      const gapX = a.w / cols;
      const gapY = a.h / rows;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const stagger = (r % 2) * gapX * 0.5;
          const x = a.x + c * gapX + gapX * 0.5 + stagger;
          if (x > a.x + a.w - 4) continue;
          const y = a.y + r * gapY + gapY * 0.6;
          this.people.push({
            x,
            baseY: y,
            y,
            vy: 0,
            phase: Math.random() * Math.PI * 2,
            speed: 1.5 + Math.random() * 1.5,
            shirt: SHIRT_COLORS[(Math.random() * SHIRT_COLORS.length) | 0],
            skin: SKIN_COLORS[(Math.random() * SKIN_COLORS.length) | 0],
            size: 7 + Math.random() * 2,
            scarf: Math.random() < 0.35,
          });
        }
      }
    }

    react(type) {
      let pool = CHANTS;
      if (type === 'goal') pool = CHEERS;
      else if (type === 'save') pool = SAVES;
      else if (type === 'miss') pool = BOOS;

      for (const p of this.people) {
        if (type === 'goal' || type === 'save') {
          p.vy = -90 - Math.random() * 170; // jump for joy
        } else if (type === 'miss') {
          p.vy = -20 + Math.random() * 10; // small disappointed slump
        }
      }

      const count = type === 'goal' ? 7 : 4;
      for (let i = 0; i < count; i++) {
        const txt = pool[(Math.random() * pool.length) | 0];
        this.shouts.push({
          text: txt,
          x: this.area.x + 20 + Math.random() * (this.area.w - 40),
          y: this.area.y + 10 + Math.random() * (this.area.h - 20),
          vy: -22 - Math.random() * 16,
          life: 0,
          max: 1.1 + Math.random() * 0.5,
          color:
            type === 'miss'
              ? '#9aa5b1'
              : type === 'save'
              ? '#7ad7ff'
              : '#fff45b',
        });
      }

      if (type === 'goal') this._spawnConfetti();
    }

    _spawnConfetti() {
      for (let i = 0; i < 90; i++) {
        this.confetti.push({
          x: this.area.x + Math.random() * this.area.w,
          y: this.area.y + Math.random() * this.area.h,
          vx: (Math.random() - 0.5) * 60,
          vy: 40 + Math.random() * 120,
          size: 3 + Math.random() * 4,
          color: SHIRT_COLORS[(Math.random() * SHIRT_COLORS.length) | 0],
          rot: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 8,
          life: 0,
          max: 2.2 + Math.random() * 1.2,
        });
      }
    }

    update(dt) {
      this.time += dt;
      const g = 520;
      for (const p of this.people) {
        if (p.vy !== 0 || p.y < p.baseY) {
          p.vy += g * dt;
          p.y += p.vy * dt;
          if (p.y >= p.baseY) {
            p.y = p.baseY;
            p.vy = p.vy < -40 ? -p.vy * 0.3 : 0; // little bounce
            if (Math.abs(p.vy) < 12) p.vy = 0;
          }
        } else {
          // idle bobbing wave
          p.y = p.baseY + Math.sin(this.time * p.speed + p.phase) * 1.8;
        }
      }

      for (let i = this.shouts.length - 1; i >= 0; i--) {
        const s = this.shouts[i];
        s.life += dt;
        s.y += s.vy * dt;
        if (s.life >= s.max) this.shouts.splice(i, 1);
      }

      for (let i = this.confetti.length - 1; i >= 0; i--) {
        const c = this.confetti[i];
        c.life += dt;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        c.rot += c.vr * dt;
        if (c.life >= c.max) this.confetti.splice(i, 1);
      }
    }

    draw(ctx) {
      for (const p of this.people) {
        const s = p.size;
        // body / shirt
        ctx.fillStyle = p.shirt;
        ctx.fillRect(p.x - s * 0.5, p.y, s, s * 0.9);
        // head
        ctx.fillStyle = p.skin;
        ctx.fillRect(p.x - s * 0.35, p.y - s * 0.7, s * 0.7, s * 0.7);
        // scarf wavers
        if (p.scarf) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(p.x - s * 0.5, p.y + s * 0.1, s, s * 0.18);
        }
      }
      this.drawShouts(ctx);
    }

    drawShouts(ctx) {
      ctx.textAlign = 'center';
      for (const s of this.shouts) {
        const a = 1 - s.life / s.max;
        ctx.globalAlpha = Math.max(0, a);
        ctx.font = '10px "Press Start 2P", monospace';
        ctx.fillStyle = '#000';
        ctx.fillText(s.text, s.x + 1, s.y + 1);
        ctx.fillStyle = s.color;
        ctx.fillText(s.text, s.x, s.y);
      }
      ctx.globalAlpha = 1;
    }

    drawConfetti(ctx) {
      for (const c of this.confetti) {
        const a = 1 - c.life / c.max;
        ctx.globalAlpha = Math.max(0, a);
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(c.rot);
        ctx.fillStyle = c.color;
        ctx.fillRect(-c.size / 2, -c.size / 2, c.size, c.size);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
  }

  PADI.Crowd = Crowd;
})();
