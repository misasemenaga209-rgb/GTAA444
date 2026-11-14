/**
 * =============================================================================
 * GORODNYA 3D: OPEN WORLD (ЧАСТЬ 2 - GAMEPLAY, VEHICLES, AI, SOUND & MISSIONS)
 * =============================================================================
 * Senior Gameplay, Physics, AI & Audio Architecture (Three.js + Web Audio API)
 * Полная бесшовная стыковка с Частью 1 через хук: window.GorodnyaWorld
 * =============================================================================
 */

// =============================================================================
// 1. ПРОЦЕДУРНЫЙ ЗВУКОВОЙ ДВИЖОК (WEB AUDIO API)
// =============================================================================
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = false;

    // Двигатель автомобиля
    this.engineOsc1 = null;
    this.engineOsc2 = null;
    this.engineFilter = null;
    this.engineGain = null;

    // Визг резины / дрифт
    this.skidGain = null;
    this.skidSource = null;

    // Двухтональная сирена полиции
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenActive = false;

    this.stepInterval = 0;
  }

  init() {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioCtx();

    // 1. Звук двигателя (двойной низкочастотный осциллятор + lowpass фильтр)
    this.engineOsc1 = this.ctx.createOscillator();
    this.engineOsc2 = this.ctx.createOscillator();
    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineGain = this.ctx.createGain();

    this.engineOsc1.type = 'sawtooth';
    this.engineOsc2.type = 'triangle';
    this.engineOsc1.frequency.setValueAtTime(32, this.ctx.currentTime);
    this.engineOsc2.frequency.setValueAtTime(64, this.ctx.currentTime);

    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.setValueAtTime(260, this.ctx.currentTime);
    this.engineGain.gain.setValueAtTime(0, this.ctx.currentTime);

    this.engineOsc1.connect(this.engineFilter);
    this.engineOsc2.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.ctx.destination);

    this.engineOsc1.start();
    this.engineOsc2.start();

    // 2. Визг шин при дрифте (фильтрованный розовый/белый шум)
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    this.skidSource = this.ctx.createBufferSource();
    this.skidSource.buffer = noiseBuffer;
    this.skidSource.loop = true;

    const skidFilter = this.ctx.createBiquadFilter();
    skidFilter.type = 'bandpass';
    skidFilter.frequency.setValueAtTime(1400, this.ctx.currentTime);
    skidFilter.Q.setValueAtTime(3.5, this.ctx.currentTime);

    this.skidGain = this.ctx.createGain();
    this.skidGain.gain.setValueAtTime(0, this.ctx.currentTime);

    this.skidSource.connect(skidFilter);
    skidFilter.connect(this.skidGain);
    this.skidGain.connect(this.ctx.destination);
    this.skidSource.start();

    // 3. Сирена полиции
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenGain = this.ctx.createGain();
    this.sirenOsc.type = 'sawtooth';
    this.sirenOsc.frequency.setValueAtTime(650, this.ctx.currentTime);
    this.sirenGain.gain.setValueAtTime(0, this.ctx.currentTime);

    const sirenFilter = this.ctx.createBiquadFilter();
    sirenFilter.type = 'lowpass';
    sirenFilter.frequency.setValueAtTime(1200, this.ctx.currentTime);

    this.sirenOsc.connect(sirenFilter);
    sirenFilter.connect(this.sirenGain);
    this.sirenGain.connect(this.ctx.destination);
    this.sirenOsc.start();
  }

  updateEngine(rpmRatio, load = 0.5) {
    if (!this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;
    if (rpmRatio > 0.02) {
      const baseFreq = 30 + rpmRatio * 110;
      this.engineOsc1.frequency.setTargetAtTime(baseFreq, t, 0.04);
      this.engineOsc2.frequency.setTargetAtTime(baseFreq * 2.05, t, 0.04);
      this.engineFilter.frequency.setTargetAtTime(240 + rpmRatio * 750, t, 0.05);
      const targetVol = Math.min(0.22, 0.04 + rpmRatio * 0.16 + load * 0.05);
      this.engineGain.gain.setTargetAtTime(targetVol, t, 0.05);
    } else {
      this.engineGain.gain.setTargetAtTime(0, t, 0.08);
    }
  }

  stopEngine() {
    if (!this.ctx) return;
    this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.06);
  }

  setDriftSkid(intensity) {
    if (!this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;
    const target = Math.max(0, Math.min(0.28, intensity * 0.28));
    this.skidGain.gain.setTargetAtTime(target, t, 0.03);
  }

  setPoliceSiren(active) {
    if (!this.ctx || this.isMuted) return;
    this.sirenActive = active;
    const t = this.ctx.currentTime;
    if (active) {
      this.sirenGain.gain.setTargetAtTime(0.12, t, 0.1);
      const phase = Math.sin(Date.now() / 220);
      const freq = phase > 0 ? 920 : 660;
      this.sirenOsc.frequency.setTargetAtTime(freq, t, 0.04);
    } else {
      this.sirenGain.gain.setTargetAtTime(0, t, 0.2);
    }
  }

  playCrash(speed = 10) {
    if (!this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;
    const duration = 0.35;
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * duration, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.08));
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, t);

    const gain = this.ctx.createGain();
    const vol = Math.min(0.6, (speed / 30) * 0.6);
    gain.gain.setValueAtTime(vol, t);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    src.start(t);
  }

  playFootstep(surface = 'asphalt') {
    if (!this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = surface === 'grass' ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(surface === 'grass' ? 80 : 160, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.06);

    gain.gain.setValueAtTime(0.06, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.06);
  }

  playPurchase() {
    if (!this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(987.77, t);
    osc.frequency.setValueAtTime(1318.51, t + 0.09);
    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.3);
  }
}

