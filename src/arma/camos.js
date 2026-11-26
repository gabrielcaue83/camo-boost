import * as THREE from 'three';
import { NOISE } from '../topo.js';
import { GLSL_MAESTRIA } from './camosMaestria.js';

// Camuflagens procedurais (nenhuma imagem), tiradas das referências do jogo.
// Cada uma é uma função no shader que devolve cor, metal, rugosidade, brilho
// próprio e (no cristal) a inclinação da faceta, a partir da posição e da
// normal no espaço da arma (~7,6 unidades de comprimento no eixo X, boca em -X).
// A troca entre duas camos é uma "varredura" do cano até a coronha.

export const CAMOS = [
  // fundo = cor da seção inteira (centro atrás da arma / bordas)
  // topo = linhas da topografia por cima do fundo (preto)
  { id: 0, nome: 'Ouro', fundo: { centro: '#b8861a', borda: '#3d2a04' }, topo: { linha: '#000000', destaque: '#000000', iris: 0 } },
  { id: 1, nome: 'Platina', fundo: { centro: '#9aa0a8', borda: '#2b2e33' }, topo: { linha: '#000000', destaque: '#000000', iris: 0 } },
  { id: 2, nome: 'Harmonic Break', fundo: { centro: '#8e0f18', borda: '#240305' }, topo: { linha: '#000000', destaque: '#000000', iris: 0 } },
  { id: 3, nome: 'Divergência', fundo: { centro: '#6e7396', borda: '#191b2e' }, topo: { linha: '#000000', destaque: '#000000', iris: 0 } },
];

// Harmonic Break é reativa: faixas diagonais grossas, alternando preto e
// vermelho, atravessam a arma sem parar (um ciclo que se realimenta: passa a
// preta, a que vem atrás é a vermelha, depois preta de novo...)
export const HARMONIC = {
  vel: 0.5, // unidades por segundo que as faixas andam (a arma tem ~7,6 de comprimento)
  periodo: 6.0, // unidades: uma faixa preta + uma vermelha (cada uma com metade)
  inclinacao: 0.8, // diagonal das faixas (0 = em pé; maior = mais deitada)
  faixa: 0.9, // unidades: largura das bordas salpicadas (peças meio cheias) dos dois lados
  fumaca: 0.15, // quanto as bordas ondulam como fumaça (0 = retas)
  fumacaVel: 0.12, // velocidade com que a "fumaça" se mexe
  comprimento: 0.19, // unidades: comprimento de cada fileira de chevrons (ao longo da arma)
  largura: 0.3, // unidades: largura de cada chevron (as duas asas juntas)
  bico: 0.9, // quanto o chevron dobra em V (0 = retângulos)
  costura: 0.01, // unidades: espessura da divisão entre as peças
  enche: 0.22, // quanto a onda precisa avançar para uma peça encher toda (maior = enche mais devagar)
  ondulacao: 18.0, // detalhe da borda do preenchimento (maior = borda mais "fumacenta")
  borda: 0.9, // brilho vermelho na frente do preenchimento
};

// verniz (camada brilhante por cima) de cada camo, 0..1
export const VERNIZ = { ouro: 1.0, platina: 1.0, harmonic: 0.6, divergencia: 0.8, rugosidade: 0.03 };

// Divergência: cromo + película iridescente + linhas de topografia com aberração cromática
export const DIVERGENCIA = {
  escala: 0.55, // tamanho das curvas de nível na arma (maior = curvas menores)
  niveis: 5.0, // quantas linhas por "morro"
  velocidade: 0.05, // quão rápido as curvas andam
  manchas: 0.35, // tamanho das manchas onde as linhas aparecem (maior = manchas menores)
  manchasVel: 0.12, // quão rápido as manchas acendem e apagam
  aberracao: 0.04, // unidades: separação vermelho/verde/azul das linhas
  brilhoLinhas: 1.8, // brilho próprio das linhas coloridas
  pelicula: [180, 760], // nm: espessura da película iridescente (muda as cores do reflexo)
  facetas: 2.4, // tamanho dos losangos (maior = losangos menores)
  quebra: 0.7, // quanto cada losango entorta o reflexo
};

export const VARREDURA = {
  inicio: -4.6, // unidades: onde a linha começa (antes da boca do cano)
  fim: 4.7, // unidades: onde termina (depois da coronha)
  borda: 0.015, // suavidade do corte entre as camos
  brilho: 3.2, // força da linha amarela
  largura: 0.045, // espessura da linha amarela
};

