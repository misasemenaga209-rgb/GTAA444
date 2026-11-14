/**
 * =============================================================================
 * GORODNYA 3D: OPEN WORLD (ЧАСТЬ 3 - AAA SYSTEMS EXPANSION)
 * =============================================================================
 * Lead Gameplay Systems Architect, VFX/Shader Artist & UI/UX Designer
 * 1. Бесшовные 3D-интерьеры (АТБ, Аврора, СТО/Гараж)
 * 2. Тюнинг-ателье СТО (Покраска, Диски, Подвеска, Нитро NOS, Неон)
 * 3. Боевая система, Оружие (Бита, Пистолет, АК-47), «ПОТРАЧЕНО» / «АРЕСТОВАН», 10 Пасхалок
 * 4. Динамическая погода (Ясно, Густой туман, Дождь/Гроза, Мокрый асфальт)
 * 5. Интерактивный GTA-Смартфон (GPS-навигатор, Миссии, Чит-меню, Сохранения в LocalStorage)
 * 6. Единый загрузчик GameBootstrap
 * =============================================================================
 */

// =============================================================================
// 1. БЕСШОВНЫЕ ИНТЕРЬЕРЫ ЗДАНИЙ (АТБ, АВРОРА, ГАРАЖ / СТО)
// =============================================================================
class InteriorSystem {
  constructor(scene, collisionBoxes) {
    this.scene = scene;
    this.collisionBoxes = collisionBoxes;

    this.buildATBInterior();
    this.buildAvroraInterior();
    this.buildGarageSTO();
  }

  buildATBInterior() {
    // Супермаркет «АТБ» (ул. Черниговская, 5)
    // Позиция: (0, 0, -180), размеры зала: 28м x 20м x 5.5м
    const atbGroup = new THREE.Group();
    atbGroup.position.set(0, 0, -180);

    // Плиточный пол торгового зала
    const floorGeo = new THREE.PlaneGeometry(28, 20);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0xdcdde1, roughness: 0.2, metalness: 0.1 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.05;
    atbGroup.add(floor);

    // Ряды торговых стеллажей (Снеки, Напитки, Продукты)
    const shelfMat = new THREE.MeshStandardMaterial({ color: 0x2f3640 });
    const itemColors = [0xe74c3c, 0xf1c40f, 0x2ecc71, 0x3498db, 0xe67e22];

    for (let r = -6; r <= 6; r += 4) {
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.6, 12), shelfMat);
      shelf.position.set(r, 1.3, -1);
      atbGroup.add(shelf);
      this.collisionBoxes.push(new THREE.Box3().setFromCenterAndSize(
        new THREE.Vector3(r, 1.3, -181), new THREE.Vector3(1.6, 2.6, 12)
      ));