// =============================================================================
// 2. ДЕТАЛИЗИРОВАННЫЙ 3D-ПЕРСОНАЖ И THIRD-PERSON КАМЕРА
// =============================================================================
class CharacterController {
  constructor(scene, soundEngine) {
    this.scene = scene;
    this.sound = soundEngine;

    this.group = new THREE.Group();
    this.group.name = 'PlayerCharacter';

    // Спавн в центре Городни на открытом тротуаре возле супермаркета АТБ (без коллизий)
    this.position = new THREE.Vector3(0, 0.1, -120);
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.heading = 0;
    this.walkSpeed = 5.2;
    this.sprintSpeed = 10.5;
    this.jumpForce = 8.5;
    this.gravity = -22.0;
    this.isGrounded = true;
    this.inVehicle = null;

    this.walkCycle = 0;
    this.stepInterval = 0;
    this.health = 100;
    this.maxHealth = 100;
    this.money = 1250;
    this.wantedStars = 0;
    this.wantedTimer = 0;

    this.buildCharacterMesh();
    this.scene.add(this.group);
    this.group.position.copy(this.position);
  }

  buildCharacterMesh() {
    const matSkin = new THREE.MeshLambertMaterial({ color: 0xf5cba7 });
    const matHoodie = new THREE.MeshLambertMaterial({ color: 0x1e293b });
    const matPants = new THREE.MeshLambertMaterial({ color: 0x334155 });
    const matShoes = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const matCap = new THREE.MeshLambertMaterial({ color: 0x0f172a });

    // Торс и капюшон
    this.torso = new THREE.Group();
    const torsoMesh = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.72, 0.32), matHoodie);
    torsoMesh.position.y = 1.25;
    torsoMesh.castShadow = true;
    this.torso.add(torsoMesh);

    const hoodMesh = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.28, 0.18), matHoodie);
    hoodMesh.position.set(0, 1.48, -0.16);
    this.torso.add(hoodMesh);

    // Голова и кепка
    this.head = new THREE.Group();
    this.head.position.set(0, 1.76, 0);
    const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), matSkin);
    this.head.add(headMesh);
    const capMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 12), matCap);
    capMesh.position.y = 0.1;
    this.head.add(capMesh);
    const visorMesh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.02, 0.16), matCap);
    visorMesh.position.set(0, 0.08, 0.18);
    this.head.add(visorMesh);
    this.torso.add(this.head);

    // Руки
    this.leftArm = new THREE.Group();
    this.leftArm.position.set(-0.35, 1.5, 0);
    const lUpperArm = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.38, 0.15), matHoodie);
    lUpperArm.position.y = -0.18;
    this.leftArm.add(lUpperArm);
    const lHand = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.12), matSkin);
    lHand.position.y = -0.42;
    this.leftArm.add(lHand);
    this.torso.add(this.leftArm);

    this.rightArm = new THREE.Group();
    this.rightArm.position.set(0.35, 1.5, 0);
    const rUpperArm = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.38, 0.15), matHoodie);
    rUpperArm.position.y = -0.18;
    this.rightArm.add(rUpperArm);
    const rHand = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.12), matSkin);
    rHand.position.y = -0.42;
    rHand.name = 'PlayerHandR';
    this.rightArm.add(rHand);
    this.torso.add(this.rightArm);

    // Ноги
    this.leftLeg = new THREE.Group();
    this.leftLeg.position.set(-0.16, 0.9, 0);
    const lLegMesh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.65, 0.2), matPants);
    lLegMesh.position.y = -0.32;
    this.leftLeg.add(lLegMesh);
    const lShoe = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.34), matShoes);
    lShoe.position.set(0, -0.68, 0.06);
    this.leftLeg.add(lShoe);
    this.group.add(this.leftLeg);

    this.rightLeg = new THREE.Group();
    this.rightLeg.position.set(0.16, 0.9, 0);
    const rLegMesh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.65, 0.2), matPants);
    rLegMesh.position.y = -0.32;
    this.rightLeg.add(rLegMesh);
    const rShoe = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.34), matShoes);
    rShoe.position.set(0, -0.68, 0.06);
    this.rightLeg.add(rShoe);
    this.group.add(this.rightLeg);

    this.group.add(this.torso);
  }

  update(delta, input, cameraAngleY, collisionBoxes) {
    if (this.inVehicle) {
      this.group.visible = false;
      this.position.copy(this.inVehicle.mesh.position);
      this.group.position.copy(this.position);
      return;
    }

    this.group.visible = true;
    const moveVector = new THREE.Vector3(0, 0, 0);
    if (input.forward) moveVector.z -= 1;
    if (input.backward) moveVector.z += 1;
    if (input.left) moveVector.x -= 1;
    if (input.right) moveVector.x += 1;

    const isMoving = moveVector.lengthSq() > 0.01;
    const currentSpeed = input.sprint ? this.sprintSpeed : this.walkSpeed;

    if (isMoving) {
      moveVector.normalize();
      moveVector.applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraAngleY);

      const targetHeading = Math.atan2(moveVector.x, moveVector.z);
      let diff = targetHeading - this.heading;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      this.heading += diff * Math.min(1.0, delta * 14);
      this.group.rotation.y = this.heading;

      this.velocity.x = moveVector.x * currentSpeed;
      this.velocity.z = moveVector.z * currentSpeed;

      this.walkCycle += delta * (input.sprint ? 14 : 9);
      const swing = Math.sin(this.walkCycle) * (input.sprint ? 0.75 : 0.45);
      this.leftLeg.rotation.x = swing;
      this.rightLeg.rotation.x = -swing;
      this.leftArm.rotation.x = -swing * 0.9;
      this.rightArm.rotation.x = swing * 0.9;

      this.stepInterval += delta * (input.sprint ? 1.8 : 1.0);
      if (this.stepInterval > 0.38) {
        this.stepInterval = 0;
        this.sound.playFootstep('asphalt');
      }
    } else {
      this.velocity.x = 0;
      this.velocity.z = 0;
      this.leftLeg.rotation.x *= 0.85;
      this.rightLeg.rotation.x *= 0.85;
      this.leftArm.rotation.x *= 0.85;
      this.rightArm.rotation.x *= 0.85;
    }

    if (input.jump && this.isGrounded) {
      this.velocity.y = this.jumpForce;
      this.isGrounded = false;
      this.sound.playFootstep('jump');
    }

    this.velocity.y += this.gravity * delta;

    const pRadius = 0.35;
    const pHeight = 1.8;

    // 1. Депенетрация: предотвращение застревания персонажа в любых препятствиях
    if (collisionBoxes && collisionBoxes.length > 0) {
      for (let i = 0; i < collisionBoxes.length; i++) {
        const box = collisionBoxes[i];
        if (this.position.y + pHeight > box.min.y && this.position.y < box.max.y) {
          if (this.position.x + pRadius > box.min.x && this.position.x - pRadius < box.max.x &&
              this.position.z + pRadius > box.min.z && this.position.z - pRadius < box.max.z) {
            const penLeft = (this.position.x + pRadius) - box.min.x;
            const penRight = box.max.x - (this.position.x - pRadius);
            const penBack = (this.position.z + pRadius) - box.min.z;
            const penFront = box.max.z - (this.position.z - pRadius);
            const minPen = Math.min(penLeft, penRight, penBack, penFront);
            if (minPen === penLeft) this.position.x = box.min.x - pRadius - 0.03;
            else if (minPen === penRight) this.position.x = box.max.x + pRadius + 0.03;
            else if (minPen === penBack) this.position.z = box.min.z - pRadius - 0.03;
            else if (minPen === penFront) this.position.z = box.max.z + pRadius + 0.03;
          }
        }
      }
    }

    // 2. Раздельная проверка коллизий по X (скольжение вдоль стен и заборов)
    const newX = this.position.x + this.velocity.x * delta;
    let hitX = false;
    const boxX = new THREE.Box3(
      new THREE.Vector3(newX - pRadius, this.position.y + 0.1, this.position.z - pRadius),
      new THREE.Vector3(newX + pRadius, this.position.y + pHeight, this.position.z + pRadius)
    );
    if (collisionBoxes) {
      for (let i = 0; i < collisionBoxes.length; i++) {
        if (boxX.intersectsBox(collisionBoxes[i])) {
          hitX = true;
          break;
        }
      }
    }
    if (!hitX) {
      this.position.x = newX;
    }

    // 3. Раздельная проверка коллизий по Z (скольжение)
    const newZ = this.position.z + this.velocity.z * delta;
    let hitZ = false;
    const boxZ = new THREE.Box3(
      new THREE.Vector3(this.position.x - pRadius, this.position.y + 0.1, newZ - pRadius),
      new THREE.Vector3(this.position.x + pRadius, this.position.y + pHeight, newZ + pRadius)
    );
    if (collisionBoxes) {
      for (let i = 0; i < collisionBoxes.length; i++) {
        if (boxZ.intersectsBox(collisionBoxes[i])) {
          hitZ = true;
          break;
        }
      }
    }
    if (!hitZ) {
      this.position.z = newZ;
    }

    // 4. Прижатие к уровню земли
    this.position.y += this.velocity.y * delta;
    if (this.position.y <= 0) {
      this.position.y = 0;
      this.velocity.y = 0;
      this.isGrounded = true;
    }

    this.group.position.copy(this.position);

    if (this.wantedStars > 0) {
      this.wantedTimer += delta;
      if (this.wantedTimer > 25.0) {
        this.wantedStars = Math.max(0, this.wantedStars - 1);
        this.wantedTimer = 0;
      }
    }
  }
}

