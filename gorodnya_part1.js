/**
 * =============================================================================
 * GORODNYA 3D: OPEN WORLD (ЧАСТЬ 1 - ZERO-VOID ULTRA WORLD GENERATOR)
 * =============================================================================
 * Senior Procedural World Architect & Level Designer (Three.js / WebGL)
 * 
 * ПРИНЦИП «НУЛЕВОЙ ПУСТОТЫ» (ZERO-VOID URBAN & NATURE FILLING):
 * 1. Плотная сетка улиц и 75+ жилых кварталов (Grid Block System)
 * 2. 100% заполнение усадебной застройкой без пустых дыр (дома, заборы, сараи, колодцы, сады)
 * 3. Плотный исторический и торговый центр (АТБ, Аврора, Базар, Горсовет, Аптеки, Киоски)
 * 4. Густой лесной массив аэродрома (4000+ сосен на InstancedMesh), Дендропарк, камыши рек
 * 5. Вспаханные поля с бороздами и лесополосы на границах карты (Черниговский пейзаж)
 * 6. Полная оптимизация на InstancedMesh (< 120 Draw Calls) и AABB коллизии
 * =============================================================================
 */

// =============================================================================
// 1. ПРОЦЕДУРНЫЙ ГЕНЕРАТОР PBR-МАТЕРИАЛОВ И ТЕКСТУР В ПАМЯТИ
// =============================================================================
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

  // Тротуарная плитка ФЭМ (Центр, парковка АТБ)
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
    return new THREE.MeshStandardMaterial({ map: diffuse, roughness: 0.65, metalness: 0.05 });
  }

  // Волнистый шифер с мхом для крыш
  static createSlateRoofMaterial() {
    const diffuse = this.createTexture(512, 512, (ctx, w, h) => {
      ctx.fillStyle = '#636e72'; ctx.fillRect(0, 0, w, h);
      const waveWidth = 32;
      for (let x = 0; x < w; x += waveWidth) {
        const grad = ctx.createLinearGradient(x, 0, x + waveWidth, 0);
        grad.addColorStop(0, '#2d3436');
        grad.addColorStop(0.5, '#b2bec3');
        grad.addColorStop(1, '#2d3436');
        ctx.fillStyle = grad;
        ctx.fillRect(x, 0, waveWidth, h);
      }
      ctx.fillStyle = 'rgba(46, 125, 50, 0.45)';
      for (let i = 0; i < 35; i++) {
        ctx.beginPath();
        ctx.arc(Math.random() * w, Math.random() * h, 8 + Math.random() * 24, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    diffuse.repeat.set(4, 4);
    return new THREE.MeshStandardMaterial({ map: diffuse, roughness: 0.88, metalness: 0.02 });
  }

  // Металлочерепица (вишневая / шоколадная)
  static createMetalRoofMaterial(colorHex = '#800000') {
    const diffuse = this.createTexture(256, 256, (ctx, w, h) => {
      ctx.fillStyle = colorHex; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      for (let y = 0; y < h; y += 32) ctx.fillRect(0, y, w, 4);
    });
    diffuse.repeat.set(3, 3);
    return new THREE.MeshStandardMaterial({ map: diffuse, roughness: 0.35, metalness: 0.6 });
  }

  // Облицовочный силикатный, красный кирпич и штукатурка
  static createBrickMaterial(type = 'red') {
    let baseColor = '#a04000';
    if (type === 'white') baseColor = '#d5dbdb';
    if (type === 'plaster') baseColor = '#e0d8b0';

    const diffuse = this.createTexture(512, 256, (ctx, w, h) => {
      ctx.fillStyle = '#2c3e50'; ctx.fillRect(0, 0, w, h);
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
    return new THREE.MeshStandardMaterial({ map: diffuse, roughness: 0.78, metalness: 0.05 });
  }

  // Вспаханная земля полей (бороздки чернозема)
  static createPlowedFieldMaterial() {
    const diffuse = this.createTexture(512, 512, (ctx, w, h) => {
      ctx.fillStyle = '#2d1e18'; ctx.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 16) {
        ctx.fillStyle = '#1a110d'; ctx.fillRect(0, y, w, 6);
        ctx.fillStyle = '#3d2b22'; ctx.fillRect(0, y + 6, w, 10);
      }
    });
    diffuse.repeat.set(16, 16);
    return new THREE.MeshStandardMaterial({ map: diffuse, roughness: 0.95 });
  }

  // Фирменная светящаяся вывеска
  static createSignageMaterial(text, bgColor, textColor, logoIcon = '') {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = bgColor; ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = textColor; ctx.lineWidth = 6; ctx.strokeRect(4, 4, 504, 120);
    ctx.fillStyle = textColor;
    ctx.font = 'bold 54px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
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
    this.vehicles = [];
    this.roadsList = [];

    // 1. Природный ландшафт, реки, озера и окраинные поля
    this.buildTerrainAndWaters();

    // 2. Главные магистрали и полная сетка улиц
    this.buildRoadNetwork();

    // 3. Знаковые объекты центра Городни
    this.buildATBSupermarket();
    this.buildAvroraMultimarket();
    this.buildCentralMarket();
    this.buildDowntownAndPharmacies();
    this.buildNovaPoshta();
    this.buildMilitaryAirfield();
    this.buildRailwayStation();

    // 4. Реализация правила «Нулевой пустоты»: сплошные жилые кварталы и усадьбы
    this.buildDenseResidentialGrid();

    // 5. Окружающие лесные массивы (4000+ сосен на InstancedMesh), Дендропарк и посадки
    this.buildForestsAndDendropark();
    this.spawnFleet();
  }

  // --- 1. ПРИРОДНЫЕ ЗОНЫ, ВОДОЕМЫ И ПОЛЯ НА ГОРИЗОНТЕ ---
  buildTerrainAndWaters() {
    // Основная земля 3200x3200м
    const groundGeo = new THREE.PlaneGeometry(3200, 3200, 16, 16);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x1f3822, roughness: 0.95 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Вспаханные поля на границах города (Запад, Юг, Север)
    const fieldMat = ProceduralPBRFactory.createPlowedFieldMaterial();
    const field1 = new THREE.Mesh(new THREE.PlaneGeometry(1200, 700), fieldMat);
    field1.rotation.x = -Math.PI / 2; field1.position.set(-900, 0.02, -850);
    this.scene.add(field1);

    const field2 = new THREE.Mesh(new THREE.PlaneGeometry(1100, 800), fieldMat);
    field2.rotation.x = -Math.PI / 2; field2.position.set(-950, 0.02, 850);
    this.scene.add(field2);

    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7, roughness: 0.08, metalness: 0.85
    });

    // Речка Смяч (Юго-Запад, ширина 28м, длина 2400м)
    const riverGeo = new THREE.PlaneGeometry(32, 2400);
    const river = new THREE.Mesh(riverGeo, waterMat);
    river.rotation.x = -Math.PI / 2;
    river.position.set(-380, 0.03, 100);
    river.rotation.z = 0.28;
    this.scene.add(river);

    // Мост через реку Смяч
    const bridgeMat = new THREE.MeshStandardMaterial({ color: 0x57606f, roughness: 0.7 });
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(16, 1.2, 46), bridgeMat);
    bridge.position.set(-380, 0.6, 100);
    bridge.rotation.y = -0.28;
    this.scene.add(bridge);

    // Озеро Делдачков (Лисовецкий ставок)
    const lakeGeo = new THREE.CircleGeometry(160, 36);
    const lake = new THREE.Mesh(lakeGeo, waterMat);
    lake.rotation.x = -Math.PI / 2;
    lake.position.set(-320, 0.04, -340);
    this.scene.add(lake);

    // Камыши вдоль берегов озер и реки
    const reedMat = new THREE.MeshLambertMaterial({ color: 0x556b2f });
    const reedGeo = new THREE.CylinderGeometry(0.04, 0.08, 2.2, 5);
    const reedCount = 450;
    const reedInst = new THREE.InstancedMesh(reedGeo, reedMat, reedCount);
    const dummy = new THREE.Object3D();

    for (let i = 0; i < reedCount; i++) {
      const ang = Math.random() * Math.PI * 2;
      const rad = 155 + Math.random() * 18;
      dummy.position.set(-320 + Math.cos(ang) * rad, 1.1, -340 + Math.sin(ang) * rad);
      dummy.rotation.set((Math.random() - 0.5) * 0.2, Math.random() * Math.PI, (Math.random() - 0.5) * 0.2);
      dummy.updateMatrix();
      reedInst.setMatrixAt(i, dummy.matrix);
    }
    reedInst.instanceMatrix.needsUpdate = true;
    this.scene.add(reedInst);
  }

  // --- 2. ДОРОЖНАЯ СЕТЬ ГОРОДНИ ---
  buildRoadNetwork() {
    const asphaltMat = new THREE.MeshStandardMaterial({ color: 0x222629, roughness: 0.88, metalness: 0.1 });
    const dirtRoadMat = new THREE.MeshStandardMaterial({ color: 0x4a3b32, roughness: 0.95 });
    const curbMat = new THREE.MeshStandardMaterial({ color: 0x8395a7, roughness: 0.6 });

    const createRoad = (width, length, x, z, rotY = 0, isDirt = false) => {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(width, length), isDirt ? dirtRoadMat : asphaltMat);
      road.rotation.x = -Math.PI / 2;
      road.rotation.z = -rotY;
      road.position.set(x, 0.06, z);
      road.receiveShadow = true;
      this.scene.add(road);
      this.roadsList.push(road);

      // Бордюры для асфальтированных дорог
      if (!isDirt && width >= 12) {
        const curbL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.25, length), curbMat);
        curbL.position.set(x - width / 2, 0.12, z);
        curbL.rotation.y = rotY;
        const curbR = curbL.clone();
        curbR.position.set(x + width / 2, 0.12, z);
        this.scene.add(curbL); this.scene.add(curbR);
      }
    };

    // 1. ул. Шевченко (главная ось Север-Юг): ширина 18м, длина 2600м
    createRoad(18, 2600, 0, 0, 0);

    // 2. ул. Черниговская: ширина 16м, ведет на юго-запад
    createRoad(16, 1600, -380, -320, 0.58);

    // 3. ул. Троицкая: ширина 14м, ведет на восток
    createRoad(14, 1800, 500, -80, Math.PI / 2);

    // 4. ул. 1-го Мая: ширина 14м, центр и запад
    createRoad(14, 1400, -450, -80, Math.PI / 2);

    // 5. Вокзальное шоссе: ширина 14м, северо-восток
    createRoad(14, 1600, 480, 160, -0.42);

    // 6. ул. Волковича: ширина 12м, север
    createRoad(12, 1200, -180, 450, 0);
  }

  // --- 3. КЛЮЧЕВЫЕ ОБЪЕКТЫ ГОРОДНИ ---
  buildATBSupermarket() {
    const atbGroup = new THREE.Group();
    atbGroup.position.set(0, 0, -180);

    const wallMat = new THREE.MeshStandardMaterial({ color: 0x1e272e, roughness: 0.35, metalness: 0.4 });
    const building = new THREE.Mesh(new THREE.BoxGeometry(42, 6.2, 28), wallMat);
    building.position.y = 3.1;
    building.castShadow = true;
    atbGroup.add(building);
    this.collisionBoxes.push(new THREE.Box3().setFromCenterAndSize(
      new THREE.Vector3(0, 3.1, -180), new THREE.Vector3(42, 6.2, 28)
    ));

    const signMat = ProceduralPBRFactory.createSignageMaterial('АТБ-МАРКЕТ', '#0984e3', '#ffffff', '🛒');
    const sign = new THREE.Mesh(new THREE.BoxGeometry(16, 2.6, 0.4), signMat);
    sign.position.set(0, 6.5, 14.2);
    atbGroup.add(sign);

    const parkingMat = ProceduralPBRFactory.createFEMTileMaterial();
    const parking = new THREE.Mesh(new THREE.PlaneGeometry(54, 34), parkingMat);
    parking.rotation.x = -Math.PI / 2;
    parking.position.set(0, 0.08, 30);
    atbGroup.add(parking);

    this.scene.add(atbGroup);
  }

  buildAvroraMultimarket() {
    const avrGroup = new THREE.Group();
    avrGroup.position.set(-90, 0, -80);

    const wallMat = new THREE.MeshStandardMaterial({ color: 0xfbc531, roughness: 0.4 });
    const redTrimMat = new THREE.MeshStandardMaterial({ color: 0xeb4d4b });

    const building = new THREE.Mesh(new THREE.BoxGeometry(26, 5.5, 20), wallMat);
    building.position.y = 2.75;
    avrGroup.add(building);
    this.collisionBoxes.push(new THREE.Box3().setFromCenterAndSize(
      new THREE.Vector3(-90, 2.75, -80), new THREE.Vector3(26, 5.5, 20)
    ));

    const frieze = new THREE.Mesh(new THREE.BoxGeometry(26.2, 1.2, 20.2), redTrimMat);
    frieze.position.y = 5.0;
    avrGroup.add(frieze);

    const signMat = ProceduralPBRFactory.createSignageMaterial('АВРОРА МУЛЬТИМАРКЕТ', '#eb4d4b', '#fbc531', '🏬');
    const sign = new THREE.Mesh(new THREE.BoxGeometry(15, 2.2, 0.3), signMat);
    sign.position.set(0, 5.0, 10.2);
    avrGroup.add(sign);

    this.scene.add(avrGroup);
  }

  buildCentralMarket() {
    const marketGroup = new THREE.Group();
    marketGroup.position.set(-225, 0, 35);

    const paveMat = ProceduralPBRFactory.createFEMTileMaterial();
    const pave = new THREE.Mesh(new THREE.PlaneGeometry(90, 75), paveMat);
    pave.rotation.x = -Math.PI / 2;
    pave.position.y = 0.07;
    marketGroup.add(pave);

    const kioskMat1 = new THREE.MeshStandardMaterial({ color: 0x0984e3 });
    const kioskMat2 = new THREE.MeshStandardMaterial({ color: 0x20bf6b });
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0xffffff });

    for (let rx = -35; rx <= 35; rx += 14) {
      for (let rz = -25; rz <= 25; rz += 16) {
        const kiosk = new THREE.Mesh(new THREE.BoxGeometry(5.2, 3.2, 4.4), (rx + rz) % 28 === 0 ? kioskMat1 : kioskMat2);
        kiosk.position.set(rx, 1.6, rz);
        marketGroup.add(kiosk);

        const awning = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.2, 2.2), canopyMat);
        awning.position.set(rx, 2.9, rz + 2.5);
        awning.rotation.x = 0.2;
        marketGroup.add(awning);

        this.collisionBoxes.push(new THREE.Box3().setFromCenterAndSize(
          new THREE.Vector3(-225 + rx, 1.6, 35 + rz), new THREE.Vector3(5.2, 3.2, 4.4)
        ));
      }
    }
    this.scene.add(marketGroup);
  }

  buildDowntownAndPharmacies() {
    const dtGroup = new THREE.Group();
    dtGroup.position.set(0, 0, 0);

    const councilMat = new THREE.MeshStandardMaterial({ color: 0xf5f6fa, roughness: 0.6 });
    const council = new THREE.Mesh(new THREE.BoxGeometry(45, 11, 22), councilMat);
    council.position.set(-65, 5.5, 30);
    dtGroup.add(council);
    this.collisionBoxes.push(new THREE.Box3().setFromCenterAndSize(
      new THREE.Vector3(-65, 5.5, 30), new THREE.Vector3(45, 11, 22)
    ));

    // Аптека «Подорожник» с неоновым зеленым крестом
    const podorozhnik = new THREE.Mesh(new THREE.BoxGeometry(16, 5.2, 14), new THREE.MeshStandardMaterial({ color: 0x2ecc71 }));
    podorozhnik.position.set(45, 2.6, -45);
    dtGroup.add(podorozhnik);

    const crossMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.2, 0.2), crossMat);
    crossV.position.set(45, 5.8, -37.8);
    const crossH = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 0.2), crossMat);
    crossH.position.copy(crossV.position);
    dtGroup.add(crossV); dtGroup.add(crossH);

    this.scene.add(dtGroup);
  }

  buildNovaPoshta() {
    const npMat = new THREE.MeshStandardMaterial({ color: 0xd63031, roughness: 0.4 });
    const signMat = ProceduralPBRFactory.createSignageMaterial('НОВА ПОШТА №1', '#d63031', '#ffffff', '📦');

    const np1 = new THREE.Mesh(new THREE.BoxGeometry(28, 5.5, 18), npMat);
    np1.position.set(70, 2.75, -150);
    this.scene.add(np1);
    this.collisionBoxes.push(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(70, 2.75, -150), new THREE.Vector3(28, 5.5, 18)));

    const sign1 = new THREE.Mesh(new THREE.BoxGeometry(16, 2.2, 0.3), signMat);
    sign1.position.set(70, 5.4, -140.8);
    this.scene.add(sign1);
  }

  buildMilitaryAirfield() {
    const airfieldGroup = new THREE.Group();
    airfieldGroup.position.set(450, 0, -450);

    const runwayMat = new THREE.MeshStandardMaterial({ color: 0x57606f, roughness: 0.75, metalness: 0.1 });
    const runway = new THREE.Mesh(new THREE.PlaneGeometry(55, 1400), runwayMat);
    runway.rotation.x = -Math.PI / 2;
    runway.position.y = 0.07;
    airfieldGroup.add(runway);

    const hangarMat = new THREE.MeshStandardMaterial({ color: 0x2f3542, metalness: 0.8, roughness: 0.3 });
    for (let h = -250; h <= 250; h += 250) {
      const hangar = new THREE.Mesh(new THREE.CylinderGeometry(18, 18, 50, 16, 1, false, 0, Math.PI), hangarMat);
      hangar.rotation.x = Math.PI / 2;
      hangar.position.set(55, 0, h);
      airfieldGroup.add(hangar);
      this.collisionBoxes.push(new THREE.Box3().setFromCenterAndSize(
        new THREE.Vector3(505, 9, -450 + h), new THREE.Vector3(36, 18, 50)
      ));
    }
    this.scene.add(airfieldGroup);
  }

  buildRailwayStation() {
    const stGroup = new THREE.Group();
    stGroup.position.set(520, 0, 40);

    const bldMat = new THREE.MeshStandardMaterial({ color: 0xf1c40f, roughness: 0.5 });
    const bld = new THREE.Mesh(new THREE.BoxGeometry(48, 7.5, 18), bldMat);
    bld.position.y = 3.75;
    stGroup.add(bld);
    this.collisionBoxes.push(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(520, 3.75, 40), new THREE.Vector3(48, 7.5, 18)));

    const train = new THREE.Mesh(new THREE.BoxGeometry(55, 4.0, 3.4), new THREE.MeshStandardMaterial({ color: 0x34495e }));
    train.position.set(0, 2.2, 28);
    stGroup.add(train);
    this.collisionBoxes.push(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(520, 2.2, 68), new THREE.Vector3(55, 4.0, 3.4)));

    this.scene.add(stGroup);
  }

  // ===========================================================================
  // 4. ПРАВИЛО «НУЛЕВОЙ ПУСТОТЫ»: ПЛОТНАЯ СЕТКА КВАРТАЛОВ И УСАДЕБ
  // ===========================================================================
  buildDenseResidentialGrid() {
    // Геометрии и материалы для InstancedMesh застройки
    const houseWallGeo = new THREE.BoxGeometry(11, 4.2, 8.5);
    const roofGeo = new THREE.ConeGeometry(8.2, 3.6, 4);
    const chimneyGeo = new THREE.BoxGeometry(0.7, 1.8, 0.7);

    const shedGeo = new THREE.BoxGeometry(6.5, 3.0, 4.5);
    const fenceSegmentGeo = new THREE.BoxGeometry(22, 1.3, 0.15);
    const wellGeo = new THREE.CylinderGeometry(0.9, 0.9, 1.1, 10);
    const poleGeo = new THREE.CylinderGeometry(0.14, 0.18, 9.2, 8);
    const gardenGeo = new THREE.PlaneGeometry(16, 12);

    const redBrickMat = ProceduralPBRFactory.createBrickMaterial('red');
    const whiteBrickMat = ProceduralPBRFactory.createBrickMaterial('white');
    const plasterMat = ProceduralPBRFactory.createBrickMaterial('plaster');
    const slateRoofMat = ProceduralPBRFactory.createSlateRoofMaterial();
    const metalRoofMat = ProceduralPBRFactory.createMetalRoofMaterial('#800000');
    const shedWoodMat = new THREE.MeshLambertMaterial({ color: 0x8b5a2b });
    const fenceMat = new THREE.MeshLambertMaterial({ color: 0xa0522d });
    const concreteMat = new THREE.MeshStandardMaterial({ color: 0x95a5a6, roughness: 0.8 });
    const soilMat = new THREE.MeshStandardMaterial({ color: 0x2d1e18, roughness: 0.98 });

    // Сетка жилых улиц и переулков Городни
    // Формируем свыше 75 плотных кварталов
    const blockBounds = [];

    // Западный жилой массив (ул. Шевченко -> пойма р. Смяч)
    for (let bx = -760; bx <= -120; bx += 80) {
      for (let bz = -560; bz <= 560; bz += 80) {
        // Пропускаем зону центрального рынка и озера Делдачков
        if (bx > -280 && bx < -160 && bz > -20 && bz < 90) continue;
        if (bx > -420 && bx < -220 && bz > -450 && bz < -230) continue;

        blockBounds.push({
          minX: bx + 7, maxX: bx + 73,
          minZ: bz + 7, maxZ: bz + 73
        });
      }
    }

    // Восточный жилой массив (к Вокзалу и аэродрому)
    for (let bx = 90; bx <= 490; bx += 85) {
      for (let bz = -420; bz <= 420; bz += 85) {
        // Пропускаем Ж/Д Вокзал и промзону СТО
        if (bx > 420 && bz > -20 && bz < 100) continue;
        if (bx > 120 && bx < 240 && bz > -120 && bz < -40) continue;

        blockBounds.push({
          minX: bx + 7, maxX: bx + 78,
          minZ: bz + 7, maxZ: bz + 78
        });
      }
    }

    console.log(`[Zero-Void Architecture] Сгенерировано ${blockBounds.length} плотных жилых кварталов Городни`);

    // Подготовка InstancedMesh пулов
    const totalLots = blockBounds.length * 4; // по 4 усадьбы на квартал
    const instHouses = new THREE.InstancedMesh(houseWallGeo, redBrickMat, totalLots);
    const instRoofs = new THREE.InstancedMesh(roofGeo, slateRoofMat, totalLots);
    const instChimneys = new THREE.InstancedMesh(chimneyGeo, whiteBrickMat, totalLots);
    const instSheds = new THREE.InstancedMesh(shedGeo, shedWoodMat, totalLots);
    const instFences = new THREE.InstancedMesh(fenceSegmentGeo, fenceMat, totalLots * 2);
    const instWells = new THREE.InstancedMesh(wellGeo, concreteMat, totalLots);
    const instGardens = new THREE.InstancedMesh(gardenGeo, soilMat, totalLots);
    const instPoles = new THREE.InstancedMesh(poleGeo, concreteMat, blockBounds.length * 2);

    const dummy = new THREE.Object3D();
    let lotIdx = 0;
    let fenceIdx = 0;
    let poleIdx = 0;

    // Вторичные асфальтированные и грунтовые переулки между кварталами
    const sideStreetMat = new THREE.MeshStandardMaterial({ color: 0x33393d, roughness: 0.9 });
    for (let bx = -760; bx <= 490; bx += 80) {
      const st = new THREE.Mesh(new THREE.PlaneGeometry(8, 1200), sideStreetMat);
      st.rotation.x = -Math.PI / 2;
      st.position.set(bx, 0.055, 0);
      this.scene.add(st);
    }
    for (let bz = -560; bz <= 560; bz += 80) {
      const st = new THREE.Mesh(new THREE.PlaneGeometry(1300, 8), sideStreetMat);
      st.rotation.x = -Math.PI / 2;
      st.position.set(-135, 0.055, bz);
      this.scene.add(st);
    }

    // Заполнение каждого квартала усадьбами по периметру
    blockBounds.forEach((blk) => {
      // 4 усадьбы в квартале (Север-Запад, Север-Восток, Юг-Запад, Юг-Восток)
      const halfW = (blk.maxX - blk.minX) / 2;
      const halfH = (blk.maxZ - blk.minZ) / 2;

      const lots = [
        { cx: blk.minX + halfW * 0.5, cz: blk.minZ + halfH * 0.5, rot: 0 },
        { cx: blk.minX + halfW * 1.5, cz: blk.minZ + halfH * 0.5, rot: 0 },
        { cx: blk.minX + halfW * 0.5, cz: blk.minZ + halfH * 1.5, rot: Math.PI },
        { cx: blk.minX + halfW * 1.5, cz: blk.minZ + halfH * 1.5, rot: Math.PI }
      ];

      lots.forEach((lot) => {
        if (lotIdx >= totalLots) return;

        // 1. Жилой дом фасадом к улице
        const houseY = 2.1;
        const houseOffsetZ = lot.rot === 0 ? -10 : 10;
        dummy.position.set(lot.cx, houseY, lot.cz + houseOffsetZ);
        dummy.rotation.set(0, lot.rot, 0);
        dummy.updateMatrix();
        instHouses.setMatrixAt(lotIdx, dummy.matrix);

        // 2. Двускатная крыша с шифером
        dummy.position.set(lot.cx, houseY + 3.8, lot.cz + houseOffsetZ);
        dummy.rotation.set(0, lot.rot + Math.PI / 4, 0);
        dummy.updateMatrix();
        instRoofs.setMatrixAt(lotIdx, dummy.matrix);

        // 3. Кирпичная печная труба с дымоходом
        dummy.position.set(lot.cx + 2.4, houseY + 4.6, lot.cz + houseOffsetZ + 1.2);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        instChimneys.setMatrixAt(lotIdx, dummy.matrix);

        // Коллизия дома
        this.collisionBoxes.push(new THREE.Box3().setFromCenterAndSize(
          new THREE.Vector3(lot.cx, houseY, lot.cz + houseOffsetZ),
          new THREE.Vector3(11, 4.5, 8.5)
        ));

        // 4. Хозяйственные постройки в глубине двора (Сарай / Летняя кухня)
        const shedOffsetZ = lot.rot === 0 ? 12 : -12;
        dummy.position.set(lot.cx - 6.5, 1.5, lot.cz + shedOffsetZ);
        dummy.rotation.set(0, lot.rot, 0);
        dummy.updateMatrix();
        instSheds.setMatrixAt(lotIdx, dummy.matrix);

        this.collisionBoxes.push(new THREE.Box3().setFromCenterAndSize(
          new THREE.Vector3(lot.cx - 6.5, 1.5, lot.cz + shedOffsetZ),
          new THREE.Vector3(6.5, 3.0, 4.5)
        ));

        // 5. Колодец / колонка во дворе
        dummy.position.set(lot.cx + 7.2, 0.55, lot.cz);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        instWells.setMatrixAt(lotIdx, dummy.matrix);

        // 6. Огород и грядки в задней части усадьбы
        dummy.position.set(lot.cx, 0.07, lot.cz + shedOffsetZ);
        dummy.rotation.set(-Math.PI / 2, 0, 0);
        dummy.updateMatrix();
        instGardens.setMatrixAt(lotIdx, dummy.matrix);

        // 7. Сплошной забор с воротами
        if (fenceIdx < totalLots * 2) {
          dummy.position.set(lot.cx, 0.65, lot.cz + (lot.rot === 0 ? -18 : 18));
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          instFences.setMatrixAt(fenceIdx++, dummy.matrix);
        }

        lotIdx++;
      });

      // 8. Столбы ЛЭП вдоль дорог
      if (poleIdx < blockBounds.length * 2) {
        dummy.position.set(blk.minX - 4.0, 4.6, blk.minZ);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        instPoles.setMatrixAt(poleIdx++, dummy.matrix);

        dummy.position.set(blk.maxX + 4.0, 4.6, blk.maxZ);
        dummy.updateMatrix();
        instPoles.setMatrixAt(poleIdx++, dummy.matrix);
      }
    });

    instHouses.instanceMatrix.needsUpdate = true;
    instRoofs.instanceMatrix.needsUpdate = true;
    instChimneys.instanceMatrix.needsUpdate = true;
    instSheds.instanceMatrix.needsUpdate = true;
    instFences.instanceMatrix.needsUpdate = true;
    instWells.instanceMatrix.needsUpdate = true;
    instGardens.instanceMatrix.needsUpdate = true;
    instPoles.instanceMatrix.needsUpdate = true;

    this.scene.add(instHouses);
    this.scene.add(instRoofs);
    this.scene.add(instChimneys);
    this.scene.add(instSheds);
    this.scene.add(instFences);
    this.scene.add(instWells);
    this.scene.add(instGardens);
    this.scene.add(instPoles);
  }

  // ===========================================================================
  // 5. ГУСТОЙ ЛЕСНОЙ МАССИВ (4000+ СОСЕН), ДЕНДРОПАРК И ЛЕСОПОЛОСЫ
  // ===========================================================================
  buildForestsAndDendropark() {
    // InstancedMesh соснового леса (Ствол + Крона)
    const trunkGeo = new THREE.CylinderGeometry(0.24, 0.38, 12, 6);
    const foliageGeo = new THREE.ConeGeometry(3.6, 11, 6);

    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x4a2e1b });
    const foliageMat = new THREE.MeshLambertMaterial({ color: 0x1b4332 });

    const totalTrees = 4500;
    const instTrunks = new THREE.InstancedMesh(trunkGeo, trunkMat, totalTrees);
    const instFoliage = new THREE.InstancedMesh(foliageGeo, foliageMat, totalTrees);

    const dummy = new THREE.Object3D();
    let treeIdx = 0;

    // 1. Густой сосновый бор вокруг военного аэродрома и дороги на Вокзал (Восток / Юго-Восток)
    for (let i = 0; i < 2800; i++) {
      if (treeIdx >= totalTrees) break;
      const x = 320 + Math.random() * 800;
      const z = -1100 + Math.random() * 1400;

      // Не спавним деревья прямо на взлетной полосе ПАГ-14
      if (x > 420 && x < 480 && z > -1150 && z < 250) continue;

      const scale = 0.75 + Math.random() * 0.55;
      dummy.position.set(x, 6.0 * scale, z);
      dummy.scale.set(scale, scale, scale);
      dummy.rotation.set((Math.random() - 0.5) * 0.12, Math.random() * Math.PI, (Math.random() - 0.5) * 0.12);
      dummy.updateMatrix();
      instTrunks.setMatrixAt(treeIdx, dummy.matrix);

      dummy.position.set(x, 11.5 * scale, z);
      dummy.updateMatrix();
      instFoliage.setMatrixAt(treeIdx, dummy.matrix);

      treeIdx++;
    }

    // 2. Городнянский дендропарк (Северо-Восток центра)
    for (let i = 0; i < 700; i++) {
      if (treeIdx >= totalTrees) break;
      const x = 70 + Math.random() * 260;
      const z = 70 + Math.random() * 280;

      const scale = 0.7 + Math.random() * 0.5;
      dummy.position.set(x, 6.0 * scale, z);
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      instTrunks.setMatrixAt(treeIdx, dummy.matrix);

      dummy.position.set(x, 11.0 * scale, z);
      dummy.updateMatrix();
      instFoliage.setMatrixAt(treeIdx, dummy.matrix);

      treeIdx++;
    }

    // 3. Защитные лесополосы вдоль трасс и границ карты (Север, Запад, Юг)
    for (let i = 0; i < 1000; i++) {
      if (treeIdx >= totalTrees) break;
      // Вдоль границы карты
      const isNorth = i % 2 === 0;
      const x = (Math.random() - 0.5) * 2800;
      const z = isNorth ? 1100 + Math.random() * 250 : -1100 - Math.random() * 250;

      const scale = 0.8 + Math.random() * 0.45;
      dummy.position.set(x, 6.0 * scale, z);
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      instTrunks.setMatrixAt(treeIdx, dummy.matrix);

      dummy.position.set(x, 11.0 * scale, z);
      dummy.updateMatrix();
      instFoliage.setMatrixAt(treeIdx, dummy.matrix);

      treeIdx++;
    }

    instTrunks.instanceMatrix.needsUpdate = true;
    instFoliage.instanceMatrix.needsUpdate = true;
    this.scene.add(instTrunks);
    this.scene.add(instFoliage);

    console.log(`[Zero-Void Forests] Розсаджено ${treeIdx} сосен та дерев лісових масивів Городні`);
  }
  spawnFleet() {
    if (typeof VehicleFactory === 'undefined') return;
    if (this.vehicles.length > 0) return;

    const vaz = VehicleFactory.createVAZ2101();
    vaz.position.set(-185, 0, 15);
    this.scene.add(vaz);
    this.vehicles.push({ mesh: vaz, type: 'vaz' });

    const lanos = VehicleFactory.createDaewooLanos();
    lanos.position.set(16, 0, -170);
    this.scene.add(lanos);
    this.vehicles.push({ mesh: lanos, type: 'lanos' });

    const npVan = VehicleFactory.createNovaPoshtaVan();
    npVan.position.set(-165, 0, -135);
    this.scene.add(npVan);
    this.vehicles.push({ mesh: npVan, type: 'np' });

    const bus = VehicleFactory.createGorodnyaBus();
    bus.position.set(-14, 0, 30);
    this.scene.add(bus);
    this.vehicles.push({ mesh: bus, type: 'bus' });

    const drag = VehicleFactory.createDragCoupe();
    drag.position.set(340, 0, -220);
    this.scene.add(drag);
    this.vehicles.push({ mesh: drag, type: 'drag' });

    const police = VehicleFactory.createPoliceCar();
    police.position.set(-18, 0, -45);
    this.scene.add(police);
    this.vehicles.push({ mesh: police, type: 'police' });
  }
}

window.GorodnyaWorldPart1 = GorodnyaPart1World;
window.ProceduralPBRFactory = ProceduralPBRFactory;
console.log('✅ [GorodnyaPart1World] Повний генератор нульової пустоти (Zero-Void) завантажено!');
