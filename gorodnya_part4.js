/**
 * =============================================================================
 * GORODNYA 3D: OPEN WORLD (ЧАСТЬ 4 - ULTRA TEXTURE & SHADER ENGINE)
 * =============================================================================
 * Principal Graphics & Shader Programmer (WebGL / GLSL / Three.js)
 * 
 * ПОЛНОЦЕННЫЙ МОДУЛЬ ФОТОРЕАЛИСТИЧНОГО ТЕКСТУРИРОВАНИЯ И ШЕЙДЕРОВ ГОРОДНИ:
 * 1. Устранение тайлинга через Perlin Noise Splatting (onBeforeCompile в GLSL):
 *    - Смешивание свежего черного, выцветшего асфальта и битумных заплаток (Шевченко, Черниговская)
 *    - Градиент обочины: асфальт -> гравий/песок -> зеленая трава
 *    - Бетонные плиты ПАГ-14 аэродрома с масляными пятнами и травой в стыках
 * 2. Процедурное старение и контактное затенение:
 *    - Грязь и брызги в нижней части стен (первые 0.85 м от земли)
 *    - Вертикальные подтеки от дождя под шиферными крышами и карнизами
 *    - Генерация карт нормалей (Sobel Operator) для кирпича, шифера и еврозаборов
 * 3. Псевдо-интерьеры в окнах (Fake Interior Parallax) и зеркальные стекла (roughness: 0.08)
 * 4. Система декалей (DecalScatterSystem через InstancedMesh):
 *    - Канализационные люки «ГОРОДНЯ КАНАЛІЗАЦІЯ»
 *    - Ливневки у бордюров
 *    - Паутина асфальтовых трещин
 *    - Таблички улиц («вул. Шевченка», «вул. Чернігівська», «вул. Троїцька»)
 *    - Объявления на бетонных столбах ЛЭП
 *    - Опавшие осенние листья в Дендропарке
 * 5. Бесшовный хук UltraTextureEngine.attach(window.GorodnyaWorld)
 * =============================================================================
 */

