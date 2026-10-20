// The installation itself, ported from StudioRetrux/WCCE_glass_stacks (src/simulation) to the browser:
// the same 315 satin glass slabs on the same twisting path, the same lift, idle wave, KV colour themes,
// backdrop and tone map. Values are the repo's config.py. Left out: shadow map, floor reflection,
// Kinect / crowd stages and the cinematic sequence (the visitor here is the pointer).
import * as THREE from './three.module.min.js';

const C = {
  PANEL_COUNT: 315, PANEL_WIDTH: 1.5, PANEL_HEIGHT: 3.306, PANEL_DEPTH: 0.116, PANEL_SPACING: 0.182,
  WAVE_AMPLITUDE: 0.409, WAVE_FREQUENCY: 2.409, WAVE_PHASE: 3.1416,
  WAVE_SECONDARY: 0.3, WAVE_SECONDARY_FREQUENCY: 2.5, WAVE_SECONDARY_PHASE: 0.785,
  WAVE_DEPTH: 0.0, WAVE_DEPTH_FREQUENCY: 1.111, WAVE_HEIGHT: 3.136,
  PATH_DROP: 1.364, PATH_RECEDE: 2.879, PATH_STRETCH: 0.75,
  ROLL_TURNS: -4.818, ROLL_SPIN_SPEED: 0.023, ROLL_AMPLITUDE_DEG: 180.0, ROLL_FREQUENCY: 1.061,
  ROLL_PHASE: 2.784, ROLL_OFFSET_DEG: -90.0, LOUVER_ANGLE_DEG: 4.091, ROTATION_AMOUNT: 0.432,
  ROTATION_WAVE_DEG: 19.856, ROTATION_WAVE_SPEED: 0.189, ROTATION_WAVE_LENGTH: 38.151, ROTATION_WAVE_LIFT: 0.152,
  LIFT_AMOUNT: 4.0, LIFT_SLAB_COUNT: 10, LIFT_EDGE_FRACTION: 0.0, INTERACTION_RADIUS: 4.617,
  SPRING_STIFFNESS: 99.216, SPRING_DAMPING: 11.0, SIM_MAX_DT: 0.05,
  THEME_INTERVAL: 6.549, THEME_FADE: 5.252,
  BACKGROUND_BLACK: 0.22, BACKGROUND_BLACK_FADE: 0.4, BACKGROUND_MOTION: 1.0, BACKGROUND_GRADIENT: 1.0,
  EXPOSURE: 0.578, BLOOM_THRESHOLD: 1.8, BLOOM_STRENGTH: 0.35, BLOOM_RADIUS: 1.6,
  CAMERA_DISTANCE: 11.5, CAMERA_HEIGHT: 1.8, CAMERA_TARGET: [0.5, 3.6, -1.0], CAMERA_FOV: 55.0,
  KEY_LIGHT_AZIMUTH_DEG: -35.0, KEY_LIGHT_ELEVATION_DEG: 55.0,
};
const RAD = Math.PI / 180;

