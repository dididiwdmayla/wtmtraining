/**
 * Ponto de entrada. Por enquanto só prova que o núcleo está vivo
 * e que o ciclo de build funciona no celular.
 *
 * A cena three.js entra aqui, na tarefa da camada de render.
 */
import apfsds from '../data/ammo/apfsds.json';
import { solucaoDeTiro, type Ammo } from './core/index.js';

const municao = apfsds as Ammo;

const solucao = solucaoDeTiro(
  { posicao: { x: 0, y: 0, z: 0 }, velocidade: { x: 0, y: 0, z: 0 }, mira: { x: 0, y: 0, z: 1 } },
  { posicao: { x: 0, y: 0, z: 1200 }, velocidade: { x: 12, y: 0, z: 0 }, guinada: 0 },
  municao,
);

const app = document.querySelector<HTMLDivElement>('#app');
if (app) {
  app.style.cssText = 'color:#cfe3cf;font:14px/1.6 ui-monospace,monospace;padding:24px';
  app.innerHTML = `
    <p>Núcleo online.</p>
    <p>Alvo a 1200 m cruzando a 12 m/s, atirador parado:</p>
    <p>tempo de voo ${solucao.tempoVoo.toFixed(3)} s</p>
    <p>lead horizontal ${solucao.leadHorizontalMrad.toFixed(2)} mrad</p>
    <p>queda ${solucao.quedaM.toFixed(2)} m</p>
  `;
}
