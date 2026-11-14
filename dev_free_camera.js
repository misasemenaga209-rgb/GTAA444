/**
 * =============================================================================
 * GORODNYA 3D: OPEN WORLD - DEV FREE CAMERA & PHOTO MODE
 * =============================================================================
 * Режим свободной камеры разработчика (FreeCamera Mode) для Three.js:
 * 1. Плавный полет во всех плоскостях (WASD + Space/Ctrl + Shift)
 * 2. Регулировка скорости на лету (Колесико мыши или +/-)
 * 3. Фоторежим чистого экрана (Клавиша H скрывает весь HUD)
 * 4. Пресеты телепортации по ключевым точкам Городни (Numpad 1–7)
 * 5. Информативная плашка с координатами (X, Y, Z) и подсказками
 * =============================================================================
 */

class DevFreeCamera {
  constructor(camera, domElement, options = {}) {
    this.camera = camera;
    this.domElement = domElement || document.body;

    // Состояние режима
    this.isActive = false;
    this.isHudHidden = false;

    // Параметры скорости полета
    this.baseSpeed = options.speed || 45.0; // м/с
    this.minSpeed = 5.0;
    this.maxSpeed = 350.0;
    this.speedMultiplier = 1.0;

    // Углы поворота и сглаживание
    this.yaw = 0;
    this.pitch = 0;
    this.targetYaw = 0;
    this.targetPitch = 0;
    this.lookSensitivity = 0.0032;
    this.damping = 0.14;

    // Мышь и клавиши
    this.isMouseDown = false;
    this.prevMouse = { x: 0, y: 0 };
    this.keys = {};

    // Сохранение исходного состояния для плавного возврата
    this.savedState = {
      position: new THREE.Vector3(),
      quaternion: new THREE.Quaternion()
    };

    // Точки быстрого телепорта по Городне
    this.teleportPresets = [
      { name: '1: Центр / АТБ / Аврора', pos: new THREE.Vector3(0, 48, -130), look: new THREE.Vector3(0, 5, -180) },
      { name: '2: Центральний Базар', pos: new THREE.Vector3(-225, 45, 100), look: new THREE.Vector3(-225, 3, 35) },
      { name: '3: вул. Шевченка (Перспектива)', pos: new THREE.Vector3(0, 38, 280), look: new THREE.Vector3(0, 5, -200) },
      { name: '4: Озеро Делдачков та Смяч', pos: new THREE.Vector3(-260, 42, -180), look: new THREE.Vector3(-320, 2, -340) },
      { name: '5: Рампа «Нова Пошта» №1', pos: new THREE.Vector3(70, 32, -105), look: new THREE.Vector3(70, 3, -150) },
      { name: '6: Ж/Д Вокзал та потяг', pos: new THREE.Vector3(470, 36, 10), look: new THREE.Vector3(520, 3, 40) },
      { name: '7: Військовий Аеродром ПАГ-14', pos: new THREE.Vector3(450, 65, -220), look: new THREE.Vector3(450, 2, -750) }
    ];

    this.createUI();
    this.bindEvents();
    console.log('✅ [DevFreeCamera] Модуль вільної камери розробника ініціалізовано. Натисніть [C] або [F8] для активації.');
  }