// ---- colour themes (themes.py, sampled from the KV) -------------------------------------
const lin = (c) => c.map((v) => Math.pow(v / 255, 2.2));
const hue = (c) => { const l = lin(c), m = Math.max(...l, 1e-6); return l.map((v) => v / m); };
// background: the HDR value that comes out as this sRGB colour after the ACES curve
const scene = (c) => lin(c).map((v) => {
  const y = Math.min(Math.max(v, 0), 0.98), qa = 2.51 - y * 2.43, qb = 0.03 - y * 0.59, qc = -y * 0.14;
  return ((-qb + Math.sqrt(qb * qb - 4 * qa * qc)) / (2 * qa)) * (C.BACKGROUND_GRADIENT / C.EXPOSURE);
});
const theme = (t) => ({
  bgTop: scene(t.bgTop), bgMid: scene(t.bgMid), bgBottom: scene(t.bgBottom), bgEdge: scene(t.bgEdge),
  body: hue(t.body), glow: hue(t.glow), edge: hue(t.edge), rimA: hue(t.rimA), rimB: hue(t.rimB), key: hue(t.key),
});
const THEMES = [
  theme({ bgTop: [0, 0, 59], bgMid: [0, 65, 146], bgBottom: [1, 118, 189], bgEdge: [0, 4, 78],
    body: [17, 96, 200], glow: [53, 187, 238], edge: [120, 210, 255], rimA: [24, 166, 227], rimB: [40, 60, 220], key: [200, 230, 255] }),
  theme({ bgTop: [0, 115, 70], bgMid: [12, 175, 114], bgBottom: [190, 227, 214], bgEdge: [0, 105, 30],
    body: [1, 154, 97], glow: [173, 219, 202], edge: [200, 240, 222], rimA: [70, 185, 137], rimB: [190, 227, 214], key: [225, 255, 240] }),
  theme({ bgTop: [0, 0, 56], bgMid: [49, 32, 123], bgBottom: [82, 44, 144], bgEdge: [5, 0, 30],
    body: [80, 37, 160], glow: [220, 50, 160], edge: [190, 110, 230], rimA: [220, 40, 150], rimB: [90, 50, 220], key: [225, 205, 255] }),
  theme({ bgTop: [0, 0, 0], bgMid: [90, 0, 0], bgBottom: [147, 11, 15], bgEdge: [10, 0, 0],
    body: [227, 5, 5], glow: [242, 118, 33], edge: [255, 120, 50], rimA: [237, 103, 26], rimB: [235, 17, 0], key: [255, 225, 200] }),
];
const REALM = 2;

// ---- the path and the rest pose of every slab (wave_generator.py) ------------------------
function rawCurve(u, L) {
  const tp = 2 * Math.PI;
  return [
    (u - 0.5) * L * C.PATH_STRETCH,
    C.WAVE_HEIGHT + C.WAVE_AMPLITUDE * Math.cos(tp * C.WAVE_FREQUENCY * u + C.WAVE_PHASE)
      + C.WAVE_AMPLITUDE * C.WAVE_SECONDARY * Math.sin(tp * C.WAVE_SECONDARY_FREQUENCY * u + C.WAVE_SECONDARY_PHASE)
      + C.PATH_DROP * (0.5 - u),
    C.PATH_RECEDE * (u - 0.5) + C.WAVE_DEPTH * Math.sin(tp * C.WAVE_DEPTH_FREQUENCY * u + 0.8),
  ];
}

function generatePanels(n) {
  const M = 6000, dense = new Float64Array(M), cum = new Float64Array(M);
  for (let i = 0; i < M; i++) dense[i] = i / (M - 1);
  const span = (n - 1) * C.PANEL_SPACING;
  let L = n * C.PANEL_SPACING, total = 0;
  for (let it = 0; it < 6; it++) {
    let prev = rawCurve(0, L); cum[0] = 0;
    for (let i = 1; i < M; i++) {
      const p = rawCurve(dense[i], L);
      cum[i] = cum[i - 1] + Math.hypot(p[0] - prev[0], p[1] - prev[1], p[2] - prev[2]);
      prev = p;
    }
    total = cum[M - 1];
    if (total >= span * 1.02) break;
    L *= (span * 1.05) / Math.max(total, 1e-6);
  }
  const interp = (s) => {
    let lo = 0, hi = M - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cum[mid] <= s) lo = mid; else hi = mid; }
    const f = (s - cum[lo]) / Math.max(cum[hi] - cum[lo], 1e-12);
    return dense[lo] + (dense[hi] - dense[lo]) * Math.min(Math.max(f, 0), 1);
  };
  const v = (a) => new THREE.Vector3(a[0], a[1], a[2]);
  const up0 = new THREE.Vector3(0, 1, 0);
  const out = [];
  for (let i = 0; i < n; i++) {
    const s = Math.min(Math.max((total - span) * 0.5 + i * C.PANEL_SPACING, 0), total);
    const u = interp(s);
    const pos = v(rawCurve(u, L));
    const tangent = v(rawCurve(Math.min(u + 1e-3, 1), L)).sub(v(rawCurve(Math.max(u - 1e-3, 0), L))).normalize();
    const slope = tangent.y / Math.max(Math.hypot(tangent.x, tangent.z), 1e-6);
    let normal = tangent.clone();
    const up = up0.clone().addScaledVector(normal, -normal.dot(up0)).normalize();
    const roll = 2 * Math.PI * C.ROLL_TURNS * u
      + C.ROLL_AMPLITUDE_DEG * RAD * Math.sin(2 * Math.PI * C.ROLL_FREQUENCY * u + C.ROLL_PHASE)
      + C.ROLL_OFFSET_DEG * RAD;
    up.applyAxisAngle(normal, roll).normalize();
    const yaw = C.LOUVER_ANGLE_DEG * RAD + C.ROTATION_AMOUNT * Math.atan(slope);
    normal.applyAxisAngle(up, yaw).normalize();
    const width = new THREE.Vector3().crossVectors(up, normal).normalize();
    normal = new THREE.Vector3().crossVectors(width, up).normalize();
    out.push({ pos, width, up, normal });
  }
  return out;
}

