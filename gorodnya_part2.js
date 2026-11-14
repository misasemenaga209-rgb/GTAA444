/**
 * =============================================================================
 * GORODNYA 3D: OPEN WORLD (ЧАСТЬ 2 - GAMEPLAY, VEHICLES, AI, SOUND & MISSIONS)
 * =============================================================================
 * Senior Gameplay, Physics, AI & Audio Architecture (Three.js + Web Audio API)
 * Полная интеграция с картой города Городня (ул. Шевченко, Черниговская, АТБ,
 * Базар, Новая Почта, Вокзал, Аэродром ПАГ-14, Дендропарк, Смяч).
 * =============================================================================
 */

// =============================================================================
// 1. PROCEDURAL SOUND ENGINE (WEB AUDIO API - ZERO EXTERNAL ASSETS)
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

    // Полицейская сирена
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenActive = false;

    // Шаги
    this.stepTimer = 0;
  }

  init() {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioCtx();

    // 1. Подсистема звука двигателя (двойной низкочастотный осциллятор + lowpass)
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

    // 2. Подсистема визга резины при дрифте (фильтрованный розовый/белый шум)
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

    // 3. Подсистема полицейской двухтональной сирены
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
    osc.frequency.setValueAtTime(987.77, t); // B5
    osc.frequency.setValueAtTime(1318.51, t + 0.09); // E6
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

    // Физические параметры
    this.position = new THREE.Vector3(0, 0, 0);
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.heading = 0;
    this.walkSpeed = 4.2;
    this.sprintSpeed = 8.5;
    this.jumpForce = 9.8;
    this.gravity = -24.0;
    this.isGrounded = true;
    this.inVehicle = null;

    // Состояния и анимации
    this.walkCycle = 0;
    this.stepInterval = 0;
    this.health = 100;
    this.maxHealth = 100;
    this.money = 1250; // Стартовые гривны
    this.wantedStars = 0;
    this.wantedTimer = 0;

    this.buildCharacterMesh();
    this.scene.add(this.group);
  }

  buildCharacterMesh() {
    const matSkin = new THREE.MeshLambertMaterial({ color: 0xf5cba7 });
    const matHoodie = new THREE.MeshLambertMaterial({ color: 0x1e293b }); // Стильное темное худи
    const matPants = new THREE.MeshLambertMaterial({ color: 0x334155 });  // Джинсы карго
    const matShoes = new THREE.MeshLambertMaterial({ color: 0xffffff });  // Кроссовки
    const matCap = new THREE.MeshLambertMaterial({ color: 0x0f172a });    // Кепка

    // 1. Корпус / Торс (худи)
    this.torso = new THREE.Group();
    const torsoMesh = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.72, 0.32), matHoodie);
    torsoMesh.position.y = 1.25;
    torsoMesh.castShadow = true;
    this.torso.add(torsoMesh);

    // Капюшон на спине
    const hoodMesh = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.28, 0.18), matHoodie);
    hoodMesh.position.set(0, 1.48, -0.16);
    this.torso.add(hoodMesh);

    // 2. Голова и кепка
    this.head = new THREE.Group();
    this.head.position.set(0, 1.76, 0);
    const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), matSkin);
    headMesh.castShadow = true;
    this.head.add(headMesh);

    const capMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 12), matCap);
    capMesh.position.y = 0.1;
    this.head.add(capMesh);

    const visorMesh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.02, 0.16), matCap);
    visorMesh.position.set(0, 0.08, 0.18);
    this.head.add(visorMesh);
    this.torso.add(this.head);

    // 3. Руки (Плечо + Предплечье + Кисть)
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
    this.rightArm.add(rHand);
    this.torso.add(this.rightArm);

    // 4. Ноги (Бедра + Голень + Кроссовки)
    this.leftLeg = new THREE.Group();
    this.leftLeg.position.set(-0.16, 0.9, 0);
    const lLegMesh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.65, 0.2), matPants);
    lLegMesh.position.y = -0.32;
    lLegMesh.castShadow = true;
    this.leftLeg.add(lLegMesh);
    const lShoe = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.34), matShoes);
    lShoe.position.set(0, -0.68, 0.06);
    this.leftLeg.add(lShoe);
    this.group.add(this.leftLeg);

    this.rightLeg = new THREE.Group();
    this.rightLeg.position.set(0.16, 0.9, 0);
    const rLegMesh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.65, 0.2), matPants);
    rLegMesh.position.y = -0.32;
    rLegMesh.castShadow = true;
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

    // 1. Расчет вектора направления относительно камеры
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

      // Плавный разворот персонажа лицом к движению
      const targetHeading = Math.atan2(moveVector.x, moveVector.z);
      let diff = targetHeading - this.heading;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      this.heading += diff * Math.min(1.0, delta * 12);
      this.group.rotation.y = this.heading;

      this.velocity.x = moveVector.x * currentSpeed;
      this.velocity.z = moveVector.z * currentSpeed;

      // Процедурная скелетная анимация ходьбы/бега
      this.walkCycle += delta * (input.sprint ? 14 : 9);
      const swing = Math.sin(this.walkCycle) * (input.sprint ? 0.75 : 0.45);

      this.leftLeg.rotation.x = swing;
      this.rightLeg.rotation.x = -swing;
      this.leftArm.rotation.x = -swing * 0.9;
      this.rightArm.rotation.x = swing * 0.9;
      this.torso.position.y = Math.abs(Math.sin(this.walkCycle * 2)) * 0.05;

      // Звуки шагов
      this.stepInterval += delta * (input.sprint ? 1.8 : 1.0);
      if (this.stepInterval > 0.38) {
        this.stepInterval = 0;
        this.sound.playFootstep('asphalt');
      }
    } else {
      this.velocity.x = 0;
      this.velocity.z = 0;
      // Плавный сброс в Idle
      this.leftLeg.rotation.x *= 0.85;
      this.rightLeg.rotation.x *= 0.85;
      this.leftArm.rotation.x *= 0.85;
      this.rightArm.rotation.x *= 0.85;
      this.torso.position.y = Math.sin(Date.now() / 400) * 0.015;
    }

    // 2. Прыжок и гравитация
    if (input.jump && this.isGrounded) {
      this.velocity.y = this.jumpForce;
      this.isGrounded = false;
    }

    this.velocity.y += this.gravity * delta;

    // 3. Вычисление перемещения и коллизии с объектами Городни
    const nextPos = this.position.clone();
    nextPos.x += this.velocity.x * delta;
    nextPos.z += this.velocity.z * delta;
    nextPos.y += this.velocity.y * delta;

    // Земля (высота рельефа 0 по умолчанию)
    if (nextPos.y <= 0) {
      nextPos.y = 0;
      this.velocity.y = 0;
      this.isGrounded = true;
    }

    // Проверка коллизий со стенами зданий (Box3)
    const playerRadius = 0.4;
    const playerBox = new THREE.Box3(
      new THREE.Vector3(nextPos.x - playerRadius, nextPos.y, nextPos.z - playerRadius),
      new THREE.Vector3(nextPos.x + playerRadius, nextPos.y + 1.8, nextPos.z + playerRadius)
    );

    let collided = false;
    if (collisionBoxes && collisionBoxes.length) {
      for (let i = 0; i < collisionBoxes.length; i++) {
        if (playerBox.intersectsBox(collisionBoxes[i])) {
          collided = true;
          break;
        }
      }
    }

    if (!collided) {
      this.position.copy(nextPos);
    } else {
      // Скользящая коллизия
      this.position.y = nextPos.y;
    }

    this.group.position.copy(this.position);

    // Таймер сброса звезд розыска
    if (this.wantedStars > 0) {
      this.wantedTimer += delta;
      if (this.wantedTimer > 25.0) { // 25 секунд покоя без нарушений
        this.wantedStars = Math.max(0, this.wantedStars - 1);
        this.wantedTimer = 0;
      }
    }
  }

  damage(amount) {
    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0) {
      // Игрок погиб (Wasted)
      this.position.set(0, 0, 0);
      this.health = 100;
      this.wantedStars = 0;
    }
  }
}

