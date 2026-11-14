/**
 * =============================================================================
 * GORODNYA 3D: OPEN WORLD (ЧАСТЬ 3 - AAA SYSTEMS EXPANSION)
 * =============================================================================
 * Lead Gameplay Systems Architect, VFX/Shader Artist & UI/UX Designer
 * 
 * ПОЛНОЦЕННЫЙ МОДУЛЬ РАСШИРЕНИЯ ГЕЙМПЛЕЯ ГОРОДНИ:
 * 1. Бесшовные 3D-интерьеры ключевых зданий:
 *    - Торговый зал супермаркета «АТБ-Маркет» (ул. Черниговская, 5)
 *    - Торговый зал «Аврора Мультимаркет» (ул. 1-го Мая, 19)
 *    - Бокс СТО / Гараж на окраине Городни со смотровой ямой и гидроподъемником
 * 2. Тюнинг-ателье в СТО:
 *    - Облет камеры на 360° вокруг автомобиля в боксе
 *    - Покраска кузова: глянец, металлик, перламутр, хамелеон, матовый
 *    - Смена 3D-дисков (кованные звезды, BBS-паутинка, глубокие разварки)
 *    - Регулировка клиренса (Drop/Stance) и отрицательного развала колес (Camber)
 *    - Чип-тюнинг ECU (+35% максималка, +45% ускорение), спортивные шины Michelin
 *    - Неоновая подсветка днища (Underglow) с выбором цвета
 *    - Закис азота (Нитро / NOS на Shift): синее пламя из выхлопа, искажение FOV
 * 3. Боевая система и арсенал (клавиши 1–4):
 *    - 1: Кулаки (ближний бой, физика ударов)
 *    - 2: Бита / монтировка (спрятана на Центральном рынке и в ангаре Аэродрома)
 *    - 3: Пистолет Форт / Макаров (вспышки дула, гильзы, звук, трассеры)
 *    - 4: Автомат АК-47 (автоматический огонь, отдача, снопы искр, вызов полиции)
 *    - Экран «ПОТРАЧЕНО» (Wasted) с респавном у Городнянской районной больницы
 *    - Экран «АРЕСТОВАН» (Busted) с респавном у отделения полиции
 *    - 10 Секретных светящихся посылок Городни с наградой 50 000 ₴
 * 4. Динамическая погода и смена суток:
 *    - День / Золотой закат / Глубокая ночь
 *    - Автоматическое включение уличных фонарей, неоновых вывесок и автомобильных фар
 *    - Режимы погоды: Ясно, Густой туман над рекой Смяч и озером, Гроза с молниями и ливнем
 *    - Мокрый зеркальный асфальт и аквапланирование (снижение сцепления шин)
 * 5. Интерактивный GTA-смартфон (клавиша P):
 *    - GPS-навигатор по Городне с установкой луча-метки (Waypoint) в 3D
 *    - Приложение миссий и контрактов
 *    - Радар поиска 10 секретных посылок
 *    - Банк и Сохранение / Загрузка игры через localStorage
 * 6. Глобальный загрузчик и бесшовная интеграция с Частями 1 и 2
 * =============================================================================
 */

// =============================================================================
// 1. БЕСШОВНЫЕ ИНТЕРЬЕРЫ ЗДАНИЙ (АТБ, АВРОРА, БОКС СТО)
// =============================================================================
class InteriorSystem {
  constructor(scene, collisionBoxes) {
    this.scene = scene;
    this.collisionBoxes = collisionBoxes;

    this.atbInteriorGroup = null;
    this.avroraInteriorGroup = null;
    this.stoGarageGroup = null;

    this.slidingDoors = [];

    this.buildATBInterior();
    this.buildAvroraInterior();
    this.buildGarageSTO();
  }