// ---- shaders ------------------------------------------------------------------------------
// GLSL3 programs: three r160 leaves the fragment output to the shader
const OUT = "layout(location = 0) out highp vec4 outColor;\n#define gl_FragColor outColor\n";
const FULLSCREEN_VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

// gradient.glsl
const BACKDROP_FRAG = `
varying vec2 vUv;
uniform vec3 uTop, uMid, uBottom, uEdge;
uniform vec2 uBlack; uniform float uMotion, uPhase;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float nz(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
void main(){
  vec2 uv = vUv; float ph = uPhase, m = uMotion;
  float dx = m * 0.03 * sin(17.0 * ph + 0.5);
  float dy = m * (0.012 * sin(23.0 * ph) + 0.008 * sin(37.0 * ph + 1.7));
  float x = uv.x - 0.5 - dx;
  float low = (1.0 - smoothstep(0.0, 0.55, uv.y)) * exp(-x * x / 0.11);
  vec3 c = mix(uMid, uBottom, low);
  c = mix(c, uTop, smoothstep(0.45, 1.0, uv.y));
  c = mix(c, uEdge, smoothstep(0.2, 0.7, abs(x)) * 0.7);
  vec2 drift = 1.5 * vec2(cos(ph), sin(ph));
  vec2 p = uv * vec2(2.4, 1.6) + drift;
  float n = 0.65 * nz(p) + 0.35 * nz(p * 2.1 + 7.3 - 0.5 * drift);
  c *= 1.0 + m * 0.08 * (n - 0.5);
  float top = 1.0 - uBlack.x;
  float black = smoothstep(top - max(uBlack.y, 0.001), top, uv.y + dy);
  gl_FragColor = vec4(mix(c, vec3(0.0), black), 1.0);
}`;

const SLAB_VERT = `
attribute float aLift;
uniform vec3 uHalf;
varying vec3 vWorld, vLocal, vAx0, vAx1, vAx2;
varying float vLifted;
void main(){
  vec4 world = instanceMatrix * vec4(position, 1.0);
  mat3 r = mat3(instanceMatrix);
  vAx0 = r[0]; vAx1 = r[1]; vAx2 = r[2];
  vWorld = world.xyz; vLocal = position; vLifted = aLift;
  gl_Position = projectionMatrix * viewMatrix * world;
}`;