// =============================================================================
// 3. УМНАЯ THIRD-PERSON КАМЕРА
// =============================================================================
class ThirdPersonCamera {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;

    this.target = new THREE.Vector3();
    this.angleX = 0.25; // Тангаж (вертикальный угол)
    this.angleY = 0;    // Рыскание (горизонтальный угол)
    this.distance = 5.5;
    this.targetDistance = 5.5;
    this.isDragging = false;
    this.previousMousePosition = { x: 0, y: 0 };

    this.setupMouseEvents();
  }

  setupMouseEvents() {
    this.domElement.addEventListener('mousedown', e => {
      if (e.button === 0 || e.button === 2) {
        this.isDragging = true;
        this.previousMousePosition = { x: e.clientX, y: e.clientY };
      }
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    window.addEventListener('mousemove', e => {
      if (!this.isDragging) return;
      const deltaX = e.clientX - this.previousMousePosition.x;
      const deltaY = e.clientY - this.previousMousePosition.y;

      this.angleY -= deltaX * 0.0055;
      this.angleX += deltaY * 0.0055;
      this.angleX = Math.max(-0.25, Math.min(1.25, this.angleX));

      this.previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('wheel', e => {
      this.targetDistance += e.deltaY * 0.005;
      this.targetDistance = Math.max(2.8, Math.min(14.0, this.targetDistance));
    });
  }

  update(delta, targetPos, vehicleSpeed = 0, collisionBoxes = []) {
    // В машине камера плавно отдаляется при ускорении
    const dynamicDist = this.targetDistance + (vehicleSpeed / 40.0) * 4.5;
    this.distance += (dynamicDist - this.distance) * (delta * 4.0);

    // Сглаживание точки слежения
    this.target.lerp(new THREE.Vector3(targetPos.x, targetPos.y + 1.4, targetPos.z), delta * 8.0);

    // Идеальная позиция камеры
    const horizontalDist = this.distance * Math.cos(this.angleX);
    const idealX = this.target.x + horizontalDist * Math.sin(this.angleY);
    const idealY = this.target.y + this.distance * Math.sin(this.angleX);
    const idealZ = this.target.z + horizontalDist * Math.cos(this.angleY);
    const idealPos = new THREE.Vector3(idealX, idealY, idealZ);

    // Защита камеры от проникновения сквозь стены (Raycaster)
    const rayDir = new THREE.Vector3().subVectors(idealPos, this.target).normalize();
    const rayLength = this.target.distanceTo(idealPos);
    let finalDist = rayLength;

    if (collisionBoxes && collisionBoxes.length) {
      const ray = new THREE.Ray(this.target, rayDir);
      for (let i = 0; i < collisionBoxes.length; i++) {
        const intersection = ray.intersectBox(collisionBoxes[i], new THREE.Vector3());
        if (intersection) {
          const hitDist = this.target.distanceTo(intersection) - 0.3;
          if (hitDist < finalDist && hitDist > 0.8) {
            finalDist = hitDist;
          }
        }
      }
    }

    const actualPos = this.target.clone().add(rayDir.multiplyScalar(finalDist));
    this.camera.position.lerp(actualPos, Math.min(1.0, delta * 12.0));
    this.camera.lookAt(this.target);
  }
}

// =============================================================================
// 4. АВТОПАРК ГОРОДНИ (VEHICLE FACTORY: 6 УНИКАЛЬНЫХ МОДЕЛЕЙ)
// =============================================================================
class VehicleFactory {
  static createLicensePlateTexture(plateNumber = 'CB 4821 AK', isPolice = false) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    // Фон номерного знака
    ctx.fillStyle = isPolice ? '#003399' : '#ffffff';
    ctx.fillRect(0, 0, 256, 64);
    ctx.strokeStyle = isPolice ? '#ffffff' : '#000000';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, 252, 60);

    if (!isPolice) {
      // Сине-желтый флаг Украины слева
      ctx.fillStyle = '#0057b7';
      ctx.fillRect(4, 4, 32, 28);
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(4, 32, 32, 28);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText('UA', 8, 42);

      // Черный текст номера
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 36px monospace';
      ctx.fillText(plateNumber, 48, 46);
    } else {
      // Полицейский синий номер
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 36px monospace';
      ctx.fillText(plateNumber, 42, 46);
    }

    const texture = new THREE.CanvasTexture(canvas);
    return new THREE.MeshBasicMaterial({ map: texture });
  }

  static createWheel(radius = 0.36, width = 0.24) {
    const wheelGroup = new THREE.Group();
    const tireMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xdcdde1, metalness: 0.8, roughness: 0.2 });

    const tire = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 18), tireMat);
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    wheelGroup.add(tire);

    const rim = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.65, radius * 0.65, width + 0.01, 12), rimMat);
    rim.rotation.z = Math.PI / 2;
    wheelGroup.add(rim);

    return wheelGroup;
  }

  // 1. ВАЗ-2101 «Жигули»
  static createVAZ2101() {
    const car = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xb93a2b, roughness: 0.4 }); // Советский терракотовый
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, metalness: 0.9, roughness: 0.1 });
    const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x222f3e, transparent: true, opacity: 0.65, roughness: 0.1 });

    // Кузов (угловатый классический седан)
    const lowerBody = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.58, 4.1), bodyMat);
    lowerBody.position.y = 0.62;
    lowerBody.castShadow = true;
    car.add(lowerBody);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.54, 0.52, 2.1), bodyMat);
    cabin.position.set(0, 1.15, -0.15);
    car.add(cabin);

    // Хромированные бамперы и решетка
    const fCrBumper = new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.12, 0.14), chromeMat);
    fCrBumper.position.set(0, 0.45, 2.12);
    car.add(fCrBumper);

    const rCrBumper = new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.12, 0.14), chromeMat);
    rCrBumper.position.set(0, 0.45, -2.12);
    car.add(rCrBumper);

    // Круглые фары ВАЗ
    const lightMat = new THREE.MeshStandardMaterial({ color: 0xffffcc, emissive: 0xfff9b0, emissiveIntensity: 0.7 });
    const lLight = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.05, 12), lightMat);
    lLight.rotation.x = Math.PI / 2;
    lLight.position.set(-0.6, 0.65, 2.06);
    const rLight = lLight.clone();
    rLight.position.x = 0.6;
    car.add(lLight);
    car.add(rLight);

    // Украинский номер Черниговской области
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.14), this.createLicensePlateTexture('CB 4821 AK'));
    plate.position.set(0, 0.45, 2.2);
    car.add(plate);

    return car;
  }

  // 2. Daewoo Lanos (Обтекаемый народный седан)
  static createDaewooLanos() {
    const car = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x718093, metalness: 0.4, roughness: 0.3 }); // Популярный серебристый
    const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x1e272e, transparent: true, opacity: 0.7 });

    const lowerBody = new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.55, 4.2), bodyMat);
    lowerBody.position.y = 0.6;
    lowerBody.castShadow = true;
    car.add(lowerBody);

    // Округлые стекла и каплевидная крыша
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.54, 2.2), glassMat);
    cabin.position.set(0, 1.12, -0.1);
    car.add(cabin);

    // Каплевидные фары Lanos
    const headMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfffee0, emissiveIntensity: 0.8 });
    const lHead = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.1), headMat);
    lHead.position.set(-0.62, 0.68, 2.1);
    const rHead = lHead.clone();
    rHead.position.x = 0.62;
    car.add(lHead);
    car.add(rHead);

    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.14), this.createLicensePlateTexture('CB 1904 BC'));
    plate.position.set(0, 0.46, 2.12);
    car.add(plate);

    return car;
  }

  // 3. Фургон «Нова Пошта»
  static createNovaPoshtaVan() {
    const van = new THREE.Group();
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf5f6fa, roughness: 0.3 });
    const redMat = new THREE.MeshStandardMaterial({ color: 0xed1c24, roughness: 0.3 }); // Фирменный красный NP

    // Шасси и высокий кузов
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.6, 5.2), whiteMat);
    base.position.y = 0.65;
    van.add(base);

    const cargoBox = new THREE.Mesh(new THREE.BoxGeometry(1.92, 1.5, 3.6), whiteMat);
    cargoBox.position.set(0, 1.65, -0.65);
    van.add(cargoBox);

    // Красная фирменная полоса с логотипом
    const stripeL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.45, 3.58), redMat);
    stripeL.position.set(-0.97, 1.6, -0.65);
    const stripeR = stripeL.clone();
    stripeR.position.x = 0.97;
    van.add(stripeL);
    van.add(stripeR);

    // Кабина водителя
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.85, 1.0, 1.4), whiteMat);
    cabin.position.set(0, 1.35, 1.7);
    van.add(cabin);

    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.14), this.createLicensePlateTexture('CB 7722 AB'));
    plate.position.set(0, 0.48, 2.62);
    van.add(plate);

    return van;
  }

  // 4. Маршрутный автобус «Городня — Чернигов» (ПАЗ / Эталон)
  static createGorodnyaBus() {
    const bus = new THREE.Group();
    const yellowMat = new THREE.MeshStandardMaterial({ color: 0xfbc531, roughness: 0.4 }); // Автобусный желтый
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x2f3640 });
    const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x353b48, transparent: true, opacity: 0.65 });

    // Кузов автобуса
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.9, 7.4), yellowMat);
    body.position.y = 1.6;
    body.castShadow = true;
    bus.add(body);

    // Остекление салона по бокам
    const windowsL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.72, 6.2), glassMat);
    windowsL.position.set(-1.16, 1.85, -0.2);
    const windowsR = windowsL.clone();
    windowsR.position.x = 1.16;
    bus.add(windowsL);
    bus.add(windowsR);

    // Табличка маршрута: «ГОРОДНЯ — ЧЕРНІГІВ» над стеклом
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = '#c23616'; ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center'; ctx.fillText('ГОРОДНЯ — ЧЕРНІГІВ', 128, 40);
    const routeTex = new THREE.CanvasTexture(canvas);
    const routeSign = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.35), new THREE.MeshBasicMaterial({ map: routeTex }));
    routeSign.position.set(0, 2.3, 3.72);
    bus.add(routeSign);

    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.14), this.createLicensePlateTexture('CB 0315 AA'));
    plate.position.set(0, 0.7, 3.73);
    bus.add(plate);

    return bus;
  }

  // 5. Драг-купе для Аэродрома
  static createDragCoupe() {
    const car = new THREE.Group();
    const neonMat = new THREE.MeshStandardMaterial({ color: 0x9c88ff, metalness: 0.8, roughness: 0.15 }); // Неоновый фиолетовый
    const carbonMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 });

    // Заниженный кузов
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.46, 4.4), neonMat);
    body.position.y = 0.45;
    body.castShadow = true;
    car.add(body);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.42, 1.9), carbonMat);
    roof.position.set(0, 0.86, -0.2);
    car.add(roof);

    // Задний антикрыло / спойлер для драг-рейсинга
    const wingMat = new THREE.MeshStandardMaterial({ color: 0x000000 });
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.05, 0.38), wingMat);
    wing.position.set(0, 1.05, -2.1);
    const postL = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.35), wingMat);
    postL.position.set(-0.6, 0.88, -2.1);
    const postR = postL.clone();
    postR.position.x = 0.6;
    car.add(wing); car.add(postL); car.add(postR);

    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.14), this.createLicensePlateTexture('CB 9999 GT'));
    plate.position.set(0, 0.38, 2.22);
    car.add(plate);

    return car;
  }

  // 6. Патрульный автомобиль Национальной Полиции Украины
  static createPoliceCar() {
    const car = new THREE.Group();
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
    const blueMat = new THREE.MeshStandardMaterial({ color: 0x0057b7 });
    const yellowMat = new THREE.MeshStandardMaterial({ color: 0xffd700 });

    const lowerBody = new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.58, 4.3), whiteMat);
    lowerBody.position.y = 0.6;
    lowerBody.castShadow = true;
    car.add(lowerBody);

    // Сине-желтая ливрея и надпись «ПОЛІЦІЯ»
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0057b7'; ctx.fillRect(0, 0, 256, 32);
    ctx.fillStyle = '#ffd700'; ctx.fillRect(0, 32, 256, 32);
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center'; ctx.fillText('ПОЛІЦІЯ', 128, 42);
    const liveryTex = new THREE.CanvasTexture(canvas);
    const liveryMat = new THREE.MeshBasicMaterial({ map: liveryTex });

    const doorDecalL = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.4), liveryMat);
    doorDecalL.position.set(-0.89, 0.65, 0);
    doorDecalL.rotation.y = -Math.PI / 2;
    const doorDecalR = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.4), liveryMat);
    doorDecalR.position.set(0.89, 0.65, 0);
    doorDecalR.rotation.y = Math.PI / 2;
    car.add(doorDecalL);
    car.add(doorDecalR);

    // Крыша
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 2.1), whiteMat);
    cabin.position.set(0, 1.12, -0.15);
    car.add(cabin);

    // Светодиодная люстра-мигалка (Красный + Синий стробы)
    const barMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
    const lightBarBase = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.22), barMat);
    lightBarBase.position.set(0, 1.42, -0.15);
    car.add(lightBarBase);

    const redStrobe = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.12, 0.18), new THREE.MeshStandardMaterial({
      color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 2.0
    }));
    redStrobe.position.set(-0.25, 1.48, -0.15);
    car.add(redStrobe);
    car.redStrobe = redStrobe;

    const blueStrobe = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.12, 0.18), new THREE.MeshStandardMaterial({
      color: 0x0066ff, emissive: 0x0066ff, emissiveIntensity: 2.0
    }));
    blueStrobe.position.set(0.25, 1.48, -0.15);
    car.add(blueStrobe);
    car.blueStrobe = blueStrobe;

    // Синий украинский полицейский номер
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.14), this.createLicensePlateTexture('0244 11', true));
    plate.position.set(0, 0.46, 2.17);
    car.add(plate);

    return car;
  }
}

