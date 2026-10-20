// Hero: a ring of glossy plates fanned around a centre, after the WCCE "Blades Reveal" render.
// It turns slowly on its own; plates near the pointer lift and open a little wider.
import * as THREE from './three.module.min.js';

export function mountFan(stage, canvas, { reduce = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 16 / 7, 0.1, 80);
  const lookAt = new THREE.Vector3(0, -0.8, 0);

  // Plates: radial length along local x, standing height along y, thin along z
  const COUNT = 112, R = 2.15;
  const geo = new THREE.BoxGeometry(1.7, 0.62, 0.022);
  const mat = new THREE.MeshPhysicalMaterial({ color: '#d9ccff', roughness: 0.28, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.18 });
  const plates = new THREE.InstancedMesh(geo, mat, COUNT);
  plates.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  // Outer plates deeper violet, a slow drift toward blue around the ring
  const col = new THREE.Color();
  for (let i = 0; i < COUNT; i++) {
    const u = i / COUNT;
    col.setHSL(0.7 + 0.06 * Math.sin(u * Math.PI * 2), 0.55, 0.62 + 0.08 * Math.cos(u * Math.PI * 4));
    plates.setColorAt(i, col);
  }
  scene.add(plates);

  scene.add(new THREE.HemisphereLight('#f3ecff', '#2a1660', 0.9));
  const key = new THREE.DirectionalLight('#ffffff', 3.2); key.position.set(-3, 6, 4);
  const rim = new THREE.DirectionalLight('#6f8cff', 1.6); rim.position.set(4, 1, -3);
  const under = new THREE.PointLight('#8a5cff', 6, 8, 1.6); under.position.set(0, -1.2, 0);
  scene.add(key, rim, under);

  const lift = new Float32Array(COUNT), liftV = new Float32Array(COUNT);
  const dummy = new THREE.Object3D();
  dummy.rotation.order = 'YXZ';

  // Pointer, projected onto the ring's plane to know which plates it is near
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
  const ptr = { angle: 0, near: 0, target: 0, px: 0, py: 0, tpx: 0, tpy: 0 };
  stage.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ptr.tpx = ndc.x; ptr.tpy = ndc.y;
    ray.setFromCamera(ndc, camera);
    if (ray.ray.intersectPlane(plane, hit)) {
      ptr.angle = Math.atan2(hit.z, hit.x);
      ptr.target = THREE.MathUtils.clamp(1.6 - Math.abs(hit.length() - R) * 0.5, 0, 1);
    }
  });
  stage.addEventListener('pointerleave', () => { ptr.target = 0; ptr.tpx = 0; ptr.tpy = 0; });

  let dist = 7.3;
  function size() {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // keep the whole ring in view on narrow screens
    dist = 7.3 * Math.pow(Math.max(1, 1.6 / camera.aspect), 0.95);
    camera.updateProjectionMatrix();
  }
  size();
  new ResizeObserver(size).observe(stage);

  const clock = new THREE.Clock();
  // Entrance: plates arrive one by one around the ring, each dropping in and turning into place
  let intro = reduce ? 99 : -0.45;
  const easeOut = (x) => 1 - Math.pow(1 - x, 3);
  function step(dt) {
    const t = clock.elapsedTime;
    intro += dt;
    ptr.near += (ptr.target - ptr.near) * (1 - Math.exp(-dt * 3));
    ptr.px += (ptr.tpx - ptr.px) * (1 - Math.exp(-dt * 2));
    ptr.py += (ptr.tpy - ptr.py) * (1 - Math.exp(-dt * 2));

    // camera floats a touch with the pointer
    camera.position.set(ptr.px * 0.6, dist * 0.56 + ptr.py * 0.3, dist * 0.8);
    camera.lookAt(lookAt);

    const spin = t * 0.08;
    for (let i = 0; i < COUNT; i++) {
      const a = (i / COUNT) * Math.PI * 2 + spin;
      // a slow wave runs round the ring, opening and closing the fan
      const wave = Math.sin(a * 3 - t * 0.7) * 0.5 + Math.sin(a * 5 + t * 0.4) * 0.2;
      let da = a - ptr.angle; da = Math.atan2(Math.sin(da), Math.cos(da));
      const g = Math.exp(-(da * da) / 0.18) * ptr.near;

      liftV[i] += (g * 0.55 - lift[i]) * 30 * dt; liftV[i] *= Math.exp(-dt * 6); lift[i] += liftV[i] * dt;

      const e = easeOut(Math.min(1, Math.max(0, (intro - (i / COUNT) * 1.8) / 1.1)));
      const r = R + wave * 0.12 + lift[i] * 0.25 + (1 - e) * 0.6;
      dummy.position.set(Math.cos(a) * r, wave * 0.16 + lift[i] * 0.7 + (1 - e) * 1.4, Math.sin(a) * r);
      dummy.rotation.set(0.95 + wave * 0.45 + lift[i] * 0.9 + (1 - e) * 1.6, -a, -0.32 - lift[i] * 0.4);
      dummy.scale.setScalar(Math.max(0.0001, e));
      dummy.updateMatrix();
      plates.setMatrixAt(i, dummy.matrix);
    }
    plates.instanceMatrix.needsUpdate = true;
    renderer.render(scene, camera);
  }

  let running = false;
  function loop() {
    if (!running) return;
    step(Math.min(clock.getDelta(), 1 / 20));
    requestAnimationFrame(loop);
  }
  if (reduce) { clock.elapsedTime = 2; step(1 / 60); stage.classList.add('ready'); return; }
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting && !running) { running = true; clock.getDelta(); requestAnimationFrame(loop); }
    else if (!e.isIntersecting) { running = false; intro = -0.45; }   // the plates arrive again next time
  }).observe(stage);
  requestAnimationFrame(() => stage.classList.add('ready'));
}
