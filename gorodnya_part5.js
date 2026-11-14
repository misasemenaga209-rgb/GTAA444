/**
 * =============================================================================
 * GORODNYA 3D: OPEN WORLD (ЧАСТЬ 5 - PERFORMANCE & WORLD POLISH)
 * =============================================================================
 * Principal Engine Optimization Engineer & Gameplay Polish Lead (Three.js / WebGL)
 * 1. Система оптимизации (Dynamic LOD & Chunk Streaming 250x250м, InstancedMesh, Object Pooling)
 * 2. Разрушаемое окружение (Destructible Props: заборы, знаки, урны, столбы)
 * 3. Автомобильное радио (Procedural Synth Radio: «Городня FM», «Ретро-Шансон», «Поліцейська хвиля»)
 * 4. Свободные активности (Курьер Новой Почты, Режим Такси, Рыбалка на озере Делдачков)
 * 5. Главное меню и стартовый экран с облетающей 3D-камерой и настройками графики (60 FPS Lock)
 * =============================================================================
 */

// =============================================================================
// 1. СИСТЕМА ОПТИМИЗАЦИИ (CHUNK STREAMING, INSTANCING, OBJECT POOLING)
// =============================================================================
class ChunkLODManager {
  constructor(scene) {
    this.scene = scene;
    this.chunkSize = 250; // Чанки 250x250м
    this.chunks = new Map(); // key: "x,z" -> { lod0: [], lod1: [] }
    this.activeChunks = new Set();
  }

  getChunkKey(x, z) {
    const cx = Math.floor(x / this.chunkSize);
    const cz = Math.floor(z / this.chunkSize);
    return `${cx},${cz}`;
  }

  registerObject(x, z, objLOD0, objLOD1 = null) {
    const key = this.getChunkKey(x, z);
    if (!this.chunks.has(key)) {
      this.chunks.set(key, { lod0: [], lod1: [] });
    }
    const chunk = this.chunks.get(key);
    chunk.lod0.push(objLOD0);
    if (objLOD1) chunk.lod1.push(objLOD1);
  }

  update(playerPos) {
    const playerCX = Math.floor(playerPos.x / this.chunkSize);
    const playerCZ = Math.floor(playerPos.z / this.chunkSize);

    // Радиус стриминга: 4 чанка вокруг игрока (~1000м)
    const streamRadius = 4;
    const currentActiveKeys = new Set();

    for (let dx = -streamRadius; dx <= streamRadius; dx++) {
      for (let dz = -streamRadius; dz <= streamRadius; dz++) {
        const key = `${playerCX + dx},${playerCZ + dz}`;
        if (this.chunks.has(key)) {
          currentActiveKeys.add(key);
          const chunk = this.chunks.get(key);
          const chunkWorldX = (playerCX + dx + 0.5) * this.chunkSize;
          const chunkWorldZ = (playerCZ + dz + 0.5) * this.chunkSize;
          const dist = Math.hypot(playerPos.x - chunkWorldX, playerPos.z - chunkWorldZ);

          // LOD0 (< 350м): Полная детализация
          if (dist < 350) {
            chunk.lod0.forEach(obj => { obj.visible = true; });
            chunk.lod1.forEach(obj => { obj.visible = false; });
          }
          // LOD1 (350м - 800м): Упрощенная геометрия
          else if (dist < 800) {
            chunk.lod0.forEach(obj => { obj.visible = false; });
            chunk.lod1.forEach(obj => { obj.visible = true; });
          }
          // > 800м: Куллинг (скрывается в тумане)
          else {
            chunk.lod0.forEach(obj => { obj.visible = false; });
            chunk.lod1.forEach(obj => { obj.visible = false; });
          }
        }
      }
    }

    // Скрытие выгруженных чанков
    this.activeChunks.forEach(key => {
      if (!currentActiveKeys.has(key)) {
        const chunk = this.chunks.get(key);
        chunk.lod0.forEach(obj => { obj.visible = false; });
        chunk.lod1.forEach(obj => { obj.visible = false; });
      }
    });

    this.activeChunks = currentActiveKeys;
  }
}