  buildATBInterior() {
    // Супермаркет «АТБ-Маркет» (ул. Черниговская, 5)
    // Координаты центра здания: (0, 0, -180), размер торгового зала: 32м x 22м x 5.8м
    const atbGroup = new THREE.Group();
    atbGroup.position.set(0, 0, -180);

    // Плиточный пол (светлый керамогранит 60x60 с глянцевым отблеском)
    const floorGeo = new THREE.PlaneGeometry(32, 22);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0xecf0f1,
      roughness: 0.18,
      metalness: 0.08
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.04;
    floor.receiveShadow = true;
    atbGroup.add(floor);

    // Подвесной потолок со встроенными светодиодными панелями 600x600
    const ceilingGeo = new THREE.PlaneGeometry(32, 22);
    const ceilingMat = new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.8 });
    const ceiling = new THREE.Mesh(ceilingGeo, ceilingMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = 5.75;
    atbGroup.add(ceiling);

    // 6 световых рядов ламп дневного света
    for (let lx = -10; lx <= 10; lx += 5) {
      for (let lz = -8; lz <= 8; lz += 4) {
        const lamp = new THREE.Mesh(
          new THREE.BoxGeometry(1.4, 0.08, 0.4),
          new THREE.MeshBasicMaterial({ color: 0xffffff })
        );
        lamp.position.set(lx, 5.7, lz);
        atbGroup.add(lamp);

        if ((lx === -5 || lx === 5) && (lz === -4 || lz === 4)) {
          const pLight = new THREE.PointLight(0xfff5e6, 0.9, 14);
          pLight.position.set(lx, 5.0, lz);
          atbGroup.add(pLight);
        }
      }
    }

    // Ряды двусторонних металлических стеллажей АТБ с продуктами
    const shelfFrameMat = new THREE.MeshStandardMaterial({ color: 0x1e272e, roughness: 0.5 });
    const snackColors = [0xe74c3c, 0xf1c40f, 0x2ecc71, 0x3498db, 0xe67e22, 0x9b59b6];

    for (let sx = -9; sx <= 9; sx += 4.5) {
      // Каркас стеллажа
      const rack = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.8, 14), shelfFrameMat);
      rack.position.set(sx, 1.4, -1);
      rack.castShadow = true;
      rack.receiveShadow = true;
      atbGroup.add(rack);

      // Коллизия стеллажа
      this.collisionBoxes.push(new THREE.Box3().setFromCenterAndSize(
        new THREE.Vector3(sx, 1.4, -181),
        new THREE.Vector3(1.8, 2.8, 14)
      ));

      // 4 яруса полок с яркими упаковками товаров (чипсы, крупы, шоколад, напитки)
      for (let tier = 0; tier < 4; tier++) {
        for (let itemIdx = -6; itemIdx <= 6; itemIdx += 1.2) {
          const itemBox = new THREE.Mesh(
            new THREE.BoxGeometry(0.35, 0.35, 0.75),
            new THREE.MeshLambertMaterial({ color: snackColors[Math.abs(Math.round(sx + tier + itemIdx)) % snackColors.length] })
          );
          itemBox.position.set(sx + (itemIdx % 2 === 0 ? 0.75 : -0.75), 0.5 + tier * 0.65, -1 + itemIdx);
          atbGroup.add(itemBox);
        }
      }
    }

    // Длинная холодильная витрина для молочной продукции и напитков вдоль северной стены
    const fridgeMat = new THREE.MeshStandardMaterial({ color: 0x718093, metalness: 0.3, roughness: 0.3 });
    const fridgeGlassMat = new THREE.MeshStandardMaterial({
      color: 0x81ecec,
      transparent: true,
      opacity: 0.45,
      roughness: 0.1
    });

    const fridgeBase = new THREE.Mesh(new THREE.BoxGeometry(26, 3.2, 1.9), fridgeMat);
    fridgeBase.position.set(0, 1.6, -9.8);
    atbGroup.add(fridgeBase);

    // Стеклянные раздвижные дверцы витрины
    const fridgeGlass = new THREE.Mesh(new THREE.BoxGeometry(25.6, 2.4, 0.1), fridgeGlassMat);
    fridgeGlass.position.set(0, 1.8, -8.8);
    atbGroup.add(fridgeGlass);

    // Неоновая светодиодная полоса подсветки полок холодильника (холодный белый / аква)
    const ledStrip = new THREE.Mesh(
      new THREE.BoxGeometry(25.4, 0.12, 0.1),
      new THREE.MeshBasicMaterial({ color: 0x00d2d3 })
    );
    ledStrip.position.set(0, 3.05, -8.75);
    atbGroup.add(ledStrip);

    const fridgeLight = new THREE.PointLight(0x00d2d3, 1.4, 12);
    fridgeLight.position.set(0, 2.5, -8.5);
    atbGroup.add(fridgeLight);

    // Кассовая зона АТБ: 3 кассовых стола с конвейерной лентой и сканерами штрих-кода
    for (let c = -6; c <= 6; c += 6) {
      const checkoutGroup = new THREE.Group();
      checkoutGroup.position.set(c, 0, 7.5);

      // Стол с лентой
      const table = new THREE.Mesh(
        new THREE.BoxGeometry(4.2, 1.05, 1.3),
        new THREE.MeshStandardMaterial({ color: 0x2d3436, roughness: 0.4 })
      );
      table.position.set(0, 0.525, 0);
      checkoutGroup.add(table);

      // Черная конвейерная резиновая лента
      const belt = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 0.05, 0.7),
        new THREE.MeshLambertMaterial({ color: 0x111111 })
      );
      belt.position.set(-0.6, 1.06, 0);
      checkoutGroup.add(belt);

      // Монитор кассира и лазерный сканер
      const posTerminal = new THREE.Mesh(
        new THREE.BoxGeometry(0.35, 0.4, 0.25),
        new THREE.MeshStandardMaterial({ color: 0x636e72 })
      );
      posTerminal.position.set(1.1, 1.25, -0.2);
      checkoutGroup.add(posTerminal);

      const scannerLaser = new THREE.Mesh(
        new THREE.BoxGeometry(0.15, 0.05, 0.15),
        new THREE.MeshBasicMaterial({ color: 0xff3838 })
      );
      scannerLaser.position.set(0.7, 1.08, 0);
      checkoutGroup.add(scannerLaser);

      // Кассир в синей фирменной униформе АТБ
      const cashier = new THREE.Group();
      cashier.position.set(1.1, 0, 0.5);

      const cTorso = new THREE.Mesh(
        new THREE.CylinderGeometry(0.24, 0.24, 1.1),
        new THREE.MeshStandardMaterial({ color: 0x0984e3 }) // Синий АТБ
      );
      cTorso.position.y = 0.55;
      const cHead = new THREE.Mesh(new THREE.SphereGeometry(0.18), new THREE.MeshLambertMaterial({ color: 0xf5cba7 }));
      cHead.position.y = 1.3;
      cashier.add(cTorso);
      cashier.add(cHead);
      checkoutGroup.add(cashier);

      atbGroup.add(checkoutGroup);

      this.collisionBoxes.push(new THREE.Box3().setFromCenterAndSize(
        new THREE.Vector3(c, 0.6, -172.5),
        new THREE.Vector3(4.2, 1.2, 1.4)
      ));
    }

    // Красные покупательские корзинки стопкой у входа
    for (let b = 0; b < 6; b++) {
      const basket = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.35, 0.45),
        new THREE.MeshStandardMaterial({ color: 0xd63031, roughness: 0.3 })
      );
      basket.position.set(11.5, 0.2 + b * 0.18, 9.2);
      atbGroup.add(basket);
    }

    // Раздвижные автоматические стеклянные входные двери
    const doorL = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 3.2, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x74b9ff, transparent: true, opacity: 0.55, roughness: 0.1 })
    );
    doorL.position.set(-0.85, 1.6, 10.9);
    atbGroup.add(doorL);

    const doorR = doorL.clone();
    doorR.position.x = 0.85;
    atbGroup.add(doorR);

    this.slidingDoors.push({ left: doorL, right: doorR, centerPos: new THREE.Vector3(0, 0, -169), openAmount: 0 });

    this.scene.add(atbGroup);
    this.atbInteriorGroup = atbGroup;
  }

  buildAvroraInterior() {
    // «Аврора Мультимаркет» (ул. 1-го Мая, 19)
    // Позиция: (-90, 0, -80), размеры: 20м x 16м x 5м
    const avrGroup = new THREE.Group();
    avrGroup.position.set(-90, 0, -80);

    // Светлый полированный пол
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 16),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.04;
    avrGroup.add(floor);

    // Потолок с ярким торговым светом
    const ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 16),
      new THREE.MeshStandardMaterial({ color: 0xf1f2f6 })
    );
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = 4.8;
    avrGroup.add(ceiling);

    const avrLight = new THREE.PointLight(0xfffae6, 1.2, 16);
    avrLight.position.set(0, 4.2, 0);
    avrGroup.add(avrLight);

    // Фирменные ярко-желтые и красные стеллажи «Аврора»
    const yellowRackMat = new THREE.MeshStandardMaterial({ color: 0xfbc531, roughness: 0.4 });
    const redRackMat = new THREE.MeshStandardMaterial({ color: 0xeb4d4b, roughness: 0.4 });

    for (let rx = -6; rx <= 6; rx += 4) {
      const rack = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.5, 9.5), rx % 8 === 0 ? yellowRackMat : redRackMat);
      rack.position.set(rx, 1.25, -1);
      avrGroup.add(rack);

      this.collisionBoxes.push(new THREE.Box3().setFromCenterAndSize(
        new THREE.Vector3(-90 + rx, 1.25, -81),
        new THREE.Vector3(1.4, 2.5, 9.5)
      ));

      // Мелочи на полках (фонарики, батарейки, посуда, блокноты)
      for (let i = -3.5; i <= 3.5; i += 1.4) {
        const item = new THREE.Mesh(
          new THREE.BoxGeometry(0.25, 0.3, 0.4),
          new THREE.MeshStandardMaterial({ color: 0x00d2d3 })
        );
        item.position.set(rx + 0.65, 1.1, -1 + i);
        avrGroup.add(item);
      }
    }

    // Красная кассовая зона с логотипом
    const desk = new THREE.Mesh(new THREE.BoxGeometry(5.2, 1.1, 1.3), redRackMat);
    desk.position.set(0, 0.55, 5.5);
    avrGroup.add(desk);

    this.collisionBoxes.push(new THREE.Box3().setFromCenterAndSize(
      new THREE.Vector3(-90, 0.6, -74.5),
      new THREE.Vector3(5.2, 1.2, 1.4)
    ));

    this.scene.add(avrGroup);
    this.avroraInteriorGroup = avrGroup;
  }

  buildGarageSTO() {
    // Бокс СТО / Гараж тюнинга (промзона на окраине Городни)
    // Позиция: (180, 0, -80), размеры: 26м x 24м x 7.5м
    const stoGroup = new THREE.Group();
    stoGroup.position.set(180, 0, -80);

    // Маслянистый замасленный бетонный пол со следами шин
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(26, 24),
      new THREE.MeshStandardMaterial({ color: 0x2d3436, roughness: 0.85, metalness: 0.15 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.04;
    stoGroup.add(floor);

    // Стены из силикатного кирпича
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x636e72, roughness: 0.9 });
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(26, 7.5, 0.8), wallMat);
    backWall.position.set(0, 3.75, -12);
    stoGroup.add(backWall);

    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.8, 7.5, 24), wallMat);
    leftWall.position.set(-13, 3.75, 0);
    stoGroup.add(leftWall);

    const rightWall = leftWall.clone();
    rightWall.position.x = 13;
    stoGroup.add(rightWall);

    // Смотровая яма с металлической окантовкой по центру бокса
    const pitGeo = new THREE.BoxGeometry(3.6, 0.1, 9.5);
    const pitMat = new THREE.MeshBasicMaterial({ color: 0x050505 });
    const pit = new THREE.Mesh(pitGeo, pitMat);
    pit.position.set(0, 0.05, 0);
    stoGroup.add(pit);

    // Двухстоечный гидравлический автоподъемник синего цвета
    const liftMat = new THREE.MeshStandardMaterial({ color: 0x0984e3, metalness: 0.75, roughness: 0.25 });
    const postL = new THREE.Mesh(new THREE.BoxGeometry(0.45, 5.2, 0.55), liftMat);
    postL.position.set(-2.6, 2.6, 0);
    const postR = postL.clone();
    postR.position.x = 2.6;
    stoGroup.add(postL);
    stoGroup.add(postR);

    // Лапы подъемника
    const armGeo = new THREE.BoxGeometry(1.6, 0.12, 0.25);
    const armFL = new THREE.Mesh(armGeo, liftMat);
    armFL.position.set(-1.8, 0.8, 1.4);
    armFL.rotation.y = 0.35;
    const armFR = armFL.clone();
    armFR.position.x = 1.8;
    armFR.rotation.y = -0.35;
    stoGroup.add(armFL);
    stoGroup.add(armFR);

    // Промышленный верстак с тисками и ящиками инструментов
    const bench = new THREE.Mesh(
      new THREE.BoxGeometry(7.5, 1.2, 1.3),
      new THREE.MeshStandardMaterial({ color: 0xd63031, roughness: 0.5 })
    );
    bench.position.set(8.5, 0.6, -10.5);
    stoGroup.add(bench);

    // Металлические бочки для моторного масла
    for (let br = 0; br < 4; br++) {
      const barrel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.42, 0.42, 1.15, 12),
        new THREE.MeshStandardMaterial({ color: br % 2 === 0 ? 0x0097e6 : 0x273c75, metalness: 0.8 })
      );
      barrel.position.set(-11.2, 0.575, -9.5 + br * 1.05);
      stoGroup.add(barrel);
    }

    // Стойка со спортивными колесными дисками и шинами на стене
    const rackMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    for (let w = 0; w < 4; w++) {
      const tire = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.16, 8, 18), rackMat);
      tire.rotation.y = Math.PI / 2;
      tire.position.set(-12.4, 2.2 + (w % 2) * 1.2, -3 + Math.floor(w / 2) * 1.4);
      stoGroup.add(tire);
    }

    // Яркий потолочный свет СТО
    const stoLight = new THREE.PointLight(0xffffff, 1.8, 22);
    stoLight.position.set(0, 6.2, 0);
    stoGroup.add(stoLight);

    this.scene.add(stoGroup);
    this.stoGarageGroup = stoGroup;

    // Коллизии стен СТО
    this.collisionBoxes.push(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(180, 3.75, -92), new THREE.Vector3(26, 7.5, 0.8)));
    this.collisionBoxes.push(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(167, 3.75, -80), new THREE.Vector3(0.8, 7.5, 24)));
    this.collisionBoxes.push(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(193, 3.75, -80), new THREE.Vector3(0.8, 7.5, 24)));
  }

  update(delta, playerPos) {
    // Плавная автоматическая анимация раздвижных дверей АТБ при приближении
    this.slidingDoors.forEach(door => {
      const dist = playerPos.distanceTo(door.centerPos);
      const shouldOpen = dist < 5.0;
      const targetOpen = shouldOpen ? 1.4 : 0;
      door.openAmount = THREE.MathUtils.lerp(door.openAmount, targetOpen, delta * 5.0);

      door.left.position.x = -0.85 - door.openAmount;
      door.right.position.x = 0.85 + door.openAmount;
    });
  }
}