  // --- 1. СОЗДАНИЕ ИНТЕРФЕЙСА FREECAM И ПОДСКАЗОК ---
  createUI() {
    // Информационный баннер вверху экрана
    this.banner = document.createElement('div');
    this.banner.id = 'dev-freecam-banner';
    this.banner.style.cssText = `
      position: fixed; top: 14px; left: 50%; transform: translateX(-50%);
      background: rgba(15, 23, 42, 0.92); border: 2px solid #38bdf8;
      box-shadow: 0 0 25px rgba(56, 189, 248, 0.4);
      padding: 8px 20px; border-radius: 8px; z-index: 9999;
      font-family: 'Ubuntu', -apple-system, sans-serif; font-size: 13px; color: #fff;
      display: none; align-items: center; gap: 14px; pointer-events: auto; user-select: none;
    `;

    this.banner.innerHTML = `
      <div style="display:flex; align-items:center; gap:8px;">
        <span style="background:#0284c7; padding:2px 8px; border-radius:4px; font-weight:bold; font-size:12px;">📷 FREECAM</span>
        <span id="freecam-coords" style="color:#38bdf8; font-family:monospace; font-size:13px;">X: 0 | Y: 0 | Z: 0</span>
      </div>
      <div style="color:#94a3b8; font-size:12px; border-left:1px solid #475569; padding-left:12px;">
        <b>[WASD]</b> Політ &nbsp;|&nbsp;
        <b>[Space/Ctrl]</b> Висота &nbsp;|&nbsp;
        <b>[Shift]</b> Турбо x3 &nbsp;|&nbsp;
        <b>[Коліщатко]</b> Швидкість: <span id="freecam-speed-val" style="color:#f1c40f;">45</span> м/с &nbsp;|&nbsp;
        <b>[H]</b> Фоторежим &nbsp;|&nbsp;
        <b>[1-7]</b> Телепорт &nbsp;|&nbsp;
        <b>[C]</b> Вихід
      </div>
    `;
    document.body.appendChild(this.banner);

    // Панель быстрых кнопок телепортации в правом нижнем углу
    this.teleportBar = document.createElement('div');
    this.teleportBar.id = 'dev-freecam-teleports';
    this.teleportBar.style.cssText = `
      position: fixed; bottom: 85px; right: 22px; z-index: 9999;
      display: none; flex-direction: column; gap: 6px;
      background: rgba(15, 23, 42, 0.88); border: 1px solid #475569;
      padding: 10px 14px; border-radius: 8px; font-family: 'Ubuntu', sans-serif;
      box-shadow: 0 4px 20px rgba(0,0,0,0.6);
    `;

    let html = `<div style="font-size:12px; color:#38bdf8; font-weight:bold; margin-bottom:4px;">📍 ТОЧКИ ТЕЛЕПОРТУ ГОРОДНІ:</div>`;
    this.teleportPresets.forEach((tp, i) => {
      html += `<button class="tp-btn" data-idx="${i}" style="background:#1e293b; color:#e2e8f0; border:1px solid #334155; padding:4px 8px; border-radius:4px; font-size:11px; text-align:left; cursor:pointer;">${tp.name}</button>`;
    });
    this.teleportBar.innerHTML = html;
    document.body.appendChild(this.teleportBar);

    this.teleportBar.querySelectorAll('.tp-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.target.getAttribute('data-idx'));
        this.teleportTo(idx);
      });
    });
  }

  // --- 2. ОБРАБОТКА ВВОДА И КЛАВИАТУРЫ ---
  bindEvents() {
    window.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      this.keys[key] = true;

      // Включение / выключение FreeCam на клавишу C или F8
      if (key === 'c' || e.key === 'F8') {
        // Проверяем, что фокус не в input текстовых полях
        if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          this.toggle();
        }
      }

      // Скрытие / показ всего HUD на клавишу H (Фоторежим)
      if (key === 'h' && this.isActive) {
        e.preventDefault();
        this.toggleHud();
      }

      // Цифры 1–7 для быстрого телепорта в режиме FreeCam
      if (this.isActive && !e.ctrlKey && !e.altKey) {
        const num = parseInt(e.key);
        if (num >= 1 && num <= this.teleportPresets.length) {
          this.teleportTo(num - 1);
        }
      }

      // Изменение скорости клавишами + / -
      if (this.isActive) {
        if (e.key === '+' || e.key === '=') this.adjustSpeed(5);
        if (e.key === '-' || e.key === '_') this.adjustSpeed(-5);
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.key.toLowerCase()] = false;
    });

    // Регулировка скорости полета колесиком мыши
    window.addEventListener('wheel', (e) => {
      if (this.isActive) {
        const delta = e.deltaY < 0 ? 5 : -5;
        this.adjustSpeed(delta);
      }
    }, { passive: true });

    // Вращение камеры мышью
    window.addEventListener('mousedown', (e) => {
      if (!this.isActive) return;
      if (e.button === 0 || e.button === 2) {
        this.isMouseDown = true;
        this.prevMouse.x = e.clientX;
        this.prevMouse.y = e.clientY;
      }
    });

    window.addEventListener('mouseup', () => {
      this.isMouseDown = false;
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isActive || !this.isMouseDown) return;

      const dx = e.clientX - this.prevMouse.x;
      const dy = e.clientY - this.prevMouse.y;

      this.targetYaw -= dx * this.lookSensitivity;
      this.targetPitch = Math.max(-1.52, Math.min(1.52, this.targetPitch - dy * this.lookSensitivity));

      this.prevMouse.x = e.clientX;
      this.prevMouse.y = e.clientY;
    });

    // Отключение контекстного меню при клике ПКМ в режиме полета
    window.addEventListener('contextmenu', (e) => {
      if (this.isActive) e.preventDefault();
    });
  }

  adjustSpeed(amount) {
    this.baseSpeed = Math.max(this.minSpeed, Math.min(this.maxSpeed, this.baseSpeed + amount));
    const speedEl = document.getElementById('freecam-speed-val');
    if (speedEl) speedEl.innerText = Math.round(this.baseSpeed);
  }

  // --- 3. АКТИВАЦИЯ И ВОЗВРАТ КАМЕРЫ ---
  toggle() {
    this.isActive = !this.isActive;

    if (this.isActive) {
      // Сохраняем исходное положение камеры игрока
      this.savedState.position.copy(this.camera.position);
      this.savedState.quaternion.copy(this.camera.quaternion);

      // Инициализируем углы обзора по текущему направлению камеры
      const dir = new THREE.Vector3();
      this.camera.getWorldDirection(dir);
      this.targetYaw = Math.atan2(dir.x, -dir.z);
      this.targetPitch = Math.asin(dir.y);
      this.yaw = this.targetYaw;
      this.pitch = this.targetPitch;

      // Отображаем плашку и телепорт-панель
      this.banner.style.display = 'flex';
      this.teleportBar.style.display = 'flex';
      this.isHudHidden = false;

      console.log('🚀 [DevFreeCamera] Вільний політ АКТИВОВАНО. Геймплей заморожено.');
    } else {
      // Возвращаем камеру и скрываем UI разработчика
      this.banner.style.display = 'none';
      this.teleportBar.style.display = 'none';

      // Если HUD был скрыт клавишей H, восстанавливаем его
      if (this.isHudHidden) {
        this.toggleHud();
      }

      console.log('🛬 [DevFreeCamera] Вільний політ ДЕАКТИВОВАНО. Камеру повернуто гравцю.');
    }
  }

  // --- 4. ФОТОРЕЖИМ: СКРЫТИЕ / ПОКАЗ ИНТЕРФЕЙСА (КЛАВИША H) ---
  toggleHud() {
    this.isHudHidden = !this.isHudHidden;
    const hudElements = [
      'hud-top-right',
      'hud-bottom-left',
      'hud-speedometer',
      'hud-mission-info',
      'interaction-prompt',
      'dev-freecam-banner',
      'dev-freecam-teleports',
      'shop-modal',
      'gta-smartphone',
      'tuning-modal'
    ];

    hudElements.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.style.visibility = this.isHudHidden ? 'hidden' : 'visible';
      }
    });

    console.log(`📸 [PhotoMode] Чистий екран: ${this.isHudHidden ? 'УВІМКНЕНО (HUD сховано)' : 'ВИМКНЕНО'}`);
  }

  // --- 5. ТЕЛЕПОРТАЦИЯ КАМЕРЫ ПО ПРЕСЕТАМ ГОРОДНИ ---
  teleportTo(index) {
    if (index < 0 || index >= this.teleportPresets.length) return;
    const tp = this.teleportPresets[index];

    this.camera.position.copy(tp.pos);

    // Ориентация камеры на целевой объект
    const fwd = tp.look.clone().sub(tp.pos).normalize();
    this.targetYaw = Math.atan2(fwd.x, -fwd.z);
    this.targetPitch = Math.asin(fwd.y);
    this.yaw = this.targetYaw;
    this.pitch = this.targetPitch;

    console.log(`📍 [DevFreeCamera] Телепорт до: ${tp.name}`);
  }

  // --- 6. ОБНОВЛЕНИЕ В ИГРОВОМ ЦИКЛЕ ANIMATE() ---
  update(delta) {
    if (!this.isActive) return;

    // Плавное сглаживание вращения камеры
    this.yaw = THREE.MathUtils.lerp(this.yaw, this.targetYaw, this.damping);
    this.pitch = THREE.MathUtils.lerp(this.pitch, this.targetPitch, this.damping);

    // Вычисление базисных векторов движения
    const fwd = new THREE.Vector3(
      Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      -Math.cos(this.yaw) * Math.cos(this.pitch)
    ).normalize();

    const right = new THREE.Vector3(Math.cos(this.yaw), 0, Math.sin(this.yaw)).normalize();
    const up = new THREE.Vector3(0, 1, 0);

    // Расчет текущей скорости (с учетом турбо Shift)
    const isTurbo = this.keys['shift'];
    const currentSpeed = this.baseSpeed * (isTurbo ? 3.0 : 1.0);
    const moveStep = currentSpeed * delta;

    // Перемещение во всех направлениях
    if (this.keys['w'] || this.keys['arrowup']) this.camera.position.addScaledVector(fwd, moveStep);
    if (this.keys['s'] || this.keys['arrowdown']) this.camera.position.addScaledVector(fwd, -moveStep);
    if (this.keys['a'] || this.keys['arrowleft']) this.camera.position.addScaledVector(right, -moveStep);
    if (this.keys['d'] || this.keys['arrowright']) this.camera.position.addScaledVector(right, moveStep);

    // Вертикальный подъем / спуск
    if (this.keys[' '] || this.keys['space'] || this.keys['e']) this.camera.position.y += moveStep * 0.85;
    if (this.keys['control'] || this.keys['q']) this.camera.position.y -= moveStep * 0.85;

    // Ориентация камеры
    const target = this.camera.position.clone().add(fwd);
    this.camera.lookAt(target);

    // Обновление координат на баннере
    const coordsEl = document.getElementById('freecam-coords');
    if (coordsEl && !this.isHudHidden) {
      coordsEl.innerText = `X: ${Math.round(this.camera.position.x)} | Y: ${Math.round(this.camera.position.y)} | Z: ${Math.round(this.camera.position.z)}`;
    }
  }
}

// Экспорт для глобального использования
window.DevFreeCamera = DevFreeCamera;