// Peças que ficam PRETAS em todas as camos (como no jogo). O GLB é uma malha
// só, então as peças são marcadas por caixas, medidas em PIXELS da imagem de
// referência lateral (1024 px, cano em x=135, coronha em x=886).
// `lado: true` = só as faces laterais (painel encaixado na empunhadura).
// `zMin` = só o que fica para fora do corpo (|z| maior que isso), em qualquer face.
const PX = 7.6 / 751; // unidades por px
const ux = (px) => (px - 510.5) * PX;
const uy = (py) => -(py - 256) * PX;
export const PECAS_PRETAS = [
  { nome: 'carregador', x: [488, 584], y: [334, 482] },
  { nome: 'painelEmpunhadura', x: [546, 606], y: [200, 324], lado: true },
  { nome: 'trilhoLateral', x: [238, 407], y: [112, 166], zMin: 0.29 }, // tudo que sai do corpo (inclui chanfros e ranhuras)
  { nome: 'trilhoBaixo', x: [245, 405], y: [178, 202] },
  { nome: 'soleira', x: [834, 892], y: [94, 262] },
];

const f = (v) => v.toFixed(4);
const GLSL_PRETAS = PECAS_PRETAS.map((c) => {
  const caixa = `caixa(p, vec4(${f(ux(c.x[0]))}, ${f(ux(c.x[1]))}, ${f(uy(c.y[1]))}, ${f(uy(c.y[0]))}))`;
  const lado = c.lado ? ' * smoothstep(0.55, 0.75, abs(n.z))' : '';
  const fora = c.zMin != null ? ` * smoothstep(${f(c.zMin - 0.01)}, ${f(c.zMin + 0.01)}, abs(p.z))` : '';
  return `  m = max(m, ${caixa}${lado}${fora});`;
}).join('\n');

