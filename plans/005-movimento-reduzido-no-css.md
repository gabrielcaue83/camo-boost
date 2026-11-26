# 005 — Respeitar "reduzir movimento" nos loops do CSS e no céu da Orion

- **Status**: DONE (26/11/2026)
- **Commit**: a035f5d + mudanças locais não commitadas (redesenho da Maestria de 26/11/2026)
- **Severity**: MEDIUM
- **Category**: Accessibility
- **Estimated scope**: 2 arquivos, ~20 linhas

## Problem

O JavaScript já respeita `prefers-reduced-motion` (variável `reduzir` em `vitrine.js`, `maestria.js`, `mestria.js`, `ambientes.js`). Mas o `src/style.css` não tem NENHUMA regra `@media (prefers-reduced-motion: reduce)`. Para quem pediu menos movimento, estes loops infinitos continuam rodando:

```css
/* src/style.css — atual */
244: .trilha__item--maestria.pronta .trilha__amostra { animation: pulsoCadeado 1.6s ease-in-out infinite; }
493:   filter: blur(14px); opacity: calc(0.3 + var(--carga, 0) * 0.7); animation: seloGiro 4s linear infinite;      /* .selo__brilho */
497: .selo__marcas { transform-origin: 60px 60px; animation: seloMarcas 30s linear infinite; }
521:   animation: prisma 5s linear infinite;                                                                       /* .selo__textos b */
555:   animation: prisma 6s linear infinite;                                                                       /* .maestria__titulo > span:last-child > span */
575: .mficha .botao--amarelo { background: var(--prisma); background-size: 220% 100%; animation: prisma 6s linear infinite; }
588:   filter: blur(70px); mix-blend-mode: screen; opacity: 0.45; animation: escorre var(--d) linear infinite;     /* .amb--mercurial i */
597:   position: absolute; inset: -30% 0; animation: filetes 10s linear infinite;                                  /* .amb__filetes */
608:   animation: flutua var(--d) ease-in-out var(--a) infinite alternate;                                         /* .amb--polyatomic i */
```

Também: o selo entra subindo 18px (`.selo { transform: translateY(18px); transition: ... transform 0.7s ... }`), o selo balança em `.selo.chamando .selo__emblema { animation: chamarSelo 0.8s ease-out; }`, e no céu da Orion (`src/arma/ambientes.js`, função `desenharCeu`) as 420 estrelas cintilam a cada quadro:

```js
/* src/arma/ambientes.js — atual, dentro de desenharCeu */
    fundoEstrelas.forEach((s) => {
      const a = (0.45 + 0.55 * Math.sin(t * s.v + s.f) ** 2) * (1 - apagaEm(s.x, s.y, t) * 0.92);
```

Movimento reduzido significa menos e mais suave, **não zero**: manter as trocas de opacidade e cor (elas ajudam a entender o estado), tirar deslocamentos, giros e loops.

## Target

```css
/* target — novo bloco no FIM do bloco de ambientes em src/style.css */
@media (prefers-reduced-motion: reduce) {
  /* sem loops nem deslocamento; ficam só as trocas de opacidade e cor */
  .trilha__item--maestria.pronta .trilha__amostra,
  .selo__brilho, .selo__marcas, .selo__textos b,
  .maestria__titulo > span:last-child > span, .mficha .botao--amarelo,
  .amb--mercurial i, .amb__filetes, .amb--polyatomic i,
  .selo.chamando .selo__emblema { animation: none; }
  .selo { transform: none; transition: opacity 0.3s ease, visibility 0.3s; }
}
```

```js
/* target — ambientes.js, dentro de desenharCeu: estrelas paradas com movimento reduzido */
    const tc = reduzir ? 0 : t; // movimento reduzido: as estrelas não cintilam
    fundoEstrelas.forEach((s) => {
      const a = (0.45 + 0.55 * Math.sin(tc * s.v + s.f) ** 2) * (1 - apagaEm(s.x, s.y, t) * 0.92);
```

(O apagão continua usando `t`: é uma troca lenta de brilho, que ajuda a ler o efeito da camo.)

## Repo conventions to follow

- `reduzir` já está declarado no topo de `src/arma/ambientes.js`: `const reduzir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;`.
- Comentários de bloco no CSS em português, no estilo `/* Orion: céu noturno (canvas) */`.

## Steps

1. Em `src/style.css`, logo depois da regra `.amb--orion canvas { ... }` e do bloco `@media (max-width: 860px) { /* celular: o selo fica no vão ... */ }` que vem a seguir, cole o bloco CSS "target".
2. Em `src/arma/ambientes.js`, dentro de `desenharCeu`, imediatamente antes de `fundoEstrelas.forEach((s) => {`, adicione `const tc = reduzir ? 0 : t;` e troque `Math.sin(t * s.v + s.f)` por `Math.sin(tc * s.v + s.f)` nessa linha.

## Boundaries

- NÃO remova as transições de opacidade/cor existentes (`.amb { transition: opacity 1.4s ... }`, `.selo` opacity).
- NÃO toque nas regras de hero/preloader/loja (fora do escopo desta auditoria).
- Se as linhas não baterem com os trechos acima, PARE e reporte.

## Verification

- **Mechanical**: `npm run build` termina com "✓ built". `grep -n "prefers-reduced-motion" src/style.css` mostra o bloco novo.
- **Feel check**: no DevTools → Rendering → "Emulate CSS media feature prefers-reduced-motion: reduce", recarregue:
  - na Divergência, o selo aparece por fade (sem subir), sem luz girando nem marcas rodando, texto "Maestria" parado;
  - na Maestria, o título não fica correndo de cor; Mercurial e Polyatomic mostram o fundo parado; na Orion as estrelas ficam paradas (o apagão ainda escurece devagar);
  - desligando a emulação, tudo volta a se mexer.
- **Done when**: com a emulação ligada, nada na vitrine/Maestria se desloca ou gira em loop.
