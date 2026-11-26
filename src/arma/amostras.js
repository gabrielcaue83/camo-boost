import * as THREE from 'three';
import { criarEstudio } from './estudio.js';
import { criarMateriais, CAMOS } from './camos.js';

// Ícones das camos gerados pelo PRÓPRIO shader da arma (nada de imagem do
// jogo): uma plaquinha com o material de cada camo, levemente inclinada para
// pegar reflexo, fotografada uma vez e devolvida como imagem (data URL).

export const AMOSTRA = {
  tamanho: 160, // px da imagem gerada
  tempo: 9.0, // s: "instante" congelado das camos animadas (9 = divisa vermelho/preto da Harmonic Break no meio)
  inclinacao: [-0.32, 0.42], // rad (x, y): ângulo da plaquinha para o reflexo aparecer
};

let cache = null; // gera uma vez só para a página inteira (vitrine e loja usam as mesmas)

export function gerarAmostras() {
  if (cache) return cache;
  const canvas = document.createElement('canvas');
  const { renderer, cena } = criarEstudio(canvas);
  renderer.setPixelRatio(1);
  renderer.setSize(AMOSTRA.tamanho, AMOSTRA.tamanho, false);

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
  camera.position.set(0, 0, 3.1);

  // plaquinha no meio da arma (fora das peças pretas), pattern no espaço da arma
  const materiais = criarMateriais();
  const placa = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6, 48, 48), materiais.camo);
  placa.rotation.set(AMOSTRA.inclinacao[0], AMOSTRA.inclinacao[1], 0);
  cena.add(placa);

  const U = materiais.uniforms;
  U.uTempo.value = AMOSTRA.tempo;
  U.uTransicao.value = 0;
  const imagens = CAMOS.map((c) => {
    U.uCamoA.value = c.id;
    renderer.render(cena, camera);
    return canvas.toDataURL('image/png'); // lido no mesmo instante do render
  });

  placa.geometry.dispose();
  materiais.camo.dispose();
  renderer.dispose();
  renderer.forceContextLoss();
  cache = imagens;
  return imagens;
}