const GLSL = /* glsl */ `
uniform float uCamoA, uCamoB, uTransicao, uTempo, uVerMascara;
uniform vec3 uCorVarredura; // cor da linha da varredura (amarela; vermelha no desbloqueio da Maestria)
varying vec3 vCamoPos;
varying vec3 vCamoNormal;
${NOISE}

struct Camo { vec3 cor; float metal; float rugo; vec3 brilho; vec3 inclina; };

vec3 lin(vec3 c) { return pow(c, vec3(2.2)); } // cores escritas em sRGB
const vec3 AMARELO = vec3(1.0, 0.82, 0.0);
const vec3 ZERO = vec3(0.0);

float hash2(vec2 c) { return fract(sin(dot(c, vec2(127.1, 311.7))) * 43758.5453); }
vec3 hue(float h) { return clamp(abs(fract(h + vec3(0.0, 2.0, 1.0) / 3.0) * 6.0 - 3.0) - 1.0, 0.0, 1.0); }

// projeção plana escolhida pela face (lado, cima/baixo, frente/trás)
vec2 plano(vec3 p, vec3 n) {
  vec3 a = abs(n);
  if (a.z >= a.x && a.z >= a.y) return p.xy;
  if (a.y >= a.x) return p.xz;
  return p.zy;
}

float caixa(vec3 p, vec4 b) { // b = x0, x1, y0, y1
  vec2 d = min(p.xy - b.xz, b.yw - p.xy);
  return smoothstep(0.0, 0.015, min(d.x, d.y));
}

float pecaPreta(vec3 p, vec3 n) {
  float m = 0.0;
${GLSL_PRETAS}
  return m;
}

// --- OURO: amarelo-ouro saturado, metal com reflexo forte
Camo camoOuro(vec3 p, vec3 n) {
  float var = snoise(p * 0.8) * 0.5 + 0.5;
  vec3 c = mix(lin(vec3(0.86, 0.64, 0.2)), lin(vec3(1.0, 0.8, 0.34)), var);
  return Camo(c, 1.0, 0.07, ZERO, ZERO); // espelhado (o verniz vem por cima)
}

// --- PLATINA: níquel prateado, levemente quente
Camo camoPlatina(vec3 p, vec3 n) {
  float var = snoise(p * 0.8 + 5.0) * 0.5 + 0.5;
  vec3 c = mix(lin(vec3(0.86, 0.86, 0.85)), lin(vec3(0.97, 0.97, 0.96)), var);
  // metal de baixo levemente acetinado (fica claro/prateado); o verniz espelhado vem por cima
  return Camo(c, 1.0, 0.17, ZERO, ZERO);
}

// mosaico de chevrons: cada "bico/asa" são dois trapézios espelhados,
// em fileiras ao longo da arma (eixo X). Devolve: id da peça, centro em X e
// a costura (0..1) entre as peças.
struct Peca { vec2 id; float cx; float cy; float costura; float local; };
Peca chevron(vec2 uv) {
  const float C = ${HARMONIC.comprimento.toFixed(3)}, L = ${HARMONIC.largura.toFixed(3)}, B = ${HARMONIC.bico.toFixed(3)};
  float a = uv.y / L;
  float col = floor(a), cf = fract(a);
  float v = uv.x / C - abs(cf - 0.5) * B; // fileiras dobradas em V
  float fil = floor(v), vf = fract(v);
  float metade = step(0.5, cf);
  float dFileira = min(vf, 1.0 - vf) * C * 0.75;
  float dColuna = min(min(cf, 1.0 - cf), abs(cf - 0.5)) * L;
  float costura = 1.0 - smoothstep(${(HARMONIC.costura * 0.6).toFixed(4)}, ${(HARMONIC.costura * 1.4).toFixed(4)}, min(dFileira, dColuna));
  return Peca(vec2(fil * 2.0 + metade, col), (fil + 0.5 + 0.25 * B) * C, (col + 0.25 + 0.5 * metade) * L, costura, vf);
}

// --- HARMONIC BREAK: mosaico de chevrons vermelho que "quebra" peça por peça
//     para preto bem escuro (só a divisão entre as peças aparece)
Camo camoHarmonic(vec3 p, vec3 n) {
  vec2 uv = plano(p, n);
  Peca pc = chevron(uv);
  float h = hash2(pc.id);
  // faixa preta diagonal andando do cano (-X) para a coronha (+X)
  float tf = uTempo * ${HARMONIC.fumacaVel.toFixed(3)};
  float fum = snoise(vec3(pc.id * 0.12, tf)) + 0.5 * snoise(vec3(pc.id * 0.3 + 9.0, tf * 1.6));
  float diag = pc.cx + pc.cy * ${HARMONIC.inclinacao.toFixed(3)}; // posição da peça na diagonal
  // posição dentro do ciclo: 0.5 = miolo de uma faixa preta, 0 ou 1 = miolo de uma vermelha
  float ciclo = fract((diag - uTempo * ${HARMONIC.vel.toFixed(3)}) / ${HARMONIC.periodo.toFixed(3)});
  float dist = abs(ciclo - 0.5) * ${HARMONIC.periodo.toFixed(3)}; // distância até o miolo preto mais próximo
  // 1 dentro da faixa preta, 0 na vermelha; as bordas (largura "faixa") ficam salpicadas
  float nivel = clamp((${(HARMONIC.periodo / 4).toFixed(3)} - dist) / ${HARMONIC.faixa.toFixed(3)} + 0.5 + fum * ${HARMONIC.fumaca.toFixed(3)}, 0.0, 1.0);
  float limite = hash2(pc.id + 31.0) * (1.0 - ${HARMONIC.enche.toFixed(3)}); // todas conseguem encher até o fim
  // cada peça ENCHE de preto aos poucos, como fumaça: na frente da faixa o preto
  // entra pelo lado do cano; atrás dela, o preto sai pelo lado do cano (sobra no da coronha)
  float enche = clamp((nivel - limite) / ${HARMONIC.enche.toFixed(3)}, 0.0, 1.0);
  float lado = ciclo > 0.5 ? pc.local : 1.0 - pc.local; // na frente da faixa preta ou atrás dela
  float frente = lado + snoise(p * ${HARMONIC.ondulacao.toFixed(2)} + vec3(0.0, 0.0, uTempo * 0.4)) * 0.12;
  float preto = smoothstep(frente - 0.03, frente + 0.03, enche * 1.15 - 0.075);
  float fronteira = (1.0 - smoothstep(0.0, 0.09, abs(enche * 1.15 - 0.075 - frente))) * step(0.001, enche) * step(enche, 0.999);
  vec3 vermelho = mix(lin(vec3(0.58, 0.035, 0.045)) * (0.88 + 0.24 * h), lin(vec3(0.2, 0.0, 0.012)), pc.costura);
  vec3 escuro = mix(lin(vec3(0.03, 0.03, 0.033)) * (0.8 + 0.4 * h), lin(vec3(0.008)), pc.costura);
  vec3 c = mix(vermelho, escuro, preto);
  vec3 brilho = lin(vec3(1.0, 0.1, 0.12)) * fronteira * ${HARMONIC.borda.toFixed(3)};
  return Camo(c, 0.45, mix(0.22, 0.55, pc.costura), brilho, ZERO);
}

// --- DIVERGÊNCIA: cromo prateado com reflexo iridescente (película fina) e
//     as linhas da topografia do fundo aparecendo em manchas pela arma, com
//     aberração cromática (cada linha separada em vermelho / verde / azul)
float linhaTopo(vec3 q) {
  float v = snoise(q * ${DIVERGENCIA.escala.toFixed(3)} + vec3(0.0, 0.0, uTempo * ${DIVERGENCIA.velocidade.toFixed(3)})) * ${DIVERGENCIA.niveis.toFixed(2)};
  float w = fwidth(v);
  return 1.0 - smoothstep(w * 0.6, w * 1.8, abs(fract(v + 0.5) - 0.5));
}
Camo camoDivergencia(vec3 p, vec3 n) {
  // manchas que acendem e apagam devagar, em lugares diferentes da arma
  float mancha = smoothstep(0.02, 0.42, snoise(p * ${DIVERGENCIA.manchas.toFixed(3)} + vec3(7.0, 3.0, uTempo * ${DIVERGENCIA.manchasVel.toFixed(3)})));
  vec3 d = vec3(${DIVERGENCIA.aberracao.toFixed(4)}, ${(DIVERGENCIA.aberracao * 0.5).toFixed(4)}, 0.0);
  vec3 linhas = vec3(linhaTopo(p + d), linhaTopo(p), linhaTopo(p - d)) * mancha;
  float alguma = max(linhas.r, max(linhas.g, linhas.b));
  // facetas de cristal (losangos em grade triangular): cada uma com brilho e
  // inclinação próprios, o que quebra o reflexo em pedaços
  vec2 uv = plano(p, n) * ${DIVERGENCIA.facetas.toFixed(3)};
  uv += vec2(snoise(vec3(uv * 0.35, 1.0)), snoise(vec3(uv * 0.35, 5.0))) * 0.25;
  vec2 sk = vec2(uv.x + uv.y * 0.57735, uv.y * 1.1547);
  vec2 id = floor(sk), g = fract(sk);
  vec2 fid = id * 2.0 + vec2(step(g.y, g.x), 0.0);
  float h = hash2(fid), h2 = hash2(fid + 9.1), h3 = hash2(fid + 21.7);
  vec3 c = lin(vec3(0.9, 0.91, 0.94)) * (0.55 + 0.45 * h);
  c = mix(c, c * 0.3, alguma * 0.6); // as linhas marcam o metal
  vec3 inclina = (vec3(h, h2, h3) - 0.5) * ${DIVERGENCIA.quebra.toFixed(3)};
  return Camo(c, 1.0, 0.16 + h3 * 0.08, linhas * ${DIVERGENCIA.brilhoLinhas.toFixed(2)}, inclina);
}

// camos de maestria (ids 4 em diante), em camosMaestria.js
${GLSL_MAESTRIA}

// película iridescente (Divergência e algumas de maestria): espessura segue a topografia
float irisPorId(float id) { return id > 3.5 ? irisMaestria(id) : (id > 2.5 ? 1.0 : 0.0); }
float irisFinal(vec3 p, vec3 n) {
  float v = irisPorId(uCamoA);
  if (uTransicao > 0.0) {
    float lim = mix(${VARREDURA.inicio.toFixed(3)}, ${VARREDURA.fim.toFixed(3)}, uTransicao);
    float m = smoothstep(lim - ${VARREDURA.borda.toFixed(3)}, lim + ${VARREDURA.borda.toFixed(3)}, p.x);
    v = mix(irisPorId(uCamoB), v, m);
  }
  return v * (1.0 - pecaPreta(p, n));
}
float espessuraIris(vec3 p) {
  float v = snoise(p * ${DIVERGENCIA.escala.toFixed(3)} + vec3(0.0, 0.0, uTempo * ${DIVERGENCIA.velocidade.toFixed(3)}));
  return mix(${DIVERGENCIA.pelicula[0].toFixed(1)}, ${DIVERGENCIA.pelicula[1].toFixed(1)}, 0.5 + 0.5 * sin(v * 9.42)); // faixas de arco-íris suaves seguindo as curvas
}

// verniz (clearcoat) de cada camo: 1 = laca espelhada
float vernizPorId(float id) {
  if (id < 0.5) return ${VERNIZ.ouro.toFixed(2)};
  if (id < 1.5) return ${VERNIZ.platina.toFixed(2)};
  if (id < 2.5) return ${VERNIZ.harmonic.toFixed(2)};
  if (id < 3.5) return ${VERNIZ.divergencia.toFixed(2)};
  return vernizMaestria(id);
}
float vernizFinal(vec3 p, vec3 n) {
  float v = vernizPorId(uCamoA);
  if (uTransicao > 0.0) {
    float lim = mix(${VARREDURA.inicio.toFixed(3)}, ${VARREDURA.fim.toFixed(3)}, uTransicao);
    float m = smoothstep(lim - ${VARREDURA.borda.toFixed(3)}, lim + ${VARREDURA.borda.toFixed(3)}, p.x);
    v = mix(vernizPorId(uCamoB), v, m);
  }
  return v * (1.0 - pecaPreta(p, n));
}

Camo camoPorId(float id, vec3 p, vec3 n) {
  if (id < 0.5) return camoOuro(p, n);
  if (id < 1.5) return camoPlatina(p, n);
  if (id < 2.5) return camoHarmonic(p, n);
  if (id < 3.5) return camoDivergencia(p, n);
  return camoMaestria(id, p, n);
}

Camo camoFinal(vec3 p, vec3 n) {
  Camo s = camoPorId(uCamoA, p, n);
  if (uTransicao > 0.0) {
    Camo b = camoPorId(uCamoB, p, n);
    float lim = mix(${VARREDURA.inicio.toFixed(3)}, ${VARREDURA.fim.toFixed(3)}, uTransicao);
    float m = smoothstep(lim - ${VARREDURA.borda.toFixed(3)}, lim + ${VARREDURA.borda.toFixed(3)}, p.x); // 1 = ainda a antiga
    float faixa = exp(-pow((p.x - lim) / ${VARREDURA.largura.toFixed(3)}, 2.0)) * step(uTransicao, 0.999);
    s.cor = mix(b.cor, s.cor, m);
    s.metal = mix(b.metal, s.metal, m);
    s.rugo = mix(b.rugo, s.rugo, m);
    s.inclina = mix(b.inclina, s.inclina, m);
    s.brilho = mix(b.brilho, s.brilho, m) + uCorVarredura * faixa * ${VARREDURA.brilho.toFixed(2)};
  }
  // peças pretas (polímero fosco), iguais em todas as camos
  float preta = pecaPreta(p, n);
  s.cor = mix(s.cor, lin(vec3(0.07, 0.07, 0.075)), preta);
  s.metal = mix(s.metal, 0.15, preta);
  s.rugo = mix(s.rugo, 0.72, preta); // bem fosco: não pega o reflexo amarelo da luz de trás
  s.inclina *= 1.0 - preta;
  s.brilho *= 1.0 - preta;
  if (uVerMascara > 0.5) s.brilho += vec3(1.0, 0.0, 1.0) * preta; // depuração: peças pretas em magenta
  return s;
}
`;