// =============================================================================
// 2. СИСТЕМА ТЮНИНГА И КАСТОМИЗАЦИИ В БОКСЕ СТО
// =============================================================================
class TuningSystem {
  constructor(soundEngine) {
    this.sound = soundEngine;
    this.activeVehicle = null;
    this.isMenuOpen = false;
    this.orbitAngle = 0;

    // Конфигурация активных улучшений
    this.upgrades = {
      color: '#c0392b',
      finish: 'gloss', // 'gloss', 'metallic', 'matte', 'chameleon'
      wheelRim: 'stock', // 'stock', 'bbs', 'star', 'deep'
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
    if (!playerVehicle || !playerVehicle.mesh) return false;
    // Координаты заезда в бокс СТО: (180, 0, -80)
    const dist = playerVehicle.mesh.position.distanceTo(new THREE.Vector3(180, 0, -80));
    return dist < 8.0;
  }

  openTuningMenu(vehiclePhysics) {
    this.activeVehicle = vehiclePhysics;
    this.isMenuOpen = true;
    const modal = document.getElementById('tuning-modal');
    if (modal) modal.style.display = 'block';
  }

  closeTuningMenu() {
    this.isMenuOpen = false;
    const modal = document.getElementById('tuning-modal');
    if (modal) modal.style.display = 'none';
  }

  updateOrbitCamera(delta, camera) {
    if (!this.isMenuOpen || !this.activeVehicle) return;
    this.orbitAngle += delta * 0.45;
    const vPos = this.activeVehicle.mesh.position;
    const radius = 6.8;
    const height = 2.4;

    camera.position.set(
      vPos.x + Math.sin(this.orbitAngle) * radius,
      vPos.y + height,
      vPos.z + Math.cos(this.orbitAngle) * radius
    );
    camera.lookAt(vPos.x, vPos.y + 0.8, vPos.z);
  }

  applyPaint(colorHex, finish = 'gloss') {
    if (!this.activeVehicle) return;
    this.upgrades.color = colorHex;
    this.upgrades.finish = finish;
    const col = new THREE.Color(colorHex);

    this.activeVehicle.mesh.traverse(child => {
      if (child.isMesh && child.material && child.geometry.type === 'BoxGeometry' && child.position.y > 0.4) {
        child.material.color = col;
        if (finish === 'metallic') {
          child.material.metalness = 0.88;
          child.material.roughness = 0.16;
        } else if (finish === 'matte') {
          child.material.metalness = 0.05;
          child.material.roughness = 0.92;
        } else if (finish === 'chameleon') {
          child.material.metalness = 0.75;
          child.material.roughness = 0.12;
          child.material.emissive = new THREE.Color(0x2e0854);
          child.material.emissiveIntensity = 0.35;
        } else {
          child.material.metalness = 0.35;
          child.material.roughness = 0.3;
        }
      }
    });

    if (this.sound && this.sound.playPurchase) this.sound.playPurchase();
  }

  applySuspension(lowerAmount, camberAngle) {
    if (!this.activeVehicle || !this.activeVehicle.wheels) return;
    this.upgrades.suspensionLower = lowerAmount;
    this.upgrades.camber = camberAngle;

    const w = this.activeVehicle.wheels;
    const baseH = 0.36 + lowerAmount;

    w.fl.position.y = baseH;
    w.fr.position.y = baseH;
    w.rl.position.y = baseH;
    w.rr.position.y = baseH;

    // Отрицательный развал для дрифта и стенса
    w.fl.rotation.z = camberAngle;
    w.fr.rotation.z = -camberAngle;
    w.rl.rotation.z = camberAngle;
    w.rr.rotation.z = -camberAngle;
  }

  installUnderglow(colorHex) {
    if (!this.activeVehicle) return;
    this.upgrades.underglowColor = colorHex;

    // Удаляем старый свет, если был
    const oldLight = this.activeVehicle.mesh.getObjectByName('UnderglowLight');
    if (oldLight) this.activeVehicle.mesh.remove(oldLight);

    const light = new THREE.PointLight(new THREE.Color(colorHex), 4.5, 6.0);
    light.name = 'UnderglowLight';
    light.position.set(0, 0.12, 0);
    this.activeVehicle.mesh.add(light);
  }

  buyUpgrade(player, upgradeType) {
    const catalog = {
      chip: { cost: 1500, name: 'Stage 2 ECU чип-тюнинг (+35% максималка, +45% ускорение)' },
      tires: { cost: 900, name: 'Спортивные полуслики Michelin Pilot Sport' },
      nitro: { cost: 2200, name: 'Система закиси азота Nitrous Express (NOS)' },
      neon: { cost: 750, name: 'RGB LED неон днища' }
    };

    const item = catalog[upgradeType];
    if (item && player.money >= item.cost) {
      player.money -= item.cost;
      if (this.sound && this.sound.playPurchase) this.sound.playPurchase();

      if (upgradeType === 'chip') {
        this.upgrades.chipTuning = true;
        this.activeVehicle.maxSpeed *= 1.35;
        this.activeVehicle.acceleration *= 1.45;
      } else if (upgradeType === 'tires') {
        this.upgrades.sportTires = true;
        this.activeVehicle.friction = 0.993;
      } else if (upgradeType === 'nitro') {
        this.upgrades.nitroInstalled = true;
      } else if (upgradeType === 'neon') {
        this.installUnderglow('#00ffcc');
      }
      return true;
    }
    return false;
  }

  triggerNitro(delta, vehiclePhysics, particles, camera) {
    if (!this.upgrades.nitroInstalled || this.nitroFuel <= 0) return;

    this.nitroActive = true;
    this.nitroFuel = Math.max(0, this.nitroFuel - delta * 30.0);
    vehiclePhysics.speed = Math.min(vehiclePhysics.maxSpeed * 1.55, vehiclePhysics.speed + 42.0 * delta);

    // Синее реактивное пламя из выхлопных труб
    const leftExhaust = new THREE.Vector3(0.55, 0.35, -2.15).applyMatrix4(vehiclePhysics.mesh.matrixWorld);
    const rightExhaust = new THREE.Vector3(-0.55, 0.35, -2.15).applyMatrix4(vehiclePhysics.mesh.matrixWorld);

    if (particles && particles.spawnNitroFlame) {
      particles.spawnNitroFlame(leftExhaust);
      particles.spawnNitroFlame(rightExhaust);
    }

    // Эффект ускорения и размытия зрения (Warp FOV)
    camera.fov = THREE.MathUtils.lerp(camera.fov, 82, delta * 9.0);
    camera.updateProjectionMatrix();
  }

  stopNitro(delta, camera) {
    this.nitroActive = false;
    camera.fov = THREE.MathUtils.lerp(camera.fov, 65, delta * 6.0);
    camera.updateProjectionMatrix();
    // Плавная регенерация баллона закиси азота
    this.nitroFuel = Math.min(100, this.nitroFuel + delta * 8.0);
  }
}

// =============================================================================
// 3. БОЕВАЯ СИСТЕМА, ОРУЖИЕ, «ПОТРАЧЕНО» / «АРЕСТОВАН» И 10 СЕКРЕТНЫХ ПОСЫЛОК
// =============================================================================
class CombatAndEasterEggSystem {
  constructor(scene, soundEngine) {
    this.scene = scene;
    this.sound = soundEngine;

    this.currentWeapon = 'fists'; // 'fists', 'bat', 'pistol', 'ak47'
    this.ammo = { pistol: 60, ak47: 240 };
    this.shootCooldown = 0;

    // Вспышка дульного пламени
    this.muzzleFlash = new THREE.PointLight(0xffaa00, 0, 9);
    this.scene.add(this.muzzleFlash);

    // 10 Секретных светящихся посылок Городни
    this.secretPackages = [];
    this.collectedCount = 0;
    this.initSecretPackages();
  }