class UltraTextureEngine {
  constructor(renderer) {
    this.renderer = renderer;
    this.maxAnisotropy = renderer && renderer.capabilities ? renderer.capabilities.getMaxAnisotropy() : 16;
    this.textureCache = new Map();

    console.log(`[UltraTextureEngine] Активирован с анизотропной фильтрацией ${this.maxAnisotropy}x`);
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

  // Фильтр Собеля (Sobel Operator 3x3) для генерации Normal Map из карты высот
  generateNormalMapFromHeight(heightCanvas, strength = 2.8) {
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
        // Ядро Собеля 3x3
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

        const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const nx = -dx / len;
        const ny = -dy / len;
        const nz = dz / len;

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

  // --- 2. ПРОЦЕДУРНЫЕ КАРТЫ НОРМАЛЕЙ ГОРОДНИ ---

  // Рельеф кирпичной кладки (силикатный и красный кирпич)
  getBrickNormalMap() {
    if (this.textureCache.has('brick_normal')) return this.textureCache.get('brick_normal');

    const hCanvas = document.createElement('canvas');
    hCanvas.width = 512; hCanvas.height = 512;
    const ctx = hCanvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 512, 512);

    ctx.fillStyle = '#1a1a1a';
    const rows = 16; const cols = 8;
    const rh = 512 / rows; const cw = 512 / cols;

    for (let r = 0; r <= rows; r++) ctx.fillRect(0, r * rh - 2, 512, 4);
    for (let r = 0; r < rows; r++) {
      const offset = (r % 2) * (cw / 2);
      for (let c = 0; c <= cols; c++) ctx.fillRect(c * cw + offset - 2, r * rh, 4, rh);
    }

    const imgData = ctx.getImageData(0, 0, 512, 512);
    for (let i = 0; i < imgData.data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 40;
      imgData.data[i] = Math.max(0, Math.min(255, imgData.data[i] + noise));
    }
    ctx.putImageData(imgData, 0, 0);

    const normalTex = this.generateNormalMapFromHeight(hCanvas, 3.2);
    normalTex.wrapS = THREE.RepeatWrapping; normalTex.wrapT = THREE.RepeatWrapping;
    normalTex.repeat.set(4, 4);
    this.textureCache.set('brick_normal', normalTex);
    return normalTex;
  }

  // Рельеф волнового шифера для крыш частного сектора
  getSlateNormalMap() {
    if (this.textureCache.has('slate_normal')) return this.textureCache.get('slate_normal');

    const hCanvas = document.createElement('canvas');
    hCanvas.width = 512; hCanvas.height = 512;
    const ctx = hCanvas.getContext('2d');

    const imgData = ctx.createImageData(512, 512);
    for (let y = 0; y < 512; y++) {
      for (let x = 0; x < 512; x++) {
        // Волна шифера с шагом 32 пикселя
        const wave = Math.sin((x / 32) * Math.PI * 2) * 0.5 + 0.5;
        const val = Math.floor(wave * 200 + (Math.random() - 0.5) * 25);
        const idx = (y * 512 + x) * 4;
        imgData.data[idx] = val;
        imgData.data[idx + 1] = val;
        imgData.data[idx + 2] = val;
        imgData.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);

    const normalTex = this.generateNormalMapFromHeight(hCanvas, 4.0);
    normalTex.wrapS = THREE.RepeatWrapping; normalTex.wrapT = THREE.RepeatWrapping;
    normalTex.repeat.set(6, 6);
    this.textureCache.set('slate_normal', normalTex);
    return normalTex;
  }

  // Рельеф наборного бетонного еврозабора с фактурой колотого камня
  getEuroFenceNormalMap() {
    if (this.textureCache.has('eurofence_normal')) return this.textureCache.get('eurofence_normal');

    const hCanvas = document.createElement('canvas');
    hCanvas.width = 512; hCanvas.height = 256;
    const ctx = hCanvas.getContext('2d');
    ctx.fillStyle = '#b0b0b0'; ctx.fillRect(0, 0, 512, 256);

    // Горизонтальные секции плит
    ctx.fillStyle = '#111111';
    ctx.fillRect(0, 80, 512, 8);
    ctx.fillRect(0, 165, 512, 8);

    // Каменная имитация
    for (let i = 0; i < 60; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#dddddd' : '#777777';
      const kx = Math.random() * 500;
      const ky = Math.random() * 240;
      ctx.fillRect(kx, ky, 25 + Math.random() * 40, 15 + Math.random() * 20);
    }

    const normalTex = this.generateNormalMapFromHeight(hCanvas, 3.5);
    normalTex.wrapS = THREE.RepeatWrapping; normalTex.wrapT = THREE.RepeatWrapping;
    normalTex.repeat.set(2, 2);
    this.textureCache.set('eurofence_normal', normalTex);
    return normalTex;
  }

  // Рельеф бетонных плит ПАГ-14 аэродрома
  getConcreteJointNormalMap() {
    if (this.textureCache.has('concrete_joint_normal')) return this.textureCache.get('concrete_joint_normal');

    const hCanvas = document.createElement('canvas');
    hCanvas.width = 512; hCanvas.height = 512;
    const ctx = hCanvas.getContext('2d');
    ctx.fillStyle = '#dcdde1'; ctx.fillRect(0, 0, 512, 512);

    // Шов плиты
    ctx.strokeStyle = '#111111'; ctx.lineWidth = 14; ctx.strokeRect(0, 0, 512, 512);

    // Выбоины по кромке
    for (let i = 0; i < 45; i++) {
      ctx.fillStyle = '#333333';
      const sz = 5 + Math.random() * 9;
      const side = Math.floor(Math.random() * 4);
      if (side === 0) ctx.fillRect(Math.random() * 512, 0, sz, sz);
      else if (side === 1) ctx.fillRect(Math.random() * 512, 512 - sz, sz, sz);
      else if (side === 2) ctx.fillRect(0, Math.random() * 512, sz, sz);
      else ctx.fillRect(512 - sz, Math.random() * 512, sz, sz);
    }

    const normalTex = this.generateNormalMapFromHeight(hCanvas, 2.2);
    normalTex.wrapS = THREE.RepeatWrapping; normalTex.wrapT = THREE.RepeatWrapping;
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

  // Шейдер дорог Городни: Смешивание 3 слоев асфальта + градиент обочины к траве
  createRoadMaterial() {
    const mat = new THREE.MeshStandardMaterial({
      roughness: 0.86,
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
         vec2 wPos = vWorldPosition.xz;

         // Шум разной частоты
         float macroNoise = snoise(wPos * 0.015);
         float microNoise = snoise(wPos * 0.18);
         float crackNoise = snoise(wPos * 0.85);

         // 1. 3 Текстурных слоя асфальта
         vec3 freshAsphalt = vec3(0.08, 0.09, 0.11); // Свежий черный битумный асфальт
         vec3 agedAsphalt  = vec3(0.24, 0.26, 0.29); // Выцветший гравийный асфальт
         vec3 tarPatch     = vec3(0.02, 0.02, 0.03); // Заплатки горячей смолы

         float blendFactor = smoothstep(-0.4, 0.5, macroNoise + microNoise * 0.35);
         vec3 roadColor = mix(freshAsphalt, agedAsphalt, blendFactor);

         if (crackNoise > 0.68) {
           roadColor = tarPatch;
         }

         // 2. Разметка (осевая желтая линия и белые полосы)
         float distFromCenter = abs(vWorldPosition.x);
         if (abs(vWorldPosition.z) < 600.0 && distFromCenter < 0.2) {
           float dash = step(0.4, fract(vWorldPosition.z * 0.15));
           roadColor = mix(roadColor, vec3(0.95, 0.76, 0.08), dash);
         }

         // 3. Градиент обочины: переход в гравий/пыль и зеленую траву
         float shoulderDist = abs(vWorldPosition.x);
         if (shoulderDist > 6.8) {
           float shoulderBlend = smoothstep(6.8, 8.8, shoulderDist);
           vec3 gravelColor = vec3(0.35, 0.32, 0.27);
           vec3 grassColor  = vec3(0.18, 0.32, 0.14);
           vec3 edgeColor = mix(gravelColor, grassColor, smoothstep(7.6, 9.0, shoulderDist));
           roadColor = mix(roadColor, edgeColor, shoulderBlend);
         }

         diffuseColor.rgb = roadColor;
        `
      );
    };

    return mat;
  }

  // Шейдер аэродрома Городни (плиты ПАГ-14 + пятна масла + трава в стыках)
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

         // Сетка плит ПАГ-14: 6.0м х 2.0м
         vec2 grid = abs(fract(slabCoord * vec2(1.0/6.0, 1.0/2.0)) - 0.5);
         float seam = 1.0 - smoothstep(0.42, 0.48, max(grid.x, grid.y));

         vec3 concreteColor = vec3(0.56, 0.59, 0.63);

         // Масляные пятна от самолетов и дрифта
         float oilNoise = snoise(slabCoord * 0.35);
         if (oilNoise > 0.45) {
           concreteColor *= (1.0 - (oilNoise - 0.45) * 1.45);
         }

         // Трава и мох в компенсационных швах
         vec3 mossSeam = vec3(0.12, 0.28, 0.14);
         float grassNoise = snoise(slabCoord * 1.2);
         if (seam > 0.6 && grassNoise > 0.18) {
           concreteColor = mix(concreteColor, mossSeam, 0.88);
         }

         diffuseColor.rgb = concreteColor;
        `
      );
    };

    return mat;
  }

  // Шейдер стен зданий с грязевым градиентом у земли и дождевыми подтеками
  createWeatheredFacadeMaterial(baseColorHex = 0xb93a2b, type = 'brick') {
    let normalMap = null;
    if (type === 'brick') normalMap = this.getBrickNormalMap();
    else if (type === 'slate') normalMap = this.getSlateNormalMap();
    else if (type === 'eurofence') normalMap = this.getEuroFenceNormalMap();

    const mat = new THREE.MeshStandardMaterial({
      color: baseColorHex,
      roughness: 0.76,
      metalness: 0.08,
      normalMap: normalMap
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
         // 1. Брызги и налипшая грязь у цоколя (первые 0.85 м от земли)
         float heightFactor = clamp(vWorldPosition.y / 0.85, 0.0, 1.0);
         float mudNoise = snoise(vWorldPosition.xz * 1.6) * 0.16;
         float dirtMask = (1.0 - heightFactor) + mudNoise;
         vec3 dirtColor = vec3(0.18, 0.14, 0.11);

         diffuseColor.rgb = mix(diffuseColor.rgb, dirtColor, clamp(dirtMask * 0.85, 0.0, 0.92));

         // 2. Вертикальные темные подтеки от дождя под крышей и карнизами
         float rainStreak = snoise(vec2(vWorldPosition.x * 2.6, vWorldPosition.y * 0.22));
         if (vWorldPosition.y > 3.4 && rainStreak > 0.48) {
           diffuseColor.rgb *= 0.7;
         }
        `
      );
    };

    return mat;
  }

  // --- 4. ПСЕВДО-ИНТЕРЬЕРЫ В ОКНАХ (PARALLAX WINDOW MATERIAL) ---
  createParallaxWindowMaterial(interiorType = 'atb') {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x101a26,
      roughness: 0.08,
      metalness: 0.88,
      envMapIntensity: 2.2
    });

    const atlas = this.createCanvasTexture(256, 256, (ctx, w, h) => {
      if (interiorType === 'atb') {
        ctx.fillStyle = '#092540'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#00d2d3'; ctx.fillRect(20, 130, 216, 8); // LED-полоса полок
        ctx.fillStyle = '#fffae6'; ctx.beginPath(); ctx.arc(128, 50, 25, 0, Math.PI * 2); ctx.fill();
      } else if (interiorType === 'avrora') {
        ctx.fillStyle = '#3a1210'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#fbc531'; ctx.fillRect(20, 120, 216, 12);
        ctx.fillStyle = '#eb4d4b'; ctx.fillRect(20, 170, 216, 12);
      } else {
        // Жилой уютный дом (люстра, занавески)
        ctx.fillStyle = '#261c14'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#f39c12'; ctx.beginPath(); ctx.arc(128, 65, 30, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#dcdde1'; ctx.fillRect(10, 0, 30, h); ctx.fillRect(w - 40, 0, 30, h); // Занавески
      }
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
         vec3 viewDir = normalize(vViewPosition);
         vec2 parallaxOffset = viewDir.xy * 0.18;
         vec4 interiorColor = texture2D(uInteriorAtlas, vUv + parallaxOffset);
         diffuseColor.rgb = mix(diffuseColor.rgb, interiorColor.rgb, 0.48);
        `
      );
    };

    return mat;
  }
}

// =============================================================================
// 5. СИСТЕМА ДЕКАЛЕЙ И МИКРОДЕТАЛЕЙ (DECAL SCATTER SYSTEM ЧЕРЕЗ INSTANCEDMESH)
// =============================================================================
class DecalScatterSystem {
  constructor(scene, textureEngine) {
    this.scene = scene;
    this.engine = textureEngine;

    this.scatterManholes();
    this.scatterStormDrains();
    this.scatterAsphaltCracks();
    this.scatterStreetSigns();
    this.scatterPowerPoleAds();
    this.scatterAutumnLeaves();
  }

  // Канализационные люки («ГОРОДНЯ КАНАЛІЗАЦІЯ»)
  scatterManholes() {
    const manholeTex = this.engine.createCanvasTexture(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#2b3035'; ctx.beginPath(); ctx.arc(128, 128, 120, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#181b1c'; ctx.lineWidth = 10; ctx.stroke();
      ctx.strokeStyle = '#4b5558'; ctx.lineWidth = 4;
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
        ctx.beginPath(); ctx.moveTo(128, 128); ctx.lineTo(128 + Math.cos(a) * 110, 128 + Math.sin(a) * 110); ctx.stroke();
      }
      ctx.fillStyle = '#dcdde1'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('ГОРОДНЯ', 128, 118); ctx.fillText('2024', 128, 142);
    });

    const geo = new THREE.PlaneGeometry(1.4, 1.4);
    const mat = new THREE.MeshStandardMaterial({ map: manholeTex, transparent: true, roughness: 0.6, depthWrite: false });
    const count = 28;
    const instMesh = new THREE.InstancedMesh(geo, mat, count);
    const dummy = new THREE.Object3D();

    for (let i = 0; i < count; i++) {
      const isShev = i % 2 === 0;
      const x = isShev ? (Math.random() - 0.5) * 800 : (Math.random() > 0.5 ? 4.2 : -4.2);
      const z = isShev ? (Math.random() > 0.5 ? 4.2 : -4.2) : (Math.random() - 0.5) * 800;

      dummy.position.set(x, 0.106, z);
      dummy.rotation.x = -Math.PI / 2;
      dummy.rotation.z = Math.random() * Math.PI * 2;
      dummy.updateMatrix();
      instMesh.setMatrixAt(i, dummy.matrix);
    }
    instMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(instMesh);
  }

  // Ливневые решетки у бордюров
  scatterStormDrains() {
    const drainTex = this.engine.createCanvasTexture(128, 256, (ctx, w, h) => {
      ctx.fillStyle = '#1e272e'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#050505';
      for (let y = 14; y < h - 14; y += 22) ctx.fillRect(12, y, w - 24, 10);
    });

    const geo = new THREE.PlaneGeometry(0.9, 1.8);
    const mat = new THREE.MeshStandardMaterial({ map: drainTex, roughness: 0.5, metalness: 0.8, depthWrite: false });
    const count = 36;
    const instMesh = new THREE.InstancedMesh(geo, mat, count);
    const dummy = new THREE.Object3D();

    for (let i = 0; i < count; i++) {
      const z = -450 + i * 26;
      dummy.position.set(i % 2 === 0 ? 8.35 : -8.35, 0.103, z);
      dummy.rotation.x = -Math.PI / 2;
      dummy.updateMatrix();
      instMesh.setMatrixAt(i, dummy.matrix);
    }
    instMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(instMesh);
  }

  // Паутина трещин на асфальте (InstancedMesh)
  scatterAsphaltCracks() {
    const crackTex = this.engine.createCanvasTexture(256, 256, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = '#050505'; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(128, 128);
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2;
        const len = 40 + Math.random() * 80;
        ctx.lineTo(128 + Math.cos(ang) * len, 128 + Math.sin(ang) * len);
        ctx.moveTo(128, 128);
      }
      ctx.stroke();
    });

