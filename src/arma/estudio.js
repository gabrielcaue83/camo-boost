import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

// Tudo que a arma precisa para ficar bonita, igual em qualquer lugar do site
// (preloader e vitrine): renderizador, "estúdio" que ela reflete e as luzes.

export const ESTUDIO = {
  exposicao: 1.05, // brilho geral da imagem
  reflexo: 0.7, // força do ambiente refletido (estúdio)
  luzChave: 2.2, // luz branca principal (de cima, à esquerda)
  luzContra: 3.0, // recorte amarelo por trás
  luzBaixo: 0.6, // preenchimento azulado por baixo
};

// "Estúdio" que a arma reflete: a sala padrão + faixas de luz fortes (softboxes).
// É o que dá o reflexo de verniz/espelho no ouro e na platina.
function criarAmbiente() {
  const estudio = new RoomEnvironment();
  const luz = (w, h, intensidade, pos, rot) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1).multiplyScalar(intensidade), side: THREE.DoubleSide }),
    );
    m.position.set(...pos);
    m.rotation.set(...rot);
    estudio.add(m);
  };
  luz(10, 1.4, 9, [0, 6.5, 0], [Math.PI / 2, 0, 0]); // faixa comprida em cima
  luz(1.1, 7, 7, [-7, 1, 2], [0, Math.PI / 2, 0]); // faixa vertical à esquerda
  luz(1.1, 7, 5, [7, 1, -1], [0, -Math.PI / 2, 0]); // faixa vertical à direita
  luz(6, 0.8, 6, [0, 2.5, 7], [0, Math.PI, 0]); // faixa na frente, alta
  return estudio;
}

/** Renderizador + cena com reflexos e luzes prontos. */
export function criarEstudio(canvas, { reflexo = ESTUDIO.reflexo } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = ESTUDIO.exposicao;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const cena = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  cena.environment = pmrem.fromScene(criarAmbiente(), 0).texture; // sem desfoque: reflexo nítido
  cena.environmentIntensity = reflexo;
  pmrem.dispose();

  const chave = new THREE.DirectionalLight(0xffffff, ESTUDIO.luzChave);
  chave.position.set(-6, 7, 4);
  const contra = new THREE.DirectionalLight(0xffd100, ESTUDIO.luzContra);
  contra.position.set(5, 2, -6);
  const baixo = new THREE.DirectionalLight(0x8899aa, ESTUDIO.luzBaixo);
  baixo.position.set(0, -6, 3);
  cena.add(chave, contra, baixo);

  return { renderer, cena };
}

/** Distância da câmera para a arma caber (altura e largura) com folga. */
export function distanciaCamera(fov, aspecto, comprimento, folgaLargura = 1.18, alturaVisivel = 6.4) {
  const meia = Math.tan(THREE.MathUtils.degToRad(fov / 2));
  return Math.max(alturaVisivel / (2 * meia), (comprimento * folgaLargura) / (2 * meia * aspecto));
}