// Пул объектов (Object Pool) для частиц без нагрузки на Garbage Collector
class ObjectPool {
  constructor(createFn, initialSize = 100) {
    this.createFn = createFn;
    this.pool = [];
    for (let i = 0; i < initialSize; i++) {
      const item = this.createFn();
      item.active = false;
      this.pool.push(item);
    }
  }

  get() {
    for (let i = 0; i < this.pool.length; i++) {
      if (!this.pool[i].active) {
        this.pool[i].active = true;
        return this.pool[i];
      }
    }
    // Расширение пула при необходимости
    const newItem = this.createFn();
    newItem.active = true;
    this.pool.push(newItem);
    return newItem;
  }

  release(item) {
    item.active = false;
  }
}

// =============================================================================
// 2. РАЗРУШАЕМОЕ ОКРУЖЕНИЕ (DESTRUCTIBLE PROPS)
// =============================================================================
class DestructiblePropSystem {
  constructor(scene, soundEngine) {
    this.scene = scene;
    this.sound = soundEngine;
    this.props = [];

    this.initProps();
  }

  initProps() {
    // 1. Дорожные знаки («Головна дорога», «Городня»)
    const signMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x718093, metalness: 0.8 });

    const signCoords = [
      { x: 10, z: -15, rot: 0, text: 'ГОРОДНЯ' },
      { x: -10, z: 15, rot: Math.PI, text: 'ГОЛОВНА ДОРОГА' },
      { x: 10, z: -170, rot: -Math.PI/2, text: 'АТБ' },
      { x: 330, z: -210, rot: 0, text: 'АЕРОДРОМ' }
    ];

    signCoords.forEach(sc => {
      const propGroup = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.6), poleMat);
      pole.position.y = 1.3;
      propGroup.add(pole);

      const signBoard = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.5, 0.05), signMat);
      signBoard.position.set(0, 2.2, 0);
      propGroup.add(signBoard);

      propGroup.position.set(sc.x, 0, sc.z);
      propGroup.rotation.y = sc.rot;
      this.scene.add(propGroup);

      this.props.push({
        group: propGroup,
        originPos: propGroup.position.clone(),
        originRot: propGroup.rotation.clone(),
        isBroken: false,
        velocity: new THREE.Vector3(),
        rotVelocity: new THREE.Vector3(),
        type: 'sign'
      });
    });

    // 2. Урны возле АТБ и Авроры
    const binMat = new THREE.MeshStandardMaterial({ color: 0x2d3436, metalness: 0.6 });
    const binCoords = [{ x: -6, z: -168 }, { x: 6, z: -168 }, { x: -85, z: -72 }];
    binCoords.forEach(bc => {
      const bin = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.22, 0.8, 10), binMat);
      bin.position.set(bc.x, 0.4, bc.z);
      this.scene.add(bin);

      this.props.push({
        group: bin,
        originPos: bin.position.clone(),
        originRot: bin.rotation.clone(),
        isBroken: false,
        velocity: new THREE.Vector3(),
        rotVelocity: new THREE.Vector3(),
        type: 'bin'
      });
    });

    // 3. Секции деревянного штакетника в частном секторе
    const fenceMat = new THREE.MeshLambertMaterial({ color: 0xa0522d });
    for (let x = -280; x < -180; x += 18) {
      const fence = new THREE.Mesh(new THREE.BoxGeometry(14, 1.2, 0.15), fenceMat);
      fence.position.set(x, 0.6, 85);
      this.scene.add(fence);

      this.props.push({
        group: fence,
        originPos: fence.position.clone(),
        originRot: fence.rotation.clone(),
        isBroken: false,
        velocity: new THREE.Vector3(),
        rotVelocity: new THREE.Vector3(),
        type: 'fence'
      });
    }
  }

  checkVehicleCollisions(vehicle) {
    if (!vehicle || Math.abs(vehicle.speed) < 3.5) return;

    const carPos = vehicle.mesh.position;
    this.props.forEach(prop => {
      if (prop.isBroken) return;

      const dist = carPos.distanceTo(prop.group.position);
      if (dist < 2.4) {
        // Удар и сбитие объекта
        prop.isBroken = true;
        this.sound.playCrash(Math.abs(vehicle.speed));

        // Импульс от машины
        const fwd = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), vehicle.mesh.rotation.y);
        prop.velocity.copy(fwd).multiplyScalar(vehicle.speed * 0.9);
        prop.velocity.y = 3.5 + Math.random() * 2.5; // Подлет вверх

        prop.rotVelocity.set(
          (Math.random() - 0.5) * 8.0,
          (Math.random() - 0.5) * 8.0,
          (Math.random() - 0.5) * 8.0
        );
      }
    });
  }

  update(delta, playerPos) {
    this.props.forEach(prop => {
      if (!prop.isBroken) return;

      // Физика отлетающего объекта (гравитация и скольжение)
      prop.velocity.y -= 18.0 * delta;
      prop.group.position.addScaledVector(prop.velocity, delta);

      prop.group.rotation.x += prop.rotVelocity.x * delta;
      prop.group.rotation.y += prop.rotVelocity.y * delta;
      prop.group.rotation.z += prop.rotVelocity.z * delta;

      // Падение на землю
      if (prop.group.position.y < 0.2) {
        prop.group.position.y = 0.2;
        prop.velocity.multiplyScalar(0.7);
        prop.rotVelocity.multiplyScalar(0.7);
      }

      // Автоматическое восстановление, когда игрок отъехал далеко (> 450м)
      if (playerPos.distanceTo(prop.originPos) > 450) {
        prop.isBroken = false;
        prop.group.position.copy(prop.originPos);
        prop.group.rotation.copy(prop.originRot);
        prop.velocity.set(0, 0, 0);
        prop.rotVelocity.set(0, 0, 0);
      }
    });
  }
}