      // Товары на полках (яркие упаковки)
      for (let i = 0; i < 6; i++) {
        const prod = new THREE.Mesh(
          new THREE.BoxGeometry(0.3, 0.4, 0.8),
          new THREE.MeshLambertMaterial({ color: itemColors[(i + Math.abs(r)) % itemColors.length] })
        );
        prod.position.set(r + 0.7, 1.2 + (i % 2) * 0.7, -4 + i * 1.5);
        atbGroup.add(prod);
      }
    }

    // Холодильные витрины с LED-подсветкой вдоль задней стены
    const fridgeMat = new THREE.MeshStandardMaterial({ color: 0x718093 });
    const ledMat = new THREE.MeshBasicMaterial({ color: 0x00d2d3 });
    const fridge = new THREE.Mesh(new THREE.BoxGeometry(22, 2.8, 1.8), fridgeMat);
    fridge.position.set(0, 1.4, -8.8);
    atbGroup.add(fridge);

    const ledStripe = new THREE.Mesh(new THREE.BoxGeometry(21.6, 0.15, 0.1), ledMat);
    ledStripe.position.set(0, 2.7, -7.8);
    atbGroup.add(ledStripe);

    // Кассовая зона (лента, сканер, кассир)
    const deskMat = new THREE.MeshStandardMaterial({ color: 0x353b48 });
    const cashDesk = new THREE.Mesh(new THREE.BoxGeometry(6, 1.1, 1.4), deskMat);
    cashDesk.position.set(-5, 0.55, 6.5);
    atbGroup.add(cashDesk);

    // Сканер кассы (красный лазерный маркер)
    const scanner = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.3), new THREE.MeshBasicMaterial({ color: 0xff3838 }));
    scanner.position.set(-4.5, 1.25, 6.5);
    atbGroup.add(scanner);

    // Кассир NPC
    const cashier = new THREE.Group();
    cashier.position.set(-5, 0, 7.5);
    const cBody = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 1.3), new THREE.MeshLambertMaterial({ color: 0x0055aa })); // Синий жилет АТБ
    cBody.position.y = 0.65;
    const cHead = new THREE.Mesh(new THREE.SphereGeometry(0.18), new THREE.MeshLambertMaterial({ color: 0xf5cba7 }));
    cHead.position.y = 1.45;
    cashier.add(cBody); cashier.add(cHead);
    atbGroup.add(cashier);

    // Покупательские корзины у входа
    for (let c = 0; c < 3; c++) {
      const basket = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 0.9), new THREE.MeshStandardMaterial({ color: 0xe74c3c }));
      basket.position.set(6 + c * 1.1, 0.4, 7.5);
      atbGroup.add(basket);
    }

    this.scene.add(atbGroup);
  }

  buildAvroraInterior() {
    // «Аврора Мультимаркет» (ул. 1-го Мая, 19)
    // Позиция: (-90, 0, -80), размеры: 18м x 14м
    const avrGroup = new THREE.Group();
    avrGroup.position.set(-90, 0, -80);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(18, 14),
      new THREE.MeshStandardMaterial({ color: 0xf5f6fa, roughness: 0.3 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.05;
    avrGroup.add(floor);

    // Желто-красные фирменные стеллажи «Аврора»
    const yellowMat = new THREE.MeshStandardMaterial({ color: 0xfbc531 });
    const redMat = new THREE.MeshStandardMaterial({ color: 0xeb4d4b });

    for (let i = -4; i <= 4; i += 4) {
      const rack = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.4, 8), yellowMat);
      rack.position.set(i, 1.2, 0);
      avrGroup.add(rack);
      this.collisionBoxes.push(new THREE.Box3().setFromCenterAndSize(
        new THREE.Vector3(-90 + i, 1.2, -80), new THREE.Vector3(1.2, 2.4, 8)
      ));
    }

    // Кассовая стойка
    const desk = new THREE.Mesh(new THREE.BoxGeometry(4.5, 1.1, 1.2), redMat);
    desk.position.set(0, 0.55, 5.0);
    avrGroup.add(desk);

    this.scene.add(avrGroup);
  }

  buildGarageSTO() {
    // СТО / Тюнинг-ателье Городни (промзона на окраине)
    // Позиция: (180, 0, -80)
    const garageGroup = new THREE.Group();
    garageGroup.position.set(180, 0, -80);

    // Бетонный пол бокса
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 22),
      new THREE.MeshStandardMaterial({ color: 0x353b48, roughness: 0.7 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.05;
    garageGroup.add(floor);

    // Кирпичные стены СТО
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x7f1d1d, roughness: 0.9 });
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(24, 6.5, 0.8), wallMat);
    backWall.position.set(0, 3.25, -11);
    garageGroup.add(backWall);

    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.8, 6.5, 22), wallMat);
    leftWall.position.set(-12, 3.25, 0);
    garageGroup.add(leftWall);

    const rightWall = leftWall.clone();
    rightWall.position.x = 12;
    garageGroup.add(rightWall);

    // Смотровая яма по центру
    const pit = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.1, 8.5), new THREE.MeshBasicMaterial({ color: 0x111111 }));
    pit.position.set(0, 0.06, 0);
    garageGroup.add(pit);

    // Автомобильный двухстоечный гидроподъемник
    const postMat = new THREE.MeshStandardMaterial({ color: 0x0984e3, metalness: 0.8 });
    const postL = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4.8, 0.5), postMat);
    postL.position.set(-2.4, 2.4, 0);
    const postR = postL.clone();
    postR.position.x = 2.4;
    garageGroup.add(postL); garageGroup.add(postR);

    // Верстак с инструментами
    const bench = new THREE.Mesh(new THREE.BoxGeometry(6, 1.2, 1.2), new THREE.MeshStandardMaterial({ color: 0xd63031 }));
    bench.position.set(7, 0.6, -9.8);
    garageGroup.add(bench);

    this.scene.add(garageGroup);

    // Коллизии стен СТО
    this.collisionBoxes.push(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(180, 3.25, -91), new THREE.Vector3(24, 6.5, 0.8)));
    this.collisionBoxes.push(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(168, 3.25, -80), new THREE.Vector3(0.8, 6.5, 22)));
    this.collisionBoxes.push(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(192, 3.25, -80), new THREE.Vector3(0.8, 6.5, 22)));
  }
}

