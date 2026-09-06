/**
 * Ponto de entrada. Monta a cena de treino: o alvo parado a 1000 m e o
 * blindado do jogador — casco, torre e canhão — com as duas câmeras.
 * Nada de balística aqui, isso é do núcleo.
 */
import * as THREE from 'three';
import veiculoJson from '../data/vehicles/mbt-generico.json';
import municaoJson from '../data/ammo/apfsds.json';
import controlesJson from '../data/controles.json';
import type { Ammo, Veiculo } from './core/index.js';
import { createScene } from './render/scene.js';
import { buildVehicleMesh } from './render/vehicle.js';
import { criarBlindado } from './render/tank.js';
import { ALVO_DISTANCIA_M, criarCameras } from './render/camera.js';
import { criarControles, type ConfiguracaoControles } from './render/input.js';
import { criarClarao } from './render/flash.js';
import { criarSons } from './render/audio.js';
import {
  criarProjetilRenderizado,
  distanciaNaLinha,
  type ProjetilRenderizado,
} from './render/shot.js';
import { marcarImpacto } from './render/decals.js';
import {
  createResultBanner,
  criarBotao,
  criarClaraoDeTela,
  criarReticula,
  criarTelemetria,
  criarVersao,
  formatarResultado,
} from './render/hud.js';

const veiculo = veiculoJson as Veiculo;
const municao = municaoJson as Ammo;
const controlesConfig = controlesJson as ConfiguracaoControles;

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
const blindado = criarBlindado(
  veiculo,
  { x: 0, z: ALVO_DISTANCIA_M, guinada: Math.PI },
  controlesConfig.torre,
);
scene.add(blindado.casco);

const cameras = criarCameras(
  window.innerWidth / window.innerHeight,
  blindado,
  controlesConfig.zoom,
);
const controles = criarControles(renderer.domElement, controlesConfig, cameras);
const reticula = criarReticula();
const telemetria = criarTelemetria();
const banner = createResultBanner();
const clarao = criarClarao(blindado.boca);
const claraoDeTela = criarClaraoDeTela();
const sons = criarSons(`${import.meta.env.BASE_URL}audio/disparo-apfsds.mp3`);

// Hash curto do deploy; "dev" quando a Vercel não injetou a variável.
const commit = import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA;
criarVersao(commit ? commit.slice(0, 7) : 'dev');

// Política de autoplay: o contexto de áudio só sai de "suspended"
// dentro de um gesto. O primeiro toque da sessão serve.
window.addEventListener('pointerdown', () => sons.destravar(), { once: true });

const origem = new THREE.Vector3();
const direcao = new THREE.Vector3();
const velocidadeAtirador = new THREE.Vector3();
const pontoDeMira = new THREE.Vector3();
const projeteis = new Set<ProjetilRenderizado>();

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
// `pointerdown`, não `click`: o clique só nasce ao soltar o dedo, e
// esse tempo aparece entre a decisão de atirar e o clarão.
botaoTiro.addEventListener('pointerdown', (ev) => {
  ev.preventDefault();
  sons.destravar();
  atirar();
});

window.addEventListener('keydown', (ev) => {
  if (ev.code === 'Space' && !ev.repeat) atirar();
});

/**
 * O tiro. Não há condição nenhuma sobre o estado do casco: atirar em
 * movimento é o objeto do treino, e o núcleo já decide o resto.
 * Som e clarão saem no quadro do disparo; impacto só sai quando a flecha
 * cruza uma placa durante o voo.
 */
function atirar(): void {
  blindado.linhaDeTiro(origem, direcao);
  blindado.velocidadeMundo(velocidadeAtirador);
  sons.disparo();
  clarao.disparar();
  claraoDeTela.disparar();

  const projetil = criarProjetilRenderizado(
    origem,
    direcao,
    velocidadeAtirador,
    alvo,
    veiculo,
    municao,
  );
  scene.add(projetil.objeto);
  projeteis.add(projetil);
}

function atualizarProjeteis(dt: number): void {
  for (const projetil of projeteis) {
    const desfecho = projetil.atualizar(dt);
    if (!desfecho) continue;

    projeteis.delete(projetil);
    scene.remove(projetil.objeto);
    projetil.destruir();

    if (desfecho === 'errou') {
      banner.mostrar('ERROU');
      continue;
    }

    banner.mostrar(formatarResultado(desfecho.resultado, veiculo));
    if (desfecho.marca) {
      marcarImpacto(desfecho.marca.objeto, desfecho.marca.ponto, desfecho.marca.normal);
    }
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
  clarao.atualizar(dt);
  atualizarProjeteis(dt);

  const camera = cameras.ativa();
  atualizarReticula(camera);
  telemetria.atualizar(
    blindado.estado.velocidade,
    blindado.torre.rotation.y,
    cameras.modo() === 'mira' ? cameras.ampliacao() : null,
  );

  renderer.render(scene, camera);
}
animar();