// =============================================================================
// 3. УМНАЯ THIRD-PERSON КАМЕРА (360° ОБЗОР И ЗАЩИТА ОТ СТЕН)
// =============================================================================
class ThirdPersonCamera {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;
    this.target = new THREE.Vector3();
    this.angleX = 0.25;
    this.angleY = 0;
    this.distance = 5.5;
    this.targetDistance = 5.5;
    this.isDragging = false;
    this.previousMousePosition = { x: 0, y: 0 };
    this.setupMouseEvents();
  }

  setupMouseEvents() {
    this.domElement.addEventListener('mousedown', e => {
      this.isDragging = true;
      this.previousMousePosition = { x: e.clientX, y: e.clientY };
    });
    window.addEventListener('mouseup', () => this.isDragging = false);
    window.addEventListener('mousemove', e => {
      if (!this.isDragging) return;
      const deltaX = e.clientX - this.previousMousePosition.x;
      const deltaY = e.clientY - this.previousMousePosition.y;
      this.angleY -= deltaX * 0.0055;
      this.angleX = Math.max(-0.25, Math.min(1.25, this.angleX + deltaY * 0.0055));
      this.previousMousePosition = { x: e.clientX, y: e.clientY };
    });
    window.addEventListener('wheel', e => {
      this.targetDistance = Math.max(2.8, Math.min(14.0, this.targetDistance + e.deltaY * 0.005));
    });
  }

  update(delta, targetPos, vehicleSpeed = 0, collisionBoxes = []) {
    const dynamicDist = this.targetDistance + (vehicleSpeed / 40.0) * 4.5;
    this.distance += (dynamicDist - this.distance) * (delta * 4.0);
    this.target.lerp(new THREE.Vector3(targetPos.x, targetPos.y + 1.4, targetPos.z), delta * 8.0);

    const horizontalDist = this.distance * Math.cos(this.angleX);
    const idealX = this.target.x + horizontalDist * Math.sin(this.angleY);
    const idealY = this.target.y + this.distance * Math.sin(this.angleX);
    const idealZ = this.target.z + horizontalDist * Math.cos(this.angleY);
    const idealPos = new THREE.Vector3(idealX, idealY, idealZ);

    const rayDir = new THREE.Vector3().subVectors(idealPos, this.target).normalize();
    let finalDist = this.target.distanceTo(idealPos);

    if (collisionBoxes && collisionBoxes.length) {
      const ray = new THREE.Ray(this.target, rayDir);
      for (let i = 0; i < collisionBoxes.length; i++) {
        const intersection = ray.intersectBox(collisionBoxes[i], new THREE.Vector3());
        if (intersection) {
          const hitDist = this.target.distanceTo(intersection) - 0.3;
          if (hitDist < finalDist && hitDist > 0.8) finalDist = hitDist;
        }
      }
    }

    const actualPos = this.target.clone().add(rayDir.multiplyScalar(finalDist));
    this.camera.position.lerp(actualPos, Math.min(1.0, delta * 12.0));
    this.camera.lookAt(this.target);
  }
}

// =============================================================================
// 4. АВТОПАРК ГОРОДНИ (6 МОДЕЛЕЙ С ЧЕРНИГОВСКИМИ НОМЕРАМИ)
// =============================================================================
class VehicleFactory {
  static createLicensePlateTexture(plateNumber = 'CB 4821 AK', isPolice = false) {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = isPolice ? '#003399' : '#ffffff';
    ctx.fillRect(0, 0, 256, 64);
    ctx.strokeStyle = isPolice ? '#ffffff' : '#000000';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, 252, 60);

