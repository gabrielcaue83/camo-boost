// Fundo de topografia militar, vivo (WebGL puro, sem Three.js).
// Curvas de nível que andam devagar, curva-mestra a cada 5 linhas (como nas
// cartas militares), grade de coordenadas com cruzetas, um pulso de radar
// amarelo saindo do centro e o mouse acendendo as curvas em amarelo.
// Sem WebGL: desenha a versão parada num canvas 2D.

export const TOPO = {
  zoom: 900, // px: tamanho de um "morro" (maior = curvas maiores, menos linhas)
  niveis: 9, // linhas por morro (mais = mapa mais denso)
  mestra: 5, // a cada quantas linhas vem a curva-mestra (mais grossa)
  detalhe: 0.18, // quanto entra de ondulação miúda (0 = curvas bem lisas)
  velocidade: 0.05, // quão rápido o relevo anda e muda
  linha: 0.14, // opacidade das curvas comuns
  linhaMestra: 0.3, // opacidade das curvas-mestras
  grade: 150, // px entre as linhas da grade de coordenadas
  gradeAlfa: 0.05, // opacidade da grade
  cruzeta: 0.22, // opacidade das cruzetas (+) nos cruzamentos da grade
  pulso: { periodo: 5.5, largura: 140, forca: 0.85 }, // radar: s entre pulsos, px de espessura, brilho
  mouse: { raio: 260, forca: 1 }, // px do brilho amarelo em volta do mouse
  dpr: 1.5, // limite de resolução (canvas de tela inteira)
};

export const CORES = {
  linha: '#e9e9e4', // curvas comuns (branco quente)
  amarelo: '#ffd100', // pulso e mouse
};

export const NOISE = /* glsl */ `
// Simplex 3D (Ashima Arts / Stefan Gustavson, licença MIT)
vec4 permute(vec4 x){ return mod(((x*34.0)+1.0)*x, 289.0); }
vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + 2.0 * C.xxx;
  vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
  i = mod(i, 289.0);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 1.0/7.0;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}`;

const f = (v) => Number(v).toFixed(4);
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);