// satin.frag (MATERIAL_STYLE 1) without the shadow map and the mirrored reflection pass
const SLAB_FRAG = OUT + `
varying vec3 vWorld, vLocal, vAx0, vAx1, vAx2;
varying float vLifted;
uniform vec3 uHalf, uKeyDir;
uniform vec3 uBody, uGlow, uEdge, uRimA, uRimB, uKey;
uniform float uBackface;
const float IOR = 1.648, OPACITY = 0.0, ROUGHNESS = 1.0, TRANSLUCENCY = 1.0, BODY = 0.898;
const float EDGE_LIGHT = 1.6, GLOW_DEPTH = 0.3, SHADOW_FLOOR = 0.04, BEVEL = 0.02, BEVEL_SHINE = 1.5;
const float KEY_SIZE = 0.6981, KEY_INT = 3.0, RIM_INT = 1.2, GAP_OCC = 0.8, GAP_DEPTH = 0.35, ENV = 1.0;
const vec3 RIM_A_DIR = vec3(-0.78, 0.30, -0.55);
const vec3 RIM_B_DIR = vec3(0.78, 0.30, -0.55);

float softbox(vec3 d, vec3 dir, float radius, float soft){
  float ang = acos(clamp(dot(d, normalize(dir)), -1.0, 1.0));
  return 1.0 - smoothstep(radius - soft, radius + soft, ang);
}
vec3 studio(vec3 d, float rough){
  float soft = 0.08 + rough * 0.9;
  vec3 c = uKey * softbox(d, uKeyDir, KEY_SIZE * 0.5, soft) * KEY_INT;
  c += uRimA * softbox(d, RIM_A_DIR, 0.35, soft + 0.1) * RIM_INT;
  c += uRimB * softbox(d, RIM_B_DIR, 0.35, soft + 0.1) * RIM_INT;
  c += uBody * (0.015 + 0.03 * max(d.y, 0.0));
  return c * ENV;
}
void main(){
  vec3 axes[3] = vec3[](normalize(vAx0), normalize(vAx1), normalize(vAx2));
  vec3 lp = clamp(vLocal, -uHalf, uHalf);
  vec3 a = abs(lp) / uHalf;
  int k = (a.x >= a.y && a.x >= a.z) ? 0 : ((a.y >= a.z) ? 1 : 2);
  bool bigFace = (k == 2);
  vec3 Nf = axes[k] * sign(lp[k]);
  int i0 = (k + 1) % 3, i1 = (k + 2) % 3;
  vec3 e = max(uHalf - abs(lp), 0.0);
  int m = (e[i0] < e[i1]) ? i0 : i1;
  float edge = e[m];
  vec3 outward = axes[m] * sign(lp[m]);
  vec4 ed = max(vec4(uHalf.xx - vec2(1.0, -1.0) * lp.x, uHalf.yy - vec2(1.0, -1.0) * lp.y), 0.0);

  float bt = clamp(1.0 - edge / BEVEL, 0.0, 1.0);
  float bang = bt * bt * 1.45;
  vec3 N = normalize(Nf * cos(bang) + outward * sin(bang));
  if (!gl_FrontFacing) { N = -N; Nf = -Nf; }

  vec3 V = normalize(cameraPosition - vWorld);
  float NdV = clamp(dot(N, V), 0.0, 1.0);
  vec3 L = normalize(uKeyDir);
  float lifted = clamp(vLifted, 0.0, 1.0);

  float ao = 1.0;
  if (bigFace) {
    vec4 open = 1.0 - exp(-ed / GAP_DEPTH);
    ao = 1.0 - GAP_OCC * open.x * open.y * open.z * open.w * (1.0 - lifted);
  }
  float NL = dot(N, L);
  float keyLight = (max(NL, 0.0) + max(-NL, 0.0) * TRANSLUCENCY) * KEY_INT;
  float rimLight = (max(dot(N, normalize(RIM_A_DIR)), 0.0) + max(dot(N, normalize(RIM_B_DIR)), 0.0)) * RIM_INT * 0.5;
  float lum = (keyLight + rimLight) * ao * BODY;
  if (bigFace) {
    vec4 fall = exp(-ed / GLOW_DEPTH);
    for (int j = 0; j < 4; j++) {
      vec3 o = axes[j / 2] * (j % 2 == 0 ? 1.0 : -1.0);
      float enter = max(dot(o, L), 0.0) * KEY_INT + max(dot(o, normalize(RIM_A_DIR)), 0.0) * RIM_INT * 0.6
                  + max(dot(o, normalize(RIM_B_DIR)), 0.0) * RIM_INT * 0.6;
      lum += enter * fall[j] * EDGE_LIGHT;
    }
  }
  vec3 ramp = mix(uBody, uGlow, smoothstep(0.15, 1.2, lum));
  ramp = mix(ramp, vec3(1.0), smoothstep(1.2, 3.0, lum) * 0.6);
  vec3 body = ramp * lum * 0.35;
  body += uBody * SHADOW_FLOOR * (0.4 + 0.6 * ao);

  float f0 = (IOR - 1.0) / (IOR + 1.0); f0 *= f0;
  float F = f0 + (1.0 - f0) * pow(1.0 - NdV, 5.0);
  vec3 R = reflect(-V, N);
  float rough = clamp(ROUGHNESS - bt * 0.3, 0.02, 1.0);
  vec3 spec = studio(R, rough);
  float specOcc = mix(ao, 1.0, 0.3);
  vec3 bevelLine = spec * bt * bt * BEVEL_SHINE * (0.35 + 0.65 * F) * mix(0.5, 1.0, specOcc);

  vec3 color = body + bevelLine;
  if (!gl_FrontFacing) color *= uBackface;
  color = mix(color, color * 1.8 + uEdge * 0.35 * lifted, lifted);

  float alpha = bigFace ? mix(OPACITY, 1.0, F) : 1.0;
  alpha = clamp(max(alpha, bt), 0.0, 1.0);
  color *= mix(1.0, alpha, 0.5);
  color = min(color, vec3(8.0));
  gl_FragColor = vec4(color, alpha);
}`;

