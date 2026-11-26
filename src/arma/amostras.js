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
  trecho: [-1.8, 1.9], // unidades (x, y) no espaço da arma: de onde a plaquinha copia a camo (longe das peças pretas)
};

const cache = new Map(); // gera uma vez só por lista de ids (vitrine, loja e maestria reaproveitam)

/** ids = quais camos fotografar (padrão: as 4 de CAMOS). Devolve as imagens na mesma ordem. */
export function gerarAmostras(ids = CAMOS.map((c) => c.id)) {
  const chave = ids.join(',');
  if (cache.has(chave)) return cache.get(chave);
  const canvas = document.createElement('canvas');
  const { renderer, cena } = criarEstudio(canvas);
  renderer.setPixelRatio(1);
  renderer.setSize(AMOSTRA.tamanho, AMOSTRA.tamanho, false);

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
  camera.position.set(0, 0, 3.1);

  // plaquinha no meio da arma (fora das peças pretas), pattern no espaço da arma
  const materiais = criarMateriais();
  const placa = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6, 48, 48), materiais.camo);
  // o shader lê a posição da geometria: desloca a geometria até um trecho da
  // arma sem peças pretas (antes pegava o painel da empunhadura, uma faixa
  // preta na direita do ícone) e devolve a malha ao centro da câmera
  placa.geometry.translate(...AMOSTRA.trecho, 0);
  placa.position.set(-AMOSTRA.trecho[0], -AMOSTRA.trecho[1], 0);
  const suporte = new THREE.Group(); // a inclinação gira em volta do centro da plaquinha
  suporte.rotation.set(AMOSTRA.inclinacao[0], AMOSTRA.inclinacao[1], 0);
  suporte.add(placa);
  cena.add(suporte);

  const U = materiais.uniforms;
  U.uTempo.value = AMOSTRA.tempo;
  U.uTransicao.value = 0;
  const imagens = ids.map((id) => {
    U.uCamoA.value = id;
    renderer.render(cena, camera);
    return canvas.toDataURL('image/png'); // lido no mesmo instante do render
  });

  placa.geometry.dispose();
  materiais.camo.dispose();
  renderer.dispose();
  renderer.forceContextLoss();
  cache.set(chave, imagens);
  return imagens;
}