const FRAG = /* glsl */ `
#extension GL_OES_standard_derivatives : enable
precision highp float;
uniform float uTempo, uDpr, uEntrada, uFase, uLuz, uIris, uForca;
uniform vec3 uCorLinha, uCorDestaque; // cores (sRGB cru, iguais ao CSS)
// emenda com a seção de cima: o mapa continua do mesmo ponto (uOrigemY) e, numa
// faixa de altura uEmenda no topo, cor e força vêm das da seção de cima
uniform float uOrigemY, uEmenda, uForcaTopo;
uniform vec3 uCorTopo, uDestaqueTopo;
// cortina de cor: do lado do corte (uCortina, px CSS) as cores já são as novas.
// uCortinaLado: 1 = as novas entram pela esquerda, -1 = pela direita, 0 = parada
uniform vec3 uCorNova, uLinhaNova;
uniform float uCortina, uCortinaLado, uCortinaInclina; // inclina: px de deslocamento por px de altura ("/")
uniform vec2 uTela, uMouse, uDesloc; // px CSS, y para baixo
${NOISE}

float traco(float v, float largura) {
  float d = abs(fract(v + 0.5) - 0.5);
  float w = fwidth(v) * largura;
  return 1.0 - smoothstep(w * 0.5, w * 1.5, d);
}

void main() {
  vec2 px = vec2(gl_FragCoord.x, uTela.y * uDpr - gl_FragCoord.y) / uDpr; // px CSS, y para baixo
  vec2 mapa = px + vec2(0.0, uOrigemY) - uDesloc; // posição na PÁGINA (seções emendam) + parallax
  vec2 p = mapa / ${f(TOPO.zoom)};
  float t = uTempo * ${f(TOPO.velocidade)};

  // relevo
  float n = snoise(vec3(p + vec2(t * 0.5, t * 0.15), t)) * (1.0 - ${f(TOPO.detalhe)})
          + snoise(vec3(p * 2.3 + 7.0, t * 1.4)) * ${f(TOPO.detalhe)};
  float v = n * ${f(TOPO.niveis)};
  float comum = traco(v, 1.0);
  float mestra = traco(v / ${f(TOPO.mestra)}, 2.2);   // a cada N linhas, uma mais grossa
  float curvas = max(comum * ${f(TOPO.linha)}, mestra * ${f(TOPO.linhaMestra)});

  // grade de coordenadas + cruzetas
  vec2 g = mapa / ${f(TOPO.grade)};
  vec2 dg = abs(fract(g + 0.5) - 0.5) * ${f(TOPO.grade)};   // px até a linha mais próxima
  float grade = (1.0 - smoothstep(0.0, 1.0, min(dg.x, dg.y))) * ${f(TOPO.gradeAlfa)};
  float cruz = (1.0 - smoothstep(0.0, 1.0, min(dg.x, dg.y))) * step(max(dg.x, dg.y), 6.0) * ${f(TOPO.cruzeta)};

  // pulso de radar saindo do centro
  vec2 centro = uTela * 0.5;
  float dist = length(px - centro);
  float raioMax = length(uTela) * 0.6;
  float anel = exp(-pow((dist - uFase * raioMax) / ${f(TOPO.pulso.largura)}, 2.0)) * (1.0 - uFase) * ${f(TOPO.pulso.forca)};
  anel *= smoothstep(0.0, uTela.y * 0.25, px.y) * smoothstep(uTela.y, uTela.y * 0.75, px.y); // some perto das bordas: não corta na emenda

  // brilho do mouse
  float luz = exp(-pow(length(px - uMouse) / ${f(TOPO.mouse.raio)}, 2.0)) * uLuz * ${f(TOPO.mouse.forca)};

  float amarelo = clamp(anel + luz, 0.0, 1.0);
  float linhas = max(comum, mestra);
  float a = curvas + linhas * amarelo * 0.55 + grade + cruz;

  // entrada: o mapa se desenha do centro para fora
  float revela = smoothstep(0.0, 160.0, uEntrada * raioMax * 1.3 - dist);
  a *= revela;

  // destaque: cor fixa ou arco-íris (uIris = 1) que corre pelo mapa
  vec3 arco = clamp(abs(fract(n * 1.5 + uTempo * 0.04 + px.x / uTela.x * 0.5 + vec3(0.0, 2.0, 1.0) / 3.0) * 6.0 - 3.0) - 1.0, 0.0, 1.0);
  // borda esfumaçada (névoa), não um corte seco
  float diag = px.x + (px.y - uTela.y * 0.5) * uCortinaInclina; // posição medida perpendicular à reta inclinada
  float fumo = smoothstep(uCortina - 140.0, uCortina + 140.0, diag);
  float nova = uCortinaLado > 0.5 ? 1.0 - fumo : (uCortinaLado < -0.5 ? fumo : 0.0);
  vec3 corDestaque = mix(uCorDestaque, uCorNova, nova);
  vec3 corLinha = mix(uCorLinha, uLinhaNova, nova);
  vec3 destaque = mix(corDestaque, mix(vec3(1.0), arco, 0.75), uIris);
  float k = uEmenda > 0.5 ? smoothstep(0.0, uEmenda, px.y) : 1.0; // 0 no topo (cores da seção de cima) → 1
  vec3 cor = mix(mix(uCorTopo, corLinha, k), mix(uDestaqueTopo, destaque, k), clamp(amarelo * 1.4 * linhas, 0.0, 1.0));
  a *= mix(uForcaTopo, uForca, k);
  gl_FragColor = vec4(cor * a, a);
}`;

const VERT = 'attribute vec2 pos; void main(){ gl_Position = vec4(pos, 0.0, 1.0); }';

