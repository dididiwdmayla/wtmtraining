import type { ComandoBlindado } from './tank.js';
import type { PainelDeAjustes, ConfiguracaoMira } from './ajustes.js';
import { anguloDoArraste, type DimensaoTela } from './sensibilidade.js';

export type { ConfiguracaoMira } from './ajustes.js';

export interface ConfiguracaoControles {
  /** Sensibilidade, curva de ganho e faixas dos deslizadores. */
  mira: ConfiguracaoMira;
  zoom: {
    fovMaxGraus: number;
    fovMinGraus: number;
    /** Multiplicador por entalhe da roda do mouse (conveniência de PC). */
    passoRoda: number;
    /** Multiplicador por toque de tecla (conveniência de PC). */
    passoTecla: number;
  };
  torre: {
    /**
     * Quanto de ângulo a mira pode ficar devendo ao dedo. A torre gasta
     * essa dívida no seu próprio teto de velocidade, então o número é
     * literalmente "quanto tempo a mira ainda anda depois que o dedo
     * parou": 6° contra uma torre de 30°/s são 0,2 s.
     */
    pendenciaMaxGraus: number;
  };
  joystick: {
    raioPx: number;
    zonaMorta: number;
  };
}

/**
 * O que o input precisa saber da óptica: o FOV VERTICAL que está na
 * tela — `sensibilidade.ts` deriva o horizontal com a razão de aspecto
 * — e o FOV da mira, que é o que a pinça mexe.
 */
export interface Optica {
  fovAtivoGraus(): number;
  fovMiraGraus(): number;
  definirFovMiraGraus(graus: number): void;
}

/** Só o que o input consome de `tela.ts`. */
export interface Medidor {
  tamanho(): DimensaoTela;
}

export interface Controles {
  /**
   * Comando do quadro. CONSOME o arraste acumulado, então chame uma vez
   * por quadro e só uma. O que sai daqui já está em radianos: o ângulo
   * foi calculado evento a evento, no instante do toque.
   */
  ler(): ComandoBlindado;
  destruir(): void;
}

/**
 * Divisor mínimo ao medir a velocidade do dedo. Eventos coalescidos
 * podem chegar com carimbos praticamente iguais e a divisão explodiria
 * numa velocidade que não existiu. Não é suavização: nenhuma amostra é
 * descartada nem misturada com a vizinha, só o divisor tem piso.
 */
const DT_MINIMO_S = 0.0005;

/**
 * Duas metades de tela, dois corpos:
 *
 * - esquerda: joystick virtual. Acelera, freia, ré e giro do casco.
 * - direita: arraste. Guinada da torre e elevação do canhão. Dois dedos
 *   nessa metade viram pinça de zoom.
 *
 * A metade direita entrega DELTA ANGULAR, não posição absoluta: quem
 * limita a velocidade de giro é o blindado, e é lá que mora a inércia.
 *
 * O roteamento é por `pointerId`: cada dedo entra em exatamente um
 * papel no `pointerdown` e fica nele até levantar. Joystick e mira não
 * disputam evento, e nenhum arraste é contado duas vezes.
 */