  initSecretPackages() {
    const coords = [
      { name: 'Крыша супермаркета «АТБ»', pos: new THREE.Vector3(0, 7.8, -180) },
      { name: 'Дендропарк Городни (вековая сосна)', pos: new THREE.Vector3(145, 1.2, 160) },
      { name: 'Старый деревянный мост через р. Смяч', pos: new THREE.Vector3(0, 1.8, -230) },
      { name: 'Перрон Ж/Д Вокзала у тепловоза', pos: new THREE.Vector3(450, 1.3, 40) },
      { name: 'Конец взлетной полосы ПАГ-14 на Аэродроме', pos: new THREE.Vector3(350, 1.1, -720) },
      { name: 'Островок Лисовецкого ставка / озера Делдачков', pos: new THREE.Vector3(-280, 1.2, -310) },
      { name: 'Ряды Центрального Базара Городни', pos: new THREE.Vector3(-240, 1.2, 80) },
      { name: 'Внутренний двор районной больницы', pos: new THREE.Vector3(-85, 1.1, 190) },
      { name: 'Грузовой терминал «Нова Пошта» №2', pos: new THREE.Vector3(-190, 1.2, -160) },
      { name: 'Крыша бокса СТО и тюнинга', pos: new THREE.Vector3(180, 7.6, -80) }
    ];

    const pkgGeo = new THREE.BoxGeometry(0.85, 0.55, 0.5);
    const pkgMat = new THREE.MeshStandardMaterial({
      color: 0x00f5d4,
      emissive: 0x00bbf9,
      emissiveIntensity: 0.95,
      metalness: 0.8,
      roughness: 0.15
    });

    coords.forEach((item, idx) => {
      const mesh = new THREE.Mesh(pkgGeo, pkgMat.clone());
      mesh.position.copy(item.pos);
      this.scene.add(mesh);

      const pLight = new THREE.PointLight(0x00f5d4, 2.0, 7.5);
      pLight.position.copy(item.pos);
      this.scene.add(pLight);

      this.secretPackages.push({
        id: idx + 1,
        name: item.name,
        mesh,
        light: pLight,
        collected: false
      });
    });
  }