// =============================================================================
// 5. ФИЗИКА АВТОМОБИЛЯ И СИСТЕМА ДРИФТА
// =============================================================================
class VehiclePhysics {
  constructor(mesh, type, soundEngine) {
    this.mesh = mesh;
    this.type = type;
    this.sound = soundEngine;

    // Параметры динамики
    this.speed = 0;
    this.maxSpeed = type === 'drag' ? 42.0 : (type === 'bus' ? 18.0 : (type === 'police' ? 33.0 : 26.0));
    this.acceleration = type === 'drag' ? 24.0 : 14.0;
    this.braking = 28.0;
    this.reverseSpeed = 10.0;
    this.turnAngle = 0;
    this.maxTurnAngle = 0.58;
    this.angularVelocity = 0;
    this.friction = 0.985;
    this.driftFactor = 0.94;
    this.slipAngle = 0;

    // Фары и стоп-сигналы
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
    const wheelbase = isBus ? 2.4 : 1.4;

    this.wheels.fl.position.set(-track, 0.36, wheelbase);
    this.wheels.fr.position.set(track, 0.36, wheelbase);
    this.wheels.rl.position.set(-track, 0.36, -wheelbase);
    this.wheels.rr.position.set(track, 0.36, -wheelbase);

    this.mesh.add(this.wheels.fl);
    this.mesh.add(this.wheels.fr);
    this.mesh.add(this.wheels.rl);
    this.mesh.add(this.wheels.rr);
  }

