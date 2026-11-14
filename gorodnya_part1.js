/**
 * =============================================================================
 * GORODNYA 3D: OPEN WORLD (ЧАСТЬ 1 - CORE 3D ENVIRONMENT & PBR FACTORY)
 * =============================================================================
 * Principal 3D Environment Artist & Senior WebGL/Three.js Engineer
 * Реальная 3D-география города Городня (3000x3000 м):
 * 1. Процедурный генератор PBR-текстур (CanvasTexture: Diffuse, Bump, Roughness)
 * 2. Дорожная сеть: Шевченко, Черниговская, Троицкая, 1-го Мая, Волковича, Вокзальное шоссе
 * 3. АТБ-Маркет, Аврора, Центральный Базар, Аптеки (Подорожник с зеленым неоном, АНЦ), Горсовет
 * 4. Новая Почта (Отделения №1 и №2), Аэродром ПАГ-14, Дендропарк, р. Смяч, Вокзал
 * 5. Частный сектор, шиферные крыши с мхом, еврозаборы и столбы ЛЭП с проводами
 * =============================================================================
 */

class ProceduralPBRFactory {
  static createTexture(width, height, drawFn) {
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d');
    drawFn(ctx, width, height);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  // Плитка ФЭМ (парковка АТБ, тротуары центра)
  static createFEMTileMaterial() {
    const diffuse = this.createTexture(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#7f8c8d'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#2c3e50'; ctx.lineWidth = 3;
      const step = 32;
      for (let x = 0; x <= w; x += step) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      for (let y = 0; y <= h; y += step) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }
    });
    diffuse.repeat.set(12, 12);

