import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

// Arma modelada (GLB do usuário, otimizado com glTF-Transform: 1M → 200k
// triângulos, compressão meshopt). Aqui ela é "normalizada" e a transformação
// fica gravada na geometria: comprimento no eixo X, centro na origem, boca do
// cano para -X e tamanho fixo. Assim o shader de camo lê `position` sempre no
// mesmo espaço, qualquer que seja o arquivo.
// O arquivo é baixado UMA vez para a página inteira (preloader e vitrine usam
// a mesma geometria).

export const ARMA = {
  arquivo: `${import.meta.env.BASE_URL}modelos/arma.glb`,
  comprimento: 7.6, // unidades: tamanho final da arma (as camos foram ajustadas nessa escala)
  altura: 4.44, // unidades: altura da arma nessa escala (para enquadrar antes de carregar)
  girar180: true, // este GLB chega com o cano em +X: gira para a boca ficar à esquerda (lado esquerdo da arma, igual às referências do jogo)
};

function paraFloat(attr) {
  // posições quantizadas (Int16 normalizado) estourariam ao aplicar a matriz
  const out = new Float32Array(attr.count * attr.itemSize);
  for (let i = 0; i < attr.count; i++) for (let k = 0; k < attr.itemSize; k++) out[i * attr.itemSize + k] = attr.getComponent(i, k);
  return new THREE.BufferAttribute(out, attr.itemSize);
}

function normalizar(gltf) {
  gltf.scene.updateMatrixWorld(true);
  let geo = null;
  gltf.scene.traverse((o) => {
    if (geo || !o.isMesh) return; // o arquivo tem uma malha só
    geo = o.geometry.clone();
    geo.setAttribute('position', paraFloat(geo.attributes.position));
    if (geo.attributes.normal) geo.setAttribute('normal', paraFloat(geo.attributes.normal));
    geo.applyMatrix4(o.matrixWorld);
  });
  if (!geo) throw new Error('GLB sem malha');

  // comprimento no eixo X
  geo.computeBoundingBox();
  const t = new THREE.Vector3();
  geo.boundingBox.getSize(t);
  if (t.z > t.x && t.z >= t.y) geo.rotateY(Math.PI / 2);
  else if (t.y > t.x && t.y > t.z) geo.rotateZ(Math.PI / 2);
  if (ARMA.girar180) geo.rotateY(Math.PI);

  // centro na origem e tamanho fixo
  geo.computeBoundingBox();
  const centro = new THREE.Vector3();
  geo.boundingBox.getCenter(centro);
  geo.translate(-centro.x, -centro.y, -centro.z);
  geo.boundingBox.getSize(t);
  const s = ARMA.comprimento / t.x;
  geo.scale(s, s, s);
  // normais recalculadas em precisão total: as do arquivo vêm com 8 bits
  // (compressão) e deixam o reflexo de metal / verniz "mastigado"
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

// --- download único, com progresso para quem quiser ouvir (o preloader)
const ouvintes = new Set();
let progresso = 0;
let promessa = null;

/** Recebe o progresso do download (0..1). Devolve a função que para de ouvir. */
export function ouvirProgresso(fn) {
  ouvintes.add(fn);
  fn(progresso);
  return () => ouvintes.delete(fn);
}

export function carregarGeometria() {
  if (!promessa) {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    promessa = loader
      .loadAsync(ARMA.arquivo, (e) => {
        if (!e.lengthComputable || !e.total) return;
        progresso = Math.min(0.99, e.loaded / e.total);
        ouvintes.forEach((fn) => fn(progresso));
      })
      .then((gltf) => {
        const geo = normalizar(gltf);
        progresso = 1;
        ouvintes.forEach((fn) => fn(1));
        return geo;
      });
  }
  return promessa;
}

/** Arma pronta para a cena, com o material de camo dado (a geometria é compartilhada). */
export async function carregarArma({ camo }) {
  const geo = await carregarGeometria();
  const malha = new THREE.Mesh(geo, camo);
  malha.name = 'arma';
  const grupo = new THREE.Group();
  grupo.add(malha);
  return { grupo, malha, tamanho: geo.boundingBox.getSize(new THREE.Vector3()) };
}