const BRIGHT_FRAG = OUT + `
varying vec2 vUv; uniform sampler2D uTex; uniform float uThreshold;
void main(){ vec3 c = texture2D(uTex, vUv).rgb; float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  gl_FragColor = vec4(c * (max(l - uThreshold, 0.0) / max(l, 1e-4)), 1.0); }`;
const BLUR_FRAG = OUT + `
varying vec2 vUv; uniform sampler2D uTex; uniform vec2 uDir;
void main(){ float w[5] = float[](0.2270270270, 0.1945945946, 0.1216216216, 0.0540540541, 0.0162162162);
  vec3 c = texture2D(uTex, vUv).rgb * w[0];
  for (int i = 1; i < 5; i++){ c += texture2D(uTex, vUv + uDir * float(i)).rgb * w[i]; c += texture2D(uTex, vUv - uDir * float(i)).rgb * w[i]; }
  gl_FragColor = vec4(c, 1.0); }`;
// composite.frag: bloom, exposure, ACES, gamma, vignette, dither
const COMPOSITE_FRAG = OUT + `
varying vec2 vUv; uniform sampler2D uScene, uBloom1, uBloom2; uniform float uBloomStrength, uExposure;
vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main(){
  vec3 c = texture2D(uScene, vUv).rgb + (texture2D(uBloom1, vUv).rgb * 0.65 + texture2D(uBloom2, vUv).rgb * 0.35) * uBloomStrength;
  c = pow(aces(c * uExposure), vec3(1.0 / 2.2));
  c *= 0.82 + 0.18 * smoothstep(1.35, 0.35, length(vUv - 0.5));
  c += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
  gl_FragColor = vec4(c, 1.0);
}`;