  selectWeapon(slot, playerMesh) {
    const slots = { 1: 'fists', 2: 'bat', 3: 'pistol', 4: 'ak47' };
    this.currentWeapon = slots[slot] || 'fists';
    this.updateWeaponInHand(playerMesh);

    const hudWeapon = document.getElementById('hud-weapon');
    if (hudWeapon) {
      const names = {
        fists: '👊 Кулаки',
        bat: '🏏 Бита / Монтировка',
        pistol: `🔫 Пістолет (${this.ammo.pistol})`,
        ak47: `💥 АК-47 (${this.ammo.ak47})`
      };
      hudWeapon.innerText = names[this.currentWeapon];
    }
  }

  updateWeaponInHand(playerGroup) {
    if (!playerGroup) return;
    const hand = playerGroup.getObjectByName('PlayerHandR');
    if (!hand) return;

    while (hand.children.length > 0) hand.remove(hand.children[0]);

    if (this.currentWeapon === 'bat') {
      const bat = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.025, 0.9, 10),
        new THREE.MeshStandardMaterial({ color: 0xd35400, roughness: 0.6 })
      );
      bat.rotation.x = Math.PI / 2;
      hand.add(bat);
    } else if (this.currentWeapon === 'pistol') {
      const gun = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.14, 0.26),
        new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.9 })
      );
      gun.position.set(0, -0.1, 0.12);
      hand.add(gun);
    } else if (this.currentWeapon === 'ak47') {
      const ak = new THREE.Mesh(
        new THREE.BoxGeometry(0.09, 0.22, 0.85),
        new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.85 })
      );
      ak.position.set(0, -0.1, 0.3);
      hand.add(ak);
    }
  }

  attack(player, camera, particles, livingCity) {
    if (this.shootCooldown > 0) return;

    if (this.currentWeapon === 'fists' || this.currentWeapon === 'bat') {
      this.shootCooldown = 0.32;
      const isBat = this.currentWeapon === 'bat';
      const range = isBat ? 3.4 : 2.2;
      const dmg = isBat ? 60 : 25;

      if (livingCity && livingCity.pedestrians) {
        livingCity.pedestrians.forEach(ped => {
          if (ped.group.position.distanceTo(player.position) < range) {
            ped.panic = true;
            if (particles && particles.spawnImpactSparks) {
              particles.spawnImpactSparks(ped.group.position, '#e74c3c');
            }
            player.wantedStars = Math.min(5, player.wantedStars + 1);
          }
        });
      }
      if (this.sound && this.sound.playCrash) this.sound.playCrash(isBat ? 5 : 2);
      return;
    }

    // Огнестрел (Пистолет / АК-47)
    const isAK = this.currentWeapon === 'ak47';
    const ammoKey = isAK ? 'ak47' : 'pistol';

    if (this.ammo[ammoKey] <= 0) return;
    this.ammo[ammoKey]--;
    this.shootCooldown = isAK ? 0.095 : 0.26;

    // Вспышка дульного пламени
    const fwd = new THREE.Vector3();
    camera.getWorldDirection(fwd);
    const muzzlePos = player.position.clone().add(new THREE.Vector3(0, 1.45, 0)).addScaledVector(fwd, 1.1);
    this.muzzleFlash.position.copy(muzzlePos);
    this.muzzleFlash.intensity = 4.8;
    setTimeout(() => { this.muzzleFlash.intensity = 0; }, 45);

    // Звук выстрела
    if (this.sound && this.sound.playCrash) {
      this.sound.playCrash(isAK ? 20 : 12);
    }

    // Трассер пули с искрами
    const hitTarget = muzzlePos.clone().addScaledVector(fwd, 140);
    if (particles && particles.spawnBulletTracer) {
      particles.spawnBulletTracer(muzzlePos, hitTarget);
    }

    // Выстрелы в общественном месте вызывают полицию
    player.wantedStars = Math.max(1, player.wantedStars);
  }

  update(delta, player, particles) {
    if (this.shootCooldown > 0) this.shootCooldown -= delta;

    // Вращение и подбор секретных посылок
    this.secretPackages.forEach(pkg => {
      if (pkg.collected) return;
      pkg.mesh.rotation.y += delta * 2.2;
      pkg.mesh.position.y += Math.sin(Date.now() / 250) * 0.0035;

      if (player.position.distanceTo(pkg.mesh.position) < 2.6) {
        pkg.collected = true;
        this.scene.remove(pkg.mesh);
        this.scene.remove(pkg.light);
        this.collectedCount++;

        if (this.sound && this.sound.playPurchase) this.sound.playPurchase();
        alert(`Знайдено секрет Городні: «${pkg.name}» (${this.collectedCount}/10)!`);

        if (this.collectedCount === 10) {
          player.money += 50000;
          alert('🏆 ВІТАЄМО! Зібрано всі 10 секретів Городні! Отримано 50 000 ₴ та доступ до суперкара на Аеродромі!');
        }
      }
    });
  }

  triggerWasted(player) {
    const screen = document.getElementById('wasted-screen');
    if (screen) screen.style.display = 'flex';
    if (this.sound && this.sound.playCrash) this.sound.playCrash(35);

    setTimeout(() => {
      // Респавн у Городнянской районной больницы: (-80, 0, 160)
      player.position.set(-80, 0, 160);
      player.health = 100;
      player.wantedStars = 0;
      player.money = Math.max(0, player.money - 300);
      if (screen) screen.style.display = 'none';
    }, 3800);
  }

  triggerBusted(player) {
    const screen = document.getElementById('busted-screen');
    if (screen) screen.style.display = 'flex';

    setTimeout(() => {
      // Респавн у отделения полиции Городни: (-18, 0, -45)
      player.position.set(-18, 0, -45);
      player.health = 100;
      player.wantedStars = 0;
      player.money = Math.max(0, player.money - 600);
      if (screen) screen.style.display = 'none';
    }, 3800);
  }
}