// =============================================================================
// 3. АВТОМОБИЛЬНОЕ РАДИО (PROCEDURAL SYNTH RADIO)
// =============================================================================
class ProceduralRadio {
  constructor(soundEngine) {
    this.sound = soundEngine;
    this.stations = [
      { id: 0, name: 'Радіо Вимкнено' },
      { id: 1, name: '📻 Городня FM (Phonk / Synthwave)' },
      { id: 2, name: '📻 Ретро-Шансон (Атмосфера ВАЗ)' },
      { id: 3, name: '📻 Поліцейська хвиля (Диспетчер)' }
    ];
    this.currentStation = 0;
    this.isPlaying = false;
    this.synthInterval = null;
    this.beatStep = 0;
  }

  toggleStation() {
    this.currentStation = (this.currentStation + 1) % this.stations.length;
    this.applyStation();
    this.showRadioHUD();
  }

  showRadioHUD() {
    let hud = document.getElementById('radio-hud-banner');
    if (!hud) {
      hud = document.createElement('div');
      hud.id = 'radio-hud-banner';
      hud.style.cssText = `
        position: absolute; top: 24px; left: 50%; transform: translateX(-50%);
        background: rgba(15, 23, 42, 0.92); border: 2px solid #38bdf8;
        padding: 8px 24px; border-radius: 8px; font-family: 'Teko', sans-serif;
        font-size: 26px; color: #fff; z-index: 60; box-shadow: 0 0 20px rgba(56, 189, 248, 0.4);
        letter-spacing: 2px;
      `;
      document.body.appendChild(hud);
    }
    hud.innerText = this.stations[this.currentStation].name;
    hud.style.display = 'block';
    clearTimeout(this.hudTimer);
    this.hudTimer = setTimeout(() => { hud.style.display = 'none'; }, 2200);
  }