  setupLights() {
    // Две фары дальнего света (SpotLight)
    this.headlightL = new THREE.SpotLight(0xfff6d6, 2.5, 45, Math.PI / 5, 0.3);
    this.headlightL.position.set(-0.6, 0.7, 2.1);
    this.headlightL.target.position.set(-0.6, 0.2, 15);

    this.headlightR = new THREE.SpotLight(0xfff6d6, 2.5, 45, Math.PI / 5, 0.3);
    this.headlightR.position.set(0.6, 0.7, 2.1);
    this.headlightR.target.position.set(0.6, 0.2, 15);

    this.mesh.add(this.headlightL);
    this.mesh.add(this.headlightL.target);
    this.mesh.add(this.headlightR);
    this.mesh.add(this.headlightR.target);
  }

  update(delta, input, surfaceGrip = 1.0, collisionBoxes = [], particleSystem) {
    const isDrifting = input.handbrake && Math.abs(this.speed) > 5.0;

    // 1. Рулевое управление с возвратом колес в центр
    if (input.left) {
      this.turnAngle = Math.min(this.maxTurnAngle, this.turnAngle + delta * 3.2);
    } else if (input.right) {
      this.turnAngle = Math.max(-this.maxTurnAngle, this.turnAngle - delta * 3.2);
    } else {
      this.turnAngle *= Math.max(0, 1 - delta * 6.0);
    }

    // Поворот передних колес
    this.wheels.fl.rotation.y = this.turnAngle;
    this.wheels.fr.rotation.y = this.turnAngle;

    // 2. Ускорение и торможение
    if (input.forward) {
      this.speed = Math.min(this.maxSpeed * surfaceGrip, this.speed + this.acceleration * delta);
    } else if (input.backward) {
      if (this.speed > 0.5) {
        this.speed = Math.max(0, this.speed - this.braking * delta);
      } else {
        this.speed = Math.max(-this.reverseSpeed, this.speed - this.acceleration * 0.6 * delta);
      }
    } else {
      this.speed *= Math.pow(this.friction, delta * 60);
    }

    // 3. Механика заноса задней оси (Дрифт)
    const turnSensitivity = isDrifting ? 1.6 : 0.95;
    const yawChange = (this.speed / this.maxSpeed) * this.turnAngle * turnSensitivity;
    this.mesh.rotation.y += yawChange * delta * 2.8;

    // Звуки двигателя и дрифта
    const rpm = Math.abs(this.speed) / this.maxSpeed;
    this.sound.updateEngine(rpm, input.forward ? 0.8 : 0.2);

    if (isDrifting) {
      this.sound.setDriftSkid(1.0);
      // Генерация 3D-дыма из-под колес
      const worldPosL = new THREE.Vector3();
      const worldPosR = new THREE.Vector3();
      this.wheels.rl.getWorldPosition(worldPosL);
      this.wheels.rr.getWorldPosition(worldPosR);
      particleSystem.spawnTireSmoke(worldPosL);
      particleSystem.spawnTireSmoke(worldPosR);
      particleSystem.addSkidDecal(worldPosL, this.mesh.rotation.y);
      particleSystem.addSkidDecal(worldPosR, this.mesh.rotation.y);
    } else {
      this.sound.setDriftSkid(0);
    }

    // Вращение колес по оси X
    const wheelRotDelta = (this.speed / 0.36) * delta;
    this.wheels.fl.children[0].rotation.x += wheelRotDelta;
    this.wheels.fr.children[0].rotation.x += wheelRotDelta;
    this.wheels.rl.children[0].rotation.x += wheelRotDelta;
    this.wheels.rr.children[0].rotation.x += wheelRotDelta;

    // 4. Движение с проверкой столкновения с домами Городни
    const forwardVec = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.mesh.rotation.y);
    const nextPos = this.mesh.position.clone().add(forwardVec.multiplyScalar(this.speed * delta));

