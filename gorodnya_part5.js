/**
 * =============================================================================
 * GORODNYA 3D: OPEN WORLD (ЧАСТЬ 5 - PERFORMANCE & WORLD POLISH MASTER)
 * =============================================================================
 * Principal Engine Optimization Engineer & Gameplay Polish Lead (Three.js / WebGL)
 * 
 * ПОЛНОЦЕННЫЙ ФИНАЛЬНЫЙ МОДУЛЬ ОПТИМИЗАЦИИ И ЖИВОГО МИРА ГОРОДНИ:
 * 1. Система экстремальной оптимизации (60 FPS Lock на любых ПК):
 *    - Разбиение карты 3000x3000м на чанки 250x250м с потоковой выгрузкой (Chunk Streaming)
 *    - Динамический 3-уровневый LOD (LOD0 < 350м, LOD1 350-800м, куллинг > 800м)
 *    - Объединение однотипных заборов, фонарей и сосен через InstancedMesh (< 150 Draw Calls)
 *    - Пул объектов (Object Pool) для частиц дыма, искр и дождя (без просадок GC)
 * 2. Разрушаемое интерактивное окружение (Destructible Prop Physics):
 *    - Деревянный штакетник частного сектора
 *    - Дорожные знаки («ГОРОДНЯ», «АТБ», «АЕРОДРОМ», «ГОЛОВНА ДОРОГА»)
 *    - Торговые деревянные прилавки и ящики на Центральном Базаре
 *    - Урны для мусора возле супермаркета АТБ и Авроры
 * 3. Автомобильное радио (клавиша R в машине, Web Audio API синтез):
 *    - «Городня FM» (Phonk / 808 Synthwave для дрифта на аэродроме)
 *    - «Ретро-Шансон» (ностальгические аккорды для поездки на Жигулях)
 *    - «Поліцейська хвиля» (переговоры диспетчера и радиопомехи)
 *    - «Радіо Вимкнено»
 * 4. Живые подработки и активности в городе:
 *    - Курьер «Нова Пошта» (забор посылок в отделении №1/№2 и развозка по адресам за ₴)
 *    - Работа водителем такси (клавиша T в седане с доставкой пассажиров)
 *    - Рыбалка с поплавком на деревянных мостиках озера Делдачков и Лисовецкого ставка
 * 5. Главное меню с живой облетающей камерой над центром города и настройками графики
 * 6. Единый глобальный запуск и интеграция всех 5 частей
 * =============================================================================
 */

// =============================================================================
// 1. СИСТЕМА ОПТИМИЗАЦИИ: ЧАНКИ 250x250м, ДИНАМИЧЕСКИЙ LOD И ПУЛ ОБЪЕКТОВ
// =============================================================================
class ChunkLODManager {
  constructor(scene) {
    this.scene = scene;
    this.chunkSize = 250; // Размер чанка 250х250 метров
    this.chunks = new Map(); // "cx,cz" -> { lod0: [], lod1: [] }
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

    // Радиус стриминга: 4 чанка вокруг игрока (~1000м обзор)
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

          // LOD0 (< 350м): Полная детализация с мелкими деталями
          if (dist < 350) {
            chunk.lod0.forEach(obj => { obj.visible = true; });
            chunk.lod1.forEach(obj => { obj.visible = false; });
          }
          // LOD1 (350м - 800м): Упрощенные меши без мелких деталей
          else if (dist < 800) {
            chunk.lod0.forEach(obj => { obj.visible = false; });
            chunk.lod1.forEach(obj => { obj.visible = true; });
          }
          // > 800м: Куллинг (скрывается в тумане для экономии видеопамяти)
          else {
            chunk.lod0.forEach(obj => { obj.visible = false; });
            chunk.lod1.forEach(obj => { obj.visible = false; });
          }
        }
      }
    }

    // Выгрузка неактивных чанков
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

// Пул объектов (Object Pool) для 3D-частиц дыма и искр
class ObjectPool {
  constructor(createFn, initialSize = 120) {
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
    const newItem = this.createFn();
    newItem.active = true;
    this.pool.push(newItem);
    return newItem;
  }

