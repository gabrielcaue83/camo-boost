// Camos de Maestria: liberadas só depois da Divergência, 3 por modo
// (Multiplayer, Warzone, DMZ). Por enquanto só as do Multiplayer.
// Mesma ideia das camos de camos.js: tudo procedural no shader, sem imagem.
// Os ids continuam a contagem de CAMOS (0..3), para o mesmo material
// desenhar qualquer camo e fazer a varredura entre elas.

export const MODOS = [
  {
    id: 'mp',
    nome: 'Multiplayer',
    local: 'Seul', // frente de operação (ambientação da seção)
    coords: '37°34′N 126°58′E',
    hangul: '서울',
    camos: [4, 5, 6],
  },
  // warzone e dmz entram depois, com as referências
];

// ⚠ PROVISÓRIO: o requisito da Mercurial Drift é o publicado nos guias (nov/2026);
//   o da Polyatomic e o da Orion ainda faltam confirmar.
//   desafio:    o que precisa fazer
//   quantidade: número grande da ficha (null = sem contador)
//   unidade:    o que esse número conta
export const CAMOS_MAESTRIA = [
  {
    id: 4, nome: 'Mercurial Drift', modo: 'mp', nivel: 1,
    fundo: { centro: '#e0187e', borda: '#2a0a2e' },
    desafio: 'Exige a Divergência. Faça 10 abates numa única partida, 250 vezes.',
    quantidade: 250, unidade: 'partidas com 10 abates',
  },
  {
    id: 5, nome: 'Polyatomic Reforged', modo: 'mp', nivel: 2,
    fundo: { centro: '#5a3ae0', borda: '#0b0826' },
    desafio: 'Exige a Mercurial Drift. Segundo desafio de Maestria do Multiplayer.',
    quantidade: null, unidade: '',
  },
  {
    id: 6, nome: 'Orion Reforged', modo: 'mp', nivel: 3,
    fundo: { centro: '#c0143c', borda: '#16030a' },
    desafio: 'Exige a Polyatomic Reforged. O último desafio de Maestria do Multiplayer.',
    quantidade: null, unidade: '',
  },
];

// Mercurial Drift: tinta líquida marmorizada (magenta, amarelo, laranja e
// manchas de índigo) escorrendo na diagonal, com veios finos por dentro.
export const MERCURIAL = {
  escala: 0.27, // tamanho das manchas (maior = manchas menores)
  esticar: 0.55, // achata na direção do escorrido (menor = mais esticado)
  angulo: 0.75, // rad: direção do escorrido
  vel: 0.035, // quão rápido a tinta anda
  torcao: 1.8, // quanto a tinta se dobra sobre si mesma
  indigo: 0.36, // 0..1: maior = menos ilhas de índigo
  veios: 13.0, // densidade dos veios finos
  metal: 0.55,
  rugosidade: 0.16,
};

// Polyatomic Reforged: cristal estilhaçado em lascas triangulares (roxo,
// azul, lavanda e branco), cada lasca com reflexo próprio, sem divisão entre elas.
export const POLYATOMIC = {
  escala: 1.6, // lascas por unidade (maior = lascas menores)
  esticar: 0.62, // alonga as lascas
  angulo: 0.6, // rad: direção em que elas se alongam
  quebra: 0.75, // quanto cada lasca entorta o reflexo
  brilhoVel: 0.18, // velocidade do brilho que passa pelas lascas claras
  metal: 0.9,
  rugosidade: 0.14,
};

// Orion Reforged (reativa): o espaço dentro de um vidro carmim que brilha
// sozinho. Base magenta/vinho (clara em umas partes, quase preta em outras),
// nuvens de fogo (vermelho -> laranja -> amarelo quase branco) e nuvens
// violeta, finas e granuladas, correndo pela arma, e uma poeira de estrelas
// na cor de onde está. Referência: vídeo da arma à noite (nov/2026).
export const ORION = {
  escalaBase: 0.32, // tamanho das manchas claras/escuras do vidro (maior = menores)
  contraste: [-0.05, 0.25], // faixa do ruído onde o vidro passa de escuro a claro (mais estreita = mais contraste)
  escala: 0.75, // tamanho das nuvens de fogo (maior = menores)
  vel: 0.09, // quão rápido a nebulosa se transforma (camo reativa)
  deriva: 2.2, // quanto ela corre ao longo da arma (do cano para a coronha)
  cobertura: 0.08, // -1..1: quanto da arma o fogo cobre (menor = cobre mais)
  brilho: 5.0, // força da luz própria do fogo
  violeta: 1.9, // força da luz própria das nuvens violeta
  violetaCobertura: 0.08, // -1..1: quanto da arma o violeta cobre (menor = cobre mais)
  autoBrilho: 0.35, // brilho próprio do vidro (visível no escuro)
  grao: 0.6, // 0..1: textura granulada de poeira dentro das nuvens
  poeira: { celulas: 18.0, limiar: 0.62, raio: 0.26, forca: 0.6 }, // estrelas finas: células por unidade / 0..1 (maior = menos) / tamanho na célula / brilho
  medias: { celulas: 5.0, limiar: 0.86, raio: 0.15, forca: 1.6 }, // estrelas maiores, poucas
  cintila: 3.0, // velocidade do cintilar
  metal: 0.2,
  rugosidade: 0.12,
};

