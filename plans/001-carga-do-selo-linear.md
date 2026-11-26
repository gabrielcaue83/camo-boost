# 001 — Carga do selo linear, com resposta imediata ao apertar

- **Status**: DONE (26/11/2026)
- **Commit**: a035f5d + mudanças locais não commitadas (redesenho da Maestria de 26/11/2026: selo, trinca, estouro, ambientes)
- **Severity**: HIGH
- **Category**: Interruptibility / Easing & duration (gesto de segurar)
- **Estimated scope**: 2 arquivos, ~6 linhas

## Problem

O selo da Maestria é um "segure para confirmar". A carga usa `power1.in` (começa devagar e acelera). Nos primeiros ~200 ms quase nada se move: o usuário aperta e acha que não pegou. Além disso, a curva mente sobre quanto falta — a primeira metade do tempo enche só um quarto do anel.

Regra: gestos de segurar usam **`linear`** durante o segurar (mostram o tempo passando, e o tempo passa linear). Ao soltar antes, volta rápido com ease-out. Esse lado (soltar) já está certo e NÃO deve mudar.

```js
/* src/arma/maestria.js:283–297 — atual */
  const carregar = () => {
    if (ativa) return;
    enchendo?.kill();
    secao.classList.add('carregando');
    enchendo = gsap.to(carga, {
      v: 1, duration: (1 - carga.v) * DESBLOQUEIO.segurar, ease: 'power1.in',
      onUpdate: aplicarCarga, onComplete: desbloquear,
    });
  };
  const soltar = () => {
    if (ativa || carga.v >= 1) return;
    enchendo?.kill();
    secao.classList.remove('carregando');
    enchendo = gsap.to(carga, { v: 0, duration: carga.v * DESBLOQUEIO.solta, ease: 'power2.out', onUpdate: aplicarCarga });
  };
```

Também não há resposta visual instantânea ao apertar: o losango só cresce conforme a carga sobe.

```css
/* src/style.css:489 — atual */
.selo__emblema { position: relative; flex: none; display: block; width: 104px; height: 104px; transform: scale(calc(1 + var(--carga, 0) * 0.1)); }
```

## Target

1. Carga linear: `ease: 'none'` no tween de `carregar`.
2. Resposta imediata ao apertar: o desenho do losango (`.selo__svg`) encolhe para `0.97` em 160 ms com `cubic-bezier(0.23, 1, 0.32, 1)` enquanto o botão está pressionado. Usa a propriedade CSS `scale` (separada de `transform`), para não brigar com o `transform` do `.selo__emblema` que cresce com a carga.

```css
/* target (novo, junto das regras do selo) */
.selo__svg { transition: scale 160ms cubic-bezier(0.23, 1, 0.32, 1); }
.selo:active .selo__svg { scale: 0.97; }
```

## Repo conventions to follow

- Configs de tempo ficam no objeto `DESBLOQUEIO` no topo de `src/arma/maestria.js`, comentadas em português. Não mexer nos valores (`segurar: 1.6`, `solta: 0.35`).
- As regras do selo ficam no bloco `/* ---------- Selo da Maestria ... */` de `src/style.css`. Exemplo de transição no mesmo bloco: `.selo__aro { ... transition: stroke 0.3s; }`.

## Steps

1. Em `src/arma/maestria.js`, dentro de `carregar`, troque `ease: 'power1.in'` por `ease: 'none'`. Nada mais nessa função.
2. Em `src/style.css`, logo depois da regra `.selo__svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }`, adicione:
   ```css
   .selo__svg { transition: scale 160ms cubic-bezier(0.23, 1, 0.32, 1); }
   .selo:active .selo__svg { scale: 0.97; }
   ```

## Boundaries

- NÃO altere `soltar` (o ease-out rápido ao soltar está correto).
- NÃO altere `DESBLOQUEIO`, o shader, nem a sequência de `desbloquear`.
- NÃO adicione dependências.
- Se o código não bater com os trechos acima, PARE e reporte.

## Verification

- **Mechanical**: `npm run build` termina com "✓ built".
- **Feel check**: `npm run dev`, role até a Divergência e segure o selo:
  - no primeiro instante do clique o losango encolhe levemente (feedback) e o anel já começa a andar;
  - o anel avança em ritmo constante do início ao fim (metade do tempo = metade do anel);
  - soltar no meio faz o anel voltar rápido;
  - no DevTools (Animations, 10%), confirme que o encolher dura ~160 ms e não tem atraso.
- **Done when**: `power1.in` não existe mais em `carregar` e o encolher ao apertar aparece.
