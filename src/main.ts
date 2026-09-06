/**
 * Ponto de entrada. Cena mínima de inspeção do veículo-alvo: nada de
 * balística aqui, isso é do núcleo.
 */
import * as THREE from 'three';
import veiculoJson from '../data/vehicles/mbt-generico.json';
import municaoJson from '../data/ammo/apfsds.json';
import type { Ammo, Veiculo } from './core/index.js';
import { createScene } from './render/scene.js';
import { buildVehicleMesh } from './render/vehicle.js';
import { createCamera, createOrbitControls } from './render/camera.js';
import { attachToqueDeTiro } from './render/input.js';
import { marcarImpacto } from './render/decals.js';
import { createResultBanner, formatarResultado } from './render/hud.js';

const veiculo = veiculoJson as Veiculo;
const municao = municaoJson as Ammo;

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('#app não encontrado');
app.innerHTML = '';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
app.appendChild(renderer.domElement);

const scene = createScene();

const veiculoMesh = buildVehicleMesh(veiculo);
scene.add(veiculoMesh.group);

const camera = createCamera(window.innerWidth / window.innerHeight);
const alvo = new THREE.Vector3(0, veiculo.alturaCentro, 0);
const controls = createOrbitControls(camera, renderer.domElement, alvo);

const banner = createResultBanner();
attachToqueDeTiro(renderer, camera, veiculoMesh.group, veiculo, municao, (impacto) => {
  banner.mostrar(formatarResultado(impacto.resultado, veiculo));
  marcarImpacto(impacto.mesh, impacto.pontoMundo);
});

const botaoDebug = document.createElement('button');
botaoDebug.type = 'button';
botaoDebug.textContent = 'módulos: off';
botaoDebug.style.cssText = [
  'position: fixed',
  'top: max(12px, env(safe-area-inset-top))',
  'left: 12px',
  'z-index: 10',
  'padding: 10px 16px',
  'font: 14px ui-monospace, monospace',
  'background: #10140f',
  'color: #cfe3cf',
  'border: 1px solid #3a4a3a',
  'border-radius: 6px',
  'touch-action: manipulation',
].join(';');
let modulosVisiveis = false;
botaoDebug.addEventListener('click', () => {
  modulosVisiveis = !modulosVisiveis;
  veiculoMesh.setModulesVisible(modulosVisiveis);
  botaoDebug.textContent = `módulos: ${modulosVisiveis ? 'on' : 'off'}`;
});
document.body.appendChild(botaoDebug);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function animar(): void {
  requestAnimationFrame(animar);
  controls.update();
  renderer.render(scene, camera);
}
animar();
