import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// "Como funciona" como um briefing de operação: uma rota tracejada atravessa a
// tela e se desenha com a rolagem (seção presa); um marcador anda na ponta e,
// a cada ponto de passagem, acende o losango e abre o cartão da fase.
// No celular vira uma lista vertical que entra conforme aparece.

// ⚠ PROVISÓRIO: textos de exemplo. Troque pelos do seu serviço.
export const FASES = [
  { titulo: 'Escolha', texto: 'Escolha a arma e a camo: Ouro, Platina, Harmonic Break ou Divergência.' },
  { titulo: 'Pagamento', texto: 'Pague com Pix ou cartão. Na hora, um booster é designado para o seu pedido.' },
  { titulo: 'Boost', texto: 'Um booster experiente joga na sua conta até liberar a camo, sem você perder horas.' },
  { titulo: 'Entrega', texto: 'Acompanhe o progresso e receba a conta com a camo liberada.' },
];

export const ROTA = {
  telas: 2.6, // quanto de rolagem (em alturas de tela) a seção fica presa
  // pontos de passagem (viewBox 1600×900); a rota passa por eles
  pontos: [[210, 600], [610, 730], [1010, 570], [1400, 720]],
  inicio: [-40, 640], // de onde a rota vem (fora da tela)
  fim: [1660, 590], // para onde ela vai
  cartaoAcima: [true, true, true, true], // cartão acima ou abaixo do ponto (acima deixa o título livre)
};

const reduzir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const pad = (n) => String(n).padStart(2, '0');

// curva suave passando por todos os pontos (Catmull-Rom → Bézier)
function caminho(pts) {
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0]} ${p2[1]}`;
  }
  return d;
}

export function iniciarComoFunciona(secao) {
  const R = ROTA;
  const todos = [R.inicio, ...R.pontos, R.fim];
  const palco = secao.querySelector('.missao__palco');

  // --- monta rota, pontos e cartões
  palco.innerHTML = `
    <svg class="missao__rota missao__rota--fundo" viewBox="0 0 1600 900" preserveAspectRatio="none" aria-hidden="true">
      <path d="${caminho(todos)}" />
    </svg>
    <svg class="missao__rota missao__rota--traco" viewBox="0 0 1600 900" preserveAspectRatio="none" aria-hidden="true">
      <path class="missao__rota-traco" d="${caminho(todos)}" />
    </svg>
    <span class="missao__marcador" aria-hidden="true"></span>
    <ol class="missao__fases">
      ${FASES.map((f, i) => {
        const [x, y] = R.pontos[i];
        return `
        <li class="missao__fase ${R.cartaoAcima[i] ? 'acima' : 'abaixo'}" style="--x:${(x / 16).toFixed(2)}%; --y:${(y / 9).toFixed(2)}%">
          <span class="missao__ponto" aria-hidden="true"><span></span></span>
          <div class="missao__cartao">
            <span class="missao__num">Fase ${pad(i + 1)}</span>
            <h3>${f.titulo}</h3>
            <p>${f.texto}</p>
          </div>
        </li>`;
      }).join('')}
    </ol>`;

  const svg = palco.querySelector('.missao__rota--traco');
  const traco = palco.querySelector('.missao__rota-traco');
  const marcador = palco.querySelector('.missao__marcador');
  const fases = [...palco.querySelectorAll('.missao__fase')];

  // amostras da rota para achar o Y em qualquer X (o marcador segue a curva)
  const total = traco.getTotalLength();
  const amostras = Array.from({ length: 240 }, (_, k) => traco.getPointAtLength((k / 239) * total));
  const yEm = (x) => {
    for (let k = 1; k < amostras.length; k++) {
      if (amostras[k].x >= x) {
        const a = amostras[k - 1], b = amostras[k];
        return a.y + ((x - a.x) / Math.max(1e-3, b.x - a.x)) * (b.y - a.y);
      }
    }
    return amostras[amostras.length - 1].y;
  };

  const mm = gsap.matchMedia();

  // --- tela grande: seção presa, rota desenhada pela rolagem
  mm.add('(min-width: 861px)', () => {
    const xs = R.pontos.map((p) => p[0]);
    const xInicio = 0, xFim = 1600;
    const estado = { x: xInicio };
    let ativos = -1;

    const aplicar = () => {
      const x = estado.x;
      const pct = ((x - xInicio) / (xFim - xInicio)) * 100;
      svg.style.clipPath = `inset(0 ${(100 - pct).toFixed(2)}% 0 0)`;
      marcador.style.left = `${(x / 16).toFixed(2)}%`;
      marcador.style.top = `${(yEm(x) / 9).toFixed(2)}%`;
      const n = xs.filter((px) => x >= px).length - 1;
      if (n !== ativos) {
        fases.forEach((f, i) => {
          const liga = i <= n;
          if (liga === f.classList.contains('ativa')) return;
          f.classList.toggle('ativa', liga);
          const c = f.querySelector('.missao__cartao');
          const p = f.querySelector('.missao__ponto');
          gsap.to(p, { scale: liga ? 1 : 0.5, duration: 0.5, ease: liga ? 'back.out(3)' : 'power2.out', overwrite: true });
          gsap.to(c, {
            clipPath: liga ? 'inset(0% 0% 0% 0%)' : (f.classList.contains('acima') ? 'inset(100% 0% 0% 0%)' : 'inset(0% 0% 100% 0%)'),
            y: liga ? 0 : (f.classList.contains('acima') ? 14 : -14),
            opacity: liga ? 1 : 0,
            duration: liga ? 0.7 : 0.35, ease: liga ? 'expo.out' : 'power2.in', overwrite: true,
          });
        });
        ativos = n;
      }
    };

    // estado inicial dos cartões (fechados)
    fases.forEach((f) => {
      gsap.set(f.querySelector('.missao__cartao'), {
        clipPath: f.classList.contains('acima') ? 'inset(100% 0% 0% 0%)' : 'inset(0% 0% 100% 0%)',
        y: f.classList.contains('acima') ? 14 : -14, opacity: 0,
      });
      gsap.set(f.querySelector('.missao__ponto'), { scale: 0.5 });
    });
    aplicar();

    const tween = gsap.to(estado, {
      x: xFim, ease: 'none', onUpdate: aplicar,
      scrollTrigger: {
        trigger: secao, start: 'top top', end: () => `+=${innerHeight * R.telas}`,
        pin: true, scrub: reduzir ? true : 0.8,
      },
    });
    return () => { tween.scrollTrigger?.kill(); tween.kill(); svg.style.clipPath = ''; };
  });

  // --- celular: lista vertical, cada cartão entra quando aparece
  mm.add('(max-width: 860px)', () => {
    fases.forEach((f) => {
      f.classList.add('ativa');
      gsap.set(f.querySelector('.missao__cartao'), { clipPath: 'none', opacity: 1, y: 0 });
      gsap.set(f.querySelector('.missao__ponto'), { scale: 1 });
    });
    const tws = fases.map((f) => gsap.from(f, {
      x: -24, opacity: 0, duration: 0.8, ease: 'expo.out',
      scrollTrigger: { trigger: f, start: 'top 85%', toggleActions: 'play none none reverse' },
    }));
    return () => tws.forEach((t) => { t.scrollTrigger?.kill(); t.kill(); });
  });

  // título: palavras sobem quando a seção chega
  if (!reduzir) {
    gsap.from(secao.querySelectorAll('.missao__titulo > span > span, .missao__rotulo'), {
      yPercent: 110, duration: 1.1, ease: 'expo.out', stagger: 0.08,
      scrollTrigger: { trigger: secao, start: 'top 70%' },
    });
  }
}