    const geo = new THREE.PlaneGeometry(3.5, 3.5);
    const mat = new THREE.MeshBasicMaterial({ map: crackTex, transparent: true, opacity: 0.8, depthWrite: false });
    const count = 40;
    const instMesh = new THREE.InstancedMesh(geo, mat, count);
    const dummy = new THREE.Object3D();

    for (let i = 0; i < count; i++) {
      dummy.position.set((Math.random() - 0.5) * 600, 0.104, (Math.random() - 0.5) * 600);
      dummy.rotation.x = -Math.PI / 2;
      dummy.rotation.z = Math.random() * Math.PI * 2;
      dummy.updateMatrix();
      instMesh.setMatrixAt(i, dummy.matrix);
    }
    instMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(instMesh);
  }

  // Таблички с названиями улиц Городни («вул. Шевченка», «вул. Чернігівська», «вул. Троїцька»)
  scatterStreetSigns() {
    const makeSignTex = (streetName) => this.engine.createCanvasTexture(256, 64, (ctx, w, h) => {
      ctx.fillStyle = '#004488'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4; ctx.strokeRect(4, 4, w - 8, h - 8);
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(streetName, w / 2, 42);
    });

    const signGeo = new THREE.PlaneGeometry(1.6, 0.42);

    const s1 = new THREE.Mesh(signGeo, new THREE.MeshBasicMaterial({ map: makeSignTex('вул. Шевченка') }));
    s1.position.set(12.05, 2.8, -12); s1.rotation.y = -Math.PI / 2; this.scene.add(s1);

    const s2 = new THREE.Mesh(signGeo, new THREE.MeshBasicMaterial({ map: makeSignTex('вул. Чернігівська') }));
    s2.position.set(-12.05, 2.8, 12); this.scene.add(s2);

    const s3 = new THREE.Mesh(signGeo, new THREE.MeshBasicMaterial({ map: makeSignTex('вул. Троїцька') }));
    s3.position.set(120, 2.8, 15.05); this.scene.add(s3);
  }

  // Объявления на столбах ЛЭП («Ремонт пральних машин», «Буріння свердловин Городня»)
  scatterPowerPoleAds() {
    const adTex = this.engine.createCanvasTexture(128, 128, (ctx, w, h) => {
      ctx.fillStyle = '#f5f6fa'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#111111'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('ГОРОДНЯ', 64, 25);
      ctx.fillStyle = '#c0392b'; ctx.font = 'bold 14px sans-serif';
      ctx.fillText('БУРІННЯ', 64, 48);
      ctx.fillText('СВЕРДЛОВИН', 64, 68);
      ctx.fillStyle = '#2c3e50'; ctx.font = '10px sans-serif';
      ctx.fillText('тел. 093-123-45-67', 64, 95);
      // Бахрома отрывных корешков
      ctx.strokeStyle = '#999999';
      for (let x = 16; x < w - 16; x += 16) {
        ctx.beginPath(); ctx.moveTo(x, 105); ctx.lineTo(x, h); ctx.stroke();
      }
    });

    const adGeo = new THREE.PlaneGeometry(0.35, 0.45);
    const adMat = new THREE.MeshBasicMaterial({ map: adTex, side: THREE.DoubleSide });

    for (let p = -5; p <= 5; p++) {
      const adMesh = new THREE.Mesh(adGeo, adMat);
      adMesh.position.set(9.2, 1.8, p * 70);
      adMesh.rotation.y = -Math.PI / 2;
      this.scene.add(adMesh);
    }
  }

  // Опавшие осенние листья в Дендропарке
  scatterAutumnLeaves() {
    const leafTex = this.engine.createCanvasTexture(64, 64, (ctx, w, h) => {
      ctx.fillStyle = '#d35400';
      ctx.beginPath();
      ctx.ellipse(32, 32, 24, 14, Math.PI / 4, 0, Math.PI * 2);
      ctx.fill();
    });

    const geo = new THREE.PlaneGeometry(0.35, 0.35);
    const mat = new THREE.MeshBasicMaterial({ map: leafTex, transparent: true, depthWrite: false });
    const count = 220;
    const instMesh = new THREE.InstancedMesh(geo, mat, count);
    const dummy = new THREE.Object3D();

    for (let i = 0; i < count; i++) {
      const lx = 70 + Math.random() * 220;
      const lz = 80 + Math.random() * 220;
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

// =============================================================================
// 6. ХУК ИНТЕГРАЦИИ В МИР ГОРОДНИ
// =============================================================================
UltraTextureEngine.attach = function(worldRef) {
  if (!worldRef || !worldRef.scene) return null;

  const engine = new UltraTextureEngine(worldRef.renderer);
  const decals = new DecalScatterSystem(worldRef.scene, engine);

  window.UltraTextureEngineInstance = engine;
  window.DecalScatterSystemInstance = decals;
  console.log('✅ [UltraTextureEngine] Модуль фотореалистичных шейдеров и декалей успешно подключен к миру Городни!');
  return { engine, decals };
};

window.UltraTextureEngine = UltraTextureEngine;
window.DecalScatterSystem = DecalScatterSystem;