    if (!isPolice) {
      ctx.fillStyle = '#0057b7'; ctx.fillRect(4, 4, 32, 28);
      ctx.fillStyle = '#ffd700'; ctx.fillRect(4, 32, 32, 28);
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 16px sans-serif'; ctx.fillText('UA', 8, 42);
      ctx.fillStyle = '#000000'; ctx.font = 'bold 36px monospace'; ctx.fillText(plateNumber, 48, 46);
    } else {
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 36px monospace'; ctx.fillText(plateNumber, 42, 46);
    }
    return new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas) });
  }

  static createWheel(radius = 0.36, width = 0.24) {
    const wheelGroup = new THREE.Group();
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 18), new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
    tire.rotation.z = Math.PI / 2;
    wheelGroup.add(tire);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.65, radius * 0.65, width + 0.01, 12), new THREE.MeshStandardMaterial({ color: 0xdcdde1, metalness: 0.8 }));
    rim.rotation.z = Math.PI / 2;
    wheelGroup.add(rim);
    return wheelGroup;
  }

  // 1. ВАЗ «Жигули»
  static createVAZ2101() {
    const car = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xb93a2b, roughness: 0.4 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, metalness: 0.9 });
    const lower = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.58, 4.1), bodyMat);
    lower.position.y = 0.62; car.add(lower);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.54, 0.52, 2.1), bodyMat);
    cabin.position.set(0, 1.15, -0.15); car.add(cabin);

    const fCr = new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.12, 0.14), chromeMat);
    fCr.position.set(0, 0.45, 2.12); car.add(fCr);
    const rCr = fCr.clone(); rCr.position.z = -2.12; car.add(rCr);

    const lightMat = new THREE.MeshStandardMaterial({ color: 0xffffcc, emissive: 0xfff9b0, emissiveIntensity: 0.7 });
    const lLight = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.05, 12), lightMat);
    lLight.rotation.x = Math.PI / 2;
    lLight.position.set(-0.6, 0.65, 2.06); car.add(lLight);
    const rLight = lLight.clone(); rLight.position.x = 0.6; car.add(rLight);

    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.14), this.createLicensePlateTexture('CB 4821 AK'));
    plate.position.set(0, 0.45, 2.2); car.add(plate);
    return car;
  }

  // 2. Daewoo Lanos
  static createDaewooLanos() {
    const car = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x718093, metalness: 0.4, roughness: 0.3 });
    const lower = new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.55, 4.2), bodyMat);
    lower.position.y = 0.6; car.add(lower);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.54, 2.2), new THREE.MeshPhysicalMaterial({ color: 0x1e272e, transparent: true, opacity: 0.7 }));
    cabin.position.set(0, 1.12, -0.1); car.add(cabin);
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.14), this.createLicensePlateTexture('CB 1904 BC'));
    plate.position.set(0, 0.46, 2.12); car.add(plate);
    return car;
  }

  // 3. Фургон «Нова Пошта»
  static createNovaPoshtaVan() {
    const van = new THREE.Group();
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf5f6fa, roughness: 0.3 });
    const redMat = new THREE.MeshStandardMaterial({ color: 0xed1c24, roughness: 0.3 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.6, 5.2), whiteMat);
    base.position.y = 0.65; van.add(base);
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.92, 1.5, 3.6), whiteMat);
    box.position.set(0, 1.65, -0.65); van.add(box);
    const stripeL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.45, 3.58), redMat);
    stripeL.position.set(-0.97, 1.6, -0.65); van.add(stripeL);
    const stripeR = stripeL.clone(); stripeR.position.x = 0.97; van.add(stripeR);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.85, 1.0, 1.4), whiteMat);
    cabin.position.set(0, 1.35, 1.7); van.add(cabin);
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.14), this.createLicensePlateTexture('CB 7722 AB'));
    plate.position.set(0, 0.48, 2.62); van.add(plate);
    return van;
  }

  // 4. Автобус «Городня — Чернигов»
  static createGorodnyaBus() {
    const bus = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.9, 7.4), new THREE.MeshStandardMaterial({ color: 0xfbc531, roughness: 0.4 }));
    body.position.y = 1.6; bus.add(body);

    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = '#c23616'; ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center'; ctx.fillText('ГОРОДНЯ — ЧЕРНІГІВ', 128, 40);
    const routeSign = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.35), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas) }));
    routeSign.position.set(0, 2.3, 3.72); bus.add(routeSign);

    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.14), this.createLicensePlateTexture('CB 0315 AA'));
    plate.position.set(0, 0.7, 3.73); bus.add(plate);
    return bus;
  }

  // 5. Драг-купе для Аэродрома
  static createDragCoupe() {
    const car = new THREE.Group();
    const neonMat = new THREE.MeshStandardMaterial({ color: 0x9c88ff, metalness: 0.8, roughness: 0.15 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.46, 4.4), neonMat);
    body.position.y = 0.45; car.add(body);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.42, 1.9), new THREE.MeshStandardMaterial({ color: 0x111111 }));
    roof.position.set(0, 0.86, -0.2); car.add(roof);

    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.05, 0.38), new THREE.MeshStandardMaterial({ color: 0x000000 }));
    wing.position.set(0, 1.05, -2.1); car.add(wing);
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.14), this.createLicensePlateTexture('CB 9999 GT'));
    plate.position.set(0, 0.38, 2.22); car.add(plate);
    return car;
  }

  // 6. Патруль Полиции
  static createPoliceCar() {
    const car = new THREE.Group();
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
    const lower = new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.58, 4.3), whiteMat);
    lower.position.y = 0.6; car.add(lower);

    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0057b7'; ctx.fillRect(0, 0, 256, 32);
    ctx.fillStyle = '#ffd700'; ctx.fillRect(0, 32, 256, 32);
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center'; ctx.fillText('ПОЛІЦІЯ', 128, 42);
    const liveryMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas) });

    const decalL = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.4), liveryMat);
    decalL.position.set(-0.89, 0.65, 0); decalL.rotation.y = -Math.PI / 2; car.add(decalL);
    const decalR = decalL.clone(); decalR.position.x = 0.89; decalR.rotation.y = Math.PI / 2; car.add(decalR);

    const redStrobe = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.12, 0.18), new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 2.0 }));
    redStrobe.position.set(-0.25, 1.48, -0.15); car.add(redStrobe); car.redStrobe = redStrobe;
    const blueStrobe = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.12, 0.18), new THREE.MeshStandardMaterial({ color: 0x0066ff, emissive: 0x0066ff, emissiveIntensity: 2.0 }));
    blueStrobe.position.set(0.25, 1.48, -0.15); car.add(blueStrobe); car.blueStrobe = blueStrobe;

    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.14), this.createLicensePlateTexture('0244 11', true));
    plate.position.set(0, 0.46, 2.17); car.add(plate);
    return car;
  }
}