// verniz e película iridescente de cada camo de maestria, 0..1 (índice = id - 4)
export const VERNIZ_MAESTRIA = [0.65, 0.5, 1.0];
export const IRIS_MAESTRIA = [0.0, 0.4, 0.0];

const f = (v) => Number(v).toFixed(4);

// GLSL das camos de maestria. Usa o que camos.js já define antes (Camo, lin,
// hash2, hue, plano, snoise, uTempo, ZERO).
export const GLSL_MAESTRIA = /* glsl */ `
float hash3(vec3 c) { return fract(sin(dot(c, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float fbm3(vec3 q) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { s += a * snoise(q); q = q * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; }
  return s;
}
mat2 gira(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
// uma estrela por célula (se o sorteio passar do limiar), em posição sorteada.
// Devolve o disco (0..1); hs = sorteio da célula; v = posição relativa à estrela
float estrela(vec2 uv, float celulas, float limiar, float raio, out float hs, out vec2 v) {
  vec2 s = uv * celulas;
  vec2 id = floor(s);
  hs = hash2(id + celulas * 13.1);
  v = fract(s) - 0.5 - (vec2(hash2(id + 1.7), hash2(id + 5.3)) - 0.5) * 0.5;
  return step(limiar, hs) * (1.0 - smoothstep(raio * 0.2, raio, length(v)));
}

// --- MERCURIAL DRIFT
Camo camoMercurial(vec3 p, vec3 n) {
  float t = uTempo * ${f(MERCURIAL.vel)};
  vec3 q = p * ${f(MERCURIAL.escala)};
  q.xy = gira(${f(MERCURIAL.angulo)}) * q.xy;
  q.x *= ${f(MERCURIAL.esticar)};
  // tinta dobrada sobre si mesma (domain warping em duas camadas)
  vec2 w1 = vec2(fbm3(q + vec3(0.0, 0.0, t)), fbm3(q + vec3(5.2, 1.3, t)));
  vec2 w2 = vec2(fbm3(q + vec3(${f(MERCURIAL.torcao)} * w1, 0.0) + vec3(1.7, 9.2, t * 1.3)),
                 fbm3(q + vec3(${f(MERCURIAL.torcao)} * w1, 0.0) + vec3(8.3, 2.8, t * 1.3)));
  float v = fbm3(q + vec3(2.4 * w2, t * 0.5));
  float k = clamp(v * 1.05 + 0.5, 0.0, 1.0);
  // índigo em ilhas pequenas, onde um segundo campo cai fundo
  float ilha = smoothstep(${f(MERCURIAL.indigo)}, ${f(MERCURIAL.indigo + 0.1)}, -(w2.x * 0.9 + v * 0.6));

  vec3 indigo = lin(vec3(0.2, 0.06, 0.62));
  vec3 magenta = lin(vec3(0.95, 0.07, 0.6));
  vec3 vermelho = lin(vec3(1.0, 0.16, 0.24));
  vec3 laranja = lin(vec3(1.0, 0.45, 0.06));
  vec3 amarelo = lin(vec3(1.0, 0.86, 0.1));
  vec3 c = mix(magenta, vermelho, smoothstep(0.47, 0.54, k));
  c = mix(c, laranja, smoothstep(0.52, 0.58, k));
  c = mix(c, amarelo, smoothstep(0.57, 0.64, k));
  c = mix(c, indigo, ilha);
  // veios finos seguindo o desenho da tinta (mais escuros e quentes)
  float veio = sin((v * ${f(MERCURIAL.veios)} + length(w2) * 5.0) * 3.14159);
  float aa = fwidth(veio) * 1.5;
  float linhaVeio = smoothstep(0.55 - aa, 0.85 + aa, veio) * (1.0 - ilha);
  c = mix(c, c * vec3(0.95, 0.42, 0.5), linhaVeio * 0.45);
  return Camo(c, ${f(MERCURIAL.metal)}, ${f(MERCURIAL.rugosidade)}, ZERO, ZERO);
}

// --- POLYATOMIC REFORGED
Camo camoPolyatomic(vec3 p, vec3 n) {
  vec2 uv = gira(${f(POLYATOMIC.angulo)}) * plano(p, n);
  uv.x *= ${f(POLYATOMIC.esticar)};
  uv *= ${f(POLYATOMIC.escala)};
  uv += vec2(snoise(vec3(uv * 0.3, 2.0)), snoise(vec3(uv * 0.3, 7.0))) * 0.18; // lascas tortas, nada de grade
  // grade triangular: cada triângulo é cortado de novo por uma linha que sai
  // do vértice (0,0) até um ponto aleatório do lado oposto -> lascas finas
  vec2 sk = vec2(uv.x + uv.y * 0.57735, uv.y * 1.1547);
  vec2 id = floor(sk), g = fract(sk);
  float baixo = step(g.y, g.x);
  vec2 tid = id * 2.0 + vec2(baixo, 0.0);
  float s = 0.2 + 0.6 * hash2(tid + 3.3);
  float corte = baixo > 0.5 ? g.y - s * g.x : g.x - s * g.y;
  float lado = step(0.0, corte);
  vec2 fid = tid * 2.0 + vec2(lado, 0.0);
  float h = hash2(fid), h2 = hash2(fid + 9.1), h3 = hash2(fid + 21.7);

  // paleta: azul-marinho, roxo, azul, petróleo, lavanda e quase branco
  vec3 c;
  if (h < 0.18) c = lin(vec3(0.14, 0.08, 0.42));
  else if (h < 0.44) c = lin(vec3(0.45, 0.18, 0.9));
  else if (h < 0.66) c = lin(vec3(0.25, 0.32, 1.0));
  else if (h < 0.76) c = lin(vec3(0.3, 0.25, 0.75));
  else if (h < 0.92) c = lin(vec3(0.68, 0.6, 1.0));
  else c = lin(vec3(0.9, 0.92, 1.0));
  // degradê dentro da lasca (uma ponta mais escura), como o chanfro do cristal
  float dentro = baixo > 0.5 ? g.x : g.y;
  c *= 0.6 + 0.55 * mix(dentro, 1.0 - dentro, step(0.5, h2));

  // brilho que passa devagar pelas lascas claras
  float faixa = sin((uv.x + uv.y) * 0.35 - uTempo * ${f(POLYATOMIC.brilhoVel)} * 6.2832);
  vec3 brilho = lin(vec3(0.7, 0.66, 1.0)) * smoothstep(0.92, 1.0, faixa) * step(0.72, h) * 0.35;

  vec3 inclina = (vec3(h, h2, h3) - 0.5) * ${f(POLYATOMIC.quebra)};
  return Camo(c, ${f(POLYATOMIC.metal)}, ${f(POLYATOMIC.rugosidade)} + h3 * 0.06, brilho, inclina);
}

// --- ORION REFORGED
Camo camoOrion(vec3 p, vec3 n) {
  // camo reativa: o vidro e a nebulosa correm devagar ao longo da arma
  // (do cano para a coronha) e as nuvens se dobram enquanto andam
  float t = uTempo * ${f(ORION.vel)};
  vec3 corre = vec3(-t * ${f(ORION.deriva)}, 0.0, 0.0);
  // vidro carmim: manchas grandes claras (magenta) e escuras (vinho quase preto)
  float base = fbm3(p * ${f(ORION.escalaBase)} + corre * 0.6 + vec3(4.0, 1.0, t * 0.5));
  float claro = smoothstep(${f(ORION.contraste[0])}, ${f(ORION.contraste[1])}, base);
  vec3 c = mix(lin(vec3(0.025, 0.0, 0.01)), lin(vec3(0.6, 0.035, 0.2)), claro);

  // nebulosa: nuvens macias dobradas sobre si mesmas, só em parte da arma
  vec3 q = p * ${f(ORION.escala)} + corre + vec3(0.0, 0.0, t);
  vec3 w = vec3(fbm3(q + vec3(3.1, 0.0, t * 0.7)), fbm3(q + vec3(7.7, 0.0, -t * 0.7)), 0.0);
  float nb = fbm3(q + 1.4 * w);
  float dens = smoothstep(${f(ORION.cobertura)}, ${f(ORION.cobertura + 0.5)}, nb);
  // grão de poeira cósmica por dentro da nuvem (anda junto com ela)
  float grao = snoise(q * 16.0 + 3.0) * 0.5 + snoise(q * 34.0) * 0.5;
  float neb = dens * (1.0 - ${f(ORION.grao)} + ${f(ORION.grao)} * (0.5 + 0.5 * grao));
  // cor do fogo pela intensidade: vermelho -> laranja -> amarelo quase branco
  vec3 fogo = mix(lin(vec3(0.85, 0.08, 0.06)), lin(vec3(1.0, 0.4, 0.08)), smoothstep(0.25, 0.6, neb));
  fogo = mix(fogo, lin(vec3(1.0, 0.85, 0.55)), smoothstep(0.65, 0.95, neb));
  vec3 brilho = fogo * pow(neb, 1.6) * ${f(ORION.brilho)};
  c = mix(c, fogo * 0.3, dens * 0.5); // a nuvem tinge o vidro por baixo

  // nuvens violeta: um segundo campo, menor, que ocupa o que o fogo deixa livre
  float vn = fbm3(q * 1.35 + vec3(11.0, 5.0, -t) + 0.8 * w);
  float vio = smoothstep(${f(ORION.violetaCobertura)}, ${f(ORION.violetaCobertura + 0.45)}, vn) * (1.0 - dens * 0.7);
  float grao2 = snoise(q * 22.0 + 9.0) * 0.5 + snoise(q * 45.0 + 4.0) * 0.5;
  float vioG = vio * (1.0 - ${f(ORION.grao)} + ${f(ORION.grao)} * (0.5 + 0.5 * grao2));
  vec3 violeta = mix(lin(vec3(0.42, 0.1, 0.85)), lin(vec3(0.78, 0.55, 1.0)), smoothstep(0.5, 0.9, vioG));
  brilho += violeta * pow(vioG, 1.4) * ${f(ORION.violeta)};
  c = mix(c, violeta * 0.2, vio * 0.4);
  // brilho próprio do vidro: a camo continua visível mesmo no escuro
  brilho += c * ${f(ORION.autoBrilho)};

  // cor das estrelas puxada da paleta do lugar onde estão: rosa no vidro claro,
  // pêssego/dourado dentro do fogo; no vidro escuro ficam claras (senão somem)
  vec3 corVidro = lin(vec3(1.0, 0.62, 0.74));
  vec3 corFogo = mix(lin(vec3(1.0, 0.6, 0.45)), lin(vec3(1.0, 0.88, 0.7)), smoothstep(0.4, 0.9, neb));
  vec3 corLocal = mix(corVidro, corFogo, smoothstep(0.1, 0.5, dens));
  corLocal = mix(corLocal, lin(vec3(0.85, 0.7, 1.0)), smoothstep(0.1, 0.5, vio) * (1.0 - dens)); // lilás nas nuvens violeta
  vec3 corEst = mix(corLocal, lin(vec3(1.0, 0.9, 0.95)), (1.0 - claro) * (1.0 - dens));

  // poeira de estrelas: muitas e pequenas (mais densas na nuvem), indo junto com a camo
  vec2 uv = plano(p + corre * 0.4, n);
  float hs;
  vec2 v;
  float fina = estrela(uv, ${f(ORION.poeira.celulas)}, ${f(ORION.poeira.limiar)} - dens * 0.2, ${f(ORION.poeira.raio)}, hs, v);
  float pisca = 0.35 + 0.65 * pow(0.5 + 0.5 * sin(uTempo * (${f(ORION.cintila)} + hs * 4.0) + hs * 60.0), 2.0);
  brilho += corEst * fina * pisca * ${f(ORION.poeira.forca)} * (0.5 + hs);
  // estrelas maiores, na mesma paleta (umas poucas puxando para o lilás)
  float media = estrela(uv + 0.37, ${f(ORION.medias.celulas)}, ${f(ORION.medias.limiar)}, ${f(ORION.medias.raio)}, hs, v);
  float pisca2 = 0.5 + 0.5 * sin(uTempo * (1.4 + hs * 2.0) + hs * 30.0);
  vec3 corMedia = mix(corEst, lin(vec3(0.85, 0.7, 1.0)), step(0.95, hs) * 0.6);
  brilho += corMedia * media * (0.4 + 0.6 * pisca2) * ${f(ORION.medias.forca)};
  return Camo(c, ${f(ORION.metal)}, ${f(ORION.rugosidade)}, brilho, ZERO);
}

Camo camoMaestria(float id, vec3 p, vec3 n) {
  if (id < 4.5) return camoMercurial(p, n);
  if (id < 5.5) return camoPolyatomic(p, n);
  return camoOrion(p, n);
}
float vernizMaestria(float id) {
  if (id < 4.5) return ${f(VERNIZ_MAESTRIA[0])};
  if (id < 5.5) return ${f(VERNIZ_MAESTRIA[1])};
  return ${f(VERNIZ_MAESTRIA[2])};
}
float irisMaestria(float id) {
  if (id < 4.5) return ${f(IRIS_MAESTRIA[0])};
  if (id < 5.5) return ${f(IRIS_MAESTRIA[1])};
  return ${f(IRIS_MAESTRIA[2])};
}
`;