function compilar(gl, tipo, fonte) {
  const s = gl.createShader(tipo);
  gl.shaderSource(s, fonte);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}

export function criarTopo(canvas, { forca = 1 } = {}) {
  const gl = canvas.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: true, powerPreference: 'low-power' });
  // se o WebGL falhar depois de criado, o canvas não aceita mais contexto 2D: troca por um novo
  const planoB = () => { const novo = canvas.cloneNode(); canvas.replaceWith(novo); return desenharTopoParado(novo); };
  if (!gl) return desenharTopoParado(canvas);
  if (!gl.getExtension('OES_standard_derivatives')) return planoB();

  let prog;
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, compilar(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compilar(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  } catch (e) {
    console.warn('[topo] sem shader, usando versão parada', e);
    return planoB();
  }
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'pos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const U = {};
  for (const nome of ['uTempo', 'uDpr', 'uEntrada', 'uFase', 'uLuz', 'uTela', 'uMouse', 'uDesloc', 'uIris', 'uForca', 'uCorLinha', 'uCorDestaque', 'uOrigemY', 'uEmenda', 'uForcaTopo', 'uCorTopo', 'uDestaqueTopo', 'uCorNova', 'uLinhaNova', 'uCortina', 'uCortinaLado', 'uCortinaInclina']) U[nome] = gl.getUniformLocation(prog, nome);

  const dpr = Math.min(window.devicePixelRatio || 1, TOPO.dpr);
  let w = 0, h = 0;
  const medir = () => {
    w = canvas.clientWidth || innerWidth;
    h = canvas.clientHeight || innerHeight;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    gl.viewport(0, 0, canvas.width, canvas.height);
  };
  medir();
  addEventListener('resize', medir);

  // estado que o hero.js controla (o GSAP anima "entrada" e "luz" direto)
  // cores em 0..1 (sRGB); o GSAP pode animar cada canal direto (ex.: troca de camo)
  const estado = {
    entrada: 0, luz: 0, mouseX: innerWidth / 2, mouseY: innerHeight / 2, deslocX: 0, deslocY: 0,
    linha: rgb(CORES.linha), destaque: rgb(CORES.amarelo), iris: 0, forca,
    // emenda com a seção de cima (desligada = 0)
    origemY: 0, emenda: 0, corTopo: rgb(CORES.linha), destaqueTopo: rgb(CORES.amarelo), forcaTopo: 1,
    // cortina de cor (troca de camo na hero): cores novas e onde está o corte
    corNova: rgb(CORES.amarelo), linhaNova: rgb(CORES.linha), cortina: 0, cortinaLado: 0, cortinaInclina: 0,
  };
  const parado = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let visivel = true;
  new IntersectionObserver(([e]) => { visivel = e.isIntersecting; }).observe(canvas);

  const quadro = () => {
    if (!visivel) return;
    if (canvas.clientWidth !== w || canvas.clientHeight !== h) medir();
    const s = parado ? 12 : performance.now() / 1000;
    gl.uniform1f(U.uTempo, s);
    gl.uniform1f(U.uDpr, dpr);
    gl.uniform1f(U.uEntrada, estado.entrada);
    gl.uniform1f(U.uFase, parado ? 1 : (s % TOPO.pulso.periodo) / TOPO.pulso.periodo);
    gl.uniform1f(U.uLuz, estado.luz);
    gl.uniform2f(U.uTela, w, h);
    gl.uniform2f(U.uMouse, estado.mouseX, estado.mouseY);
    gl.uniform2f(U.uDesloc, estado.deslocX, estado.deslocY);
    gl.uniform1f(U.uIris, estado.iris);
    gl.uniform1f(U.uForca, estado.forca);
    gl.uniform3fv(U.uCorLinha, estado.linha);
    gl.uniform3fv(U.uCorDestaque, estado.destaque);
    gl.uniform1f(U.uOrigemY, estado.origemY);
    gl.uniform1f(U.uEmenda, estado.emenda);
    gl.uniform1f(U.uForcaTopo, estado.forcaTopo);
    gl.uniform3fv(U.uCorTopo, estado.corTopo);
    gl.uniform3fv(U.uDestaqueTopo, estado.destaqueTopo);
    gl.uniform3fv(U.uCorNova, estado.corNova);
    gl.uniform3fv(U.uLinhaNova, estado.linhaNova);
    gl.uniform1f(U.uCortina, estado.cortina);
    gl.uniform1f(U.uCortinaLado, estado.cortinaLado);
    gl.uniform1f(U.uCortinaInclina, estado.cortinaInclina);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  return { estado, quadro, webgl: true };
}

// ---------------------------------------------------------------------------
// Plano B (sem WebGL): curvas paradas com marching squares num canvas 2D.

function ruido2D(semente = 7) {
  const hash = (x, y) => {
    let h = x * 374761393 + y * 668265263 + semente * 982451653;
    h = (h ^ (h >> 13)) * 1274126177;
    return ((h ^ (h >> 16)) >>> 0) / 4294967295;
  };
  const suave = (t) => t * t * (3 - 2 * t);
  const valor = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = suave(x - xi), yf = suave(y - yi);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };
  return (x, y) => valor(x, y) * 0.7 + valor(x * 2.1 + 9, y * 2.1 + 3) * 0.3;
}