// =============================================================================
// 2. СИСТЕМА ТЮНИНГА И КАСТОМИЗАЦИИ АВТОМОБИЛЕЙ (СТО)
// =============================================================================
class TuningSystem {
  constructor(soundEngine) {
    this.sound = soundEngine;
    this.activeVehicle = null;
    this.isMenuOpen = false;
    this.orbitAngle = 0;

    // Параметры установленного тюнинга
    this.upgrades = {
      color: '#b93a2b',
      wheelType: 'stock',
      suspensionLower: 0,
      camber: 0,
      chipTuning: false,
      sportTires: false,
      nitroInstalled: false,
      underglowColor: null
    };

    this.nitroActive = false;
    this.nitroFuel = 100;
  }

  checkSTODriveIn(playerVehicle) {
    if (!playerVehicle) return false;
    // Координаты бокса СТО: (180, 0, -80)
    const dist = playerVehicle.mesh.position.distanceTo(new THREE.Vector3(180, 0, -80));
    return dist < 8.5;
  }

  openTuningMenu(vehicle) {
    this.activeVehicle = vehicle;
    this.isMenuOpen = true;
    const modal = document.getElementById('tuning-modal');
    if (modal) modal.style.display = 'block';
  }

  closeTuningMenu() {
    this.isMenuOpen = false;
    const modal = document.getElementById('tuning-modal');
    if (modal) modal.style.display = 'none';
  }

  applyBodyColor(colorHex, finish = 'gloss') {
    if (!this.activeVehicle) return;
    this.upgrades.color = colorHex;
    const col = new THREE.Color(colorHex);

    this.activeVehicle.mesh.traverse(child => {
      if (child.isMesh && child.material && child.geometry.type === 'BoxGeometry' && child.position.y > 0.4) {
        child.material.color = col;
        if (finish === 'metallic') {
          child.material.metalness = 0.85;
          child.material.roughness = 0.18;
        } else if (finish === 'matte') {
          child.material.metalness = 0.05;
          child.material.roughness = 0.85;
        } else {
          child.material.metalness = 0.3;
          child.material.roughness = 0.3;
        }
      }
    });
    this.sound.playPurchase();
  }

  applySuspension(lowerAmount, camberAngle) {
    if (!this.activeVehicle) return;
    this.upgrades.suspensionLower = lowerAmount;
    this.upgrades.camber = camberAngle;

    // Занижение клиренса
    const wheels = this.activeVehicle.wheels;
    if (wheels) {
      wheels.fl.position.y = 0.36 + lowerAmount;
      wheels.fr.position.y = 0.36 + lowerAmount;
      wheels.rl.position.y = 0.36 + lowerAmount;
      wheels.rr.position.y = 0.36 + lowerAmount;

      // Отрицательный развал
      wheels.fl.rotation.z = camberAngle;
      wheels.fr.rotation.z = -camberAngle;
      wheels.rl.rotation.z = camberAngle;
      wheels.rr.rotation.z = -camberAngle;
    }
  }