    const carBox = new THREE.Box3().setFromObject(this.mesh);
    carBox.min.add(new THREE.Vector3(0.2, 0, 0.2));
    carBox.max.sub(new THREE.Vector3(0.2, 0, 0.2));

    let hit = false;
    for (let i = 0; i < collisionBoxes.length; i++) {
      if (carBox.intersectsBox(collisionBoxes[i])) {
        hit = true;
        break;
      }
    }

    if (!hit) {
      this.mesh.position.copy(nextPos);
    } else {
      if (Math.abs(this.speed) > 3.0) {
        this.sound.playCrash(Math.abs(this.speed));
      }
      this.speed = -this.speed * 0.35; // Отскок при ударе
    }

    // Анимация полицейской люстры
    if (this.type === 'police' && this.mesh.redStrobe && this.mesh.blueStrobe) {
      const flash = Math.floor(Date.now() / 120) % 2 === 0;
      this.mesh.redStrobe.material.emissiveIntensity = flash ? 3.0 : 0.2;
      this.mesh.blueStrobe.material.emissiveIntensity = flash ? 0.2 : 3.0;
    }
  }
}

// =============================================================================
// 6. СИСТЕМА 3D ЧАСТИЦ (ДЫМ ИЗ-ПОД ШИН И СЛЕДЫ ПРОТЕКТОРА)
// =============================================================================
class ParticleSystem3D {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this.decals = [];

    // Общий инстанс материала дыма
    this.smokeGeo = new THREE.SphereGeometry(0.22, 6, 6);
    this.smokeMat = new THREE.MeshBasicMaterial({
      color: 0xcccccc,
      transparent: true,
      opacity: 0.55
    });