function desenharTopoParado(canvas) {
  const n = ruido2D();
  const desenhar = () => {
    const w = innerWidth, h = innerHeight;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const g = canvas.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.strokeStyle = 'rgba(233,233,228,0.14)';
    g.lineWidth = 1;
    const passo = 8, freq = 0.0028, niveis = 14;
    const cols = Math.ceil(w / passo) + 1, lins = Math.ceil(h / passo) + 1;
    const campo = new Float32Array(cols * lins);
    for (let j = 0; j < lins; j++) for (let i = 0; i < cols; i++) campo[j * cols + i] = n(i * passo * freq, j * passo * freq);
    const v = (i, j) => campo[j * cols + i];
    const lerp = (a, b, t) => (t - a) / (b - a);
    g.beginPath();
    for (let l = 1; l < niveis; l++) {
      const t = 0.1 + (l / niveis) * 0.8;
      for (let j = 0; j < lins - 1; j++) for (let i = 0; i < cols - 1; i++) {
        const a = v(i, j), b = v(i + 1, j), c = v(i + 1, j + 1), d = v(i, j + 1);
        const caso = (a > t) | ((b > t) << 1) | ((c > t) << 2) | ((d > t) << 3);
        if (caso === 0 || caso === 15) continue;
        const x = i * passo, y = j * passo;
        const top = [x + lerp(a, b, t) * passo, y], dir = [x + passo, y + lerp(b, c, t) * passo];
        const bai = [x + lerp(d, c, t) * passo, y + passo], esq = [x, y + lerp(a, d, t) * passo];
        const seg = (p, q) => { g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); };
        switch (caso) {
          case 1: case 14: seg(esq, top); break;
          case 2: case 13: seg(top, dir); break;
          case 3: case 12: seg(esq, dir); break;
          case 4: case 11: seg(dir, bai); break;
          case 5: seg(esq, top); seg(dir, bai); break;
          case 6: case 9: seg(top, bai); break;
          case 7: case 8: seg(esq, bai); break;
          case 10: seg(top, dir); seg(esq, bai); break;
        }
      }
    }
    g.stroke();
  };
  desenhar();
  let t;
  addEventListener('resize', () => { clearTimeout(t); t = setTimeout(desenhar, 150); });
  return { estado: { entrada: 1, luz: 0, mouseX: 0, mouseY: 0, deslocX: 0, deslocY: 0, linha: rgb(CORES.linha), destaque: rgb(CORES.amarelo), iris: 0, forca: 1 }, quadro: () => {}, webgl: false };
}