// =============================================================================
// 5. АРКАДНАЯ ФИЗИКА ВОЖДЕНИЯ И СИСТЕМА ДРИФТА
// =============================================================================
class VehiclePhysics {
  constructor(mesh, type, soundEngine) {
    this.mesh = mesh;
    this.type = type;
    this.sound = soundEngine;

    this.speed = 0;
    this.maxSpeed = type === 'drag' ? 42.0 : (type === 'bus' ? 18.0 : (type === 'police' ? 33.0 : 26.0));
    this.acceleration = type === 'drag' ? 24.0 : 14.0;
    this.braking = 28.0;
    this.reverseSpeed = 10.0;
    this.turnAngle = 0;
    this.maxTurnAngle = 0.58;
    this.friction = 0.985;

    this.setupLights();
    this.setupWheels();
  }

  setupWheels() {
    this.wheels = {
      fl: VehicleFactory.createWheel(),
      fr: VehicleFactory.createWheel(),
      rl: VehicleFactory.createWheel(),
      rr: VehicleFactory.createWheel()
    };
    const isBus = this.type === 'bus';
    const track = isBus ? 1.05 : 0.86;
    const wb = isBus ? 2.4 : 1.4;
    this.wheels.fl.position.set(-track, 0.36, wb);
    this.wheels.fr.position.set(track, 0.36, wb);
    this.wheels.rl.position.set(-track, 0.36, -wb);
    this.wheels.rr.position.set(track, 0.36, -wb);
    this.mesh.add(this.wheels.fl, this.wheels.fr, this.wheels.rl, this.wheels.rr);
  }

  setupLights() {
    this.headlightL = new THREE.SpotLight(0xfff6d6, 2.5, 45, Math.PI / 5, 0.3);
    this.headlightL.position.set(-0.6, 0.7, 2.1);
    this.headlightL.target.position.set(-0.6, 0.2, 15);
    this.mesh.add(this.headlightL, this.headlightL.target);

    this.headlightR = new THREE.SpotLight(0xfff6d6, 2.5, 45, Math.PI / 5, 0.3);
    this.headlightR.position.set(0.6, 0.7, 2.1);
    this.headlightR.target.position.set(0.6, 0.2, 15);
    this.mesh.add(this.headlightR, this.headlightR.target);
  }

  update(delta, input, surfaceGrip = 1.0, collisionBoxes = [], particleSystem) {
    const isDrifting = input.handbrake && Math.abs(this.speed) > 5.0;

    if (input.left) this.turnAngle = Math.min(this.maxTurnAngle, this.turnAngle + delta * 3.2);
    else if (input.right) this.turnAngle = Math.max(-this.maxTurnAngle, this.turnAngle - delta * 3.2);
    else this.turnAngle *= Math.max(0, 1 - delta * 6.0);

    this.wheels.fl.rotation.y = this.turnAngle;
    this.wheels.fr.rotation.y = this.turnAngle;

    if (input.forward) {
      this.speed = Math.min(this.maxSpeed * surfaceGrip, this.speed + this.acceleration * delta);
    } else if (input.backward) {
      if (this.speed > 0.5) this.speed = Math.max(0, this.speed - this.braking * delta);
      else this.speed = Math.max(-this.reverseSpeed, this.speed - this.acceleration * 0.6 * delta);
    } else {
      this.speed *= Math.pow(this.friction, delta * 60);
    }

    const yawChange = (this.speed / this.maxSpeed) * this.turnAngle * (isDrifting ? 1.6 : 0.95);
    this.mesh.rotation.y += yawChange * delta * 2.8;

    const rpm = Math.abs(this.speed) / this.maxSpeed;
    this.sound.updateEngine(rpm, input.forward ? 0.8 : 0.2);

    if (isDrifting) {
      this.sound.setDriftSkid(1.0);
      const wPosL = new THREE.Vector3();
      const wPosR = new THREE.Vector3();
      this.wheels.rl.getWorldPosition(wPosL);
      this.wheels.rr.getWorldPosition(wPosR);
      if (particleSystem) {
        particleSystem.spawnTireSmoke(wPosL);
        particleSystem.spawnTireSmoke(wPosR);
        particleSystem.addSkidDecal(wPosL, this.mesh.rotation.y);
        particleSystem.addSkidDecal(wPosR, this.mesh.rotation.y);
      }
    } else {
      this.sound.setDriftSkid(0);
    }

    const wRot = (this.speed / 0.36) * delta;
    this.wheels.fl.children[0].rotation.x += wRot;
    this.wheels.fr.children[0].rotation.x += wRot;
    this.wheels.rl.children[0].rotation.x += wRot;
    this.wheels.rr.children[0].rotation.x += wRot;

    const fwd = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.mesh.rotation.y);
    const nextPos = this.mesh.position.clone().add(fwd.multiplyScalar(this.speed * delta));

    const carBox = new THREE.Box3().setFromObject(this.mesh);
    let hit = false;
    for (let i = 0; i < collisionBoxes.length; i++) {
      if (carBox.intersectsBox(collisionBoxes[i])) {
        hit = true;
        break;
      }
    }

    if (!hit) this.mesh.position.copy(nextPos);
    else {
      if (Math.abs(this.speed) > 3.0) this.sound.playCrash(Math.abs(this.speed));
      this.speed = -this.speed * 0.35;
    }