    // Плоскость следа протектора (Decal)
    this.skidGeo = new THREE.PlaneGeometry(0.32, 0.8);
    this.skidMat = new THREE.MeshBasicMaterial({
      color: 0x111111,
      transparent: true,
      opacity: 0.7,
      depthWrite: false
    });
  }

  spawnTireSmoke(worldPos) {
    if (this.particles.length > 80) return;
    const mesh = new THREE.Mesh(this.smokeGeo, this.smokeMat.clone());
    mesh.position.copy(worldPos);
    mesh.position.y = 0.2;
    this.scene.add(mesh);

    this.particles.push({
      mesh: mesh,
      life: 0.65,
      maxLife: 0.65,
      scaleSpeed: 2.2,
      velocity: new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.8 + Math.random() * 0.5, (Math.random() - 0.5) * 0.4)
    });
  }

  addSkidDecal(pos, carHeading) {
    if (this.decals.length > 120) {
      const old = this.decals.shift();
      this.scene.remove(old.mesh);
    }
    const mesh = new THREE.Mesh(this.skidGeo, this.skidMat.clone());
    mesh.position.set(pos.x, 0.02, pos.z);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = carHeading;
    this.scene.add(mesh);

    this.decals.push({ mesh: mesh, life: 18.0 });
  }

  update(delta) {
    // Обновление дыма
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= delta;
      p.mesh.position.addScaledVector(p.velocity, delta);
      const s = 1.0 + (1.0 - p.life / p.maxLife) * p.scaleSpeed;
      p.mesh.scale.set(s, s, s);
      p.mesh.material.opacity = (p.life / p.maxLife) * 0.45;

      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.particles.splice(i, 1);
      }
    }

    // Медленное угасание следов резины
    for (let i = this.decals.length - 1; i >= 0; i--) {
      const d = this.decals[i];
      d.life -= delta;
      if (d.life < 4.0) {
        d.mesh.material.opacity = (d.life / 4.0) * 0.7;
      }
      if (d.life <= 0) {
        this.scene.remove(d.mesh);
        this.decals.splice(i, 1);
      }
    }
  }
}

// =============================================================================
// 7. ЖИВОЙ ГОРОД: AI-ТРАФИК, ПЕШЕХОДЫ И ПОЛИЦИЯ ГОРОДНИ
// =============================================================================
class LivingCityAI {
  constructor(scene, collisionBoxes, soundEngine) {
    this.scene = scene;
    this.collisionBoxes = collisionBoxes;
    this.sound = soundEngine;

    this.trafficCars = [];
    this.pedestrians = [];
    this.policeCars = [];

    // Основные дорожные артерии Городни для спавна AI трафика
    this.roadWaypoints = [
      { x: 0, z: -400, dir: 'N' },     // ул. Черниговская (к АТБ)
      { x: 0, z: 400, dir: 'S' },
      { x: -500, z: 0, dir: 'W' },     // ул. Шевченко (к Базару)
      { x: 500, z: 0, dir: 'E' },      // дорога к Вокзалу
      { x: 300, z: -350, dir: 'SE' }   // выезд к Аэродрому
    ];

    this.initTraffic();
    this.initPedestrians();
  }

  initTraffic() {
    for (let i = 0; i < 14; i++) {
      const isLanos = Math.random() > 0.4;
      const mesh = isLanos ? VehicleFactory.createDaewooLanos() : VehicleFactory.createVAZ2101();
      const pos = this.roadWaypoints[i % this.roadWaypoints.length];
      mesh.position.set(pos.x + (Math.random() - 0.5) * 60, 0, pos.z + (Math.random() - 0.5) * 80);
      mesh.rotation.y = Math.random() * Math.PI * 2;
      this.scene.add(mesh);

      this.trafficCars.push({
        mesh: mesh,
        speed: 8.0 + Math.random() * 5.0,
        targetPos: new THREE.Vector3(pos.x, 0, pos.z),
        heading: mesh.rotation.y
      });
    }
  }

  initPedestrians() {
    const matPed = new THREE.MeshLambertMaterial({ color: 0x27ae60 });
    for (let i = 0; i < 28; i++) {
      const ped = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.4, 8), matPed);
      body.position.y = 0.7;
      ped.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), new THREE.MeshLambertMaterial({ color: 0xf5cba7 }));
      head.position.y = 1.5;
      ped.add(head);

      // Спавн вокруг торговых точек Городни
      const angle = Math.random() * Math.PI * 2;
      const dist = 30 + Math.random() * 250;
      ped.position.set(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);
      this.scene.add(ped);

      this.pedestrians.push({
        group: ped,
        speed: 1.2 + Math.random() * 0.8,
        heading: Math.random() * Math.PI * 2,
        panic: false,
        panicTimer: 0
      });
    }
  }

  update(delta, playerPos, wantedStars, particleSystem) {
    // 1. Обновление AI Трафика
    this.trafficCars.forEach(car => {
      const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), car.heading);
      car.mesh.position.addScaledVector(forward, car.speed * delta);

      // Простой поворот в границах города
      if (car.mesh.position.length() > 650) {
        car.heading += Math.PI * 0.85;
        car.mesh.rotation.y = car.heading;
      }
    });

    // 2. Обновление пешеходов (убегают при опасности)
    this.pedestrians.forEach(ped => {
      const distToPlayer = ped.group.position.distanceTo(playerPos);
      if (distToPlayer < 14.0 && wantedStars > 0) {
        ped.panic = true;
        ped.panicTimer = 8.0;
        ped.heading = Math.atan2(ped.group.position.x - playerPos.x, ped.group.position.z - playerPos.z);
      }

      if (ped.panic) {
        ped.panicTimer -= delta;
        if (ped.panicTimer <= 0) ped.panic = false;
      }

      const spd = ped.panic ? 4.2 : ped.speed;
      const move = new THREE.Vector3(Math.sin(ped.heading), 0, Math.cos(ped.heading)).multiplyScalar(spd * delta);
      ped.group.position.add(move);
      ped.group.rotation.y = ped.heading;
    });

    // 3. Подсистема патрульной полиции при звездах розыска
    if (wantedStars > 0) {
      this.sound.setPoliceSiren(true);

      // Спавн патрульного экипажа, если их мало
      if (this.policeCars.length < wantedStars) {
        const copMesh = VehicleFactory.createPoliceCar();
        const spawnAng = Math.random() * Math.PI * 2;
        copMesh.position.set(playerPos.x + Math.cos(spawnAng) * 90, 0, playerPos.z + Math.sin(spawnAng) * 90);
        this.scene.add(copMesh);

        const copPhysics = new VehiclePhysics(copMesh, 'police', this.sound);
        this.policeCars.push(copPhysics);
      }

      // Преследование игрока
      this.policeCars.forEach(cop => {
        const targetHeading = Math.atan2(playerPos.x - cop.mesh.position.x, playerPos.z - cop.mesh.position.z);
        let diff = targetHeading - cop.mesh.rotation.y;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;

        cop.mesh.rotation.y += Math.sign(diff) * Math.min(Math.abs(diff), delta * 2.2);
        cop.speed = Math.min(28.0, cop.speed + 16.0 * delta);

        const fwd = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), cop.mesh.rotation.y);
        cop.mesh.position.addScaledVector(fwd, cop.speed * delta);

        // Таран
        if (cop.mesh.position.distanceTo(playerPos) < 3.2) {
          this.sound.playCrash(cop.speed);
          cop.speed = -cop.speed * 0.4;
        }
      });
    } else {
      this.sound.setPoliceSiren(false);
      // Удаление лишних патрулей
      if (this.policeCars.length > 0) {
        const oldCop = this.policeCars.pop();
        this.scene.remove(oldCop.mesh);
      }
    }
  }
}