  buyUpgrade(player, upgradeType) {
    const catalog = {
      chip: { cost: 1200, name: 'Чіп-тюнінг двигуна (+35% розгін, +25% швидкість)' },
      tires: { cost: 850, name: 'Спортивна гума Michelin' },
      nitro: { cost: 1800, name: 'Закис азоту (NOS на Shift)' },
      neon: { cost: 650, name: 'Неонова підсвітка днища' }
    };

    const item = catalog[upgradeType];
    if (item && player.money >= item.cost) {
      player.money -= item.cost;
      this.sound.playPurchase();

      if (upgradeType === 'chip') {
        this.upgrades.chipTuning = true;
        this.activeVehicle.maxSpeed *= 1.35;
        this.activeVehicle.acceleration *= 1.45;
      } else if (upgradeType === 'tires') {
        this.upgrades.sportTires = true;
        this.activeVehicle.friction = 0.992;
      } else if (upgradeType === 'nitro') {
        this.upgrades.nitroInstalled = true;
      } else if (upgradeType === 'neon') {
        this.installUnderglow('#00ffcc');
      }
      return true;
    }
    return false;
  }

  installUnderglow(colorHex) {
    if (!this.activeVehicle) return;
    this.upgrades.underglowColor = colorHex;
    const light = new THREE.PointLight(new THREE.Color(colorHex), 3.5, 6);
    light.position.set(0, 0.15, 0);
    this.activeVehicle.mesh.add(light);
  }

  triggerNitro(delta, vehicle, particles, camera) {
    if (!this.upgrades.nitroInstalled || this.nitroFuel <= 0) return;

    this.nitroActive = true;
    this.nitroFuel = Math.max(0, this.nitroFuel - delta * 25);
    vehicle.speed = Math.min(vehicle.maxSpeed * 1.5, vehicle.speed + 35.0 * delta);

    // Синее пламя из выхлопной трубы
    const exhaustPos = new THREE.Vector3(0.5, 0.35, -2.1).applyMatrix4(vehicle.mesh.matrixWorld);
    particles.spawnNitroFlame(exhaustPos);

    // Эффект размытия скорости (Warp FOV)
    camera.fov = THREE.MathUtils.lerp(camera.fov, 78, delta * 8);
    camera.updateProjectionMatrix();
  }

  stopNitro(delta, camera) {
    this.nitroActive = false;
    camera.fov = THREE.MathUtils.lerp(camera.fov, 65, delta * 6);
    camera.updateProjectionMatrix();
    // Постепенное восстановление закиси азота
    this.nitroFuel = Math.min(100, this.nitroFuel + delta * 6);
  }
}

// =============================================================================
// 3. БОЕВАЯ СИСТЕМА, ОРУЖИЕ, «ПОТРАЧЕНО» / «АРЕСТОВАН» И 10 ПАСХАЛОК
// =============================================================================
class CombatAndEasterEggSystem {
  constructor(scene, soundEngine) {
    this.scene = scene;
    this.sound = soundEngine;

    // Текущее оружие: 'fists', 'bat', 'pistol', 'ak47'
    this.currentWeapon = 'fists';
    this.ammo = { pistol: 48, ak47: 180 };
    this.shootCooldown = 0;

    // Вспышка дула выстрела
    this.muzzleLight = new THREE.PointLight(0xffaa00, 0, 8);
    this.scene.add(this.muzzleLight);

    // 10 Секретных светящихся посылок Городни
    this.secretPackages = [];
    this.collectedCount = 0;
    this.initSecretPackages();
  }