export function mountField(stage, canvas, { reduce = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
  const small = Math.min(innerWidth, innerHeight) < 700;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, small ? 1.5 : 1.75));
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.autoClear = false;

  const N = C.PANEL_COUNT;
  const panels = generatePanels(N);
  const half = new THREE.Vector3(C.PANEL_WIDTH / 2, C.PANEL_HEIGHT / 2, C.PANEL_DEPTH / 2);
  const keyDir = new THREE.Vector3(
    Math.sin(C.KEY_LIGHT_AZIMUTH_DEG * RAD) * Math.cos(C.KEY_LIGHT_ELEVATION_DEG * RAD),
    Math.sin(C.KEY_LIGHT_ELEVATION_DEG * RAD),
    Math.cos(C.KEY_LIGHT_AZIMUTH_DEG * RAD) * Math.cos(C.KEY_LIGHT_ELEVATION_DEG * RAD));

  // camera.py: orbit camera at CAMERA_DISTANCE from the target, eye at CAMERA_HEIGHT
  const target = new THREE.Vector3(...C.CAMERA_TARGET);
  const pitch = Math.asin(Math.max(-0.99, Math.min(0.99, (C.CAMERA_HEIGHT - target.y) / C.CAMERA_DISTANCE)));
  const camera = new THREE.PerspectiveCamera(C.CAMERA_FOV, 16 / 9, 0.1, 200);
  camera.position.set(target.x, target.y + Math.sin(pitch) * C.CAMERA_DISTANCE, target.z + Math.cos(pitch) * C.CAMERA_DISTANCE);
  camera.lookAt(target);

  const scene3 = new THREE.Scene();
  const tri = new THREE.BufferGeometry();
  tri.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  tri.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));

  const pal = {
    uTop: { value: new THREE.Vector3() }, uMid: { value: new THREE.Vector3() }, uBottom: { value: new THREE.Vector3() }, uEdge: { value: new THREE.Vector3() },
  };
  const bgMat = new THREE.ShaderMaterial({
    vertexShader: FULLSCREEN_VERT, fragmentShader: BACKDROP_FRAG, depthTest: false, depthWrite: false,
    uniforms: { ...pal, uBlack: { value: new THREE.Vector2(C.BACKGROUND_BLACK, C.BACKGROUND_BLACK_FADE) },
      uMotion: { value: C.BACKGROUND_MOTION }, uPhase: { value: 0 } },
  });
  const bg = new THREE.Mesh(tri, bgMat);
  bg.frustumCulled = false; bg.renderOrder = -1;
  scene3.add(bg);

  // slabs: one instanced box, drawn back faces first then front faces (renderer.py _draw_pass), premultiplied blend
  const geo = new THREE.BoxGeometry(C.PANEL_WIDTH, C.PANEL_HEIGHT, C.PANEL_DEPTH);
  const liftAttr = new THREE.InstancedBufferAttribute(new Float32Array(N), 1);
  liftAttr.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aLift', liftAttr);
  const glassUniforms = {
    uHalf: { value: half }, uKeyDir: { value: keyDir }, uBackface: { value: 0.3 },
    uBody: { value: new THREE.Vector3() }, uGlow: { value: new THREE.Vector3() }, uEdge: { value: new THREE.Vector3() },
    uRimA: { value: new THREE.Vector3() }, uRimB: { value: new THREE.Vector3() }, uKey: { value: new THREE.Vector3() },
  };
  const glassMat = (side) => new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, vertexShader: SLAB_VERT, fragmentShader: SLAB_FRAG, uniforms: glassUniforms, side,
    transparent: true, depthWrite: true, depthTest: true,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  const back = new THREE.InstancedMesh(geo, glassMat(THREE.BackSide), N);
  const front = new THREE.InstancedMesh(geo, glassMat(THREE.FrontSide), N);
  back.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  front.instanceMatrix = back.instanceMatrix;
  back.renderOrder = 1; front.renderOrder = 2;
  back.frustumCulled = front.frustumCulled = false;
  scene3.add(back, front);

  // post: HDR scene with MSAA -> bloom at half / quarter size -> composite
  const post = new THREE.Scene(), postCam = new THREE.Camera();
  const quad = new THREE.Mesh(tri, null); quad.frustumCulled = false; post.add(quad);
  const brightMat = new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: FULLSCREEN_VERT, fragmentShader: BRIGHT_FRAG,
    uniforms: { uTex: { value: null }, uThreshold: { value: C.BLOOM_THRESHOLD } }, depthTest: false, depthWrite: false });
  const blurMat = new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: FULLSCREEN_VERT, fragmentShader: BLUR_FRAG,
    uniforms: { uTex: { value: null }, uDir: { value: new THREE.Vector2() } }, depthTest: false, depthWrite: false });
  const compMat = new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: FULLSCREEN_VERT, fragmentShader: COMPOSITE_FRAG,
    uniforms: { uScene: { value: null }, uBloom1: { value: null }, uBloom2: { value: null }, uBloomStrength: { value: C.BLOOM_STRENGTH }, uExposure: { value: C.EXPOSURE } },
    depthTest: false, depthWrite: false });
  const rtOpts = { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
  const sceneRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  const halfRT = [new THREE.WebGLRenderTarget(1, 1, rtOpts), new THREE.WebGLRenderTarget(1, 1, rtOpts)];
  const quarterRT = [new THREE.WebGLRenderTarget(1, 1, rtOpts), new THREE.WebGLRenderTarget(1, 1, rtOpts)];
  const pass = (mat, target) => { quad.material = mat; renderer.setRenderTarget(target); renderer.render(post, postCam); };
  const blur = (rts, w, h, r) => {
    blurMat.uniforms.uTex.value = rts[0].texture; blurMat.uniforms.uDir.value.set(r / w, 0); pass(blurMat, rts[1]);
    blurMat.uniforms.uTex.value = rts[1].texture; blurMat.uniforms.uDir.value.set(0, r / h); pass(blurMat, rts[0]);
  };

  let W = 1, H = 1;
  function size() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    const pr = renderer.getPixelRatio();
    W = Math.round(w * pr); H = Math.round(h * pr);
    sceneRT.setSize(W, H);
    halfRT.forEach((r) => r.setSize(W >> 1, H >> 1));
    quarterRT.forEach((r) => r.setSize(W >> 2, H >> 2));
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  size();
  new ResizeObserver(size).observe(stage);

  // ---- theme cycler (themes.py ThemeCycler): random other theme every THEME_INTERVAL, smooth crossfade
  let themeFrom = { ...THEMES[REALM] }, themeIdx = REALM, themeAt = 0;
  const blendTheme = (t) => {
    const x = Math.min(Math.max((t - themeAt) / Math.min(C.THEME_FADE, C.THEME_INTERVAL), 0), 1), k = x * x * (3 - 2 * x);
    const to = THEMES[themeIdx], out = {};
    for (const key in to) out[key] = to[key].map((v, i) => themeFrom[key][i] + (v - themeFrom[key][i]) * k);
    return out;
  };
  function palette(t) {
    if (t - themeAt >= C.THEME_INTERVAL) {
      themeFrom = blendTheme(t);
      const others = [0, 1, 2, 3].filter((i) => i !== themeIdx);
      themeIdx = others[Math.floor(Math.random() * others.length)];
      themeAt = t;
    }
    const p = blendTheme(t);
    pal.uTop.value.fromArray(p.bgTop); pal.uMid.value.fromArray(p.bgMid);
    pal.uBottom.value.fromArray(p.bgBottom); pal.uEdge.value.fromArray(p.bgEdge);
    glassUniforms.uBody.value.fromArray(p.body); glassUniforms.uGlow.value.fromArray(p.glow);
    glassUniforms.uEdge.value.fromArray(p.edge); glassUniforms.uRimA.value.fromArray(p.rimA);
    glassUniforms.uRimB.value.fromArray(p.rimB); glassUniforms.uKey.value.fromArray(p.key);
  }

  // ---- the visitor: the pointer over the stack, or a slow walker when nobody is there
  const visitor = { x: 0, z: 0, active: false, lastMove: -99 };
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), hit = new THREE.Vector3();
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const clock = new THREE.Clock();
  function onMove(e) {
    const p = e.touches ? e.touches[0] : e;
    const r = canvas.getBoundingClientRect();
    ndc.set(((p.clientX - r.left) / r.width) * 2 - 1, -((p.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    if (!ray.ray.intersectPlane(plane, hit)) return;
    visitor.x = THREE.MathUtils.clamp(hit.x, -14, 14); visitor.z = 0;
    visitor.lastMove = clock.elapsedTime;
    stage.classList.add('touched');
  }
  stage.addEventListener('pointermove', onMove);
  stage.addEventListener('touchmove', onMove, { passive: true });
  stage.addEventListener('pointerleave', () => { visitor.lastMove = -99; });

  // ---- field state (glass_field.py)
  const lift = new Float32Array(N), liftVel = new Float32Array(N), influence = new Float32Array(N);
  const wavePhase = new Float32Array(N);
  for (let i = 0; i < N; i++) wavePhase[i] = (i / C.ROTATION_WAVE_LENGTH) * 2 * Math.PI;
  const baseRot = panels.map((p) => new THREE.Matrix4().makeBasis(p.width, p.up, p.normal));
  const order = Array.from({ length: N }, (_, i) => i), depth = new Float32Array(N);
  const spinM = new THREE.Matrix4(), m = new THREE.Matrix4(), pos = new THREE.Vector3();
  const halfN = (C.LIFT_SLAB_COUNT - 1) / 2;
  const wEdge = 0.5 + 0.5 * Math.cos((Math.PI * halfN) / (halfN + 1));
  let fieldTime = 0;

  function step(dt) {
    dt = Math.min(Math.max(dt, 0), C.SIM_MAX_DT);
    fieldTime += dt;
    const t = clock.elapsedTime;
    if (t - visitor.lastMove > 2.5) {
      // nobody at the stack: someone walks slowly past, back and forth across the view
      visitor.x = 0.5 + Math.sin(t * 0.16) * 8.5; visitor.z = 0;
    }
    // LIFT_SLAB_COUNT: the N slabs nearest along the stack rise, centre fully, cosine window to the edge
    influence.fill(0);
    let i0 = 0, best = Infinity;
    for (let i = 0; i < N; i++) {
      const d = Math.hypot(panels[i].pos.x - visitor.x, panels[i].pos.z - visitor.z);
      if (d < best) { best = d; i0 = i; }
    }
    if (best <= C.INTERACTION_RADIUS) {
      for (let i = Math.max(0, i0 - Math.floor(halfN)); i <= Math.min(N - 1, i0 + Math.floor(halfN)); i++) {
        const k = Math.abs(i - i0);
        const w = 0.5 + 0.5 * Math.cos((Math.PI * k) / (halfN + 1));
        influence[i] = C.LIFT_EDGE_FRACTION + (1 - C.LIFT_EDGE_FRACTION) * (w - wEdge) / Math.max(1 - wEdge, 1e-6);
      }
    }
    for (let i = 0; i < N; i++) {
      const acc = (influence[i] * C.LIFT_AMOUNT - lift[i]) * C.SPRING_STIFFNESS - liftVel[i] * C.SPRING_DAMPING;
      liftVel[i] += acc * dt; lift[i] += liftVel[i] * dt;
    }
    // back to front for the blend
    for (let i = 0; i < N; i++) depth[i] = panels[i].pos.distanceToSquared(camera.position);
    order.sort((a, b) => depth[b] - depth[a]);
    for (let s = 0; s < N; s++) {
      const i = order[s], p = panels[i];
      const wave = Math.sin(wavePhase[i] - fieldTime * C.ROTATION_WAVE_SPEED * 2 * Math.PI);
      const spin = wave * C.ROTATION_WAVE_DEG * RAD + 2 * Math.PI * C.ROLL_SPIN_SPEED * fieldTime;
      spinM.makeRotationAxis(p.normal, spin);
      m.multiplyMatrices(spinM, baseRot[i]);
      pos.copy(p.pos); pos.y += lift[i] + wave * C.ROTATION_WAVE_LIFT;
      m.setPosition(pos);
      back.setMatrixAt(s, m);
      liftAttr.array[s] = influence[i];
    }
    back.instanceMatrix.needsUpdate = true;
    liftAttr.needsUpdate = true;
  }

  function render(t) {
    palette(t);
    bgMat.uniforms.uPhase.value = 2 * Math.PI * ((t % 600) / 600);
    renderer.setRenderTarget(sceneRT);
    renderer.clear();
    renderer.render(scene3, camera);
    brightMat.uniforms.uTex.value = sceneRT.texture; pass(brightMat, halfRT[0]);
    blur(halfRT, W >> 1, H >> 1, C.BLOOM_RADIUS);
    blurMat.uniforms.uTex.value = halfRT[0].texture; blurMat.uniforms.uDir.value.set(0, 0); pass(blurMat, quarterRT[0]);
    blur(quarterRT, W >> 2, H >> 2, C.BLOOM_RADIUS * 1.5);
    compMat.uniforms.uScene.value = sceneRT.texture;
    compMat.uniforms.uBloom1.value = halfRT[0].texture;
    compMat.uniforms.uBloom2.value = quarterRT[0].texture;
    pass(compMat, null);
  }

  let running = false;
  function loop() {
    if (!running) return;
    step(clock.getDelta());
    render(clock.elapsedTime);
    requestAnimationFrame(loop);
  }
  if (reduce) { clock.elapsedTime = 4; for (let i = 0; i < 120; i++) step(1 / 60); render(4); return; }
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting && !running) { running = true; clock.getDelta(); requestAnimationFrame(loop); }
    else if (!e.isIntersecting) running = false;
  }).observe(stage);
}