  applyStation() {
    if (this.synthInterval) {
      clearInterval(this.synthInterval);
      this.synthInterval = null;
    }

    if (!this.sound.ctx || this.currentStation === 0) return;

    const ctx = this.sound.ctx;

    if (this.currentStation === 1) {
      // «Городня FM»: Фонк / Синтвейв басовая линия (130 BPM)
      const bassNotes = [55, 55, 65.41, 55, 73.42, 55, 49, 55]; // Ля, До, Ре, Соль#
      this.synthInterval = setInterval(() => {
        const t = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        const note = bassNotes[this.beatStep % bassNotes.length];
        osc.frequency.setValueAtTime(note, t);

        gain.gain.setValueAtTime(0.08, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.18);

        this.beatStep++;
      }, 230);

    } else if (this.currentStation === 2) {
      // «Ретро-Шансон»: Ритмичные аккорды для поездки на Жигулях
      const chords = [130.81, 164.81, 196.00]; // До-мажор
      this.synthInterval = setInterval(() => {
        const t = ctx.currentTime;
        chords.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq * (1 + (this.beatStep % 2) * 0.25), t);
          gain.gain.setValueAtTime(0.04, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t);
          osc.stop(t + 0.25);
        });
        this.beatStep++;
      }, 420);

    } else if (this.currentStation === 3) {
      // «Поліцейська хвиля»: Радиопомехи и переговоры
      this.synthInterval = setInterval(() => {
        const t = ctx.currentTime;
        // Короткий шум рации (squelch click)
        this.sound.playCrash(2);
      }, 1600);
    }
  }

  stop() {
    if (this.synthInterval) {
      clearInterval(this.synthInterval);
      this.synthInterval = null;
    }
    this.currentStation = 0;
  }
}

// =============================================================================
// 4. СВОБОДНЫЕ АКТИВНОСТИ И ПОДРАБОТКИ В ГОРОДЕ
// =============================================================================
class CitySideActivities {
  constructor(scene, soundEngine) {
    this.scene = scene;
    this.sound = soundEngine;

    // 1. Подработка курьером «Нова Пошта»
    this.courierActive = false;
    this.courierTarget = null;
    this.courierReward = 0;

    // 2. Режим Такси
    this.taxiActive = false;
    this.taxiPassenger = null;
    this.taxiDestination = null;

    // 3. Рыбалка на озере Делдачков
    this.isFishing = false;
    this.fishingBite = false;
    this.dockPos = new THREE.Vector3(-280, 0.5, -240); // Мостик на озере
    this.initFishingDock();
  }