  initSecretPackages() {
    const coords = [
      { name: 'Дах АТБ', pos: new THREE.Vector3(0, 8.0, -180) },
      { name: 'Глибина Дендропарку', pos: new THREE.Vector3(140, 1.0, 150) },
      { name: 'Міст через р. Смяч', pos: new THREE.Vector3(0, 1.5, -220) },
      { name: 'Перон Ж/Д Вокзалу', pos: new THREE.Vector3(450, 1.2, 35) },
      { name: 'Кінець смуги Аеродрому ПАГ-14', pos: new THREE.Vector3(340, 1.0, -700) },
      { name: 'Острів озера Делдачков', pos: new THREE.Vector3(-280, 1.2, -300) },
      { name: 'Ряди Базару', pos: new THREE.Vector3(-235, 1.0, 75) },
      { name: 'Двір Лікарні', pos: new THREE.Vector3(-80, 1.0, 185) },
      { name: 'Рампа Нової Пошти №2', pos: new THREE.Vector3(-185, 1.0, -155) },
      { name: 'Дах боксу СТО', pos: new THREE.Vector3(180, 7.0, -80) }
    ];

    const packageGeo = new THREE.BoxGeometry(0.75, 0.5, 0.45);
    const packageMat = new THREE.MeshStandardMaterial({
      color: 0x00ffcc,
      emissive: 0x00a8ff,
      emissiveIntensity: 0.9,
      roughness: 0.2
    });

    coords.forEach((item, idx) => {
      const mesh = new THREE.Mesh(packageGeo, packageMat.clone());
      mesh.position.copy(item.pos);
      this.scene.add(mesh);

      // Световой ореол посылки
      const pLight = new THREE.PointLight(0x00ffcc, 1.5, 6);
      pLight.position.copy(item.pos);
      this.scene.add(pLight);

      this.secretPackages.push({ id: idx + 1, name: item.name, mesh, light: pLight, collected: false });
    });
  }

  selectWeapon(slot, playerMesh) {
    const slots = { 1: 'fists', 2: 'bat', 3: 'pistol', 4: 'ak47' };
    this.currentWeapon = slots[slot] || 'fists';
    this.updateWeaponMeshInHand(playerMesh);
  }

  updateWeaponMeshInHand(playerGroup) {
    if (!playerGroup) return;
    const hand = playerGroup.getObjectByName('PlayerHandR');
    if (!hand) return;

    // Очистка старой модели
    while (hand.children.length > 0) hand.remove(hand.children[0]);

    if (this.currentWeapon === 'bat') {
      const bat = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.025, 0.85, 8), new THREE.MeshLambertMaterial({ color: 0xd35400 }));
      bat.rotation.x = Math.PI / 2;
      hand.add(bat);
    } else if (this.currentWeapon === 'pistol') {
      const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.24), new THREE.MeshStandardMaterial({ color: 0x222222 }));
      gun.position.set(0, -0.1, 0.12);
      hand.add(gun);
    } else if (this.currentWeapon === 'ak47') {
      const ak = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.2, 0.75), new THREE.MeshStandardMaterial({ color: 0x111111 }));
      ak.position.set(0, -0.1, 0.25);
      hand.add(ak);
    }
  }

  attack(player, camera, particles, livingCity) {
    if (this.shootCooldown > 0) return;

    if (this.currentWeapon === 'fists' || this.currentWeapon === 'bat') {
      this.shootCooldown = 0.35;
      const range = this.currentWeapon === 'bat' ? 3.0 : 2.0;
      const dmg = this.currentWeapon === 'bat' ? 55 : 25;

      // Ближний бой по пешеходам
      livingCity.pedestrians.forEach(ped => {
        if (ped.group.position.distanceTo(player.position) < range) {
          ped.panic = true;
          particles.spawnImpactSparks(ped.group.position, '#e74c3c');
          player.wantedStars = Math.min(5, player.wantedStars + 1);
        }
      });
      this.sound.playCrash(4);
      return;
    }

    // Огнестрел (Пистолет / АК-47)
    const isAK = this.currentWeapon === 'ak47';
    const ammoKey = isAK ? 'ak47' : 'pistol';

    if (this.ammo[ammoKey] <= 0) return;
    this.ammo[ammoKey]--;
    this.shootCooldown = isAK ? 0.1 : 0.25;

    // Вспышка дула
    const fwd = new THREE.Vector3();
    camera.getWorldDirection(fwd);
    const muzzlePos = player.position.clone().add(new THREE.Vector3(0, 1.4, 0)).addScaledVector(fwd, 0.9);
    this.muzzleLight.position.copy(muzzlePos);
    this.muzzleLight.intensity = 4.0;
    setTimeout(() => { this.muzzleLight.intensity = 0; }, 40);

    // Звук выстрела
    if (isAK) this.sound.playCrash(18);
    else this.sound.playCrash(10);

    // Трассер пули
    const hitTarget = muzzlePos.clone().addScaledVector(fwd, 120);
    particles.spawnBulletTracer(muzzlePos, hitTarget);

    // Выстрел привлекает полицию
    player.wantedStars = Math.max(1, player.wantedStars);
  }

  update(delta, player, particles) {
    if (this.shootCooldown > 0) this.shootCooldown -= delta;

    // Анимация и сбор 10 секретных посылок
    this.secretPackages.forEach(pkg => {
      if (pkg.collected) return;
      pkg.mesh.rotation.y += delta * 2.0;
      pkg.mesh.position.y += Math.sin(Date.now() / 300) * 0.003;

      if (player.position.distanceTo(pkg.mesh.position) < 2.5) {
        pkg.collected = true;
        this.scene.remove(pkg.mesh);
        this.scene.remove(pkg.light);
        this.collectedCount++;
        this.sound.playPurchase();

        alert(`Знайдено секретний предмет: «${pkg.name}» (${this.collectedCount}/10)!`);

        // Награда за сбор всех 10
        if (this.collectedCount === 10) {
          player.money += 50000;
          alert('ВІТАЄМО! Зібрано всі 10 секретів Городні! Отримано 50 000 ₴ та доступ до суперкара на Аеродромі!');
        }
      }
    });
  }

  triggerWasted(player) {
    const screen = document.getElementById('wasted-screen');
    if (screen) screen.style.display = 'flex';
    this.sound.playCrash(30);

    setTimeout(() => {
      // Возрождение возле Городнянской районной больницы: (-80, 0, 160)
      player.position.set(-80, 0, 160);
      player.health = 100;
      player.wantedStars = 0;
      player.money = Math.max(0, player.money - 250); // Плата за лечение
      if (screen) screen.style.display = 'none';
    }, 3500);
  }

  triggerBusted(player) {
    const screen = document.getElementById('busted-screen');
    if (screen) screen.style.display = 'flex';

    setTimeout(() => {
      // Выход из полицейского участка в центре: (-18, 0, -45)
      player.position.set(-18, 0, -45);
      player.wantedStars = 0;
      player.money = Math.max(0, player.money - 500);
      if (screen) screen.style.display = 'none';
    }, 3500);
  }
}