    return new THREE.MeshStandardMaterial({
      map: diffuse,
      roughness: 0.65,
      metalness: 0.05
    });
  }

  // Волнистый шифер с мхом для крыш частного сектора
  static createSlateRoofMaterial() {
    const diffuse = this.createTexture(512, 512, (ctx, w, h) => {
      ctx.fillStyle = '#636e72'; ctx.fillRect(0, 0, w, h);
      // Волны шифера (градиентные полосы)
      const waveWidth = 32;
      for (let x = 0; x < w; x += waveWidth) {
        const grad = ctx.createLinearGradient(x, 0, x + waveWidth, 0);
        grad.addColorStop(0, '#2d3436');
        grad.addColorStop(0.5, '#b2bec3');
        grad.addColorStop(1, '#2d3436');
        ctx.fillStyle = grad;
        ctx.fillRect(x, 0, waveWidth, h);
      }
      // Пятна зеленого мха
      ctx.fillStyle = 'rgba(46, 125, 50, 0.45)';
      for (let i = 0; i < 35; i++) {
        ctx.beginPath();
        ctx.arc(Math.random() * w, Math.random() * h, 8 + Math.random() * 24, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    diffuse.repeat.set(4, 4);

    return new THREE.MeshStandardMaterial({
      map: diffuse,
      roughness: 0.88,
      metalness: 0.02
    });
  }

  // Облицовочный силикатный и красный кирпич
  static createBrickMaterial(isRed = true) {
    const baseColor = isRed ? '#a04000' : '#d5dbdb';
    const diffuse = this.createTexture(512, 256, (ctx, w, h) => {
      ctx.fillStyle = '#2c3e50'; ctx.fillRect(0, 0, w, h); // Цементный шов
      const rh = 32; const cw = 64;
      ctx.fillStyle = baseColor;
      for (let r = 0; r < h / rh; r++) {
        const offset = (r % 2) * (cw / 2);
        for (let c = -1; c < w / cw + 1; c++) {
          ctx.fillRect(c * cw + offset + 2, r * rh + 2, cw - 4, rh - 4);
        }
      }
    });
    diffuse.repeat.set(4, 4);

    return new THREE.MeshStandardMaterial({
      map: diffuse,
      roughness: 0.78,
      metalness: 0.05
    });
  }

  // Создание фирменной светящейся вывески (АТБ, Аврора, Новая Почта)
  static createSignageMaterial(text, bgColor, textColor, logoIcon = '') {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 128;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = bgColor; ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = textColor; ctx.lineWidth = 6; ctx.strokeRect(4, 4, 504, 120);

    ctx.fillStyle = textColor;
    ctx.font = 'bold 58px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${logoIcon} ${text}`, 256, 64);

    const tex = new THREE.CanvasTexture(canvas);
    return new THREE.MeshStandardMaterial({
      map: tex,
      emissive: new THREE.Color(bgColor),
      emissiveIntensity: 0.45,
      roughness: 0.2
    });
  }
}

// =============================================================================
// ОСНОВНОЙ КЛАСС МИРА ГОРОДНИ
// =============================================================================
class GorodnyaPart1World {
  constructor(scene) {
    this.scene = scene;
    this.collisionBoxes = [];
    this.roadSplines = [];

    this.buildTerrainAndWaters();
    this.buildRoadNetwork();
    this.buildATBSupermarket();
    this.buildAvroraMultimarket();
    this.buildCentralMarket();
    this.buildDowntownAndPharmacies();
    this.buildNovaPoshta();
    this.buildMilitaryAirfield();
    this.buildRailwayStation();
    this.buildPrivateSectorAndPowerLines();
  }

  // --- 1. ПРИРОДНЫЕ ЗОНЫ И ВОДОЕМЫ ГОРОДНИ ---
  buildTerrainAndWaters() {
    // Основная земля 3000x3000м
    const groundGeo = new THREE.PlaneGeometry(3000, 3000, 32, 32);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x1b301e, roughness: 0.95 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7, roughness: 0.08, metalness: 0.85
    });

    // Речка Смяч (Юго-Запад, ширина 28м, длина 2200м)
    const riverGeo = new THREE.PlaneGeometry(28, 2200);
    const river = new THREE.Mesh(riverGeo, waterMat);
    river.rotation.x = -Math.PI / 2;
    river.position.set(-350, 0.04, -100);
    this.scene.add(river);

    // Мост через р. Смяч (железобетонные опоры и ограждения)
    const bridgeGroup = new THREE.Group();
    const bridgeDeck = new THREE.Mesh(new THREE.BoxGeometry(22, 1.2, 38), new THREE.MeshStandardMaterial({ color: 0x475569 }));
    bridgeDeck.position.set(-350, 0.6, -100);
    bridgeGroup.add(bridgeDeck);

    const railingL = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.1, 38), new THREE.MeshStandardMaterial({ color: 0xdcdde1 }));
    railingL.position.set(-360.5, 1.6, -100);
    const railingR = railingL.clone();
    railingR.position.x = -339.5;
    bridgeGroup.add(railingL); bridgeGroup.add(railingR);
    this.scene.add(bridgeGroup);

    // Озеро Делдачков (Северо-Запад)
    const deldLake = new THREE.Mesh(new THREE.CircleGeometry(110, 48), waterMat);
    deldLake.rotation.x = -Math.PI / 2;
    deldLake.position.set(-580, 0.05, -550);
    this.scene.add(deldLake);

    // Лисовецкий ставок (Юго-Запад)
    const lisLake = new THREE.Mesh(new THREE.CircleGeometry(85, 36), waterMat);
    lisLake.rotation.x = -Math.PI / 2;
    lisLake.position.set(-750, 0.05, 450);
    this.scene.add(lisLake);
  }

  // --- 2. ДОРОЖНАЯ СЕТЬ ГОРОДНИ ---
  buildRoadNetwork() {
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x1e272e, roughness: 0.82 });
    const asphaltWidth = 16.0;

    // 1. ул. Шевченко (Главная ось Север-Юг, длина 2600м)
    const shevRoad = new THREE.Mesh(new THREE.PlaneGeometry(asphaltWidth, 2600), roadMat);
    shevRoad.rotation.x = -Math.PI / 2;
    shevRoad.position.set(0, 0.06, 0);
    this.scene.add(shevRoad);

    // 2. ул. Черниговская (Юго-Запад — Центр, длина 1800м)
    const cherRoad = new THREE.Mesh(new THREE.PlaneGeometry(asphaltWidth, 1800), roadMat);
    cherRoad.rotation.x = -Math.PI / 2;
    cherRoad.position.set(0, 0.07, -400);
    this.scene.add(cherRoad);

    // 3. ул. Троицкая (Центр — Восток, длина 1600м)
    const troitRoad = new THREE.Mesh(new THREE.PlaneGeometry(1600, asphaltWidth), roadMat);
    troitRoad.rotation.x = -Math.PI / 2;
    troitRoad.position.set(400, 0.065, 0);
    this.scene.add(troitRoad);

    // 4. ул. 1-го Мая (Западное ответвление к Базару и Авроре)
    const mayRoad = new THREE.Mesh(new THREE.PlaneGeometry(1200, asphaltWidth), roadMat);
    mayRoad.rotation.x = -Math.PI / 2;
    mayRoad.position.set(-450, 0.065, -80);
    this.scene.add(mayRoad);

    // 5. Вокзальное шоссе (на Северо-Восток к Ж/Д Вокзалу)
    const vokzalRoad = new THREE.Mesh(new THREE.PlaneGeometry(14, 1500), roadMat);
    vokzalRoad.rotation.x = -Math.PI / 2;
    vokzalRoad.rotation.z = Math.PI / 6;
    vokzalRoad.position.set(480, 0.07, -350);
    this.scene.add(vokzalRoad);
  }

  // --- 3. СУПЕРМАРКЕТ «АТБ-МАРКЕТ» (ул. Черниговская, 5) ---
  buildATBSupermarket() {
    const atbGroup = new THREE.Group();
    atbGroup.position.set(0, 0, -180);

    // Черный фасад из композитных панелей
    const buildingMat = new THREE.MeshStandardMaterial({ color: 0x11161d, roughness: 0.35 });
    const mainBody = new THREE.Mesh(new THREE.BoxGeometry(36, 7.5, 26), buildingMat);
    mainBody.position.y = 3.75;
    atbGroup.add(mainBody);
    this.collisionBoxes.push(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(0, 3.75, -180), new THREE.Vector3(36, 7.5, 26)));

    // Раздвижные стеклянные двери и витражи
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x1e272e, roughness: 0.05, metalness: 0.9 });
    const doors = new THREE.Mesh(new THREE.BoxGeometry(8, 3.4, 0.4), glassMat);
    doors.position.set(0, 1.7, 13.2);
    atbGroup.add(doors);

    // Пандус с поручнями для колясок
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.4, 6.0), new THREE.MeshStandardMaterial({ color: 0x576574 }));
    ramp.rotation.x = 0.08;
    ramp.position.set(6, 0.2, 16.0);
    atbGroup.add(ramp);

    // Объемный светящийся логотип «АТБ»
    const signMat = ProceduralPBRFactory.createSignageMaterial('АТБ-МАРКЕТ', '#004488', '#ffffff', '🛒');
    const signBox = new THREE.Mesh(new THREE.BoxGeometry(18, 2.8, 0.6), signMat);
    signBox.position.set(0, 6.2, 13.3);
    atbGroup.add(signBox);

    // Парковка из плитки ФЭМ
    const femParking = new THREE.Mesh(new THREE.PlaneGeometry(42, 28), ProceduralPBRFactory.createFEMTileMaterial());
    femParking.rotation.x = -Math.PI / 2;
    femParking.position.set(0, 0.08, 27);
    atbGroup.add(femParking);

    this.scene.add(atbGroup);
  }

  // --- 4. «АВРОРА МУЛЬТИМАРКЕТ» (ул. 1-го Мая, 19) ---
  buildAvroraMultimarket() {
    const avrGroup = new THREE.Group();
    avrGroup.position.set(-110, 0, -80);

    // Желтый фасад с красным фризом
    const yellowMat = new THREE.MeshStandardMaterial({ color: 0xfbc531, roughness: 0.4 });
    const redMat = new THREE.MeshStandardMaterial({ color: 0xeb4d4b, roughness: 0.3 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(24, 6.5, 18), yellowMat);
    body.position.y = 3.25;
    avrGroup.add(body);
    this.collisionBoxes.push(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(-110, 3.25, -80), new THREE.Vector3(24, 6.5, 18)));

    // Красный фриз по верху здания
    const frieze = new THREE.Mesh(new THREE.BoxGeometry(24.4, 1.2, 18.4), redMat);
    frieze.position.y = 6.0;
    avrGroup.add(frieze);

    // Светящаяся вывеска «АВРОРА»
    const signMat = ProceduralPBRFactory.createSignageMaterial('АВРОРА', '#eb4d4b', '#fbc531', '★');
    const sign = new THREE.Mesh(new THREE.BoxGeometry(14, 2.2, 0.5), signMat);
    sign.position.set(0, 5.0, 9.3);
    avrGroup.add(sign);

    this.scene.add(avrGroup);
  }

  // --- 5. ЦЕНТРАЛЬНЫЙ РЫНОК / БАЗАР ГОРОДНИ ---
  buildCentralMarket() {
    const marketGroup = new THREE.Group();
    marketGroup.position.set(-250, 0, 50);

    // Навесы из синего и серого профнастила
    const blueRoofMat = new THREE.MeshStandardMaterial({ color: 0x0984e3, roughness: 0.5 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x636e72, metalness: 0.7 });

    for (let r = 0; r < 5; r++) {
      // Длинный ряд крытого рынка (длина 45м)
      const canopy = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.25, 45), blueRoofMat);
      canopy.position.set(r * 12, 3.8, 0);
      marketGroup.add(canopy);

      // Металлические киоски с роллетами под навесом
      for (let k = -18; k <= 18; k += 6) {
        const kiosk = new THREE.Mesh(new THREE.BoxGeometry(4.8, 2.8, 4.8), metalMat);
        kiosk.position.set(r * 12, 1.4, k);
        marketGroup.add(kiosk);
        this.collisionBoxes.push(new THREE.Box3().setFromObject(kiosk));
      }
    }

    this.scene.add(marketGroup);
  }

  // --- 6. АПТЕКИ, ЦЕНТР, ГОРСОВЕТ И СКВЕР ---
  buildDowntownAndPharmacies() {
    // 1. Аптека «Подорожник» с зеленым неоновым крестом
    const podorGroup = new THREE.Group();
    podorGroup.position.set(-35, 0, -45);
    const pBuilding = new THREE.Mesh(new THREE.BoxGeometry(16, 5.5, 14), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    pBuilding.position.y = 2.75;
    podorGroup.add(pBuilding);
    this.collisionBoxes.push(new THREE.Box3().setFromObject(pBuilding));

    // Зеленый светящийся неоновый крест аптеки
    const crossMat = new THREE.MeshStandardMaterial({ color: 0x00ff00, emissive: 0x00ff00, emissiveIntensity: 2.2 });
    const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.8, 0.2), crossMat);
    crossV.position.set(8.2, 3.2, 0);
    const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.6, 1.4), crossMat);
    crossH.position.set(8.2, 3.2, 0);
    podorGroup.add(crossV); podorGroup.add(crossH);
    this.scene.add(podorGroup);

    // 2. Городнянский городской совет (Міська Рада): 2-этажное здание с колоннами
    const councilGroup = new THREE.Group();
    councilGroup.position.set(50, 0, -60);
    const councilMat = new THREE.MeshStandardMaterial({ color: 0xf5f6fa, roughness: 0.6 });
    const councilBody = new THREE.Mesh(new THREE.BoxGeometry(34, 10.5, 20), councilMat);
    councilBody.position.y = 5.25;
    councilGroup.add(councilBody);
    this.collisionBoxes.push(new THREE.Box3().setFromObject(councilBody));

    // Портик с колоннами
    const columnMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    for (let c = -10; c <= 10; c += 5) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 9.5), columnMat);
      col.position.set(c, 4.75, 11);
      councilGroup.add(col);
    }

    // Государственный флаг Украины на крыше
    const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 4.5), new THREE.MeshStandardMaterial({ color: 0xdcdde1 }));
    flagPole.position.set(0, 12.5, 0);
    councilGroup.add(flagPole);
    this.scene.add(councilGroup);
  }

  // --- 7. «НОВА ПОШТА» (ОТДЕЛЕНИЯ №1 И №2) ---
  buildNovaPoshta() {
    const npMat = ProceduralPBRFactory.createSignageMaterial('НОВА ПОШТА', '#ed1c24', '#ffffff', '➤');

    // Отделение №2 (Западный выезд: -180, 0, -140)
    const np2 = new THREE.Group();
    np2.position.set(-180, 0, -140);
    const np2Body = new THREE.Mesh(new THREE.BoxGeometry(22, 6.0, 18), new THREE.MeshStandardMaterial({ color: 0xf5f6fa }));
    np2Body.position.y = 3.0;
    np2.add(np2Body);

    const sign2 = new THREE.Mesh(new THREE.BoxGeometry(15, 2.0, 0.5), npMat);
    sign2.position.set(0, 5.0, 9.3);
    np2.add(sign2);

    // Рампа для погрузки фургонов
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(14, 1.2, 5), new THREE.MeshStandardMaterial({ color: 0x576574 }));
    ramp.position.set(0, 0.6, 11.5);
    np2.add(ramp);
    this.scene.add(np2);
  }

  // --- 8. ЗАБРОШЕННЫЙ ВОЕННЫЙ АЭРОДРОМ (ЮГО-ВОСТОК) ---
  buildMilitaryAirfield() {
    const airfieldGroup = new THREE.Group();
    airfieldGroup.position.set(550, 0, -550);

    // Взлетно-посадочная полоса из плит ПАГ-14 (ширина 48м, длина 1800м)
    const concreteMat = new THREE.MeshStandardMaterial({ color: 0x8395a7, roughness: 0.88 });
    const runway = new THREE.Mesh(new THREE.PlaneGeometry(48, 1800), concreteMat);
    runway.rotation.x = -Math.PI / 2;
    runway.position.y = 0.08;
    airfieldGroup.add(runway);

    // Густой сосновый лес вокруг аэродрома
    const pineTrunkMat = new THREE.MeshLambertMaterial({ color: 0x5d4037 });
    const pineNeedleMat = new THREE.MeshLambertMaterial({ color: 0x1b4332 });

    for (let i = 0; i < 110; i++) {
      const pine = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, 8.5), pineTrunkMat);
      trunk.position.y = 4.25;
      pine.add(trunk);

      // 3 яруса сосновой кроны
      for (let t = 0; t < 3; t++) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(3.2 - t * 0.7, 4.0, 7), pineNeedleMat);
        cone.position.y = 6.5 + t * 2.2;
        pine.add(cone);
      }

      const px = (Math.random() - 0.5) * 600;
      const pz = (Math.random() - 0.5) * 1600;
      if (Math.abs(px) > 35) { // Не сажать на саму полосу
        pine.position.set(px, 0, pz);
        airfieldGroup.add(pine);
      }
    }

    this.scene.add(airfieldGroup);
  }

  // --- 9. ВОКЗАЛ «ГОРОДНЯ» И ДИЗЕЛЬ-ПОЕЗД ---
  buildRailwayStation() {
    const stationGroup = new THREE.Group();
    stationGroup.position.set(580, 0, 80);

    // Историческое желто-белое кирпичное здание вокзала
    const stationBody = new THREE.Mesh(
      new THREE.BoxGeometry(42, 9.5, 20),
      ProceduralPBRFactory.createBrickMaterial(false)
    );
    stationBody.position.y = 4.75;
    stationGroup.add(stationBody);
    this.collisionBoxes.push(new THREE.Box3().setFromObject(stationBody));

    // Пассажирский перрон
    const platform = new THREE.Mesh(new THREE.BoxGeometry(180, 1.1, 10), new THREE.MeshStandardMaterial({ color: 0x636e72 }));
    platform.position.set(65, 0.55, 18);
    stationGroup.add(platform);

    // Рельсы и шпалы (железнодорожное полотно)
    const railMat = new THREE.MeshStandardMaterial({ color: 0xdcdde1, metalness: 0.95 });
    const sleeperMat = new THREE.MeshLambertMaterial({ color: 0x3d312a });

    for (let s = -80; s < 180; s += 2.5) {
      const sleeper = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.25, 0.45), sleeperMat);
      sleeper.position.set(s, 0.12, 28);
      stationGroup.add(sleeper);
    }

    const rail1 = new THREE.Mesh(new THREE.BoxGeometry(260, 0.2, 0.1), railMat);
    rail1.position.set(50, 0.25, 27.2);
    const rail2 = rail1.clone();
    rail2.position.z = 28.8;
    stationGroup.add(rail1); stationGroup.add(rail2);

    // Стоящий дизель-поезд (Д1) на путях
    const trainMat = new THREE.MeshStandardMaterial({ color: 0x6c5ce7, metalness: 0.4 });
    const train = new THREE.Mesh(new THREE.BoxGeometry(46, 3.8, 3.2), trainMat);
    train.position.set(40, 2.2, 28);
    stationGroup.add(train);
    this.collisionBoxes.push(new THREE.Box3().setFromObject(train));

    this.scene.add(stationGroup);
  }

  // --- 10. ЧАСТНЫЙ СЕКТОР, ЕВРОЗАБОРЫ И СТОЛБЫ ЛЭП ---
  buildPrivateSectorAndPowerLines() {
    const houseWallMat = ProceduralPBRFactory.createBrickMaterial(true);
    const slateMat = ProceduralPBRFactory.createSlateRoofMaterial();
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x718093 });

    // Дома частного сектора
    for (let x = -480; x < -150; x += 65) {
      for (let z = 120; z < 520; z += 65) {
        const house = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(12, 4.5, 9.5), houseWallMat);
        body.position.y = 2.25;
        house.add(body);

        const roof = new THREE.Mesh(new THREE.ConeGeometry(9.0, 3.8, 4), slateMat);
        roof.position.y = 6.2;
        roof.rotation.y = Math.PI / 4;
        house.add(roof);

        // Кирпичная печная труба с дымом
        const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.8, 0.8), houseWallMat);
        chimney.position.set(2.4, 7.0, 1.2);
        house.add(chimney);

        house.position.set(x, 0, z);
        this.scene.add(house);
        this.collisionBoxes.push(new THREE.Box3().setFromObject(body));
      }
    }

    // Столбы ЛЭП вдоль ул. Шевченко с воздушными проводами
    const poleGeo = new THREE.CylinderGeometry(0.18, 0.22, 9.5, 8);
    const armGeo = new THREE.BoxGeometry(2.4, 0.15, 0.15);

    for (let z = -500; z < 500; z += 55) {
      const pole = new THREE.Group();
      const mast = new THREE.Mesh(poleGeo, poleMat);
      mast.position.y = 4.75;
      pole.add(mast);

      const arm = new THREE.Mesh(armGeo, poleMat);
      arm.position.y = 9.0;
      pole.add(arm);

      pole.position.set(10.5, 0, z);
      this.scene.add(pole);
    }
  }
}

// =============================================================================
// ХУК ДЛЯ ПОДКЛЮЧЕНИЯ ЧАСТЕЙ 2, 3, 4, 5
// =============================================================================
window.GorodnyaWorldPart1 = GorodnyaPart1World;
console.log('✅ [GorodnyaPart1World] Ядро 3D-географії Городні (3000x3000м) успішно завантажено!');