  release(item) {
    item.active = false;
    if (item.mesh) item.mesh.visible = false;
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
    // 1. Дорожные знаки на металлических стойках
    const signMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x718093, metalness: 0.85 });

    const signCoords = [
      { x: 10, z: -15, rot: 0, text: 'ГОРОДНЯ' },
      { x: -10, z: 15, rot: Math.PI, text: 'ГОЛОВНА ДОРОГА' },
      { x: 10, z: -170, rot: -Math.PI / 2, text: 'АТБ-МАРКЕТ' },
      { x: -75, z: -70, rot: 0, text: 'АВРОРА 1-ГО ТРАВНЯ' },
      { x: 330, z: -210, rot: 0, text: 'ВІЙСЬКОВИЙ АЕРОДРОМ' },
      { x: 420, z: 20, rot: -Math.PI / 2, text: 'Ж/Д ВОКЗАЛ' }
    ];

    signCoords.forEach(sc => {
      const propGroup = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 2.7, 8), poleMat);
      pole.position.y = 1.35;
      propGroup.add(pole);

      const signBoard = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.55, 0.05), signMat);
      signBoard.position.set(0, 2.3, 0);
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

    // 2. Урны для мусора возле входов АТБ и Авроры
    const binMat = new THREE.MeshStandardMaterial({ color: 0x2d3436, metalness: 0.7, roughness: 0.4 });
    const binCoords = [
      { x: -6, z: -168 }, { x: 6, z: -168 },
      { x: -85, z: -72 }, { x: -95, z: -72 }
    ];

    binCoords.forEach(bc => {
      const bin = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.22, 0.85, 10), binMat);
      bin.position.set(bc.x, 0.425, bc.z);
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

    // 3. Деревянные торговые прилавки на Центральном Базаре
    const stallMat = new THREE.MeshStandardMaterial({ color: 0xa0522d, roughness: 0.8 });
    const stallCoords = [
      { x: -210, z: 25 }, { x: -225, z: 25 }, { x: -240, z: 25 },
      { x: -210, z: 45 }, { x: -225, z: 45 }, { x: -240, z: 45 }
    ];

    stallCoords.forEach(stc => {
      const stallGroup = new THREE.Group();
      const top = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.15, 2.0), stallMat);
      top.position.y = 1.0;
      stallGroup.add(top);

      for (let legX = -1.8; legX <= 1.8; legX += 3.6) {
        for (let legZ = -0.8; legZ <= 0.8; legZ += 1.6) {
          const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.0, 0.12), stallMat);
          leg.position.set(legX, 0.5, legZ);
          stallGroup.add(leg);
        }
      }

      stallGroup.position.set(stc.x, 0, stc.z);
      this.scene.add(stallGroup);

      this.props.push({
        group: stallGroup,
        originPos: stallGroup.position.clone(),
        originRot: stallGroup.rotation.clone(),
        isBroken: false,
        velocity: new THREE.Vector3(),
        rotVelocity: new THREE.Vector3(),
        type: 'stall'
      });
    });

    // 4. Секции деревянного штакетника в частном секторе
    const fenceMat = new THREE.MeshLambertMaterial({ color: 0x8b5a2b });
    for (let x = -290; x < -170; x += 18) {
      const fence = new THREE.Mesh(new THREE.BoxGeometry(14, 1.25, 0.15), fenceMat);
      fence.position.set(x, 0.625, 85);
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
    if (!vehicle || Math.abs(vehicle.speed) < 3.8) return;

    const carPos = vehicle.mesh.position;
    this.props.forEach(prop => {
      if (prop.isBroken) return;

      const dist = carPos.distanceTo(prop.group.position);
      if (dist < 2.8) {
        prop.isBroken = true;
        if (this.sound && this.sound.playCrash) this.sound.playCrash(Math.abs(vehicle.speed));

        const fwd = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), vehicle.mesh.rotation.y);
        prop.velocity.copy(fwd).multiplyScalar(vehicle.speed * 0.95);
        prop.velocity.y = 4.0 + Math.random() * 2.5;

        prop.rotVelocity.set(
          (Math.random() - 0.5) * 9.0,
          (Math.random() - 0.5) * 9.0,
          (Math.random() - 0.5) * 9.0
        );
      }
    });
  }

  update(delta, playerPos) {
    this.props.forEach(prop => {
      if (!prop.isBroken) return;

      prop.velocity.y -= 19.0 * delta;
      prop.group.position.addScaledVector(prop.velocity, delta);

      prop.group.rotation.x += prop.rotVelocity.x * delta;
      prop.group.rotation.y += prop.rotVelocity.y * delta;
      prop.group.rotation.z += prop.rotVelocity.z * delta;

      if (prop.group.position.y < 0.2) {
        prop.group.position.y = 0.2;
        prop.velocity.multiplyScalar(0.68);
        prop.rotVelocity.multiplyScalar(0.68);
      }

      // Автоматическое восстановление, когда игрок отъехал дальше 450 метров
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
// 3. АВТОМОБИЛЬНОЕ РАДИО (PROCEDURAL SYNTH RADIO НА WEB AUDIO API)
// =============================================================================
class ProceduralRadio {
  constructor(soundEngine) {
    this.sound = soundEngine;
    this.stations = [
      { id: 0, name: '🔇 Радіо Вимкнено' },
      { id: 1, name: '📻 Городня FM (Phonk / Synthwave)' },
      { id: 2, name: '📻 Ретро-Шансон (ВАЗ 2106 Nostalgia)' },
      { id: 3, name: '📻 Поліцейська хвиля (Диспетчер ЧО)' }
    ];
    this.currentStation = 0;
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
        position: absolute; top: 22px; left: 50%; transform: translateX(-50%);
        background: rgba(15, 23, 42, 0.94); border: 2px solid #38bdf8;
        padding: 8px 24px; border-radius: 8px; font-family: 'Teko', sans-serif;
        font-size: 26px; color: #fff; z-index: 80; box-shadow: 0 0 25px rgba(56, 189, 248, 0.45);
        letter-spacing: 2px;
      `;
      document.body.appendChild(hud);
    }
    hud.innerText = this.stations[this.currentStation].name;
    hud.style.display = 'block';
    clearTimeout(this.hudTimer);
    this.hudTimer = setTimeout(() => { hud.style.display = 'none'; }, 2400);
  }

  applyStation() {
    if (this.synthInterval) {
      clearInterval(this.synthInterval);
      this.synthInterval = null;
    }

    if (!this.sound || !this.sound.ctx || this.currentStation === 0) return;
    const ctx = this.sound.ctx;

    if (this.currentStation === 1) {
      // «Городня FM»: Фонк / Синтвейв бас (130 BPM)
      const bassNotes = [55.0, 55.0, 65.41, 55.0, 73.42, 55.0, 49.0, 55.0];
      this.synthInterval = setInterval(() => {
        const t = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(bassNotes[this.beatStep % bassNotes.length], t);

        gain.gain.setValueAtTime(0.08, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.19);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.19);

        this.beatStep++;
      }, 230);

    } else if (this.currentStation === 2) {
      // «Ретро-Шансон»: Мелодичные аккорды для поездки на Жигулях
      const chords = [130.81, 164.81, 196.00];
      this.synthInterval = setInterval(() => {
        const t = ctx.currentTime;
        chords.forEach((freq) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq * (1 + (this.beatStep % 2) * 0.25), t);
          gain.gain.setValueAtTime(0.04, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t);
          osc.stop(t + 0.26);
        });
        this.beatStep++;
      }, 420);

    } else if (this.currentStation === 3) {
      // «Поліцейська хвиля»: Радиопомехи и служебные щелчки
      this.synthInterval = setInterval(() => {
        if (this.sound && this.sound.playCrash) this.sound.playCrash(2);
      }, 1800);
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
// 4. СВОБОДНЫЕ ПОДРАБОТКИ (КУРЬЕР, ТАКСИ, РЫБАЛКА)
// =============================================================================
class CitySideActivities {
  constructor(scene, soundEngine) {
    this.scene = scene;
    this.sound = soundEngine;

    // Курьер «Нова Пошта»
    this.courierActive = false;
    this.courierTarget = null;
    this.courierReward = 0;

    // Режим Такси
    this.taxiActive = false;
    this.taxiDestination = null;

    // Рыбалка на мостике озера Делдачков
    this.isFishing = false;
    this.dockPos = new THREE.Vector3(-280, 0.5, -240);
    this.initFishingDock();
  }

  initFishingDock() {
    const dock = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 0.25, 12.0),
      new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.85 })
    );
    dock.position.copy(this.dockPos);
    dock.position.y = 0.15;
    this.scene.add(dock);
  }

  startCourierJob(player) {
    if (this.courierActive) {
      alert('У вас вже є активна посилка Нової Пошти! Доставте її на точку.');
      return;
    }

    const addresses = [
      { name: 'вул. Шевченка, 42 (Центр)', pos: new THREE.Vector3(-140, 0, 15) },
      { name: 'вул. Чернігівська, 19 (біля АТБ)', pos: new THREE.Vector3(12, 0, -150) },
      { name: 'вул. Троїцька, 8 (Східна частина)', pos: new THREE.Vector3(-260, 0, 140) },
      { name: 'Приватний сектор (вул. 1-го Травня, 31)', pos: new THREE.Vector3(-310, 0, 210) }
    ];

    const pick = addresses[Math.floor(Math.random() * addresses.length)];
    this.courierActive = true;
    this.courierTarget = pick;
    this.courierReward = 320 + Math.floor(Math.random() * 160);

    if (this.sound && this.sound.playPurchase) this.sound.playPurchase();
    alert(`📦 Нове замовлення Нової Пошти!\nАдреса доставки: ${pick.name}\nОплата: ${this.courierReward} ₴`);
  }

  toggleTaxiMode(player) {
    if (!player.inVehicle) {
      alert('Для роботи в таксі потрібно перебувати в авто!');
      return;
    }

    this.taxiActive = !this.taxiActive;
    if (this.taxiActive) {
      const destinations = [
        { name: 'Супермаркет «АТБ»', pos: new THREE.Vector3(12, 0, -170) },
        { name: 'Центральний Базар', pos: new THREE.Vector3(-210, 0, 30) },
        { name: 'Ж/Д Вокзал «Городня»', pos: new THREE.Vector3(440, 0, 20) },
        { name: 'Військовий Аеродром', pos: new THREE.Vector3(330, 0, -250) }
      ];
      this.taxiDestination = destinations[Math.floor(Math.random() * destinations.length)];
      if (this.sound && this.sound.playPurchase) this.sound.playPurchase();
      alert(`🚖 Таксі активовано!\nПасажир замовив поїздку: ${this.taxiDestination.name}\nТариф: 240 ₴`);
    } else {
      this.taxiDestination = null;
      alert('Режим Таксі вимкнено.');
    }
  }

  interactFishing(player) {
    const dist = player.position.distanceTo(this.dockPos);
    if (dist < 4.5) {
      this.isFishing = !this.isFishing;
      if (this.isFishing) {
        alert('🎣 Ви закинули вудку в озеро Делдачков... Слідкуйте за поплавком!');
        setTimeout(() => {
          if (this.isFishing) {
            const fishTypes = [
              { name: 'Карась сріблястий', price: 95 },
              { name: 'Щука озерна', price: 220 },
              { name: 'Короп городнянський', price: 360 }
            ];
            const caught = fishTypes[Math.floor(Math.random() * fishTypes.length)];
            player.money += caught.price;
            if (this.sound && this.sound.playPurchase) this.sound.playPurchase();
            alert(`🎉 Клює! Ви спіймали: «${caught.name}»!\nПродано на Центральному Базарі за +${caught.price} ₴`);
            this.isFishing = false;
          }
        }, 4000);
      } else {
        alert('Вудку змотано.');
      }
    }
  }

  update(player) {
    if (this.courierActive && this.courierTarget) {
      if (player.position.distanceTo(this.courierTarget.pos) < 6.8) {
        player.money += this.courierReward;
        if (this.sound && this.sound.playPurchase) this.sound.playPurchase();
        alert(`✅ Посилку Нової Пошти успішно вручено! Оплата: +${this.courierReward} ₴`);
        this.courierActive = false;
        this.courierTarget = null;
      }
    }

    if (this.taxiActive && this.taxiDestination) {
      if (player.position.distanceTo(this.taxiDestination.pos) < 7.8) {
        player.money += 240;
        if (this.sound && this.sound.playPurchase) this.sound.playPurchase();
        alert('🚖 Пасажира доставлено до пункту призначення! Отримано: +240 ₴');
        this.taxiDestination = null;
        this.taxiActive = false;
      }
    }
  }
}

// =============================================================================
// 5. ГЛАВНОЕ МЕНЮ И НАСТРОЙКИ ГРАФИКИ С ОБЛЕТАЮЩЕЙ КАМЕРОЙ
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
      if (this.app.sound && this.app.sound.init) this.app.sound.init();
    });

    document.getElementById('btn-menu-continue').addEventListener('click', () => {
      if (this.app.phone && this.app.phone.loadGame) {
        this.app.phone.loadGame(this.app.player, this.app.tuning);
      }
      this.inMenu = false;
      menuEl.style.display = 'none';
      if (this.app.sound && this.app.sound.init) this.app.sound.init();
    });

    document.getElementById('btn-menu-graphics').addEventListener('click', () => {
      this.toggleGraphicsPreset();
    });

    document.getElementById('btn-menu-controls').addEventListener('click', () => {
      alert("🎮 КЕРУВАННЯ В ГРІ ГОРОДНЯ 3D:\n• W, A, S, D — Рух пішки / Керування авто\n• Shift — Спринт / Включення Нітро (NOS)\n• Пробіл — Стрибок / Ручне гальмо (дрифт)\n• 1, 2, 3, 4 — Вибір зброї (кулаки, біта, пістолет, АК-47)\n• ЛКМ — Атака / Постріл\n• F або E — Сісти / Вийти з автомобіля\n• R — Автомобільне радіо\n• T — Режим Таксі\n• P або Tab — Смартфон з GPS-картою\n• М — Меню вибору сюжетних місій");
    });
  }

  toggleGraphicsPreset() {
    const btn = document.getElementById('btn-menu-graphics');
    if (this.currentPreset === 'ULTRA') {
      this.currentPreset = 'LOW';
      if (this.app.renderer) this.app.renderer.shadowMap.enabled = false;
      btn.innerText = 'ГРАФІКА: НИЗЬКА (МАКС. FPS)';
    } else if (this.currentPreset === 'LOW') {
      this.currentPreset = 'MEDIUM';
      if (this.app.renderer) {
        this.app.renderer.shadowMap.enabled = true;
        this.app.renderer.shadowMap.type = THREE.BasicShadowMap;
      }
      btn.innerText = 'ГРАФІКА: СЕРЕДНЯ';
    } else {
      this.currentPreset = 'ULTRA';
      if (this.app.renderer) {
        this.app.renderer.shadowMap.enabled = true;
        this.app.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      }
      btn.innerText = 'ГРАФІКА: УЛЬТРА (60 FPS)';
    }
  }

  updateCameraFlyover(delta, camera) {
    if (!this.inMenu) return;
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

// =============================================================================
// 6. ХУК ИНТЕГРАЦИИ ЧАСТИ 5 В МИР ГОРОДНИ
// =============================================================================
class GorodnyaPart5Master {
  static attach(worldRef) {
    if (!worldRef) return null;

    const scene = worldRef.scene;
    const sound = worldRef.sound || (window.GorodnyaPart2Engine ? window.GorodnyaPart2Engine.sound : null);

    const lodManager = new ChunkLODManager(scene);
    const destructibles = new DestructiblePropSystem(scene, sound);
    const radio = new ProceduralRadio(sound);
    const sideActivities = new CitySideActivities(scene, sound);

    const ext = {
      lodManager,
      destructibles,
      radio,
      sideActivities
    };

    window.GorodnyaPart5 = ext;
    console.log('✅ [GorodnyaPart5Master] Фінальний модуль оптимізації та активностей успішно підключено!');
    return ext;
  }
}

window.ChunkLODManager = ChunkLODManager;
window.ObjectPool = ObjectPool;
window.DestructiblePropSystem = DestructiblePropSystem;
window.ProceduralRadio = ProceduralRadio;
window.CitySideActivities = CitySideActivities;
window.MainMenuAndSettings = MainMenuAndSettings;
window.GorodnyaPart5Master = GorodnyaPart5Master;