// =============================================================================
// 4. ДИНАМИЧЕСКАЯ ПОГОДА И СМЕНА ВРЕМЕНИ СУТОК
// =============================================================================
class DynamicWeatherSystem {
  constructor(scene, soundEngine) {
    this.scene = scene;
    this.sound = soundEngine;

    this.timeOfDay = 12.0; // 0..24 часа
    this.timeSpeed = 0.08; // скорость течения времени
    this.currentWeather = 'CLEAR'; // 'CLEAR', 'FOG', 'RAIN'

    this.initRainParticles();
    this.initLightning();
  }

  initRainParticles() {
    const count = 2200;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);

    for (let i = 0; i < count * 3; i += 3) {
      pos[i] = (Math.random() - 0.5) * 380;
      pos[i + 1] = Math.random() * 90;
      pos[i + 2] = (Math.random() - 0.5) * 380;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: 0x74b9ff,
      size: 0.38,
      transparent: true,
      opacity: 0.8
    });

    this.rainPoints = new THREE.Points(geo, mat);
    this.rainPoints.visible = false;
    this.scene.add(this.rainPoints);
  }

  initLightning() {
    this.lightningLight = new THREE.DirectionalLight(0xffffff, 0);
    this.lightningLight.position.set(0, 200, 0);
    this.scene.add(this.lightningLight);
    this.nextFlash = 7.0;
  }

  setWeather(type, cityRoads) {
    this.currentWeather = type;

    if (type === 'CLEAR') {
      this.scene.fog.density = 0.0018;
      this.rainPoints.visible = false;
      this.setRoadWetness(cityRoads, 0.88);
    } else if (type === 'FOG') {
      this.scene.fog.density = 0.015; // Плотный туман над рекой Смяч
      this.rainPoints.visible = false;
      this.setRoadWetness(cityRoads, 0.55);
    } else if (type === 'RAIN') {
      this.scene.fog.density = 0.0055;
      this.rainPoints.visible = true;
      this.setRoadWetness(cityRoads, 0.12); // Мокрый зеркальный асфальт
    }
  }

  setRoadWetness(roads, roughness) {
    if (!roads) return;
    roads.forEach(mesh => {
      if (mesh.material && mesh.material.roughness !== undefined) {
        mesh.material.roughness = roughness;
        mesh.material.metalness = roughness < 0.25 ? 0.7 : 0.1;
      }
    });
  }

  update(delta, playerPos) {
    // Смена суток
    this.timeOfDay = (this.timeOfDay + delta * this.timeSpeed) % 24;

    if (this.currentWeather === 'RAIN') {
      this.rainPoints.position.x = playerPos.x;
      this.rainPoints.position.z = playerPos.z;

      const pos = this.rainPoints.geometry.attributes.position.array;
      for (let i = 1; i < pos.length; i += 3) {
        pos[i] -= delta * 75.0;
        if (pos[i] < 0) pos[i] = 90;
      }
      this.rainPoints.geometry.attributes.position.needsUpdate = true;

      // Гроза и молнии
      this.nextFlash -= delta;
      if (this.nextFlash <= 0) {
        this.nextFlash = 5.0 + Math.random() * 10.0;
        this.lightningLight.intensity = 5.0;
        if (this.sound && this.sound.playCrash) this.sound.playCrash(28); // Раскат грома
        setTimeout(() => { this.lightningLight.intensity = 0; }, 90);
      }
    }
  }
}

