/**
 * Ponto de entrada. Monta a cena de treino: o alvo parado a 1000 m e o
 * blindado do jogador — casco, torre e canhão — com as duas câmeras.
 * Nada de balística aqui, isso é do núcleo.
 */
import * as THREE from 'three';
import veiculoJson from '../data/vehicles/mbt-generico.json';
import apfsdsJson from '../data/ammo/apfsds.json';
import atgmJson from '../data/ammo/atgm.json';
import controlesJson from '../data/controles.json';
import type { Ammo, Veiculo } from './core/index.js';
import { createScene } from './render/scene.js';
import { buildVehicleMesh } from './render/vehicle.js';
import { criarBlindado } from './render/tank.js';
import { ALVO_DISTANCIA_M, criarCameras } from './render/camera.js';
import { criarControles, type ConfiguracaoControles } from './render/input.js';
import { criarAjustes } from './render/ajustes.js';
import { criarControleDeTela } from './render/tela.js';
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
  criarBarraDeBotoes,
  criarBotao,
  criarClaraoDeTela,
  criarReticula,
  criarTelemetria,
  criarVersao,
  formatarResultado,
} from './render/hud.js';

const veiculo = veiculoJson as Veiculo;
const controlesConfig = controlesJson as ConfiguracaoControles;

/**
 * As munições vêm de `data/ammo/`, inteiras. O que separa uma da outra
 * — v0, arrasto, guiada ou não — já está no JSON, e é dele que saem
 * tanto a trajetória quanto o tempo de voo. Nenhum número aqui.
 */
const municoes = [apfsdsJson as Ammo, atgmJson as Ammo];
let indiceMunicao = 0;
const municaoAtual = (): Ammo => municoes[indiceMunicao];

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('#app não encontrado');
app.innerHTML = '';

const tela = criarControleDeTela(document.documentElement);
let area = tela.tamanho();

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(area.largura, area.altura);
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
  area.largura / area.altura,
  blindado,
  controlesConfig.zoom,
);
const ajustes = criarAjustes(controlesConfig.mira);
const controles = criarControles(
  renderer.domElement,
  controlesConfig,
  cameras,
  tela,
  ajustes,
);
const reticula = criarReticula();
const telemetria = criarTelemetria();
const banner = createResultBanner();
const clarao = criarClarao(blindado.boca);
const claraoDeTela = criarClaraoDeTela();
const sons = criarSons(
  Object.fromEntries(
    municoes.map((m) => [m.id, `${import.meta.env.BASE_URL}audio/disparo-${m.id}.mp3`]),
  ),
);

// Hash curto do deploy; "dev" quando a Vercel não injetou a variável.
const commit = import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA;
criarVersao(commit ? commit.slice(0, 7) : 'dev');

// Política de autoplay: o contexto de áudio só sai de "suspended"
// dentro de um gesto. O mesmo gesto serve para pedir a tela cheia, que
// também só é concedida dentro de um. O primeiro toque da sessão paga
// os dois.
//
// A tela cheia é automática só onde ela é o comportamento esperado: no
// aparelho de toque, que é o alvo do app. No desktop, tomar a tela
// inteira no primeiro clique seria atropelar o usuário — lá existe o
// botão.
const noCelular = window.matchMedia?.('(pointer: coarse)').matches ?? false;
window.addEventListener(
  'pointerdown',
  () => {
    sons.destravar();
    if (noCelular) tela.entrar();
  },
  { once: true },
);

const origem = new THREE.Vector3();
const direcao = new THREE.Vector3();
const velocidadeAtirador = new THREE.Vector3();
const pontoDeMira = new THREE.Vector3();
const projeteis = new Set<ProjetilRenderizado>();

const barra = criarBarraDeBotoes();

const botaoCamera = barra.adicionar('câmera: 3ª pessoa');
botaoCamera.addEventListener('click', () => {
  const modo = cameras.alternar();
  botaoCamera.textContent = `câmera: ${modo === 'mira' ? 'mira' : '3ª pessoa'}`;
});

/**
 * Alternador de munição. É instrumento de treino, não interface de
 * combate: a flecha e o míssil exigem leituras opostas — uma quase
 * instantânea, o outro com segundos de voo para acompanhar.
 */
const botaoMunicao = barra.adicionar('');
function mostrarMunicao(): void {
  botaoMunicao.textContent = `munição: ${municaoAtual().nome}`;
}
botaoMunicao.addEventListener('click', () => {
  indiceMunicao = (indiceMunicao + 1) % municoes.length;
  mostrarMunicao();
  sons.destravar();
  // O som da munição escolhida toca na troca: é a confirmação de qual
  // delas está carregada sem precisar olhar o botão.
  sons.disparo(municaoAtual().id);
});
mostrarMunicao();

const botaoDebug = barra.adicionar('módulos: off');
let debugVisivel = false;
botaoDebug.addEventListener('click', () => {
  debugVisivel = !debugVisivel;
  alvo.setDebugVisible(debugVisivel);
  botaoDebug.textContent = `módulos: ${debugVisivel ? 'on' : 'off'}`;
});

const botaoAjustes = barra.adicionar('ajustes');
botaoAjustes.addEventListener('click', () => ajustes.alternar());

// Onde a API de tela cheia não existe (iPhone no Safari) o botão só
// mentiria: lá o caminho é instalar o PWA, que já nasce em `fullscreen`.
if (tela.suportaTelaCheia()) {
  const botaoTela = barra.adicionar('tela cheia');
  botaoTela.addEventListener('click', () => tela.alternar());
  // O rótulo só muda quando o navegador CONFIRMA: pedir é assíncrono e
  // pode ser recusado, e um botão que mente é pior que nenhum botão.
  tela.aoMudarTelaCheia((cheia) => {
    botaoTela.textContent = cheia ? 'sair da tela cheia' : 'tela cheia';
  });
}

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
  const municao = municaoAtual();
  blindado.linhaDeTiro(origem, direcao);
  blindado.velocidadeMundo(velocidadeAtirador);
  sons.disparo(municao.id);
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
    (pontoDeMira.x * 0.5 + 0.5) * area.largura,
    (-pontoDeMira.y * 0.5 + 0.5) * area.altura,
  );
}

/**
 * Uma medida só para canvas, câmeras, retícula e input. Se elas
 * discordarem, o cano aponta para um pixel e a retícula desenha em
 * outro — e a mira passa a ensinar o erro do aparelho.
 */
tela.aoMudar((tamanho) => {
  area = tamanho;
  app.style.width = `${area.largura}px`;
  app.style.height = `${area.altura}px`;
  cameras.redimensionar(area.largura / area.altura);
  renderer.setSize(area.largura, area.altura);
});
app.style.width = `${area.largura}px`;
app.style.height = `${area.altura}px`;

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
