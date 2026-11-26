import * as THREE from 'three';

// Estilhaços do selo da Maestria: quando o selo rompe, a "casca" da Divergência
// estoura em lascas de cristal cromado que saem da superfície da arma, giram
// e somem. As lascas nascem em pontos sorteados da própria malha da arma.

// ---------------------------------------------------------------------------
// CONFIGS
// ---------------------------------------------------------------------------
export const ESTILHACOS = {
  quantidade: 280, // lascas
  tamanho: [0.05, 0.2], // unidades: menor / maior lasca
  velocidade: [2.5, 8.5], // unidades por segundo na saída
  paraCamera: 0.45, // 0..1: quanto as lascas vêm na direção de quem olha
  atrito: 1.6, // desaceleração
  gravidade: 2.2, // unidades/s²
  giro: 9, // rad/s máximo
  vida: [1.1, 2.0], // s: quanto cada lasca dura
};

const E = ESTILHACOS;
const lerp = (a, b, t) => a + (b - a) * t;

export function criarEstilhacos(pivo) {
  const geo = new THREE.TetrahedronGeometry(1, 0);
  geo.scale(1, 0.35, 0.7); // lasca achatada, não pirâmide
  const material = new THREE.MeshPhysicalMaterial({
    color: 0xd9dcf2, metalness: 1, roughness: 0.08,
    iridescence: 1, iridescenceIOR: 1.8,
    emissive: 0x2a0a20, transparent: true,
  });
  const malha = new THREE.InstancedMesh(geo, material, E.quantidade);
  malha.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  malha.frustumCulled = false;
  malha.visible = false;
  pivo.add(malha);

  const lascas = Array.from({ length: E.quantidade }, () => ({
    p: new THREE.Vector3(), v: new THREE.Vector3(), q: new THREE.Quaternion(), giro: new THREE.Vector3(),
    tam: 0, vida: 0, idade: 0,
  }));
  const m = new THREE.Matrix4(), esc = new THREE.Vector3(), dq = new THREE.Quaternion(), eixo = new THREE.Vector3();
  let ativo = false;
  let arma = null;

  /** a malha da arma (para sortear de onde as lascas saem) */
  const usarArma = (malhaArma) => { arma = malhaArma; };

  /** compila o material das lascas antes da hora: compilar no quadro do estouro trava a cena */
  function precompilar(renderer, cena, camera) {
    m.makeScale(0, 0, 0);
    for (let i = 0; i < E.quantidade; i++) malha.setMatrixAt(i, m);
    malha.instanceMatrix.needsUpdate = true;
    malha.visible = true;
    renderer.compile(cena, camera);
    malha.visible = false;
  }

  /** estoura: as lascas saem da superfície da arma */
  function explodir(camera) {
    if (!arma) return;
    const pos = arma.geometry.attributes.position;
    pivo.updateMatrixWorld(true);
    const paraPivo = new THREE.Matrix4().copy(pivo.matrixWorld).invert();
    const mundo = new THREE.Matrix4().multiplyMatrices(paraPivo, arma.matrixWorld);
    // direção da câmera no espaço do pivô
    const cam = camera.position.clone().applyMatrix4(paraPivo).normalize();
    lascas.forEach((l) => {
      const i = Math.floor(Math.random() * pos.count);
      l.p.fromBufferAttribute(pos, i).applyMatrix4(mundo);
      const fora = l.p.clone().setY(l.p.y * 1.6).normalize(); // para fora do corpo da arma
      const dir = fora.multiplyScalar(1 - E.paraCamera).addScaledVector(cam, E.paraCamera)
        .add(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).multiplyScalar(0.9)).normalize();
      l.v.copy(dir).multiplyScalar(lerp(E.velocidade[0], E.velocidade[1], Math.random() ** 1.5));
      l.q.setFromEuler(new THREE.Euler(Math.random() * 6.3, Math.random() * 6.3, Math.random() * 6.3));
      l.giro.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(Math.random() * E.giro);
      l.tam = lerp(E.tamanho[0], E.tamanho[1], Math.random() ** 2);
      l.vida = lerp(E.vida[0], E.vida[1], Math.random());
      l.idade = 0;
    });
    material.opacity = 1;
    malha.visible = true;
    ativo = true;
  }

  function atualizar(dt) {
    if (!ativo) return;
    let vivas = 0;
    lascas.forEach((l, i) => {
      l.idade += dt;
      const t = Math.min(1, l.idade / l.vida);
      if (t < 1) vivas++;
      l.v.multiplyScalar(Math.exp(-dt * E.atrito));
      l.v.y -= E.gravidade * dt;
      l.p.addScaledVector(l.v, dt);
      const ang = l.giro.length();
      if (ang > 0) { dq.setFromAxisAngle(eixo.copy(l.giro).divideScalar(ang), ang * dt); l.q.multiply(dq); }
      const k = l.tam * (1 - t * t); // encolhe até sumir
      esc.setScalar(Math.max(k, 0.0001));
      m.compose(l.p, l.q, esc);
      malha.setMatrixAt(i, m);
    });
    malha.instanceMatrix.needsUpdate = true;
    if (!vivas) { ativo = false; malha.visible = false; }
  }

  return { usarArma, precompilar, explodir, atualizar };
}