    if (this.type === 'police' && this.mesh.redStrobe) {
      const flash = Math.floor(Date.now() / 120) % 2 === 0;
      this.mesh.redStrobe.material.emissiveIntensity = flash ? 3.0 : 0.2;
      this.mesh.blueStrobe.material.emissiveIntensity = flash ? 0.2 : 3.0;
    }
  }
}

// =============================================================================
// 6. СИСТЕМА ЧАСТИЦ (ДЫМ И ДЕКАЛИ ШИН)
// =============================================================================
class ParticleSystem3D {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this.decals = [];
    this.smokeGeo = new THREE.SphereGeometry(0.22, 6, 6);
    this.smokeMat = new THREE.MeshBasicMaterial({ color: 0xcccccc, transparent: true, opacity: 0.55 });
    this.skidGeo = new THREE.PlaneGeometry(0.32, 0.8);
    this.skidMat = new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.7, depthWrite: false });
  }

  spawnTireSmoke(pos) {
    if (this.particles.length > 80) return;
    const mesh = new THREE.Mesh(this.smokeGeo, this.smokeMat.clone());
    mesh.position.copy(pos); mesh.position.y = 0.2;
    this.scene.add(mesh);
    this.particles.push({ mesh, life: 0.65, maxLife: 0.65, velocity: new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.9, (Math.random() - 0.5) * 0.4) });
  }

  addSkidDecal(pos, heading) {
    if (this.decals.length > 120) this.scene.remove(this.decals.shift().mesh);
    const mesh = new THREE.Mesh(this.skidGeo, this.skidMat.clone());
    mesh.position.set(pos.x, 0.02, pos.z);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = heading;
    this.scene.add(mesh);
    this.decals.push({ mesh, life: 18.0 });
  }

  update(delta) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= delta;
      p.mesh.position.addScaledVector(p.velocity, delta);
      p.mesh.material.opacity = (p.life / p.maxLife) * 0.45;
      if (p.life <= 0) { this.scene.remove(p.mesh); this.particles.splice(i, 1); }
    }
    for (let i = this.decals.length - 1; i >= 0; i--) {
      const d = this.decals[i];
      d.life -= delta;
      if (d.life <= 0) { this.scene.remove(d.mesh); this.decals.splice(i, 1); }
    }
  }
}

// =============================================================================
// 7. ЖИВОЙ ГОРОД: AI-ТРАФИК, ПЕШЕХОДЫ И ПОЛИЦИЯ
// =============================================================================
class LivingCityAI {
  constructor(scene, collisionBoxes, soundEngine) {
    this.scene = scene;
    this.sound = soundEngine;
    this.trafficCars = [];
    this.pedestrians = [];
    this.policeCars = [];
    this.roadWaypoints = [
      { x: 0, z: -400 }, { x: 0, z: 400 }, { x: -500, z: 0 }, { x: 500, z: 0 }, { x: 300, z: -350 }
    ];
    this.initTraffic();
    this.initPedestrians();
  }

  initTraffic() {
    for (let i = 0; i < 14; i++) {
      const mesh = Math.random() > 0.4 ? VehicleFactory.createDaewooLanos() : VehicleFactory.createVAZ2101();
      const pos = this.roadWaypoints[i % this.roadWaypoints.length];
      mesh.position.set(pos.x + (Math.random() - 0.5) * 60, 0, pos.z + (Math.random() - 0.5) * 80);
      this.scene.add(mesh);
      this.trafficCars.push({ mesh, speed: 8.0 + Math.random() * 5.0, heading: mesh.rotation.y });
    }
  }

  initPedestrians() {
    const matPed = new THREE.MeshLambertMaterial({ color: 0x27ae60 });
    for (let i = 0; i < 28; i++) {
      const ped = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.4, 8), matPed);
      body.position.y = 0.7; ped.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), new THREE.MeshLambertMaterial({ color: 0xf5cba7 }));
      head.position.y = 1.5; ped.add(head);

      const angle = Math.random() * Math.PI * 2;
      ped.position.set(Math.cos(angle) * (40 + Math.random() * 240), 0, Math.sin(angle) * (40 + Math.random() * 240));
      this.scene.add(ped);
      this.pedestrians.push({ group: ped, speed: 1.2 + Math.random() * 0.8, heading: Math.random() * Math.PI * 2, panic: false });
    }
  }

  update(delta, playerPos, wantedStars, particleSystem) {
    this.trafficCars.forEach(car => {
      const fwd = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), car.heading);
      car.mesh.position.addScaledVector(fwd, car.speed * delta);
      if (car.mesh.position.length() > 650) {
        car.heading += Math.PI * 0.85;
        car.mesh.rotation.y = car.heading;
      }
    });

    this.pedestrians.forEach(ped => {
      if (ped.group.position.distanceTo(playerPos) < 14.0 && wantedStars > 0) {
        ped.panic = true;
        ped.heading = Math.atan2(ped.group.position.x - playerPos.x, ped.group.position.z - playerPos.z);
      }
      const spd = ped.panic ? 4.2 : ped.speed;
      ped.group.position.add(new THREE.Vector3(Math.sin(ped.heading), 0, Math.cos(ped.heading)).multiplyScalar(spd * delta));
      ped.group.rotation.y = ped.heading;
    });

    if (wantedStars > 0) {
      this.sound.setPoliceSiren(true);
      if (this.policeCars.length < wantedStars) {
        const copMesh = VehicleFactory.createPoliceCar();
        copMesh.position.set(playerPos.x + 90, 0, playerPos.z + 90);
        this.scene.add(copMesh);
        this.policeCars.push(new VehiclePhysics(copMesh, 'police', this.sound));
      }

      this.policeCars.forEach(cop => {
        const targetHeading = Math.atan2(playerPos.x - cop.mesh.position.x, playerPos.z - cop.mesh.position.z);
        let diff = targetHeading - cop.mesh.rotation.y;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        cop.mesh.rotation.y += Math.sign(diff) * Math.min(Math.abs(diff), delta * 2.2);
        cop.speed = Math.min(28.0, cop.speed + 16.0 * delta);

        const fwd = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), cop.mesh.rotation.y);
        cop.mesh.position.addScaledVector(fwd, cop.speed * delta);

        if (cop.mesh.position.distanceTo(playerPos) < 3.2) {
          this.sound.playCrash(cop.speed);
          cop.speed = -cop.speed * 0.4;
        }
      });
    } else {
      this.sound.setPoliceSiren(false);
      if (this.policeCars.length > 0) this.scene.remove(this.policeCars.pop().mesh);
    }
  }
}

