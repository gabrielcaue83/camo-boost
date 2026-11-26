import { iniciarVarredura } from './varredura.js';
import { PLANOS } from './planos.js';
import { CAMOS } from '../arma/camos.js';
import { gerarAmostras } from '../arma/amostras.js';

// Preços: tudo numa cena só. O radar (varredura.js) acha a loja e a câmera
// entra nela; os cartões montados aqui ficam presos aos pedestais 3D.

const pad = (n) => String(n).padStart(2, '0');

export function iniciarPrecos(rumo, { lenis } = {}) {
  montarCartoes(rumo.querySelector('.rumo__vitrines'));
  iniciarVarredura(rumo, { lenis });
}

function montarCartoes(alvo) {
  const amostras = gerarAmostras();
  alvo.innerHTML = CAMOS.map((c, i) => {
    const pl = PLANOS[i] || {};
    return `
    <article class="plano${pl.destaque ? ' plano--destaque' : ''}">
      <div class="plano__caixa">
        ${pl.destaque ? '<span class="plano__etiqueta">Mais pedido</span>' : ''}
        <div class="plano__topo">
          <span class="plano__icone"><img src="${amostras[i]}" alt="" /></span>
          <span class="plano__num">${pad(i + 1)} / ${pad(CAMOS.length)}</span>
        </div>
        <h4 class="plano__nome">${c.nome}</h4>
        <p class="plano__preco"><strong>${pl.preco || ''}</strong> <span>${pl.por || ''}</span></p>
        <ul class="plano__itens">${(pl.itens || []).map((t) => `<li>${t}</li>`).join('')}</ul>
        <a class="botao ${pl.destaque ? 'botao--amarelo' : 'botao--linha'} plano__botao" href="#contratar">
          <span class="botao__rolo" data-texto="Comprar"><span>Comprar</span></span>
        </a>
      </div>
    </article>`;
  }).join('');
}