// =============================================================================
// 8. МАГАЗИНЫ, ЭКОНОМИКА (₴) И СЮЖЕТНЫЕ МИССИИ ГОРОДНИ
// =============================================================================
class ShopAndMissionSystem {
  constructor(scene, soundEngine) {
    this.scene = scene;
    this.sound = soundEngine;

    // Магазины Городни с 3D маркерами входа
    this.shops = [
      { id: 'atb', name: 'Супермаркет «АТБ» (ул. Черниговская)', pos: new THREE.Vector3(0, 0, -180), color: 0x0055aa },
      { id: 'avrora', name: 'Магазин «Аврора» (ул. 1-го Мая)', pos: new THREE.Vector3(-90, 0, -80), color: 0xffd700 },
      { id: 'bazar', name: 'Ряды Центрального Рынка', pos: new THREE.Vector3(-220, 0, 40), color: 0xe67e22 }
    ];

    this.initShopMarkers();

    // 3 Сюжетные миссии
    this.currentMission = null;
    this.missionTimer = 0;
    this.missionStep = 0;
  }

  initShopMarkers() {
    this.markers = [];
    this.shops.forEach(s => {
      const ringGeo = new THREE.CylinderGeometry(2.0, 2.0, 0.4, 16, 1, true);
      const ringMat = new THREE.MeshBasicMaterial({ color: s.color, wireframe: true, transparent: true, opacity: 0.75 });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.copy(s.pos);
      ring.position.y = 0.2;
      this.scene.add(ring);
      this.markers.push(ring);
    });
  }

  checkShopTriggers(player) {
    for (let s of this.shops) {
      if (player.position.distanceTo(s.pos) < 2.5) {
        return s;
      }
    }
    return null;
  }

  buyItem(player, itemId) {
    const items = {
      hotdog: { name: 'Хот-дог з АТБ', cost: 45, hp: 35 },
      coffee: { name: 'Кава Американо', cost: 25, hp: 15 },
      medkit: { name: 'Аптечка з Аврори', cost: 120, hp: 100 }
    };

    const item = items[itemId];
    if (item && player.money >= item.cost) {
      player.money -= item.cost;
      player.health = Math.min(player.maxHealth, player.health + item.hp);
      this.sound.playPurchase();
      return true;
    }
    return false;
  }

  startMission(id, player) {
    if (id === 1) {
      // «Экспресс с Новой Почты»
      this.currentMission = {
        id: 1,
        title: 'Експрес з Нової Пошти',
        desc: 'Довезіть терміновий вантаж від відділення №2 до перону Вокзалу за 90 секунд!',
        timer: 90.0,
        targetPos: new THREE.Vector3(450, 0, 20), // Ж/Д Вокзал
        reward: 850
      };
    } else if (id === 2) {
      // «Король взлетки»
      this.currentMission = {
        id: 2,
        title: 'Король злітки (Драг на Аеродромі)',
        desc: 'Виграйте прямий заїзд уздовж бетонної смуги ПАГ-14 проти спорткупе!',
        timer: 35.0,
        targetPos: new THREE.Vector3(380, 0, -520), // Конец взлетки
        reward: 1500
      };
    } else if (id === 3) {
      // «Касса Центрального рынка»
      player.wantedStars = 3; // Немедленная погоня
      this.currentMission = {
        id: 3,
        title: 'Каса Центрального ринку',
        desc: 'Відірвіться від 3 зірок поліції Городні у провулках приватного сектору!',
        timer: 60.0,
        targetPos: new THREE.Vector3(-350, 0, 220), // Укрытие в частном секторе
        reward: 2200
      };
    }
  }

