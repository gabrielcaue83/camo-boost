# 006 — Céu da Orion mais leve por quadro

- **Status**: DONE (26/11/2026)
- **Commit**: a035f5d + mudanças locais não commitadas (redesenho da Maestria de 26/11/2026)
- **Severity**: LOW
- **Category**: Performance
- **Estimated scope**: 1 arquivo (`src/arma/ambientes.js`), ~25 linhas

## Problem

Com a Orion escolhida, `desenharCeu(t)` roda todo quadro (junto com o WebGL da arma e o brilho copiado do canvas). Três desperdícios:

1. `getComputedStyle(secao)` é chamado duas vezes por quadro só para ler `--mx`/`--my`, forçando recálculo de estilo:
   ```js
   /* src/arma/ambientes.js:165–166 — atual */
       const mx = parseFloat(getComputedStyle(secao).getPropertyValue('--mx')) / 100 || 0.44;
       const my = parseFloat(getComputedStyle(secao).getPropertyValue('--my')) / 100 || 0.47;
   ```
   Esses valores só mudam quando a tela muda de tamanho (media query de celular).
2. As 420 estrelas são desenhadas com `beginPath` + `arc` + `fill` cada uma, inclusive as minúsculas (raio < 1 px), onde um quadrado é indistinguível de um círculo:
   ```js
   /* src/arma/ambientes.js:157–162 — atual */
       fundoEstrelas.forEach((s) => {
         const a = (0.45 + 0.55 * Math.sin(t * s.v + s.f) ** 2) * (1 - apagaEm(s.x, s.y, t) * 0.92);
         cctx.globalAlpha = a * 0.9;
         cctx.fillStyle = '#fff';
         cctx.beginPath(); cctx.arc(s.x * w, s.y * h, s.r, 0, 6.2832); cctx.fill();
       });
   ```
3. `apagaEm(x, y, t)` sorteia uma posição nova para a mancha do apagão **dentro** da função, que é chamada uma vez por estrela. Na janela em que `ciclo < 0.02`, a mancha é re-sorteada centenas de vezes no mesmo quadro:
   ```js
   /* src/arma/ambientes.js — atual, dentro de apagaEm */
       manchas.forEach((m) => {
         const ciclo = (t / CEU.apagao.ciclo + m.fase) % 1;
         if (ciclo < 0.02) { m.x = 0.15 + 0.7 * Math.random(); m.y = 0.15 + 0.7 * Math.random(); } // nova mancha em outro lugar
   ```

## Target

- `--mx`/`--my` lidos uma vez e de novo só no `resize`.
- Estrelas pequenas (`s.r < 1`) desenhadas com `fillRect`; `fillStyle = '#fff'` definido uma vez antes do laço.
- Sorteio da mancha feito uma vez por quadro, numa função própria chamada no começo de `desenharCeu`; `apagaEm` passa a só ler.

```js
/* target — trechos */
  // centro da arma na tela (muda só com a media query de celular)
  let mx = 0.44, my = 0.47;
  const medirCentro = () => {
    const cs = getComputedStyle(secao);
    mx = parseFloat(cs.getPropertyValue('--mx')) / 100 || 0.44;
    my = parseFloat(cs.getPropertyValue('--my')) / 100 || 0.47;
  };
  medirCentro();
  addEventListener('resize', medirCentro);

  // a mancha muda de lugar uma vez, no começo de cada ciclo
  const moverManchas = (t) => {
    manchas.forEach((m) => {
      const volta = Math.floor(t / CEU.apagao.ciclo + m.fase);
      if (volta !== m.volta) { m.volta = volta; m.x = 0.15 + 0.7 * Math.random(); m.y = 0.15 + 0.7 * Math.random(); }
    });
  };
  const apagaEm = (x, y, t) => {
    let a = 0;
    manchas.forEach((m) => {
      const ciclo = (t / CEU.apagao.ciclo + m.fase) % 1;
      const env = lim(ciclo / 0.4) * (1 - lim((ciclo - 0.7) / 0.28));
      const d = Math.hypot(x - m.x, (y - m.y) * 0.8) / CEU.apagao.raio;
      a = Math.max(a, env * (1 - lim((d - 0.35) / 0.65)));
    });
    return a;
  };

  /* dentro de desenharCeu, logo após cctx.fillRect da Via Láctea */
    moverManchas(t);
    cctx.fillStyle = '#fff';
    fundoEstrelas.forEach((s) => {
      const a = (0.45 + 0.55 * Math.sin(t * s.v + s.f) ** 2) * (1 - apagaEm(s.x, s.y, t) * 0.92);
      cctx.globalAlpha = a * 0.9;
      const x = s.x * w, y = s.y * h;
      if (s.r < 1) cctx.fillRect(x - s.r, y - s.r, s.r * 2, s.r * 2);
      else { cctx.beginPath(); cctx.arc(x, y, s.r, 0, 6.2832); cctx.fill(); }
    });
```

## Repo conventions to follow

- Configs em `CEU` no topo do arquivo; não mude os valores (`estrelas: 420`, `apagao.ciclo: 13`...).
- `lim` já existe no arquivo (`const lim = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));`).

## Steps

1. Em `src/arma/ambientes.js`, logo antes de `function desenharCeu(t) {`, adicione `medirCentro` (e sua chamada + listener) e `moverManchas` do trecho "target".
2. Substitua a função `apagaEm` existente pela versão "target" (sem o `if (ciclo < 0.02)`).
3. Dentro de `desenharCeu`: apague as duas linhas `const mx = ...` / `const my = ...` (agora vêm do escopo de fora), e substitua o laço `fundoEstrelas.forEach(...)` pela versão "target" (com `moverManchas(t);` e `cctx.fillStyle = '#fff';` antes dele).
4. Se o plano 005 já tiver sido executado, mantenha a variável `tc` dele dentro do `Math.sin` (use `tc` em vez de `t` nessa linha).

## Boundaries

- NÃO mude o visual (quantidade de estrelas, cores, constelação, apagão).
- NÃO mexa em `quadro`, no brilho (`brilho`/`bctx`) nem em `mudar`.
- Se o código não bater com os trechos acima, PARE e reporte.

## Verification

- **Mechanical**: `npm run build` termina com "✓ built". `grep -n "getComputedStyle" src/arma/ambientes.js` mostra só a ocorrência dentro de `medirCentro`.
- **Feel check**: abra a Maestria, escolha a Orion:
  - o céu fica igual (estrelas, constelação, apagões passando);
  - redimensione a janela entre desktop e celular: a constelação continua centrada atrás da arma;
  - DevTools → Performance, 3 s na Orion: o tempo de script por quadro cai e não aparece "Recalculate Style" a cada quadro vindo de `desenharCeu`.
- **Done when**: nenhum `getComputedStyle` por quadro e o sorteio da mancha acontece no máximo uma vez por ciclo.