// =============================================================================
// 4. ДИНАМИЧЕСКАЯ ПОГОДА И РЕАЛИСТИЧНАЯ ФИЗИКА ПОВЕРХНОСТЕЙ
// =============================================================================
class DynamicWeatherSystem {
  constructor(scene, soundEngine) {
    this.scene = scene;
    this.sound = soundEngine;
    this.currentWeather = 'CLEAR'; // 'CLEAR', 'FOG', 'RAIN'
    this.weatherTimer = 0;

    this.initRainParticles();
    this.initLightning();
  }

  initRainParticles() {
    const count = 1600;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);

    for (let i = 0; i < count * 3; i += 3) {
      pos[i] = (Math.random() - 0.5) * 350;
      pos[i + 1] = Math.random() * 80;
      pos[i + 2] = (Math.random() - 0.5) * 350;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: 0x74b9ff,
      size: 0.35,
      transparent: true,
      opacity: 0.75
    });

    this.rainPoints = new THREE.Points(geo, mat);
    this.rainPoints.visible = false;
    this.scene.add(this.rainPoints);
  }

  initLightning() {
    this.lightningLight = new THREE.DirectionalLight(0xffffff, 0);
    this.lightningLight.position.set(0, 150, 0);
    this.scene.add(this.lightningLight);
    this.nextFlash = 8.0;
  }

  setWeather(type, cityRoads) {
    this.currentWeather = type;

    if (type === 'CLEAR') {
      this.scene.fog.density = 0.0022;
      this.rainPoints.visible = false;
      this.setRoadWetness(cityRoads, 0.85); // Сухой шероховатый асфальт
    } else if (type === 'FOG') {
      this.scene.fog.density = 0.016; // Густой туман
      this.rainPoints.visible = false;
      this.setRoadWetness(cityRoads, 0.5);
    } else if (type === 'RAIN') {
      this.scene.fog.density = 0.006;
      this.rainPoints.visible = true;
      this.setRoadWetness(cityRoads, 0.15); // Мокрый зеркальный асфальт
    }
  }

  setRoadWetness(roads, roughness) {
    if (!roads) return;
    roads.forEach(mesh => {
      if (mesh.material && mesh.material.roughness !== undefined) {
        mesh.material.roughness = roughness;
        mesh.material.metalness = roughness < 0.3 ? 0.65 : 0.1;
      }
    });
  }

  update(delta, playerPos) {
    if (this.currentWeather === 'RAIN') {
      // Следование капель дождя за игроком
      this.rainPoints.position.x = playerPos.x;
      this.rainPoints.position.z = playerPos.z;

      const positions = this.rainPoints.geometry.attributes.position.array;
      for (let i = 1; i < positions.length; i += 3) {
        positions[i] -= delta * 65.0;
        if (positions[i] < 0) positions[i] = 80;
      }
      this.rainPoints.geometry.attributes.position.needsUpdate = true;

      // Вспышки молний и раскаты грома
      this.nextFlash -= delta;
      if (this.nextFlash <= 0) {
        this.nextFlash = 6.0 + Math.random() * 12.0;
        this.lightningLight.intensity = 4.5;
        this.sound.playCrash(25); // Гром
        setTimeout(() => { this.lightningLight.intensity = 0; }, 85);
      }
    }
  }
}