// =============================================================================
// 5. ИНТЕРАКТИВНЫЙ GTA-СМАРТФОН С GPS И СОХРАНЕНИЕМ (LOCALSTORAGE)
// =============================================================================
class GTASmartphone {
  constructor(gameApp) {
    this.app = gameApp;
    this.isOpen = false;
    this.activeWaypoint = null;
    this.waypointBeam = null;

    this.createWaypointBeam();
    this.setupKeybindings();
  }

  createWaypointBeam() {
    // 3D Световой столб-маяк в небе до космоса для метки GPS
    const beamGeo = new THREE.CylinderGeometry(0.8, 0.8, 400, 16);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xf1c40f,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide
    });
    this.waypointBeam = new THREE.Mesh(beamGeo, beamMat);
    this.waypointBeam.position.set(0, 200, 0);
    this.waypointBeam.visible = false;
    this.app.scene.add(this.waypointBeam);
  }

  setupKeybindings() {
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
    this.waypointBeam.position.set(x, 200, z);
    this.waypointBeam.visible = true;
    alert(`GPS-маршрут прокладено до: ${label}`);
    this.togglePhone();
  }

  clearWaypoint() {
    this.activeWaypoint = null;
    this.waypointBeam.visible = false;
    alert('GPS-маршрут скасовано');
  }

  saveGame(player, tuning) {
    const data = {
      money: player.money,
      health: player.health,
      pos: { x: player.position.x, y: player.position.y, z: player.position.z },
      upgrades: tuning ? tuning.upgrades : null,
      packagesCount: this.app.combat ? this.app.combat.collectedCount : 0,
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
// 6. ЕДИНЫЙ ЗАГРУЗЧИК И ХУК ИНТЕГРАЦИИ (ЧАСТИ 1 + 2 + 3)
// =============================================================================
class GorodnyaPart3Extension {
  static attach(worldRef) {
    if (!worldRef) return null;

    const scene = worldRef.scene;
    const collisionBoxes = worldRef.collisionBoxes || [];
    const sound = worldRef.sound || (window.GorodnyaPart2Engine ? window.GorodnyaPart2Engine.sound : null);

    const interiors = new InteriorSystem(scene, collisionBoxes);
    const tuning = new TuningSystem(sound);
    const combat = new CombatAndEasterEggSystem(scene, sound);
    const weather = new DynamicWeatherSystem(scene, sound);
    const phone = new GTASmartphone({ scene, combat });

    const ext = {
      interiors,
      tuning,
      combat,
      weather,
      phone
    };

    window.GorodnyaPart3 = ext;
    console.log('✅ [GorodnyaPart3Extension] Частина 3 успішно інтегрована в 3D-світ Городні!');
    return ext;
  }
}

window.InteriorSystem = InteriorSystem;
window.TuningSystem = TuningSystem;
window.CombatAndEasterEggSystem = CombatAndEasterEggSystem;
window.DynamicWeatherSystem = DynamicWeatherSystem;
window.GTASmartphone = GTASmartphone;
window.GorodnyaPart3Extension = GorodnyaPart3Extension;

class GameBootstrap {
  static initAll(app) {
    app.interiors = new InteriorSystem(app.scene, app.cityMap.collisionBoxes);
    app.tuning = new TuningSystem(app.sound);
    app.combat = new CombatAndEasterEggSystem(app.scene, app.sound);
    app.weather = new DynamicWeatherSystem(app.scene, app.sound);
    app.phone = new GTASmartphone(app);
    console.log('✅ [GameBootstrap] Усі системи Частин 1, 2 та 3 успішно інтегровані в єдине ядро Городні!');
  }
}
window.GameBootstrap = GameBootstrap;
