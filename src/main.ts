/**
 * Ponto de entrada. Monta a cena de treino: o alvo parado a 1000 m e o
 * blindado do jogador — casco, torre e canhão — com as duas câmeras.
 * Nada de balística aqui, isso é do núcleo.
 */
import * as THREE from 'three';
import veiculoJson from '../data/vehicles/mbt-generico.json';
import municaoJson from '../data/ammo/apfsds.json';
import type { Ammo, Veiculo } from './core/index.js';
import { createScene } from './render/scene.js';
import { buildVehicleMesh } from './render/vehicle.js';
import { criarBlindado } from './render/tank.js';
import { ALVO_DISTANCIA_M, criarCameras } from './render/camera.js';
import { criarControles } from './render/input.js';
import { dispararDoCanhao, distanciaNaLinha } from './render/shot.js';
import { marcarImpacto } from './render/decals.js';
import {
  createResultBanner,
  criarBotao,
  criarReticula,
  criarTelemetria,
  formatarResultado,
} from './render/hud.js';

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

const alvo = buildVehicleMesh(veiculo);
scene.add(alvo.group);

// O jogador nasce a 1000 m do alvo, de frente para ele.
const blindado = criarBlindado(veiculo, { x: 0, z: ALVO_DISTANCIA_M, guinada: Math.PI });
scene.add(blindado.casco);

const cameras = criarCameras(window.innerWidth / window.innerHeight, blindado);
const controles = criarControles(renderer.domElement);
const reticula = criarReticula();
const telemetria = criarTelemetria();
const banner = createResultBanner();

const origem = new THREE.Vector3();
const direcao = new THREE.Vector3();
const pontoDeMira = new THREE.Vector3();

const botaoCamera = criarBotao('câmera: 3ª pessoa', {
  top: 'max(12px, env(safe-area-inset-top))',
  right: '12px',
});
botaoCamera.addEventListener('click', () => {
  const modo = cameras.alternar();
  botaoCamera.textContent = `câmera: ${modo === 'mira' ? 'mira' : '3ª pessoa'}`;
});

const botaoDebug = criarBotao('módulos: off', {
  top: 'calc(max(12px, env(safe-area-inset-top)) + 48px)',
  right: '12px',
});
let debugVisivel = false;
botaoDebug.addEventListener('click', () => {
  debugVisivel = !debugVisivel;
  alvo.setDebugVisible(debugVisivel);
  botaoDebug.textContent = `módulos: ${debugVisivel ? 'on' : 'off'}`;
});

const botaoTiro = criarBotao(
  'ATIRAR',
  { bottom: 'max(20px, env(safe-area-inset-bottom))', right: '20px' },
  'padding: 22px 26px;font-size: 16px;letter-spacing: 1px;border-radius: 50%',
);
botaoTiro.addEventListener('click', atirar);

function atirar(): void {
  blindado.linhaDeTiro(origem, direcao);
  const impacto = dispararDoCanhao(origem, direcao, alvo, veiculo, municao);
  if (!impacto) {
    banner.mostrar('ERROU');
    return;
  }
  banner.mostrar(formatarResultado(impacto.resultado, veiculo));
  if (impacto.marca) {
    marcarImpacto(impacto.marca.objeto, impacto.marca.ponto, impacto.marca.normal);
  }
}

/** A retícula segue o cano, não a câmera. Nas duas câmeras. */
function atualizarReticula(camera: THREE.PerspectiveCamera): void {
  const distancia = distanciaNaLinha(origem, direcao, alvo.placas) ?? ALVO_DISTANCIA_M;
  pontoDeMira.copy(origem).addScaledVector(direcao, distancia);
  camera.updateMatrixWorld();
  camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
  pontoDeMira.project(camera);
  if (pontoDeMira.z > 1) {
    reticula.esconder();
    return;
  }
  reticula.mover(
    (pontoDeMira.x * 0.5 + 0.5) * window.innerWidth,
    (-pontoDeMira.y * 0.5 + 0.5) * window.innerHeight,
  );
}

window.addEventListener('resize', () => {
  cameras.redimensionar(window.innerWidth / window.innerHeight);
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const relogio = new THREE.Clock();

function animar(): void {
  requestAnimationFrame(animar);
  // Passo longo demais (aba em segundo plano) faria o casco teleportar.
  const dt = Math.min(relogio.getDelta(), 0.05);

  blindado.atualizar(dt, controles.ler());
  blindado.linhaDeTiro(origem, direcao);

  const camera = cameras.ativa();
  atualizarReticula(camera);
  telemetria.atualizar(blindado.estado.velocidade, blindado.torre.rotation.y);

  renderer.render(scene, camera);
}
animar();
