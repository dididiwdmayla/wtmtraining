import type { ComandoBlindado } from './tank.js';

/**
 * Sensibilidade do arraste. Não é constante de balística — é ergonomia
 * de tela — mas fica em um lugar só para ajustar sem caçar.
 */
const RAD_POR_PX_GUINADA = 0.0042;
const RAD_POR_PX_ELEVACAO = 0.0012;

const RAIO_JOYSTICK_PX = 68;
const ZONA_MORTA = 0.12;

export interface Controles {
  /**
   * Comando do quadro. CONSOME o arraste acumulado, então chame uma vez
   * por quadro e só uma.
   */
  ler(): ComandoBlindado;
  destruir(): void;
}

/**
 * Duas metades de tela, dois corpos:
 *
 * - esquerda: joystick virtual. Acelera, freia, ré e giro do casco.
 * - direita: arraste. Guinada da torre e elevação do canhão.
 *
 * A metade direita entrega DELTA, não posição absoluta: quem transforma
 * isso em ângulo — e quem limita a velocidade de giro — é o blindado.
 */
export function criarControles(dom: HTMLElement): Controles {
  const base = document.createElement('div');
  base.style.cssText = [
    'position: fixed',
    'z-index: 5',
    `width: ${RAIO_JOYSTICK_PX * 2}px`,
    `height: ${RAIO_JOYSTICK_PX * 2}px`,
    'margin: -' + RAIO_JOYSTICK_PX + 'px 0 0 -' + RAIO_JOYSTICK_PX + 'px',
    'border: 2px solid #3a4a3a',
    'border-radius: 50%',
    'background: rgba(16, 20, 15, 0.35)',
    'pointer-events: none',
    'opacity: 0.5',
    'transition: opacity 120ms ease',
  ].join(';');

  const manete = document.createElement('div');
  manete.style.cssText = [
    'position: fixed',
    'z-index: 6',
    'width: 54px',
    'height: 54px',
    'margin: -27px 0 0 -27px',
    'border: 2px solid #6c8a6c',
    'border-radius: 50%',
    'background: rgba(60, 80, 58, 0.65)',
    'pointer-events: none',
  ].join(';');

  document.body.append(base, manete);

  let centro = { x: 0, y: 0 };
  let ponta = { x: 0, y: 0 };
  let idJoystick: number | null = null;
  let idArraste: number | null = null;
  let ultimoArraste = { x: 0, y: 0 };
  let arrasteAcumulado = { x: 0, y: 0 };
  const teclas = new Set<string>();

  function repousar(): void {
    centro = { x: 110, y: window.innerHeight - 110 };
    ponta = { ...centro };
    desenhar();
  }

  function desenhar(): void {
    base.style.left = `${centro.x}px`;
    base.style.top = `${centro.y}px`;
    manete.style.left = `${ponta.x}px`;
    manete.style.top = `${ponta.y}px`;
    base.style.opacity = idJoystick === null ? '0.5' : '0.9';
  }

  function aoDescer(ev: PointerEvent): void {
    if (ev.clientX < window.innerWidth / 2) {
      if (idJoystick !== null) return;
      idJoystick = ev.pointerId;
      centro = { x: ev.clientX, y: ev.clientY };
      ponta = { ...centro };
    } else {
      if (idArraste !== null) return;
      idArraste = ev.pointerId;
      ultimoArraste = { x: ev.clientX, y: ev.clientY };
    }
    dom.setPointerCapture(ev.pointerId);
    desenhar();
  }

  function aoMover(ev: PointerEvent): void {
    if (ev.pointerId === idJoystick) {
      const dx = ev.clientX - centro.x;
      const dy = ev.clientY - centro.y;
      const dist = Math.hypot(dx, dy);
      const escala = dist > RAIO_JOYSTICK_PX ? RAIO_JOYSTICK_PX / dist : 1;
      ponta = { x: centro.x + dx * escala, y: centro.y + dy * escala };
      desenhar();
    } else if (ev.pointerId === idArraste) {
      arrasteAcumulado.x += ev.clientX - ultimoArraste.x;
      arrasteAcumulado.y += ev.clientY - ultimoArraste.y;
      ultimoArraste = { x: ev.clientX, y: ev.clientY };
    }
  }

  function aoSubir(ev: PointerEvent): void {
    if (ev.pointerId === idJoystick) {
      idJoystick = null;
      repousar();
    } else if (ev.pointerId === idArraste) {
      idArraste = null;
    }
  }

  dom.addEventListener('pointerdown', aoDescer);
  dom.addEventListener('pointermove', aoMover);
  dom.addEventListener('pointerup', aoSubir);
  dom.addEventListener('pointercancel', aoSubir);
  window.addEventListener('resize', repousar);

  const aoTeclar = (ev: KeyboardEvent) => teclas.add(ev.key.toLowerCase());
  const aoSoltar = (ev: KeyboardEvent) => teclas.delete(ev.key.toLowerCase());
  window.addEventListener('keydown', aoTeclar);
  window.addEventListener('keyup', aoSoltar);

  repousar();

  return {
    ler(): ComandoBlindado {
      const eixoX = (ponta.x - centro.x) / RAIO_JOYSTICK_PX;
      const eixoY = (centro.y - ponta.y) / RAIO_JOYSTICK_PX;
      const acelerador = tecladoY(teclas) || comZonaMorta(eixoY);
      const direcao = tecladoX(teclas) || comZonaMorta(eixoX);

      const comando: ComandoBlindado = {
        acelerador,
        direcao,
        guinadaTorre: -arrasteAcumulado.x * RAD_POR_PX_GUINADA,
        elevacao: -arrasteAcumulado.y * RAD_POR_PX_ELEVACAO,
      };
      arrasteAcumulado = { x: 0, y: 0 };
      return comando;
    },

    destruir() {
      dom.removeEventListener('pointerdown', aoDescer);
      dom.removeEventListener('pointermove', aoMover);
      dom.removeEventListener('pointerup', aoSubir);
      dom.removeEventListener('pointercancel', aoSubir);
      window.removeEventListener('resize', repousar);
      window.removeEventListener('keydown', aoTeclar);
      window.removeEventListener('keyup', aoSoltar);
      base.remove();
      manete.remove();
    },
  };
}

function comZonaMorta(valor: number): number {
  const bruto = Math.max(-1, Math.min(1, valor));
  if (Math.abs(bruto) < ZONA_MORTA) return 0;
  return Math.sign(bruto) * ((Math.abs(bruto) - ZONA_MORTA) / (1 - ZONA_MORTA));
}

/** Teclado é conveniência de desenvolvimento; o alvo é o toque. */
function tecladoY(teclas: Set<string>): number {
  const frente = teclas.has('w') || teclas.has('arrowup') ? 1 : 0;
  const tras = teclas.has('s') || teclas.has('arrowdown') ? 1 : 0;
  return frente - tras;
}

function tecladoX(teclas: Set<string>): number {
  const direita = teclas.has('d') || teclas.has('arrowright') ? 1 : 0;
  const esquerda = teclas.has('a') || teclas.has('arrowleft') ? 1 : 0;
  return direita - esquerda;
}