// =============================================================================
// 5. ИНТЕРАКТИВНЫЙ GTA-СМАРТФОН И СИСТЕМА СОХРАНЕНИЯ (LOCALSTORAGE)
// =============================================================================
class GTASmartphone {
  constructor(gameApp) {
    this.app = gameApp;
    this.isOpen = false;
    this.activeWaypoint = null;

    this.setupPhoneUI();
  }

  setupPhoneUI() {
    window.addEventListener('keydown', e => {
      if (e.key.toLowerCase() === 'p' || e.key === 'Tab') {
        e.preventDefault();
        this.togglePhone();
      }
    });
  }

  togglePhone() {
    this.isOpen = !this.isOpen;
    const phoneEl = document.getElementById('gta-smartphone');
    if (phoneEl) phoneEl.style.display = this.isOpen ? 'flex' : 'none';
  }

  setWaypoint(x, z, label) {
    this.activeWaypoint = { x, z, label };
    alert(`GPS-маршрут встановлено: ${label}`);
    this.togglePhone();
  }

  saveGame(player, tuning) {
    const data = {
      money: player.money,
      health: player.health,
      pos: { x: player.position.x, y: player.position.y, z: player.position.z },
      upgrades: tuning.upgrades,
      packagesCount: this.app.combat.collectedCount,
      timestamp: new Date().toLocaleString()
    };
    localStorage.setItem('gorodnya_save_v1', JSON.stringify(data));
    alert('Гру збережено в пам’ять браузера!');
  }

  loadGame(player, tuning) {
    const raw = localStorage.getItem('gorodnya_save_v1');
    if (!raw) {
      alert('Збережень не знайдено!');
      return;
    }
    const data = JSON.parse(raw);
    player.money = data.money;
    player.health = data.health;
    player.position.set(data.pos.x, data.pos.y, data.pos.z);
    alert(`Збереження завантажено від ${data.timestamp}!`);
  }
}

// =============================================================================
// 6. ЕДИНЫЙ ЗАГРУЗЧИК (GAME BOOTSTRAP: ЧАСТИ 1, 2 И 3)
// =============================================================================
class GameBootstrap {
  static initAll(app) {
    // 1. Инициализация интерьеров
    app.interiors = new InteriorSystem(app.scene, app.cityMap.collisionBoxes);

    // 2. Инициализация тюнинг-ателье
    app.tuning = new TuningSystem(app.sound);

    // 3. Инициализация арсенала, пасхалок и боевой системы
    app.combat = new CombatAndEasterEggSystem(app.scene, app.sound);

    // 4. Инициализация динамической погоды
    app.weather = new DynamicWeatherSystem(app.scene, app.sound);

    // 5. Инициализация смартфона
    app.phone = new GTASmartphone(app);

    console.log('✅ [GameBootstrap] Усі системи Частин 1, 2 та 3 успішно інтегровані в єдине ядро Городні!');
  }
}
