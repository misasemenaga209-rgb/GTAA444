/**
 * =============================================================================
 * GORODNYA 3D: OPEN WORLD (ЧАСТЬ 4 - ULTRA TEXTURE & SHADER ENGINE)
 * =============================================================================
 * Principal Graphics & Shader Programmer (WebGL / GLSL / Three.js)
 * 1. Анти-тайлинг и смешивание слоев (Road & Terrain Splatting в GLSL)
 * 2. Процедурное загрязнение (Dirt Gradient, Rain Streaks, Sobel Normal Maps)
 * 3. Псевдо-интерьеры в окнах (Parallax Interior Shader)
 * 4. Система декалей и микро-деталей (DecalScatterSystem на InstancedMesh)
 * 5. Анизотропная фильтрация и максимальная оптимизация (60 FPS)
 * =============================================================================
 */

class UltraTextureEngine {
  constructor(renderer) {
    this.renderer = renderer;
    this.maxAnisotropy = renderer ? renderer.capabilities.getMaxAnisotropy() : 16;
    this.textureCache = new Map();

    console.log(`[UltraTextureEngine] Ініціалізація з максимальною анізотропією: ${this.maxAnisotropy}x`);
  }

  // --- 1. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ГЕНЕРАЦИИ ТЕКСТУР В ПАМЯТИ (CANVAS 2D) ---
  createCanvasTexture(width, height, drawFn) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    drawFn(ctx, width, height);

    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = this.maxAnisotropy;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    return texture;
  }

  // Генератор карты нормалей через фильтр Собеля (Sobel Operator)
  generateNormalMapFromHeight(heightCanvas, strength = 2.5) {
    const w = heightCanvas.width;
    const h = heightCanvas.height;
    const srcCtx = heightCanvas.getContext('2d');
    const srcData = srcCtx.getImageData(0, 0, w, h).data;

    const normCanvas = document.createElement('canvas');
    normCanvas.width = w;
    normCanvas.height = h;
    const normCtx = normCanvas.getContext('2d');
    const normImgData = normCtx.createImageData(w, h);
    const dstData = normImgData.data;

    const getHeight = (x, y) => {
      const px = (x + w) % w;
      const py = (y + h) % h;
      return srcData[(py * w + px) * 4] / 255.0;
    };

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        // Ядро Собеля для градиента по X и Y
        const tl = getHeight(x - 1, y - 1);
        const l  = getHeight(x - 1, y);
        const bl = getHeight(x - 1, y + 1);
        const tr = getHeight(x + 1, y - 1);
        const r  = getHeight(x + 1, y);
        const br = getHeight(x + 1, y + 1);
        const t  = getHeight(x, y - 1);
        const b  = getHeight(x, y + 1);

        const dx = (tr + 2.0 * r + br) - (tl + 2.0 * l + bl);
        const dy = (bl + 2.0 * b + br) - (tl + 2.0 * t + tr);
        const dz = 1.0 / strength;

        // Нормализация вектора (dx, dy, dz)
        const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const nx = -dx / len;
        const ny = -dy / len;
        const nz = dz / len;

        // Кодирование в RGB [0..255]
        const idx = (y * w + x) * 4;
        dstData[idx]     = Math.floor((nx * 0.5 + 0.5) * 255);
        dstData[idx + 1] = Math.floor((ny * 0.5 + 0.5) * 255);
        dstData[idx + 2] = Math.floor((nz * 0.5 + 0.5) * 255);
        dstData[idx + 3] = 255;
      }
    }

    normCtx.putImageData(normImgData, 0, 0);
    const texture = new THREE.CanvasTexture(normCanvas);
    texture.anisotropy = this.maxAnisotropy;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    return texture;
  }

  // --- 2. ПРОЦЕДУРНЫЕ КАРТЫ ДЕТАЛИЗАЦИИ МАТЕРИАЛОВ ---
  getBrickNormalMap() {
    if (this.textureCache.has('brick_normal')) return this.textureCache.get('brick_normal');

    const hCanvas = document.createElement('canvas');
    hCanvas.width = 512; hCanvas.height = 512;
    const ctx = hCanvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 512, 512);

    // Сетка швов кладки
    ctx.fillStyle = '#222222';
    const rows = 16; const cols = 8;
    const rh = 512 / rows; const cw = 512 / cols;

    for (let r = 0; r <= rows; r++) {
      ctx.fillRect(0, r * rh - 2, 512, 4);
    }
    for (let r = 0; r < rows; r++) {
      const offset = (r % 2) * (cw / 2);
      for (let c = 0; c <= cols; c++) {
        ctx.fillRect(c * cw + offset - 2, r * rh, 4, rh);
      }
    }

    // Текстурный микрошум кирпича
    const imgData = ctx.getImageData(0, 0, 512, 512);
    for (let i = 0; i < imgData.data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 35;
      imgData.data[i] = Math.max(0, Math.min(255, imgData.data[i] + noise));
    }
    ctx.putImageData(imgData, 0, 0);

    const normalTex = this.generateNormalMapFromHeight(hCanvas, 3.2);
    normalTex.wrapS = THREE.RepeatWrapping;
    normalTex.wrapT = THREE.RepeatWrapping;
    normalTex.repeat.set(4, 4);
    this.textureCache.set('brick_normal', normalTex);
    return normalTex;
  }

  getConcreteJointNormalMap() {
    if (this.textureCache.has('concrete_joint_normal')) return this.textureCache.get('concrete_joint_normal');

    const hCanvas = document.createElement('canvas');
    hCanvas.width = 512; hCanvas.height = 512;
    const ctx = hCanvas.getContext('2d');
    ctx.fillStyle = '#dcdde1'; ctx.fillRect(0, 0, 512, 512);

    // Глубокий компенсационный шов плиты ПАГ-14
    ctx.strokeStyle = '#111111'; ctx.lineWidth = 14;
    ctx.strokeRect(0, 0, 512, 512);

    // Сколы по кромке плит
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = '#333333';
      const sz = 4 + Math.random() * 8;
      const side = Math.floor(Math.random() * 4);
      if (side === 0) ctx.fillRect(Math.random() * 512, 0, sz, sz);
      else if (side === 1) ctx.fillRect(Math.random() * 512, 512 - sz, sz, sz);
      else if (side === 2) ctx.fillRect(0, Math.random() * 512, sz, sz);
      else ctx.fillRect(512 - sz, Math.random() * 512, sz, sz);
    }

    const normalTex = this.generateNormalMapFromHeight(hCanvas, 2.0);
    normalTex.wrapS = THREE.RepeatWrapping;
    normalTex.wrapT = THREE.RepeatWrapping;
    this.textureCache.set('concrete_joint_normal', normalTex);
    return normalTex;
  }

  // --- 3. GLSL ШЕЙДЕРЫ АНТИ-ТАЙЛИНГА И СМЕШИВАНИЯ СЛОЕВ (SPLAT SHADERS) ---
  static getCommonGLSLNoise() {
    return `
      // Процедурный 2D-шум Перлина / Симплекс в GLSL
      vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

      float snoise(vec2 v) {
        const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
        vec2 i  = floor(v + dot(v, C.yy));
        vec2 x0 = v - i + dot(i, C.xx);
        vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
        vec4 x12 = x0.xyxy + C.xxzz;
        x12.xy -= i1;
        i = mod289(i);
        vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
        vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
        m = m*m; m = m*m;
        vec3 x = 2.0 * fract(p * C.www) - 1.0;
        vec3 h = abs(x) - 0.5;
        vec3 ox = floor(x + 0.5);
        vec3 a0 = x - ox;
        m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
        vec3 g;
        g.x  = a0.x  * x0.x  + h.x  * x0.y;
        g.yz = a0.yz * x12.xz + h.yz * x12.yw;
        return 130.0 * dot(m, g);
      }
    `;
  }

  // Шейдер дорог Городни: Смешивание нового черного асфальта, старого серого и трещин/битума
  createRoadMaterial() {
    const mat = new THREE.MeshStandardMaterial({
      roughness: 0.85,
      metalness: 0.12
    });

    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `#include <common>
         varying vec3 vWorldPosition;`
      );
      shader.vertexShader = shader.vertexShader.replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
         vWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;`
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `#include <common>
         varying vec3 vWorldPosition;
         ${UltraTextureEngine.getCommonGLSLNoise()}`
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
         // Координаты дорожного полотна
         vec2 wPos = vWorldPosition.xz;

         // Шум разной частоты для устранения повторяемости тайлинга
         float macroNoise = snoise(wPos * 0.015);
         float microNoise = snoise(wPos * 0.18);
         float crackNoise = snoise(wPos * 0.85);

         // 3 Текстурных слоя асфальта
         vec3 freshAsphalt = vec3(0.08, 0.09, 0.11); // Свежий черный асфальт
         vec3 agedAsphalt  = vec3(0.24, 0.26, 0.29); // Выцветший гравийный асфальт
         vec3 tarPatch     = vec3(0.03, 0.03, 0.04); // Заплатки горячего битума

         // Смешивание по макро-шуму
         float blendFactor = smoothstep(-0.4, 0.5, macroNoise + microNoise * 0.35);
         vec3 roadColor = mix(freshAsphalt, agedAsphalt, blendFactor);

         // Добавление редких заплаток битума и трещин
         if (crackNoise > 0.68) {
           roadColor = tarPatch;
         }

         // Разметка (Шевченко, Черниговская): осевая желтая линия и белые полосы
         float distFromCenter = abs(vWorldPosition.x);
         if (abs(vWorldPosition.z) < 550.0 && distFromCenter < 0.2) {
           // Осевая линия (с прерывистым штрихом)
           float dash = step(0.4, fract(vWorldPosition.z * 0.15));
           roadColor = mix(roadColor, vec3(0.95, 0.75, 0.08), dash);
         }

         diffuseColor.rgb = roadColor;
        `
      );
    };

    return mat;
  }

  // Шейдер взлетной полосы Аэродрома Городни (плиты ПАГ-14 + пятна масла + трава в стыках)
  createAirfieldMaterial() {
    const mat = new THREE.MeshStandardMaterial({
      roughness: 0.88,
      metalness: 0.15,
      normalMap: this.getConcreteJointNormalMap()
    });

    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `#include <common>
         varying vec3 vWorldPosition;`
      );
      shader.vertexShader = shader.vertexShader.replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
         vWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;`
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `#include <common>
         varying vec3 vWorldPosition;
         ${UltraTextureEngine.getCommonGLSLNoise()}`
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         vec2 slabCoord = vWorldPosition.xz;

         // Сетка плит ПАГ-14: размер 6.0м х 2.0м
         vec2 grid = abs(fract(slabCoord * vec2(1.0/6.0, 1.0/2.0)) - 0.5);
         float seam = 1.0 - smoothstep(0.42, 0.48, max(grid.x, grid.y));

         // Базовый бетон
         vec3 concreteColor = vec3(0.55, 0.58, 0.62);

         // Масляные пятна от самолетов и дрифта
         float oilNoise = snoise(slabCoord * 0.35);
         if (oilNoise > 0.45) {
           concreteColor *= (1.0 - (oilNoise - 0.45) * 1.4);
         }

         // Пробивающаяся зеленая трава в компенсационных швах
         vec3 mossSeam = vec3(0.12, 0.28, 0.14);
         float grassNoise = snoise(slabCoord * 1.2);
         if (seam > 0.6 && grassNoise > 0.2) {
           concreteColor = mix(concreteColor, mossSeam, 0.85);
         }

         diffuseColor.rgb = concreteColor;
        `
      );
    };

    return mat;
  }

  // Шейдер зданий с процедурным загрязнением (Dirt Gradient) и потеками от дождя
  createWeatheredFacadeMaterial(baseColorHex = 0xb93a2b, isBrick = true) {
    const mat = new THREE.MeshStandardMaterial({
      color: baseColorHex,
      roughness: 0.75,
      metalness: 0.08,
      normalMap: isBrick ? this.getBrickNormalMap() : null
    });

    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `#include <common>
         varying vec3 vWorldPosition;`
      );
      shader.vertexShader = shader.vertexShader.replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
         vWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;`
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `#include <common>
         varying vec3 vWorldPosition;
         ${UltraTextureEngine.getCommonGLSLNoise()}`
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         // 1. Градиент грязи и пыли у фундамента (первые 0.8м от земли)
         float heightFactor = clamp(vWorldPosition.y / 0.85, 0.0, 1.0);
         float mudNoise = snoise(vWorldPosition.xz * 1.5) * 0.15;
         float dirtMask = (1.0 - heightFactor) + mudNoise;
         vec3 dirtColor = vec3(0.18, 0.14, 0.11); // Землистая грязь

         diffuseColor.rgb = mix(diffuseColor.rgb, dirtColor, clamp(dirtMask * 0.85, 0.0, 0.9));

         // 2. Вертикальные подтеки от дождя под крышей
         float rainStreak = snoise(vec2(vWorldPosition.x * 2.5, vWorldPosition.y * 0.2));
         if (vWorldPosition.y > 3.5 && rainStreak > 0.5) {
           diffuseColor.rgb *= 0.72; // Затемнение от ржавчины и воды
         }
        `
      );
    };

    return mat;
  }

  // --- 4. ПСЕВДО-ИНТЕРЬЕРЫ В ОКНАХ (PARALLAX WINDOW MATERIAL) ---
  createParallaxWindowMaterial(interiorType = 'atb') {
    // Высокая зеркальность стекла
    const mat = new THREE.MeshStandardMaterial({
      color: 0x111e2e,
      roughness: 0.06,
      metalness: 0.92,
      envMapIntensity: 1.8
    });

    // Генерация атласа псевдо-комнаты в Canvas
    const atlas = this.createCanvasTexture(256, 256, (ctx, w, h) => {
      ctx.fillStyle = interiorType === 'atb' ? '#003366' : '#2c1810';
      ctx.fillRect(0, 0, w, h);

      // Стеллажи внутри комнаты / теплый свет люстры
      ctx.fillStyle = '#fffae6';
      ctx.beginPath();
      ctx.arc(128, 60, 35, 0, Math.PI * 2);
      ctx.fill();

      // Горизонтальные полки с товарами
      ctx.fillStyle = '#f39c12';
      ctx.fillRect(20, 140, 216, 12);
      ctx.fillRect(20, 190, 216, 12);
    });

    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uInteriorAtlas = { value: atlas };

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `#include <common>
         uniform sampler2D uInteriorAtlas;`
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         // Проекция параллакса взгляда вглубь комнаты
         vec3 viewDir = normalize(vViewPosition);
         vec2 parallaxOffset = viewDir.xy * 0.18;
         vec4 interiorColor = texture2D(uInteriorAtlas, vUv + parallaxOffset);

         // Смешивание отражения стекла и внутреннего света
         diffuseColor.rgb = mix(diffuseColor.rgb, interiorColor.rgb, 0.45);
        `
      );
    };

    return mat;
  }
}

// =============================================================================
// 5. СИСТЕМА ДЕКАЛЕЙ И МЕЛКИХ ДЕТАЛЕЙ (DECAL SCATTER SYSTEM)
// =============================================================================
class DecalScatterSystem {
  constructor(scene, textureEngine) {
    this.scene = scene;
    this.engine = textureEngine;

    this.scatterManholes();
    this.scatterStormDrains();
    this.scatterStreetSigns();
    this.scatterAutumnLeaves();
  }

  // Чугунные канализационные люки («ГОРОДНЯ КАНАЛІЗАЦІЯ»)
  scatterManholes() {
    const manholeTex = this.engine.createCanvasTexture(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#2c3437'; ctx.beginPath(); ctx.arc(128, 128, 120, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#181b1c'; ctx.lineWidth = 10; ctx.stroke();
      ctx.strokeStyle = '#444d50'; ctx.lineWidth = 4;
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
        ctx.beginPath(); ctx.moveTo(128, 128); ctx.lineTo(128 + Math.cos(a) * 110, 128 + Math.sin(a) * 110); ctx.stroke();
      }
      ctx.fillStyle = '#dcdde1'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('ГОРОДНЯ', 128, 120); ctx.fillText('2024', 128, 145);
    });

    const geo = new THREE.PlaneGeometry(1.4, 1.4);
    const mat = new THREE.MeshStandardMaterial({
      map: manholeTex, transparent: true, roughness: 0.6, depthWrite: false
    });

    const count = 22;
    const instMesh = new THREE.InstancedMesh(geo, mat, count);
    const dummy = new THREE.Object3D();

    for (let i = 0; i < count; i++) {
      // Размещение люков вдоль ул. Шевченко и Черниговской
      const isShev = i % 2 === 0;
      const x = isShev ? (Math.random() - 0.5) * 700 : (Math.random() > 0.5 ? 4.2 : -4.2);
      const z = isShev ? (Math.random() > 0.5 ? 4.2 : -4.2) : (Math.random() - 0.5) * 700;

      dummy.position.set(x, 0.105, z);
      dummy.rotation.x = -Math.PI / 2;
      dummy.rotation.z = Math.random() * Math.PI * 2;
      dummy.updateMatrix();
      instMesh.setMatrixAt(i, dummy.matrix);
    }

    instMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(instMesh);
  }

  // Решетки ливневок у бордюров
  scatterStormDrains() {
    const drainTex = this.engine.createCanvasTexture(128, 256, (ctx, w, h) => {
      ctx.fillStyle = '#1e272e'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#000000';
      for (let y = 14; y < h - 14; y += 22) {
        ctx.fillRect(12, y, w - 24, 10);
      }
    });

    const geo = new THREE.PlaneGeometry(0.9, 1.8);
    const mat = new THREE.MeshStandardMaterial({ map: drainTex, roughness: 0.5, metalness: 0.8, depthWrite: false });
    const count = 30;
    const instMesh = new THREE.InstancedMesh(geo, mat, count);
    const dummy = new THREE.Object3D();

    for (let i = 0; i < count; i++) {
      const z = -400 + i * 28;
      dummy.position.set(i % 2 === 0 ? 8.4 : -8.4, 0.102, z);
      dummy.rotation.x = -Math.PI / 2;
      dummy.updateMatrix();
      instMesh.setMatrixAt(i, dummy.matrix);
    }
    instMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(instMesh);
  }

  // Таблички с названиями улиц Городни («вул. Шевченка», «вул. Чернігівська»)
  scatterStreetSigns() {
    const makeSignTex = (streetName) => this.engine.createCanvasTexture(256, 64, (ctx, w, h) => {
      ctx.fillStyle = '#004488'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4; ctx.strokeRect(4, 4, w - 8, h - 8);
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 24px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(streetName, w / 2, 42);
    });

    const shevTex = makeSignTex('вул. Шевченка');
    const cherTex = makeSignTex('вул. Чернігівська');

    const signGeo = new THREE.PlaneGeometry(1.6, 0.42);

    // Табличка на стене дома возле перекрестка
    const sign1 = new THREE.Mesh(signGeo, new THREE.MeshBasicMaterial({ map: shevTex }));
    sign1.position.set(12, 2.8, -12);
    sign1.rotation.y = -Math.PI / 2;
    this.scene.add(sign1);

    const sign2 = new THREE.Mesh(signGeo, new THREE.MeshBasicMaterial({ map: cherTex }));
    sign2.position.set(-12, 2.8, 12);
    this.scene.add(sign2);
  }

  // Опавшие листья в Дендропарке (InstancedMesh)
  scatterAutumnLeaves() {
    const leafTex = this.engine.createCanvasTexture(64, 64, (ctx, w, h) => {
      ctx.fillStyle = '#d35400';
      ctx.beginPath();
      ctx.ellipse(32, 32, 24, 14, Math.PI / 4, 0, Math.PI * 2);
      ctx.fill();
    });

    const geo = new THREE.PlaneGeometry(0.35, 0.35);
    const mat = new THREE.MeshBasicMaterial({ map: leafTex, transparent: true, depthWrite: false });
    const count = 180;
    const instMesh = new THREE.InstancedMesh(geo, mat, count);
    const dummy = new THREE.Object3D();

    for (let i = 0; i < count; i++) {
      const lx = 70 + Math.random() * 200;
      const lz = 80 + Math.random() * 200;
      dummy.position.set(lx, 0.08, lz);
      dummy.rotation.x = -Math.PI / 2;
      dummy.rotation.z = Math.random() * Math.PI * 2;
      dummy.updateMatrix();
      instMesh.setMatrixAt(i, dummy.matrix);
    }
    instMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(instMesh);
  }
}