export function criarMateriais() {
  const uniforms = {
    uCamoA: { value: 0 },
    uCamoB: { value: 0 },
    uTransicao: { value: 0 },
    uTempo: { value: 0 },
    uVerMascara: { value: 0 },
    uCorVarredura: { value: new THREE.Vector3(1.0, 0.82, 0.0) }, // mesmo AMARELO do shader
  };

  // Physical: tem a camada de verniz (clearcoat), ligada/desligada por camo no shader
  const camo = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.6, metalness: 0.1, clearcoat: 1, clearcoatRoughness: VERNIZ.rugosidade,
    iridescence: 1, iridescenceIOR: 1.85, iridescenceThicknessRange: DIVERGENCIA.pelicula,
  });
  camo.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCamoPos;\nvarying vec3 vCamoNormal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCamoPos = position;\nvCamoNormal = normal;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${GLSL}`)
      .replace('#include <color_fragment>', '#include <color_fragment>\nCamo camoAtual = camoFinal(vCamoPos, normalize(vCamoNormal));\ndiffuseColor.rgb = camoAtual.cor;')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = camoAtual.rugo;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = camoAtual.metal;')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = normalize(normal + camoAtual.inclina);')
      .replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>\nmaterial.clearcoat = vernizFinal(vCamoPos, normalize(vCamoNormal));\nmaterial.clearcoatRoughness = ${VERNIZ.rugosidade.toFixed(3)};\n#ifdef USE_IRIDESCENCE\nmaterial.iridescence = irisFinal(vCamoPos, normalize(vCamoNormal));\nmaterial.iridescenceThickness = espessuraIris(vCamoPos);\n#endif`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += camoAtual.brilho;');
  };

  return { camo, uniforms };
}