// =============================================================================
// 8. МАГАЗИНЫ («АТБ», «АВРОРА») И 3 СЮЖЕТНЫЕ МИССИИ
// =============================================================================
class ShopAndMissionSystem {
  constructor(scene, soundEngine) {
    this.scene = scene;
    this.sound = soundEngine;
    this.shops = [
      { id: 'atb', name: 'Супермаркет «АТБ» (вул. Чернігівська)', pos: new THREE.Vector3(0, 0, -180), color: 0x0055aa },
      { id: 'avrora', name: 'Магазин «Аврора» (вул. 1-го Травня)', pos: new THREE.Vector3(-90, 0, -80), color: 0xffd700 },
      { id: 'bazar', name: 'Ряди Центрального Ринку', pos: new THREE.Vector3(-220, 0, 40), color: 0xe67e22 }
    ];
    this.currentMission = null;
    this.initShopMarkers();
  }

  initShopMarkers() {
    this.markers = [];
    this.shops.forEach(s => {
      const ring = new THREE.Mesh(
        new THREE.CylinderGeometry(2.0, 2.0, 0.4, 16, 1, true),
        new THREE.MeshBasicMaterial({ color: s.color, wireframe: true, transparent: true, opacity: 0.75 })
      );
      ring.position.copy(s.pos); ring.position.y = 0.2;
      this.scene.add(ring);
      this.markers.push(ring);
    });
  }

  checkShopTriggers(player) {
    for (let s of this.shops) {
      if (player.position.distanceTo(s.pos) < 2.5) return s;
    }
    return null;
  }

  buyItem(player, itemId) {
    const items = {
      hotdog: { cost: 45, hp: 35 },
      coffee: { cost: 25, hp: 15 },
      medkit: { cost: 120, hp: 100 }
    };
    const it = items[itemId];
    if (it && player.money >= it.cost) {
      player.money -= it.cost;
      player.health = Math.min(player.maxHealth, player.health + it.hp);
      this.sound.playPurchase();
      return true;
    }
    return false;
  }

  startMission(id, player) {
    if (id === 1) {
      // 1. «Экспресс с Новой Почты»
      this.currentMission = {
        title: 'Експрес з Нової Пошти',
        timer: 90.0,
        targetPos: new THREE.Vector3(450, 0, 20),
        reward: 850
      };
    } else if (id === 2) {
      // 2. «Король взлетки»
      this.currentMission = {
        title: 'Король злітки (Драг на Аеродромі)',
        timer: 35.0,
        targetPos: new THREE.Vector3(380, 0, -520),
        reward: 1500
      };
    } else if (id === 3) {
      // 3. «Касса Центрального рынка»
      player.wantedStars = 3;
      this.currentMission = {
        title: 'Каса Центрального ринку',
        timer: 60.0,
        targetPos: new THREE.Vector3(-350, 0, 220),
        reward: 2200
      };
    }
  }

  update(delta, player) {
    this.markers.forEach(m => m.rotation.y += delta * 1.5);
    if (this.currentMission) {
      this.currentMission.timer -= delta;
      if (this.currentMission.timer <= 0) {
        alert('Місія провалена: час вийшов!');
        this.currentMission = null;
        return;
      }
      if (player.position.distanceTo(this.currentMission.targetPos) < 14.0) {
        player.money += this.currentMission.reward;
        this.sound.playPurchase();
        alert(`Місія виконана успішно! Нагорода: +${this.currentMission.reward} ₴`);
        this.currentMission = null;
      }
    }
  }
}

// =============================================================================
// 9. ВРАЩАЮЩИЙСЯ 2D-РАДАР И HUD ГОРОДНИ
// =============================================================================
class RadarAndHUD {
  constructor(radarCanvas) {
    this.canvas = radarCanvas;
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
  }

