import { gsap } from 'gsap';
import { CustomEase } from 'gsap/CustomEase';

gsap.registerPlugin(CustomEase);

// Curvas de movimento do site, iguais às do CSS (--ease-out e --ease-in-out em style.css).
export const EASE = {
  saida: CustomEase.create('saida', 'M0,0 C0.23,1 0.32,1 1,1'), // entrando/saindo e respostas da interface
  move: CustomEase.create('move', 'M0,0 C0.77,0 0.175,1 1,1'), // algo se movendo de um lugar a outro na tela
};