  update(delta, player) {
    // Вращение маркеров магазинов
    this.markers.forEach(m => {
      m.rotation.y += delta * 1.5;
    });

    if (this.currentMission) {
      this.currentMission.timer -= delta;
      if (this.currentMission.timer <= 0) {
        alert('Місія провалена: час вийшов!');
        this.currentMission = null;
        return;
      }

      // Проверка достижения финишного маркера
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
// 9. ВРАЩАЮЩИЙСЯ 2D-РАДАР ГОРОДНИ И HUD
// =============================================================================
class RadarAndHUD {
  constructor(radarCanvas) {
    this.canvas = radarCanvas;
    this.ctx = this.canvas.getContext('2d');
  }

  drawRadar(playerPos, playerHeading, shops, mission, policeCars) {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const r = w / 2 - 4;
    const scale = 0.22; // Масштаб радара

    this.ctx.clearRect(0, 0, w, h);

    this.ctx.save();
    this.ctx.translate(w / 2, h / 2);

    // Круглая маска радара
    this.ctx.beginPath();
    this.ctx.arc(0, 0, r, 0, Math.PI * 2);
    this.ctx.clip();

    // Заливка фона (темный военный интерфейс)
    this.ctx.fillStyle = '#0f172a';
    this.ctx.fillRect(-w/2, -h/2, w, h);

    // Вращение карты против угла игрока
    this.ctx.rotate(-playerHeading);
    this.ctx.translate(-playerPos.x * scale, -playerPos.z * scale);

    // 1. Отрисовка речки Смяч и озера Делдачков
    this.ctx.fillStyle = '#0284c7';
    this.ctx.fillRect(-450 * scale, -200 * scale, 900 * scale, 35 * scale); // Река Смяч
    this.ctx.beginPath();
    this.ctx.arc(-240 * scale, -280 * scale, 50 * scale, 0, Math.PI * 2);  // Озеро Делдачков
    this.ctx.fill();

    // 2. Отрисовка дорожной сетки Городни (Шевченко, Черниговская, Вокзальная)
    this.ctx.strokeStyle = '#475569';
    this.ctx.lineWidth = 14 * scale;

    this.ctx.beginPath();
    // ул. Черниговская
    this.ctx.moveTo(0, -600 * scale); this.ctx.lineTo(0, 600 * scale);
    // ул. Шевченко
    this.ctx.moveTo(-600 * scale, 0); this.ctx.lineTo(600 * scale, 0);
    // Бетонная полоса аэродрома ПАГ-14 (юго-восток)
    this.ctx.moveTo(250 * scale, -250 * scale); this.ctx.lineTo(450 * scale, -550 * scale);
    this.ctx.stroke();

    // 3. Иконки магазинов (АТБ, Аврора, Базар)
    shops.forEach(s => {
      this.ctx.fillStyle = s.id === 'atb' ? '#0070ba' : (s.id === 'avrora' ? '#f1c40f' : '#e67e22');
      this.ctx.beginPath();
      this.ctx.arc(s.pos.x * scale, s.pos.z * scale, 4.5, 0, Math.PI * 2);
      this.ctx.fill();
    });

    // 4. Маркер миссии (желтый маяк)
    if (mission && mission.targetPos) {
      this.ctx.fillStyle = '#f39c12';
      this.ctx.beginPath();
      this.ctx.arc(mission.targetPos.x * scale, mission.targetPos.z * scale, 7.0, 0, Math.PI * 2);
      this.ctx.fill();
    }

    // 5. Мигающие точки полиции
    policeCars.forEach(p => {
      const flash = Math.floor(Date.now() / 150) % 2 === 0;
      this.ctx.fillStyle = flash ? '#e74c3c' : '#3498db';
      this.ctx.beginPath();
      this.ctx.arc(p.mesh.position.x * scale, p.mesh.position.z * scale, 4.5, 0, Math.PI * 2);
      this.ctx.fill();
    });

    this.ctx.restore();

    // 6. Стрелка игрока в центре радара (всегда указывает строго вверх)
    this.ctx.fillStyle = '#2ecc71';
    this.ctx.beginPath();
    this.ctx.moveTo(w / 2, h / 2 - 8);
    this.ctx.lineTo(w / 2 - 6, h / 2 + 7);
    this.ctx.lineTo(w / 2, h / 2 + 4);
    this.ctx.lineTo(w / 2 + 6, h / 2 + 7);
    this.ctx.closePath();
    this.ctx.fill();

    // Ободок радара
    this.ctx.strokeStyle = '#38bdf8';
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2);
    this.ctx.stroke();
  }

  updateHUD(player, vehiclePhysics, mission) {
    // Деньги
    const moneyEl = document.getElementById('hud-money');
    if (moneyEl) moneyEl.innerText = `${player.money.toLocaleString()} ₴`;

    // Здоровье
    const hpBar = document.getElementById('hud-hp-bar');
    if (hpBar) hpBar.style.width = `${player.health}%`;

    // Звезды розыска
    const starsEl = document.getElementById('hud-stars');
    if (starsEl) {
      let starsStr = '';
      for (let i = 0; i < 5; i++) {
        starsStr += i < player.wantedStars ? '★ ' : '☆ ';
      }
      starsEl.innerText = starsStr;
    }

    // GPS индикатор района
    const gpsEl = document.getElementById('hud-gps-district');
    if (gpsEl) {
      let district = 'Центр — перехрестя Шевченка та Чернігівської';
      const pos = player.position;
      if (pos.z < -140) district = 'вул. Чернігівська — Супермаркет «АТБ»';
      else if (pos.x < -150) district = 'вул. 1-го Травня — Центральний Базар';
      else if (pos.x > 300 && pos.z < -250) district = 'Військовий аеродром «Городня» (смуга ПАГ-14)';
      else if (pos.x > 250 && pos.z > 0) district = 'Залізничний Вокзал «Городня»';
      gpsEl.innerText = district;
    }

    // Спидометр
    const speedoBox = document.getElementById('hud-speedometer');
    if (vehiclePhysics && player.inVehicle) {
      if (speedoBox) speedoBox.style.display = 'block';
      const kmh = Math.floor(Math.abs(vehiclePhysics.speed) * 3.6);
      const kmhEl = document.getElementById('hud-speed-value');
      if (kmhEl) kmhEl.innerText = kmh;
    } else if (speedoBox) {
      speedoBox.style.display = 'none';
    }

    // Таймер миссии
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