  drawRadar(playerPos, playerHeading, shops, mission, policeCars) {
    if (!this.ctx) return;
    const w = this.canvas.width, h = this.canvas.height;
    const r = w / 2 - 4, scale = 0.22;

    this.ctx.clearRect(0, 0, w, h);
    this.ctx.save();
    this.ctx.translate(w / 2, h / 2);
    this.ctx.beginPath();
    this.ctx.arc(0, 0, r, 0, Math.PI * 2);
    this.ctx.clip();

    this.ctx.fillStyle = '#0f172a';
    this.ctx.fillRect(-w/2, -h/2, w, h);

    this.ctx.rotate(-playerHeading);
    this.ctx.translate(-playerPos.x * scale, -playerPos.z * scale);

    // Река Смяч и озеро Делдачков
    this.ctx.fillStyle = '#0284c7';
    this.ctx.fillRect(-450 * scale, -200 * scale, 900 * scale, 35 * scale);
    this.ctx.beginPath();
    this.ctx.arc(-240 * scale, -280 * scale, 50 * scale, 0, Math.PI * 2);
    this.ctx.fill();

    // Дороги: Шевченко, Черниговская, Аэродром ПАГ-14
    this.ctx.strokeStyle = '#475569';
    this.ctx.lineWidth = 14 * scale;
    this.ctx.beginPath();
    this.ctx.moveTo(0, -600 * scale); this.ctx.lineTo(0, 600 * scale);
    this.ctx.moveTo(-600 * scale, 0); this.ctx.lineTo(600 * scale, 0);
    this.ctx.moveTo(250 * scale, -250 * scale); this.ctx.lineTo(450 * scale, -550 * scale);
    this.ctx.stroke();

    shops.forEach(s => {
      this.ctx.fillStyle = s.id === 'atb' ? '#0070ba' : (s.id === 'avrora' ? '#f1c40f' : '#e67e22');
      this.ctx.beginPath();
      this.ctx.arc(s.pos.x * scale, s.pos.z * scale, 4.5, 0, Math.PI * 2);
      this.ctx.fill();
    });

    if (mission && mission.targetPos) {
      this.ctx.fillStyle = '#f39c12';
      this.ctx.beginPath();
      this.ctx.arc(mission.targetPos.x * scale, mission.targetPos.z * scale, 7.0, 0, Math.PI * 2);
      this.ctx.fill();
    }

    policeCars.forEach(p => {
      const flash = Math.floor(Date.now() / 150) % 2 === 0;
      this.ctx.fillStyle = flash ? '#e74c3c' : '#3498db';
      this.ctx.beginPath();
      this.ctx.arc(p.mesh.position.x * scale, p.mesh.position.z * scale, 4.5, 0, Math.PI * 2);
      this.ctx.fill();
    });

    this.ctx.restore();

    this.ctx.fillStyle = '#2ecc71';
    this.ctx.beginPath();
    this.ctx.moveTo(w / 2, h / 2 - 8);
    this.ctx.lineTo(w / 2 - 6, h / 2 + 7);
    this.ctx.lineTo(w / 2, h / 2 + 4);
    this.ctx.lineTo(w / 2 + 6, h / 2 + 7);
    this.ctx.closePath();
    this.ctx.fill();

    this.ctx.strokeStyle = '#38bdf8';
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2);
    this.ctx.stroke();
  }

  updateHUD(player, vehiclePhysics, mission) {
    const moneyEl = document.getElementById('hud-money');
    if (moneyEl) moneyEl.innerText = `${player.money.toLocaleString()} ₴`;

    const hpBar = document.getElementById('hud-hp-bar');
    if (hpBar) hpBar.style.width = `${player.health}%`;

    const starsEl = document.getElementById('hud-stars');
    if (starsEl) {
      let str = '';
      for (let i = 0; i < 5; i++) str += i < player.wantedStars ? '★ ' : '☆ ';
      starsEl.innerText = str;
    }

    const gpsEl = document.getElementById('hud-gps-district');
    if (gpsEl) {
      let d = 'Центр — перехрестя Шевченка та Чернігівської';
      const pos = player.position;
      if (pos.z < -140) d = 'вул. Чернігівська — Супермаркет «АТБ»';
      else if (pos.x < -150) d = 'вул. 1-го Травня — Центральний Базар';
      else if (pos.x > 300 && pos.z < -250) d = 'Військовий аеродром «Городня» (смуга ПАГ-14)';
      else if (pos.x > 250 && pos.z > 0) d = 'Залізничний Вокзал «Городня»';
      gpsEl.innerText = d;
    }

    const speedoBox = document.getElementById('hud-speedometer');
    if (vehiclePhysics && player.inVehicle) {
      if (speedoBox) speedoBox.style.display = 'block';
      const kmhEl = document.getElementById('hud-speed-value');
      if (kmhEl) kmhEl.innerText = Math.floor(Math.abs(vehiclePhysics.speed) * 3.6);
    } else if (speedoBox) {
      speedoBox.style.display = 'none';
    }

    const missionBox = document.getElementById('hud-mission-info');
    if (mission && missionBox) {
      missionBox.style.display = 'block';
      document.getElementById('hud-mission-title').innerText = mission.title;
      document.getElementById('hud-mission-timer').innerText = `Час: ${Math.ceil(mission.timer)}с`;
    } else if (missionBox) {
      missionBox.style.display = 'none';
    }
  }
}

// =============================================================================
// БЕСШОВНОЕ ПОДКЛЮЧЕНИЕ ЧАСТИ 2 К ЧАСТИ 1 (AUTO-ATTACH)
// =============================================================================
class GorodnyaPart2Engine {
  static attach(worldPart1) {
    if (!worldPart1 || !worldPart1.scene) {
      console.warn('[GorodnyaPart2] worldPart1 не знайдено!');
      return null;
    }

    const scene = worldPart1.scene;
    const camera = worldPart1.camera;
    const renderer = worldPart1.renderer;
    const collisionBoxes = worldPart1.collisionBoxes || [];

    const sound = new SoundEngine();
    const particles = new ParticleSystem3D(scene);
    const player = new CharacterController(scene, sound);
    const tpCamera = new ThirdPersonCamera(camera, renderer.domElement);
    const aiCity = new LivingCityAI(scene, collisionBoxes, sound);
    const shopSystem = new ShopAndMissionSystem(scene, sound);
    const radarHUD = new RadarAndHUD(document.getElementById('radar-canvas'));

    // Спавн 6 уникальных автомобилей Городни
    const vehicles = [];
    const vaz = VehicleFactory.createVAZ2101(); vaz.position.set(-185, 0, 15); scene.add(vaz); vehicles.push({ mesh: vaz, type: 'vaz' });
    const lanos = VehicleFactory.createDaewooLanos(); lanos.position.set(16, 0, -170); scene.add(lanos); vehicles.push({ mesh: lanos, type: 'lanos' });
    const npVan = VehicleFactory.createNovaPoshtaVan(); npVan.position.set(-165, 0, -135); scene.add(npVan); vehicles.push({ mesh: npVan, type: 'np' });
    const bus = VehicleFactory.createGorodnyaBus(); bus.position.set(-14, 0, 30); scene.add(bus); vehicles.push({ mesh: bus, type: 'bus' });
    const drag = VehicleFactory.createDragCoupe(); drag.position.set(340, 0, -220); scene.add(drag); vehicles.push({ mesh: drag, type: 'drag' });
    const police = VehicleFactory.createPoliceCar(); police.position.set(-18, 0, -45); scene.add(police); vehicles.push({ mesh: police, type: 'police' });

    console.log('✅ [GorodnyaPart2Engine] Частина 2 успішно підключена до 3D-світу Городні!');

    return {
      sound, particles, player, tpCamera, aiCity, shopSystem, radarHUD, vehicles
    };
  }
}

window.GorodnyaPart2Engine = GorodnyaPart2Engine;

window.SoundEngine = SoundEngine;
window.CharacterController = CharacterController;
window.ThirdPersonCamera = ThirdPersonCamera;
window.VehicleFactory = VehicleFactory;
window.VehiclePhysics = VehiclePhysics;
window.ParticleSystem3D = ParticleSystem3D;
window.LivingCityAI = LivingCityAI;
window.ShopAndMissionSystem = ShopAndMissionSystem;
window.RadarAndHUD = RadarAndHUD;
