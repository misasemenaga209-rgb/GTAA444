// =============================================================================
// GTAA444 - Cloud Vice City Engine
// Pure Canvas2D + Web Audio API Top-Down Open World Game
// =============================================================================

(() => {
  'use strict';

  // --- AUDIO SYNTHESIZER (No external assets required) ---
  class SoundFX {
    constructor() {
      this.ctx = null;
      this.isMuted = false;
      this.engineOsc = null;
      this.engineGain = null;
      this.sirenOsc = null;
      this.sirenGain = null;
    }

    init() {
      if (this.ctx) return;
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();

      // Engine sound loop
      this.engineOsc = this.ctx.createOscillator();
      this.engineGain = this.ctx.createGain();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.setValueAtTime(45, this.ctx.currentTime);
      this.engineGain.gain.setValueAtTime(0, this.ctx.currentTime);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(320, this.ctx.currentTime);

      this.engineOsc.connect(filter);
      filter.connect(this.engineGain);
      this.engineGain.connect(this.ctx.destination);
      this.engineOsc.start();
    }

    setEngineSpeed(speedRatio) {
      if (!this.ctx || this.isMuted) return;
      const t = this.ctx.currentTime;
      if (speedRatio > 0.05) {
        const freq = 45 + speedRatio * 90;
        this.engineOsc.frequency.setTargetAtTime(freq, t, 0.05);
        this.engineGain.gain.setTargetAtTime(Math.min(0.12, 0.03 + speedRatio * 0.09), t, 0.05);
      } else {
        this.engineGain.gain.setTargetAtTime(0, t, 0.1);
      }
    }

    stopEngine() {
      if (this.engineGain && this.ctx) {
        this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
      }
    }

    playPistol() {
      if (!this.ctx || this.isMuted) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(400, t);
      osc.frequency.exponentialRampToValueAtTime(40, t + 0.1);

      gain.gain.setValueAtTime(0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.12);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.12);

      // Noise punch
      this.playNoise(0.08, 0.35, 1000);
    }

    playUzi() {
      if (!this.ctx || this.isMuted) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(550, t);
      osc.frequency.exponentialRampToValueAtTime(60, t + 0.06);

      gain.gain.setValueAtTime(0.28, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.07);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.07);

      this.playNoise(0.05, 0.25, 2000);
    }

    playCrash() {
      if (!this.ctx || this.isMuted) return;
      this.playNoise(0.3, 0.5, 600);
    }

    playHorn() {
      if (!this.ctx || this.isMuted) return;
      const t = this.ctx.currentTime;
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.frequency.setValueAtTime(440, t);
      osc2.frequency.setValueAtTime(370, t);
      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.35);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.start(t);
      osc2.start(t);
      osc1.stop(t + 0.35);
      osc2.stop(t + 0.35);
    }

    playSirenLoop(active) {
      if (!this.ctx || this.isMuted) return;
      const t = this.ctx.currentTime;
      if (active) {
        if (!this.sirenOsc) {
          this.sirenOsc = this.ctx.createOscillator();
          this.sirenGain = this.ctx.createGain();
          this.sirenOsc.type = 'sine';
          this.sirenOsc.frequency.setValueAtTime(650, t);
          this.sirenGain.gain.setValueAtTime(0.08, t);

          this.sirenOsc.connect(this.sirenGain);
          this.sirenGain.connect(this.ctx.destination);
          this.sirenOsc.start();
        }
        const cycle = (Math.sin(Date.now() / 250) + 1) / 2;
        this.sirenOsc.frequency.setTargetAtTime(600 + cycle * 350, t, 0.05);
      } else if (this.sirenOsc) {
        this.sirenGain.gain.setTargetAtTime(0, t, 0.2);
        setTimeout(() => {
          if (this.sirenOsc) {
            try { this.sirenOsc.stop(); } catch(e){}
            this.sirenOsc = null;
            this.sirenGain = null;
          }
        }, 220);
      }
    }

    playPickup() {
      if (!this.ctx || this.isMuted) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, t);
      osc.frequency.setValueAtTime(1200, t + 0.08);

      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.25);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.25);
    }

    playNoise(duration, volume, filterFreq) {
      const bufferSize = this.ctx.sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(filterFreq || 1000, this.ctx.currentTime);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(volume, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

      whiteNoise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      whiteNoise.start();
    }
  }

  // --- GAME CONSTANTS & WORLD SETUP ---
  const WORLD_SIZE = 3600;
  const BLOCK_SIZE = 400;
  const ROAD_WIDTH = 120;
  const SIDEWALK_WIDTH = 25;

  const audio = new SoundFX();

  // --- WORLD MAP (Buildings, Roads, Obstacles) ---
  class World {
    constructor() {
      this.buildings = [];
      this.roads = [];
      this.trees = [];
      this.lamps = [];
      this.generateCity();
    }

    generateCity() {
      const step = BLOCK_SIZE + ROAD_WIDTH;
      const buildingColors = [
        '#2b3542', '#34495e', '#2c3e50', '#3b4b59', '#1e2b37',
        '#475569', '#334155', '#1e293b', '#243242'
      ];

      for (let x = 100; x < WORLD_SIZE - 200; x += step) {
        for (let y = 100; y < WORLD_SIZE - 200; y += step) {
          // Roads surrounding block
          this.roads.push({ x: x - ROAD_WIDTH, y: y, w: ROAD_WIDTH, h: BLOCK_SIZE, dir: 'V' });
          this.roads.push({ x: x, y: y - ROAD_WIDTH, w: BLOCK_SIZE, h: ROAD_WIDTH, dir: 'H' });

          // Subdivide block into 2-4 buildings
          const subCount = Math.random() > 0.4 ? 4 : 2;
          if (subCount === 4) {
            const hw = (BLOCK_SIZE - 20) / 2;
            const hh = (BLOCK_SIZE - 20) / 2;
            const bConfigs = [
              { bx: x + 10, by: y + 10, bw: hw - 10, bh: hh - 10 },
              { bx: x + hw + 10, by: y + 10, bw: hw - 10, bh: hh - 10 },
              { bx: x + 10, by: y + hh + 10, bw: hw - 10, bh: hh - 10 },
              { bx: x + hw + 10, by: y + hh + 10, bw: hw - 10, bh: hh - 10 },
            ];
            bConfigs.forEach((b, i) => {
              const color = buildingColors[(i + Math.floor(x/100)) % buildingColors.length];
              const hasHeli = Math.random() > 0.85;
              this.buildings.push({
                x: b.bx, y: b.by, w: b.bw, h: b.bh,
                color: color,
                roofColor: shadeColor(color, 25),
                hasHeli: hasHeli
              });
            });
          } else {
            const color = buildingColors[Math.floor(Math.random() * buildingColors.length)];
            this.buildings.push({
              x: x + 15, y: y + 15,
              w: BLOCK_SIZE - 30, h: BLOCK_SIZE - 30,
              color: color,
              roofColor: shadeColor(color, 20),
              hasHeli: Math.random() > 0.6
            });
          }

          // Trees & street lamps around block corners
          this.trees.push({ x: x - 15, y: y - 15, r: 16 });
          this.trees.push({ x: x + BLOCK_SIZE + 15, y: y - 15, r: 14 });
          this.lamps.push({ x: x - 8, y: y + BLOCK_SIZE / 2 });
          this.lamps.push({ x: x + BLOCK_SIZE + 8, y: y + BLOCK_SIZE / 2 });
        }
      }
    }

    draw(ctx, camX, camY, viewW, viewH) {
      // Grass background
      ctx.fillStyle = '#1e3820';
      ctx.fillRect(0, 0, WORLD_SIZE, WORLD_SIZE);

      // Roads
      ctx.fillStyle = '#22252a';
      this.roads.forEach(r => {
        ctx.fillRect(r.x, r.y, r.w, r.h);

        // Road markings
        ctx.strokeStyle = '#e0be36';
        ctx.lineWidth = 3;
        ctx.setLineDash([20, 20]);
        ctx.beginPath();
        if (r.dir === 'H') {
          ctx.moveTo(r.x, r.y + r.h / 2);
          ctx.lineTo(r.x + r.w, r.y + r.h / 2);
        } else {
          ctx.moveTo(r.x + r.w / 2, r.y);
          ctx.lineTo(r.x + r.w / 2, r.y + r.h);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      });

      // Buildings
      this.buildings.forEach(b => {
        if (b.x + b.w < camX - 100 || b.x > camX + viewW + 100 ||
            b.y + b.h < camY - 100 || b.y > camY + viewH + 100) return;

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.fillRect(b.x + 12, b.y + 12, b.w, b.h);

        // Base & Roof
        ctx.fillStyle = b.color;
        ctx.fillRect(b.x, b.y, b.w, b.h);

        // Roof inset
        ctx.fillStyle = b.roofColor;
        ctx.fillRect(b.x + 8, b.y + 8, b.w - 16, b.h - 16);

        // Roof border outline
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 2;
        ctx.strokeRect(b.x + 8, b.y + 8, b.w - 16, b.h - 16);

        // Helipad mark
        if (b.hasHeli && b.w > 120 && b.h > 120) {
          const cx = b.x + b.w / 2;
          const cy = b.y + b.h / 2;
          ctx.strokeStyle = '#ffd700';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(cx, cy, 32, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = '#ffd700';
          ctx.font = 'bold 30px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('H', cx, cy);
        }
      });

      // Trees
      this.trees.forEach(t => {
        if (t.x < camX - 50 || t.x > camX + viewW + 50 ||
            t.y < camY - 50 || t.y > camY + viewH + 50) return;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.beginPath();
        ctx.arc(t.x + 5, t.y + 5, t.r, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#2d5a27';
        ctx.beginPath();
        ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#3c7a34';
        ctx.beginPath();
        ctx.arc(t.x - 2, t.y - 2, t.r * 0.65, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    checkCollision(x, y, radius) {
      // Map boundaries
      if (x - radius < 30 || x + radius > WORLD_SIZE - 30 ||
          y - radius < 30 || y + radius > WORLD_SIZE - 30) {
        return true;
      }
      // Buildings collision
      for (let b of this.buildings) {
        if (x + radius > b.x && x - radius < b.x + b.w &&
            y + radius > b.y && y - radius < b.y + b.h) {
          return true;
        }
      }
      return false;
    }
  }

  // --- VEHICLE CLASS ---
  class Vehicle {
    constructor(x, y, type = 'sedan') {
      this.x = x;
      this.y = y;
      this.angle = 0;
      this.speed = 0;
      this.maxSpeed = 10;
      this.accel = 0.25;
      this.brake = 0.35;
      this.friction = 0.96;
      this.turnSpeed = 0.045;
      this.width = 38;
      this.length = 74;
      this.health = 100;
      this.isPolice = type === 'police';
      this.type = type;
      this.driver = null;
      this.hornTime = 0;
      this.color = this.assignColor();

      if (type === 'sports') {
        this.maxSpeed = 13.5;
        this.accel = 0.32;
        this.turnSpeed = 0.052;
      } else if (type === 'truck') {
        this.maxSpeed = 7.5;
        this.accel = 0.18;
        this.width = 46;
        this.length = 92;
      } else if (type === 'police') {
        this.maxSpeed = 11.8;
        this.accel = 0.28;
      }
    }

    assignColor() {
      if (this.isPolice) return '#ffffff';
      const palette = ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#9b59b6', '#e67e22', '#1abc9c', '#ecf0f1', '#34495e'];
      return palette[Math.floor(Math.random() * palette.length)];
    }

    update(world, particles) {
      if (this.health <= 0) return;

      // Friction & Movement
      this.speed *= this.friction;
      if (Math.abs(this.speed) < 0.02) this.speed = 0;

      const nextX = this.x + Math.cos(this.angle) * this.speed;
      const nextY = this.y + Math.sin(this.angle) * this.speed;

      // Collision test with buildings
      if (world.checkCollision(nextX, nextY, this.width / 2)) {
        if (Math.abs(this.speed) > 2) {
          audio.playCrash();
          this.health -= Math.abs(this.speed) * 3;
          particles.spawnImpact(this.x, this.y, '#ffd700', 8);
        }
        this.speed = -this.speed * 0.4;
      } else {
        this.x = nextX;
        this.y = nextY;
      }

      // Tire skidmarks if turning at high speed or drifting
      if (Math.abs(this.speed) > 5 && Math.random() > 0.4) {
        particles.addSkidmark(this.x, this.y, this.angle, this.width);
      }

      // Damage smoke
      if (this.health < 40 && Math.random() > 0.5) {
        particles.spawnSmoke(this.x, this.y);
      }
    }

    draw(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);

      // Car shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.fillRect(-this.length / 2 + 6, -this.width / 2 + 6, this.length, this.width);

      // Car body
      ctx.fillStyle = this.color;
      roundRect(ctx, -this.length / 2, -this.width / 2, this.length, this.width, 6);
      ctx.fill();

      // Police cruiser decals & roof lightbar
      if (this.isPolice) {
        // Black hood & trunk
        ctx.fillStyle = '#111';
        ctx.fillRect(-this.length / 2, -this.width / 2, 20, this.width);
        ctx.fillRect(this.length / 2 - 20, -this.width / 2, 20, this.width);

        // Flashing beacon bar
        const flash = Math.floor(Date.now() / 120) % 2 === 0;
        ctx.fillStyle = flash ? '#ff2222' : '#0066ff';
        ctx.fillRect(-4, -this.width / 2 + 4, 8, 10);
        ctx.fillStyle = flash ? '#0066ff' : '#ff2222';
        ctx.fillRect(-4, this.width / 2 - 14, 8, 10);
      }

      // Windshield & windows
      ctx.fillStyle = '#1c2833';
      ctx.fillRect(-this.length * 0.15, -this.width * 0.4, this.length * 0.38, this.width * 0.8);

      // Roof
      ctx.fillStyle = this.isPolice ? '#ffffff' : shadeColor(this.color, -20);
      ctx.fillRect(-this.length * 0.05, -this.width * 0.35, this.length * 0.22, this.width * 0.7);

      // Headlights
      ctx.fillStyle = '#ffffaa';
      ctx.fillRect(this.length / 2 - 3, -this.width / 2 + 3, 4, 7);
      ctx.fillRect(this.length / 2 - 3, this.width / 2 - 10, 4, 7);

      // Taillights
      ctx.fillStyle = this.speed < 0 ? '#ffffff' : '#ff2222';
      ctx.fillRect(-this.length / 2 - 1, -this.width / 2 + 3, 3, 6);
      ctx.fillRect(-this.length / 2 - 1, this.width / 2 - 9, 3, 6);

      ctx.restore();
    }
  }

  // --- PEDESTRIAN (NPC) ---
  class Pedestrian {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.angle = Math.random() * Math.PI * 2;
      this.speed = 1.2 + Math.random() * 0.8;
      this.health = 30;
      this.radius = 12;
      this.isPanicking = false;
      this.panicTimer = 0;
      this.shirtColor = ['#3498db', '#e67e22', '#2ecc71', '#9b59b6', '#e74c3c', '#f1c40f'][Math.floor(Math.random() * 6)];
    }

    update(world, player, particles) {
      if (this.health <= 0) return;

      if (this.isPanicking) {
        this.speed = 3.2;
        this.panicTimer--;
        if (this.panicTimer <= 0) this.isPanicking = false;
      }

      // Check distance to player gunshots or player car
      const distToPlayer = Math.hypot(player.x - this.x, player.y - this.y);
      if (distToPlayer < 120 && player.inVehicle && Math.abs(player.inVehicle.speed) > 3) {
        this.isPanicking = true;
        this.panicTimer = 180;
        this.angle = Math.atan2(this.y - player.y, this.x - player.x);
      }

      const nextX = this.x + Math.cos(this.angle) * this.speed;
      const nextY = this.y + Math.sin(this.angle) * this.speed;

      if (world.checkCollision(nextX, nextY, this.radius)) {
        this.angle += Math.PI * 0.75 + Math.random();
      } else {
        this.x = nextX;
        this.y = nextY;
      }

      // Random wander change
      if (Math.random() < 0.015 && !this.isPanicking) {
        this.angle += (Math.random() - 0.5) * 1.5;
      }
    }

    draw(ctx) {
      if (this.health <= 0) return;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);

      // Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.beginPath();
      ctx.arc(3, 3, this.radius, 0, Math.PI * 2);
      ctx.fill();

      // Body (Shoulders)
      ctx.fillStyle = this.shirtColor;
      ctx.fillRect(-6, -10, 12, 20);

      // Head
      ctx.fillStyle = '#f5cba7';
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  // --- PARTICLE SYSTEM ---
  class ParticleSystem {
    constructor() {
      this.particles = [];
      this.skidmarks = [];
      this.cashDrops = [];
      this.bulletTracers = [];
    }

    spawnImpact(x, y, color = '#ffd700', count = 6) {
      for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 1.5 + Math.random() * 4;
        this.particles.push({
          x, y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          size: 2 + Math.random() * 3,
          color: color,
          life: 20 + Math.random() * 15,
          maxLife: 35
        });
      }
    }

    spawnSmoke(x, y) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 15,
        y: y + (Math.random() - 0.5) * 15,
        vx: (Math.random() - 0.5) * 0.8,
        vy: -1 - Math.random() * 1.5,
        size: 5 + Math.random() * 6,
        color: 'rgba(80, 80, 80, 0.6)',
        life: 40,
        maxLife: 40
      });
    }

    addSkidmark(x, y, angle, carWidth) {
      if (this.skidmarks.length > 300) this.skidmarks.shift();
      this.skidmarks.push({
        x, y, angle, width: carWidth,
        alpha: 0.35,
        life: 450
      });
    }

    addCashDrop(x, y, amount) {
      this.cashDrops.push({ x, y, amount, radius: 14, bounce: 0 });
    }

    addBulletTracer(x1, y1, x2, y2) {
      this.bulletTracers.push({ x1, y1, x2, y2, life: 6 });
    }

    update() {
      // Particles
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        if (p.life <= 0) this.particles.splice(i, 1);
      }

      // Tracers
      for (let i = this.bulletTracers.length - 1; i >= 0; i--) {
        this.bulletTracers[i].life--;
        if (this.bulletTracers[i].life <= 0) this.bulletTracers.splice(i, 1);
      }

      // Skidmarks fade slowly
      for (let i = this.skidmarks.length - 1; i >= 0; i--) {
        this.skidmarks[i].life--;
        if (this.skidmarks[i].life <= 0) this.skidmarks.splice(i, 1);
      }
    }

    draw(ctx) {
      // Skidmarks
      this.skidmarks.forEach(s => {
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(s.angle);
        ctx.fillStyle = `rgba(15, 15, 15, ${s.alpha * (s.life / 450)})`;
        ctx.fillRect(-8, -s.width * 0.4, 16, 5);
        ctx.fillRect(-8, s.width * 0.4 - 5, 16, 5);
        ctx.restore();
      });

      // Cash drops
      this.cashDrops.forEach(c => {
        c.bounce += 0.08;
        const offsetY = Math.sin(c.bounce) * 3;
        ctx.save();
        ctx.translate(c.x, c.y + offsetY);
        ctx.fillStyle = '#2ecc71';
        roundRect(ctx, -10, -6, 20, 12, 3);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('$', 0, 0);
        ctx.restore();
      });

      // Bullet Tracers
      this.bulletTracers.forEach(b => {
        ctx.strokeStyle = `rgba(255, 230, 100, ${b.life / 6})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(b.x1, b.y1);
        ctx.lineTo(b.x2, b.y2);
        ctx.stroke();
      });

      // Sparks / Smoke
      this.particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life / p.maxLife;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      });
    }
  }

  // --- PLAYER CONTROLLER ---
  class Player {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.angle = 0;
      this.speed = 3.5;
      this.health = 100;
      this.armor = 50;
      this.cash = 500;
      this.radius = 14;
      this.inVehicle = null;
      this.wantedLevel = 0;
      this.wantedTimer = 0;
      this.weapon = 'pistol'; // 'fists', 'pistol', 'uzi'
      this.shootCooldown = 0;
    }

    update(keys, mouse, world, vehicles, pedestrians, particles) {
      if (this.health <= 0) return;

      if (this.shootCooldown > 0) this.shootCooldown--;

      // Wanted level decay
      if (this.wantedLevel > 0) {
        this.wantedTimer++;
        if (this.wantedTimer > 900) { // 15 seconds without crimes
          this.wantedLevel--;
          this.wantedTimer = 0;
          updateWantedUI(this.wantedLevel);
        }
      }

      // Check cash collection
      for (let i = particles.cashDrops.length - 1; i >= 0; i--) {
        const c = particles.cashDrops[i];
        if (Math.hypot(this.x - c.x, this.y - c.y) < 35) {
          this.cash += c.amount;
          audio.playPickup();
          updateCashUI(this.cash);
          particles.cashDrops.splice(i, 1);
        }
      }

      if (this.inVehicle) {
        // --- DRIVING VEHICLE ---
        const v = this.inVehicle;
        this.x = v.x;
        this.y = v.y;
        this.angle = v.angle;

        // Accelerate & Brake
        if (keys['w'] || keys['ArrowUp']) {
          if (v.speed < v.maxSpeed) v.speed += v.accel;
        } else if (keys['s'] || keys['ArrowDown']) {
          if (v.speed > -v.maxSpeed * 0.4) v.speed -= v.brake;
        }

        // Steer
        if (Math.abs(v.speed) > 0.3) {
          const dir = v.speed > 0 ? 1 : -1;
          if (keys['a'] || keys['ArrowLeft']) v.angle -= v.turnSpeed * dir;
          if (keys['d'] || keys['ArrowRight']) v.angle += v.turnSpeed * dir;
        }

        // Drift / Handbrake
        if (keys['Shift'] || keys[' ']) {
          v.speed *= 0.94;
          particles.addSkidmark(v.x, v.y, v.angle, v.width);
        }

        // Horn
        if (keys['h'] || keys['H']) {
          audio.playHorn();
        }

        // Audio engine modulation
        audio.setEngineSpeed(Math.abs(v.speed) / v.maxSpeed);

        // Check if car hits pedestrians
        if (Math.abs(v.speed) > 2) {
          pedestrians.forEach(ped => {
            if (ped.health > 0 && Math.hypot(ped.x - v.x, ped.y - v.y) < v.width) {
              ped.health = 0;
              particles.spawnImpact(ped.x, ped.y, '#c0392b', 12);
              particles.addCashDrop(ped.x, ped.y, Math.floor(20 + Math.random() * 80));
              this.addWantedStar();
              audio.playCrash();
            }
          });
        }

        // Exit car with [F] or [Enter]
        if (keys['f_pressed'] || keys['enter_pressed']) {
          this.exitVehicle();
        }

      } else {
        // --- ON FOOT ---
        audio.stopEngine();

        // Aim towards mouse in world coordinates
        this.angle = Math.atan2(mouse.worldY - this.y, mouse.worldX - this.x);

        let moveX = 0;
        let moveY = 0;
        if (keys['w'] || keys['ArrowUp']) moveY -= 1;
        if (keys['s'] || keys['ArrowDown']) moveY += 1;
        if (keys['a'] || keys['ArrowLeft']) moveX -= 1;
        if (keys['d'] || keys['ArrowRight']) moveX += 1;

        if (moveX !== 0 || moveY !== 0) {
          const len = Math.hypot(moveX, moveY);
          const spd = (keys['Shift'] ? this.speed * 1.5 : this.speed);
          const nextX = this.x + (moveX / len) * spd;
          const nextY = this.y + (moveY / len) * spd;

          if (!world.checkCollision(nextX, this.y, this.radius)) this.x = nextX;
          if (!world.checkCollision(this.x, nextY, this.radius)) this.y = nextY;
        }

        // Weapon switching
        if (keys['1']) switchWeapon('fists');
        if (keys['2']) switchWeapon('pistol');
        if (keys['3']) switchWeapon('uzi');

        // Shoot with Mouse Left Click or Space
        if ((mouse.isDown || keys[' ']) && this.shootCooldown === 0) {
          this.shoot(world, pedestrians, vehicles, particles);
        }

        // Enter closest vehicle with [F] or [Enter]
        if (keys['f_pressed'] || keys['enter_pressed']) {
          this.tryEnterVehicle(vehicles);
        }
      }
    }

    tryEnterVehicle(vehicles) {
      let nearest = null;
      let minDist = 70;
      vehicles.forEach(v => {
        if (v.health > 0) {
          const d = Math.hypot(v.x - this.x, v.y - this.y);
          if (d < minDist) {
            minDist = d;
            nearest = v;
          }
        }
      });

      if (nearest) {
        this.inVehicle = nearest;
        nearest.driver = this;
        document.getElementById('hud-bottom-left').classList.remove('hidden');
        document.getElementById('vehicle-name').innerText = nearest.type.toUpperCase();
        document.getElementById('interaction-prompt').classList.add('hidden');
      }
    }

    exitVehicle() {
      if (!this.inVehicle) return;
      const v = this.inVehicle;
      this.x = v.x + Math.cos(v.angle + Math.PI / 2) * (v.width + 10);
      this.y = v.y + Math.sin(v.angle + Math.PI / 2) * (v.width + 10);
      v.driver = null;
      this.inVehicle = null;
      audio.stopEngine();
      document.getElementById('hud-bottom-left').classList.add('hidden');
    }

    shoot(world, pedestrians, vehicles, particles) {
      if (this.weapon === 'fists') {
        this.shootCooldown = 20;
        // Melee hit
        pedestrians.forEach(p => {
          if (p.health > 0 && Math.hypot(p.x - this.x, p.y - this.y) < 45) {
            p.health -= 35;
            particles.spawnImpact(p.x, p.y, '#e74c3c', 5);
            if (p.health <= 0) {
              particles.addCashDrop(p.x, p.y, 40);
              this.addWantedStar();
            }
          }
        });
        return;
      }

      if (this.weapon === 'pistol') {
        this.shootCooldown = 18;
        audio.playPistol();
      } else if (this.weapon === 'uzi') {
        this.shootCooldown = 7;
        audio.playUzi();
      }

      // Bullet trace raycast
      const range = 500;
      const spread = (Math.random() - 0.5) * (this.weapon === 'uzi' ? 0.16 : 0.05);
      const shotAngle = this.angle + spread;

      const originX = this.x + Math.cos(this.angle) * 18;
      const originY = this.y + Math.sin(this.angle) * 18;
      let targetX = originX + Math.cos(shotAngle) * range;
      let targetY = originY + Math.sin(shotAngle) * range;

      // Hit pedestrians
      for (let p of pedestrians) {
        if (p.health > 0 && Math.hypot(p.x - originX, p.y - originY) < range) {
          const lineDist = pointToLineDist(p.x, p.y, originX, originY, targetX, targetY);
          if (lineDist < p.radius + 6) {
            p.health -= (this.weapon === 'uzi' ? 22 : 35);
            targetX = p.x;
            targetY = p.y;
            particles.spawnImpact(p.x, p.y, '#c0392b', 8);
            if (p.health <= 0) {
              particles.addCashDrop(p.x, p.y, Math.floor(30 + Math.random() * 60));
              this.addWantedStar();
            }
            break;
          }
        }
      }

      // Hit vehicles
      for (let v of vehicles) {
        if (v !== this.inVehicle && Math.hypot(v.x - originX, v.y - originY) < range) {
          const lineDist = pointToLineDist(v.x, v.y, originX, originY, targetX, targetY);
          if (lineDist < v.width / 2 + 5) {
            v.health -= 12;
            targetX = v.x;
            targetY = v.y;
            particles.spawnImpact(v.x, v.y, '#ffd700', 6);
            if (v.isPolice) this.addWantedStar();
            break;
          }
        }
      }

      particles.addBulletTracer(originX, originY, targetX, targetY);
    }

    addWantedStar() {
      if (this.wantedLevel < 5) {
        this.wantedLevel++;
        this.wantedTimer = 0;
        updateWantedUI(this.wantedLevel);
      }
    }

    takeDamage(dmg) {
      if (this.armor > 0) {
        this.armor -= dmg;
        if (this.armor < 0) {
          this.health += this.armor;
          this.armor = 0;
        }
      } else {
        this.health -= dmg;
      }
      if (this.health <= 0) {
        this.health = 0;
        triggerGameOver();
      }
      updateHealthUI(this.health, this.armor);
    }

    draw(ctx) {
      if (this.inVehicle || this.health <= 0) return;

      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);

      // Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.beginPath();
      ctx.arc(3, 3, this.radius, 0, Math.PI * 2);
      ctx.fill();

      // Hands & Weapon
      ctx.fillStyle = '#f5cba7';
      ctx.fillRect(8, -8, 12, 4);
      ctx.fillRect(8, 4, 12, 4);

      if (this.weapon === 'pistol' || this.weapon === 'uzi') {
        ctx.fillStyle = '#222';
        ctx.fillRect(15, -3, 10, 6);
      }

      // Torso (Leather Jacket)
      ctx.fillStyle = '#2c3e50';
      ctx.fillRect(-8, -12, 16, 24);

      // Head
      ctx.fillStyle = '#f5cba7';
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();

      // Hair
      ctx.fillStyle = '#4a235a';
      ctx.beginPath();
      ctx.arc(-2, 0, 7, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  // --- POLICE AI DISPATCHER ---
  class PoliceSystem {
    constructor() {
      this.cops = [];
      this.spawnTimer = 0;
    }

    update(player, vehicles, world, particles) {
      if (player.wantedLevel <= 0) {
        audio.playSirenLoop(false);
        return;
      }

      audio.playSirenLoop(true);

      const maxCops = player.wantedLevel * 2;
      this.spawnTimer++;

      // Spawn police cruisers if needed
      if (this.cops.length < maxCops && this.spawnTimer > 180) {
        this.spawnTimer = 0;
        const ang = Math.random() * Math.PI * 2;
        const spawnDist = 650;
        const sx = player.x + Math.cos(ang) * spawnDist;
        const sy = player.y + Math.sin(ang) * spawnDist;

        if (!world.checkCollision(sx, sy, 35)) {
          const copCar = new Vehicle(sx, sy, 'police');
          vehicles.push(copCar);
          this.cops.push(copCar);
        }
      }

      // Cop AI behavior
      this.cops.forEach(cop => {
        if (cop.health <= 0) return;

        const targetAng = Math.atan2(player.y - cop.y, player.x - cop.x);
        let diff = targetAng - cop.angle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;

        cop.angle += Math.sign(diff) * Math.min(Math.abs(diff), 0.04);
        cop.speed = Math.min(cop.maxSpeed, cop.speed + cop.accel);

        // Ramming damage to player
        const dist = Math.hypot(player.x - cop.x, player.y - cop.y);
        if (dist < 55 && Math.abs(cop.speed) > 3) {
          player.takeDamage(12);
          audio.playCrash();
          particles.spawnImpact(player.x, player.y, '#ffd700', 8);
          cop.speed = -cop.speed * 0.3;
        }
      });
    }
  }

  // --- HELPER MATH & DRAWING UTILITIES ---
  function pointToLineDist(px, py, x1, y1, x2, y2) {
    const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function shadeColor(color, percent) {
    let num = parseInt(color.replace('#', ''), 16),
        amt = Math.round(2.55 * percent),
        R = (num >> 16) + amt,
        G = (num >> 8 & 0x00FF) + amt,
        B = (num & 0x0000FF) + amt;
    return '#' + (0x1000000 + (R<255?R<1?0:R:255)*0x10000 + (G<255?G<1?0:G:255)*0x100 + (B<255?B<1?0:B:255)).toString(16).slice(1);
  }

  // --- UI UPDATE FUNCTIONS ---
  function updateCashUI(cash) {
    const el = document.getElementById('cash-display');
    if (el) el.innerText = '$' + String(cash).padStart(8, '0');
  }

  function updateWantedUI(stars) {
    const starEls = document.querySelectorAll('#wanted-stars .star');
    starEls.forEach((el, idx) => {
      if (idx < stars) el.classList.add('active');
      else el.classList.remove('active');
    });
  }

  function updateHealthUI(health, armor) {
    const hBar = document.getElementById('health-bar');
    const aBar = document.getElementById('armor-bar');
    if (hBar) hBar.style.width = Math.max(0, health) + '%';
    if (aBar) aBar.style.width = Math.max(0, armor * 2) + '%';
  }

  function switchWeapon(type) {
    player.weapon = type;
    const nameEl = document.getElementById('weapon-name');
    const iconEl = document.getElementById('weapon-icon');
    if (type === 'fists') {
      nameEl.innerText = 'FISTS';
      iconEl.innerText = '👊';
    } else if (type === 'pistol') {
      nameEl.innerText = 'PISTOL';
      iconEl.innerText = '🔫';
    } else if (type === 'uzi') {
      nameEl.innerText = 'MICRO-SMG';
      iconEl.innerText = '💥';
    }
  }

  function triggerGameOver() {
    const el = document.getElementById('game-over-screen');
    if (el) el.classList.remove('hidden');
    audio.playCrash();
  }

  function respawnPlayer() {
    player.health = 100;
    player.armor = 50;
    player.x = 350;
    player.y = 350;
    player.wantedLevel = 0;
    if (player.inVehicle) player.exitVehicle();
    updateHealthUI(100, 50);
    updateWantedUI(0);
    document.getElementById('game-over-screen').classList.add('hidden');
  }

  // --- RADAR / MINIMAP RENDERER ---
  function drawRadar(radarCtx, player, vehicles, world) {
    const w = radarCtx.canvas.width;
    const h = radarCtx.canvas.height;
    const scale = 0.07;

    radarCtx.clearRect(0, 0, w, h);

    radarCtx.save();
    radarCtx.translate(w / 2, h / 2);

    // Radar background circle
    radarCtx.beginPath();
    radarCtx.arc(0, 0, w / 2 - 3, 0, Math.PI * 2);
    radarCtx.clip();

    // Map offset relative to player
    radarCtx.translate(-player.x * scale, -player.y * scale);

    // Roads
    radarCtx.fillStyle = '#444';
    world.roads.forEach(r => {
      radarCtx.fillRect(r.x * scale, r.y * scale, r.w * scale, r.h * scale);
    });

    // Vehicles (White / Red & Blue for cops)
    vehicles.forEach(v => {
      if (v.health <= 0) return;
      radarCtx.fillStyle = v.isPolice ? '#ff2222' : '#ffffff';
      radarCtx.beginPath();
      radarCtx.arc(v.x * scale, v.y * scale, 2.5, 0, Math.PI * 2);
      radarCtx.fill();
    });

    // Player marker (Green Arrow)
    radarCtx.restore();
    radarCtx.save();
    radarCtx.translate(w / 2, h / 2);
    radarCtx.rotate(player.angle);
    radarCtx.fillStyle = '#2ecc71';
    radarCtx.beginPath();
    radarCtx.moveTo(7, 0);
    radarCtx.lineTo(-6, -5);
    radarCtx.lineTo(-3, 0);
    radarCtx.lineTo(-6, 5);
    radarCtx.closePath();
    radarCtx.fill();
    radarCtx.restore();
  }

  // --- INITIALIZATION & MAIN LOOP ---
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const radarCanvas = document.getElementById('radar-canvas');
  const radarCtx = radarCanvas.getContext('2d');

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  const world = new World();
  const particles = new ParticleSystem();
  const player = new Player(350, 350);
  const police = new PoliceSystem();
  const vehicles = [];
  const pedestrians = [];

  // Populate civilian vehicles
  for (let i = 0; i < 28; i++) {
    const road = world.roads[Math.floor(Math.random() * world.roads.length)];
    const types = ['sedan', 'sports', 'truck'];
    const type = types[Math.floor(Math.random() * types.length)];
    const vx = road.x + (road.dir === 'H' ? Math.random() * road.w : road.w / 2);
    const vy = road.y + (road.dir === 'V' ? Math.random() * road.h : road.h / 2);
    const v = new Vehicle(vx, vy, type);
    v.angle = road.dir === 'H' ? 0 : Math.PI / 2;
    vehicles.push(v);
  }

  // Populate pedestrians
  for (let i = 0; i < 40; i++) {
    const px = 200 + Math.random() * (WORLD_SIZE - 400);
    const py = 200 + Math.random() * (WORLD_SIZE - 400);
    if (!world.checkCollision(px, py, 14)) {
      pedestrians.push(new Pedestrian(px, py));
    }
  }

  // Input states
  const keys = {};
  const mouse = { x: 0, y: 0, worldX: 0, worldY: 0, isDown: false };

  window.addEventListener('keydown', e => {
    keys[e.key.toLowerCase()] = true;
    keys[e.key] = true;
    if (e.key.toLowerCase() === 'f') keys['f_pressed'] = true;
    if (e.key === 'Enter') keys['enter_pressed'] = true;
    if (e.key.toLowerCase() === 'r') {
      if (player.health <= 0) respawnPlayer();
    }
  });

  window.addEventListener('keyup', e => {
    keys[e.key.toLowerCase()] = false;
    keys[e.key] = false;
    if (e.key.toLowerCase() === 'f') keys['f_pressed'] = false;
    if (e.key === 'Enter') keys['enter_pressed'] = false;
  });

  window.addEventListener('mousemove', e => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });

  window.addEventListener('mousedown', e => {
    if (e.button === 0) mouse.isDown = true;
  });

  window.addEventListener('mouseup', e => {
    if (e.button === 0) mouse.isDown = false;
  });

  // Start & Respawn Buttons
  document.getElementById('start-btn').addEventListener('click', () => {
    audio.init();
    document.getElementById('help-overlay').classList.add('hidden');
  });

  document.getElementById('respawn-btn').addEventListener('click', () => {
    respawnPlayer();
  });

  // Main Loop
  function gameLoop() {
    // Camera follow player
    const camX = player.x - canvas.width / 2;
    const camY = player.y - canvas.height / 2;

    mouse.worldX = mouse.x + camX;
    mouse.worldY = mouse.y + camY;

    // Updates
    player.update(keys, mouse, world, vehicles, pedestrians, particles);
    vehicles.forEach(v => v.update(world, particles));
    pedestrians.forEach(p => p.update(world, player, particles));
    police.update(player, vehicles, world, particles);
    particles.update();

    // Check interaction prompt
    if (!player.inVehicle) {
      let canEnter = false;
      for (let v of vehicles) {
        if (v.health > 0 && Math.hypot(v.x - player.x, v.y - player.y) < 70) {
          canEnter = true;
          break;
        }
      }
      const promptEl = document.getElementById('interaction-prompt');
      if (canEnter) promptEl.classList.remove('hidden');
      else promptEl.classList.add('hidden');
    }

    // Update speedometer & car health if in vehicle
    if (player.inVehicle) {
      const spdKmh = Math.floor(Math.abs(player.inVehicle.speed) * 12);
      document.getElementById('speed-value').innerText = spdKmh;
      document.getElementById('car-health-bar').style.width = Math.max(0, player.inVehicle.health) + '%';
    }

    // Reset single-frame key presses
    keys['f_pressed'] = false;
    keys['enter_pressed'] = false;

    // Render World
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(-camX, -camY);

    world.draw(ctx, camX, camY, canvas.width, canvas.height);
    particles.draw(ctx);
    vehicles.forEach(v => v.draw(ctx));
    pedestrians.forEach(p => p.draw(ctx));
    player.draw(ctx);

    ctx.restore();

    // Render Minimap
    drawRadar(radarCtx, player, vehicles, world);

    requestAnimationFrame(gameLoop);
  }

  requestAnimationFrame(gameLoop);
})();