  initFishingDock() {
    // Деревянный пирс/мостик на озере Делдачков
    const dock = new THREE.Mesh(
      new THREE.BoxGeometry(4.0, 0.25, 12.0),
      new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.85 })
    );
    dock.position.copy(this.dockPos);
    dock.position.y = 0.15;
    this.scene.add(dock);
  }

  // --- ПОДРАБОТКА НОВОЙ ПОЧТЫ ---
  startCourierJob(player) {
    if (this.courierActive) {
      alert('У вас вже є активне замовлення на доставку!');
      return;
    }

    const addresses = [
      { name: 'вул. Шевченка, 42', pos: new THREE.Vector3(-140, 0, 15) },
      { name: 'вул. Чернігівська, 19 (біля АТБ)', pos: new THREE.Vector3(12, 0, -150) },
      { name: 'вул. Троїцька, 8', pos: new THREE.Vector3(-260, 0, 140) },
      { name: 'Приватний сектор (вул. 1-го Травня, 31)', pos: new THREE.Vector3(-310, 0, 210) }
    ];

    const pick = addresses[Math.floor(Math.random() * addresses.length)];
    this.courierActive = true;
    this.courierTarget = pick;
    this.courierReward = 280 + Math.floor(Math.random() * 140);
    this.sound.playPurchase();

    alert(`📦 Нове замовлення Нової Пошти!\nАдреса: ${pick.name}\nВинагорода: ${this.courierReward} ₴`);
  }

  // --- РЕЖИМ ТАКСИ ---
  toggleTaxiMode(player) {
    if (!player.inVehicle) {
      alert('Для роботи в таксі потрібно перебувати в авто!');
      return;
    }

    this.taxiActive = !this.taxiActive;
    if (this.taxiActive) {
      const taxiDestinations = [
        { name: 'Супермаркет «АТБ»', pos: new THREE.Vector3(12, 0, -170) },
        { name: 'Центральний Базар', pos: new THREE.Vector3(-210, 0, 30) },
        { name: 'Ж/Д Вокзал «Городня»', pos: new THREE.Vector3(440, 0, 20) },
        { name: 'Військовий Аеродром', pos: new THREE.Vector3(330, 0, -250) }
      ];
      this.taxiDestination = taxiDestinations[Math.floor(Math.random() * taxiDestinations.length)];
      this.sound.playPurchase();
      alert(`🚖 Режим Таксі активовано!\nПасажир прямує: ${this.taxiDestination.name}\nПлата за проїзд: 220 ₴`);
    } else {
      this.taxiDestination = null;
      alert('Режим Таксі вимкнено.');
    }
  }

  // --- РЫБАЛКА ---
  interactFishing(player) {
    const dist = player.position.distanceTo(this.dockPos);
    if (dist < 4.5) {
      this.isFishing = !this.isFishing;
      if (this.isFishing) {
        alert('🎣 Ви закинули вудку в озеро Делдачков... Чекайте клювання!');
        setTimeout(() => {
          if (this.isFishing) {
            const fishTypes = [
              { name: 'Карась сріблястий', price: 90 },
              { name: 'Щука озерна', price: 210 },
              { name: 'Короп городнянський', price: 340 }
            ];
            const caught = fishTypes[Math.floor(Math.random() * fishTypes.length)];
            player.money += caught.price;
            this.sound.playPurchase();
            alert(`🎉 Клює! Ви спіймали: «${caught.name}»!\nПродано на Базарі за +${caught.price} ₴`);
            this.isFishing = false;
          }
        }, 4000);
      } else {
        alert('Вудку змотано.');
      }
    }
  }

  update(player) {
    // Проверка доставки Новой Почты
    if (this.courierActive && this.courierTarget) {
      if (player.position.distanceTo(this.courierTarget.pos) < 6.5) {
        player.money += this.courierReward;
        this.sound.playPurchase();
        alert(`✅ Посилку доставлено! Отримано оплату: +${this.courierReward} ₴`);
        this.courierActive = false;
        this.courierTarget = null;
      }
    }

    // Проверка высадки пассажира такси
    if (this.taxiActive && this.taxiDestination) {
      if (player.position.distanceTo(this.taxiDestination.pos) < 7.5) {
        player.money += 220;
        this.sound.playPurchase();
        alert('🚖 Пасажира доставлено до місця! Отримано: +220 ₴');
        this.taxiDestination = null;
        this.taxiActive = false;
      }
    }
  }
}

// =============================================================================
// 5. ГЛАВНОЕ МЕНЮ И НАСТРОЙКИ ГРАФИКИ (60 FPS LOCK)
// =============================================================================
class MainMenuAndSettings {
  constructor(gameApp) {
    this.app = gameApp;
    this.inMenu = true;
    this.orbitAngle = 0;
    this.currentPreset = 'ULTRA';

    this.createMenuUI();
  }