export function criarControles(
  dom: HTMLElement,
  config: ConfiguracaoControles,
  optica: Optica,
  tela: Medidor,
  ajustes: PainelDeAjustes,
): Controles {
  const raio = config.joystick.raioPx;

  const base = document.createElement('div');
  base.style.cssText = [
    'position: fixed',
    'z-index: 5',
    `width: ${raio * 2}px`,
    `height: ${raio * 2}px`,
    `margin: -${raio}px 0 0 -${raio}px`,
    'border: 2px solid #3a4a3a',
    'border-radius: 50%',
    'background: rgba(16, 20, 15, 0.35)',
    'pointer-events: none',
    'opacity: 0.5',
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
  let idPinca: number | null = null;
  /** Última posição do dedo que mira, com o instante em que ela valeu. */
  let dedo = { x: 0, y: 0, t: 0 };
  let dedoPinca = { x: 0, y: 0 };
  let pincaBase: { distancia: number; fov: number } | null = null;
  /**
   * Última velocidade MEDIDA do dedo. Só existe porque eventos
   * coalescidos podem chegar com o mesmo timestamp: aí não há o que
   * medir e o valor anterior vale. Não é média nem filtro.
   */
  let velocidadeDedo = 0;

  let acumulado = { guinada: 0, elevacao: 0 };
  const teclas = new Set<string>();

  function repousar(): void {
    // Com o dedo apoiado, mexer no centro seria um salto no comando —
    // e girar o aparelho dispara `resize` no meio do gesto.
    if (idJoystick !== null) return;
    const { altura } = tela.tamanho();
    centro = { x: 110, y: altura - 110 };
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

  /**
   * Uma amostra de arraste vira ângulo aqui, na hora. A conta inteira
   * está em `sensibilidade.ts`: fração de tela vezes o FOV daquele eixo,
   * com a curva de ganho pela velocidade daquela amostra e os
   * deslizadores do painel lidos neste mesmo instante.
   */
  function acumularArraste(x: number, y: number, t: number): void {
    const dx = x - dedo.x;
    const dy = y - dedo.y;
    const dt = (t - dedo.t) / 1000;
    dedo = { x, y, t };
    if (dt > 0) velocidadeDedo = Math.hypot(dx, dy) / Math.max(dt, DT_MINIMO_S);

    // Com dois dedos na tela o gesto é zoom, não guinada: o dedo que
    // mira se afasta do outro e isso não pode virar rotação.
    if (idPinca !== null) return;

    const angulo = anguloDoArraste({
      dx,
      dy,
      velocidadePxS: velocidadeDedo,
      fovAtivoGraus: optica.fovAtivoGraus(),
      tela: tela.tamanho(),
      curva: config.mira.ganho,
      zoom: config.zoom,
      razaoVertical: config.mira.razaoVertical,
      ajustes: ajustes.valores(),
    });
    acumulado.guinada += angulo.guinada;
    acumulado.elevacao += angulo.elevacao;
  }

  function ampliar(fator: number): void {
    optica.definirFovMiraGraus(optica.fovMiraGraus() / fator);
  }

  function aoDescer(ev: PointerEvent): void {
    if (ev.clientX < tela.tamanho().largura / 2) {
      if (idJoystick !== null) return;
      idJoystick = ev.pointerId;
      centro = { x: ev.clientX, y: ev.clientY };
      ponta = { ...centro };
      desenhar();
    } else if (idArraste === null) {
      idArraste = ev.pointerId;
      dedo = { x: ev.clientX, y: ev.clientY, t: ev.timeStamp };
      velocidadeDedo = 0;
    } else if (idPinca === null) {
      idPinca = ev.pointerId;
      dedoPinca = { x: ev.clientX, y: ev.clientY };
      pincaBase = {
        distancia: Math.hypot(dedo.x - dedoPinca.x, dedo.y - dedoPinca.y),
        fov: optica.fovMiraGraus(),
      };
    } else {
      return;
    }
    // Captura mantém os eventos vindo mesmo se o dedo sair do elemento.
    // Um ponteiro que já sumiu faz o navegador lançar aqui, e uma
    // exceção neste ponto abortaria o resto do gesto.
    try {
      dom.setPointerCapture(ev.pointerId);
    } catch {
      /* ponteiro já não está ativo: seguir sem captura é aceitável. */
    }
  }

  function aoMover(ev: PointerEvent): void {
    if (ev.pointerId === idJoystick) {
      const dx = ev.clientX - centro.x;
      const dy = ev.clientY - centro.y;
      const dist = Math.hypot(dx, dy);
      const escala = dist > raio ? raio / dist : 1;
      ponta = { x: centro.x + dx * escala, y: centro.y + dy * escala };
      desenhar();
      return;
    }

    if (ev.pointerId === idPinca) {
      dedoPinca = { x: ev.clientX, y: ev.clientY };
      aplicarPinca();
      return;
    }

    if (ev.pointerId !== idArraste) return;

    // Eventos coalescidos: o navegador amostra o toque mais rápido do
    // que entrega. Ler todos preserva a velocidade real do dedo e faz o
    // ângulo total do gesto não depender da taxa de quadros — o que sai
    // daqui é a SOMA dos deslocamentos, e ela é a mesma a 30 ou 120 Hz.
    const amostras =
      typeof ev.getCoalescedEvents === 'function' ? ev.getCoalescedEvents() : [];
    if (amostras.length > 0) {
      for (const amostra of amostras) {
        acumularArraste(amostra.clientX, amostra.clientY, amostra.timeStamp);
      }
    } else {
      acumularArraste(ev.clientX, ev.clientY, ev.timeStamp);
    }
    if (idPinca !== null) aplicarPinca();
  }

  /** Zoom absoluto contra a distância do início da pinça: não deriva. */
  function aplicarPinca(): void {
    if (!pincaBase || pincaBase.distancia <= 0) return;
    const distancia = Math.hypot(dedo.x - dedoPinca.x, dedo.y - dedoPinca.y);
    if (distancia <= 0) return;
    optica.definirFovMiraGraus((pincaBase.fov * pincaBase.distancia) / distancia);
  }

  function aoSubir(ev: PointerEvent): void {
    if (ev.pointerId === idJoystick) {
      idJoystick = null;
      repousar();
      return;
    }
    if (ev.pointerId === idPinca) {
      idPinca = null;
      pincaBase = null;
      return;
    }
    if (ev.pointerId !== idArraste) return;
    if (idPinca !== null) {
      // O dedo que sobrou assume a mira sem salto: a referência passa a
      // ser a posição dele, então o próximo delta nasce de zero.
      idArraste = idPinca;
      dedo = { x: dedoPinca.x, y: dedoPinca.y, t: ev.timeStamp };
      velocidadeDedo = 0;
      idPinca = null;
      pincaBase = null;
      return;
    }
    idArraste = null;
  }

  function aoRoda(ev: WheelEvent): void {
    ev.preventDefault();
    ampliar(ev.deltaY < 0 ? config.zoom.passoRoda : 1 / config.zoom.passoRoda);
  }

  dom.addEventListener('pointerdown', aoDescer);
  dom.addEventListener('pointermove', aoMover);
  dom.addEventListener('pointerup', aoSubir);
  dom.addEventListener('pointercancel', aoSubir);
  dom.addEventListener('wheel', aoRoda, { passive: false });
  window.addEventListener('resize', repousar);
  window.addEventListener('orientationchange', repousar);

  const aoTeclar = (ev: KeyboardEvent) => {
    const tecla = ev.key.toLowerCase();
    if (tecla === 'z') ampliar(config.zoom.passoTecla);
    else if (tecla === 'x') ampliar(1 / config.zoom.passoTecla);
    else teclas.add(tecla);
  };
  const aoSoltar = (ev: KeyboardEvent) => teclas.delete(ev.key.toLowerCase());
  window.addEventListener('keydown', aoTeclar);
  window.addEventListener('keyup', aoSoltar);

  repousar();

  return {
    ler(): ComandoBlindado {
      const eixoX = (ponta.x - centro.x) / raio;
      const eixoY = (centro.y - ponta.y) / raio;
      const zona = config.joystick.zonaMorta;

      const comando: ComandoBlindado = {
        acelerador: tecladoY(teclas) || comZonaMorta(eixoY, zona),
        direcao: tecladoX(teclas) || comZonaMorta(eixoX, zona),
        guinadaTorre: acumulado.guinada,
        elevacao: acumulado.elevacao,
      };
      acumulado = { guinada: 0, elevacao: 0 };
      return comando;
    },

    destruir() {
      dom.removeEventListener('pointerdown', aoDescer);
      dom.removeEventListener('pointermove', aoMover);
      dom.removeEventListener('pointerup', aoSubir);
      dom.removeEventListener('pointercancel', aoSubir);
      dom.removeEventListener('wheel', aoRoda);
      window.removeEventListener('resize', repousar);
      window.removeEventListener('orientationchange', repousar);
      window.removeEventListener('keydown', aoTeclar);
      window.removeEventListener('keyup', aoSoltar);
      base.remove();
      manete.remove();
    },
  };
}

function comZonaMorta(valor: number, zona: number): number {
  const bruto = Math.max(-1, Math.min(1, valor));
  if (Math.abs(bruto) < zona) return 0;
  return Math.sign(bruto) * ((Math.abs(bruto) - zona) / (1 - zona));
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