  createMenuUI() {
    const menuEl = document.createElement('div');
    menuEl.id = 'gta-main-menu';
    menuEl.style.cssText = `
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      background: radial-gradient(circle at 30% 50%, rgba(15, 23, 42, 0.4), rgba(11, 15, 25, 0.95));
      display: flex; flex-direction: column; justify-content: center; padding-left: 80px;
      z-index: 120; font-family: 'Teko', sans-serif;
    `;

    menuEl.innerHTML = `
      <h1 style="font-size: 88px; color: #38bdf8; margin: 0; letter-spacing: 4px; line-height: 1;">ГОРОДНЯ 3D</h1>
      <p style="font-size: 24px; color: #94a3b8; margin: 6px 0 28px 0; letter-spacing: 2px;">ЧЕРНІГІВСЬКА ОБЛАСТЬ • ВІДКРИТИЙ СВІТ</p>
      <div style="display: flex; flex-direction: column; gap: 14px; max-width: 320px;">
        <button id="btn-menu-new" style="background:#0284c7; color:#fff; border:none; padding:10px; font-size:28px; border-radius:6px; cursor:pointer; font-family:'Teko';">НОВА ГРА</button>
        <button id="btn-menu-continue" style="background:#1e293b; color:#fff; border:1px solid #475569; padding:10px; font-size:28px; border-radius:6px; cursor:pointer; font-family:'Teko';">ПРОДОВЖИТИ</button>
        <button id="btn-menu-graphics" style="background:#1e293b; color:#38bdf8; border:1px solid #475569; padding:10px; font-size:24px; border-radius:6px; cursor:pointer; font-family:'Teko';">ГРАФІКА: УЛЬТРА (60 FPS)</button>
        <button id="btn-menu-controls" style="background:#1e293b; color:#94a3b8; border:1px solid #475569; padding:10px; font-size:24px; border-radius:6px; cursor:pointer; font-family:'Teko';">КЕРУВАННЯ</button>
      </div>
    `;

    document.body.appendChild(menuEl);

    document.getElementById('btn-menu-new').addEventListener('click', () => {
      this.inMenu = false;
      menuEl.style.display = 'none';
      this.app.sound.init();
    });

    document.getElementById('btn-menu-continue').addEventListener('click', () => {
      this.app.phone.loadGame(this.app.player, this.app.tuning);
      this.inMenu = false;
      menuEl.style.display = 'none';
      this.app.sound.init();
    });

    document.getElementById('btn-menu-graphics').addEventListener('click', () => {
      this.toggleGraphicsPreset();
    });

    document.getElementById('btn-menu-controls').addEventListener('click', () => {
      alert("КЕРУВАННЯ В ГРІ:\nW,A,S,D - Рух / Керування авто\nShift - Спринт / Нітро в авто\nSpace - Стрибок / Ручник (дрифт)\n1,2,3,4 - Вибір зброї\nЛКМ - Атака / Постріл\nF,E - Сісти / Вийти з авто\nR - Автомобільне радіо\nT - Режим Таксі\nP,Tab - Смартфон GPS");
    });
  }

  toggleGraphicsPreset() {
    const btn = document.getElementById('btn-menu-graphics');
    if (this.currentPreset === 'ULTRA') {
      this.currentPreset = 'LOW';
      this.app.renderer.shadowMap.enabled = false;
      btn.innerText = 'ГРАФІКА: НИЗЬКА (МАКС. FPS)';
    } else if (this.currentPreset === 'LOW') {
      this.currentPreset = 'MEDIUM';
      this.app.renderer.shadowMap.enabled = true;
      btn.innerText = 'ГРАФІКА: СЕРЕДНЯ';
    } else {
      this.currentPreset = 'ULTRA';
      this.app.renderer.shadowMap.enabled = true;
      btn.innerText = 'ГРАФІКА: УЛЬТРА (60 FPS)';
    }
  }

  updateCameraFlyover(delta, camera) {
    if (!this.inMenu) return;

    // Кинематографичный облет камеры над центром Городни (Шевченко / Черниговская / АТБ)
    this.orbitAngle += delta * 0.12;
    const radius = 130.0;
    camera.position.set(
      Math.sin(this.orbitAngle) * radius,
      45.0,
      Math.cos(this.orbitAngle) * radius - 80
    );
    camera.lookAt(0, 5, -80);
  }
}
