import type { ResultadoImpacto, Veiculo } from '../core/index.js';

const CAIXA_HUD = [
  'position: fixed',
  'z-index: 10',
  'padding: 10px 16px',
  'font: 14px ui-monospace, monospace',
  'background: #10140f',
  'color: #cfe3cf',
  'border: 1px solid #3a4a3a',
  'border-radius: 6px',
].join(';');

export interface BannerResultado {
  mostrar(texto: string): void;
}

const DURACAO_MS = 2000;

/** Banner de resultado: aparece por dois segundos e some. */
export function createResultBanner(): BannerResultado {
  const el = document.createElement('div');
  el.style.cssText = [
    'position: fixed',
    'top: max(16px, env(safe-area-inset-top))',
    'left: 50%',
    'transform: translateX(-50%)',
    'z-index: 10',
    'padding: 10px 20px',
    'font: 16px ui-monospace, monospace',
    'background: #10140f',
    'color: #cfe3cf',
    'border: 1px solid #3a4a3a',
    'border-radius: 6px',
    'pointer-events: none',
    'opacity: 0',
    'transition: opacity 120ms ease',
  ].join(';');
  document.body.appendChild(el);

  let timer: ReturnType<typeof setTimeout> | undefined;

  return {
    mostrar(texto: string) {
      el.textContent = texto;
      el.style.opacity = '1';
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        el.style.opacity = '0';
      }, DURACAO_MS);
    },
  };
}

/** Traduz o resultado do núcleo em texto de tela. */
export function formatarResultado(resultado: ResultadoImpacto, veiculo: Veiculo): string {
  switch (resultado.tipo) {
    case 'ricochete':
      return 'RICOCHETE';
    case 'nao-penetrou':
      return 'NÃO PENETROU';
    case 'penetrou': {
      const tipos = resultado.modulosAtingidos.map(
        (id) => veiculo.modulos.find((m) => m.id === id)?.tipo ?? id,
      );
      return tipos.length > 0 ? `PENETROU — atingiu: ${tipos.join(', ')}` : 'PENETROU';
    }
    case 'errou':
      return 'ERROU';
  }
}

/** Botão de tela, no estilo do resto do HUD. */
export function criarBotao(
  texto: string,
  posicao: Partial<Record<'top' | 'right' | 'bottom' | 'left', string>>,
  extra = '',
): HTMLButtonElement {
  const el = document.createElement('button');
  el.type = 'button';
  el.textContent = texto;
  const lugar = Object.entries(posicao)
    .map(([lado, valor]) => `${lado}: ${valor}`)
    .join(';');
  el.style.cssText = `${CAIXA_HUD};${lugar};touch-action: manipulation;${extra}`;
  document.body.appendChild(el);
  return el;
}

export interface Reticula {
  /** Coloca a retícula onde a linha do cano fura a tela. */
  mover(x: number, y: number): void;
  esconder(): void;
}

/**
 * A retícula não fica no centro da tela: ela fica onde o CANO aponta.
 * Na câmera de mira as duas coisas coincidem; na de terceira pessoa,
 * não — e é justamente por isso que ela precisa ser projetada.
 */
export function criarReticula(): Reticula {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 64 64');
  svg.setAttribute('width', '64');
  svg.setAttribute('height', '64');
  svg.style.cssText = [
    'position: fixed',
    'z-index: 9',
    'margin: -32px 0 0 -32px',
    'pointer-events: none',
    'overflow: visible',
  ].join(';');
  svg.innerHTML = [
    '<circle cx="32" cy="32" r="11" fill="none" stroke="#d8f0d8" stroke-width="1.2" opacity="0.85"/>',
    '<path d="M32 6v14M32 44v14M6 32h14M44 32h14" stroke="#d8f0d8" stroke-width="1.2" opacity="0.85"/>',
    '<circle cx="32" cy="32" r="1.3" fill="#d8f0d8"/>',
  ].join('');
  document.body.appendChild(svg);

  return {
    mover(x, y) {
      svg.style.display = 'block';
      svg.style.left = `${x}px`;
      svg.style.top = `${y}px`;
    },
    esconder() {
      svg.style.display = 'none';
    },
  };
}

export interface Telemetria {
  /** `ampliacao` nula quando a mira não está na tela. */
  atualizar(velocidadeMs: number, guinadaRelativaRad: number, ampliacao: number | null): void;
}

/**
 * Velocidade do casco e ângulo da torre EM RELAÇÃO ao casco. O segundo
 * número é o que prova o modelo de dois corpos: gire o casco e ele muda
 * sozinho, sem a mira sair do lugar no mundo. Na mira entra também a
 * ampliação, porque é ela que define quanto vale um mrad na tela.
 */
export function criarTelemetria(): Telemetria {
  const el = document.createElement('div');
  el.style.cssText = `${CAIXA_HUD};top: max(12px, env(safe-area-inset-top));left: 12px;pointer-events: none`;
  document.body.appendChild(el);
  return {
    atualizar(velocidadeMs, guinadaRelativaRad, ampliacao) {
      const kmh = Math.round(velocidadeMs * 3.6);
      const graus = Math.round((guinadaRelativaRad * 180) / Math.PI);
      const zoom = ampliacao === null ? '' : `   ${ampliacao.toFixed(1)}x`;
      el.textContent = `${kmh} km/h   torre ${graus >= 0 ? '+' : ''}${graus}°${zoom}`;
    },
  };
}

export interface ClaraoDeTela {
  disparar(): void;
}

/**
 * O sopro do disparo lavando a imagem. É o clarão que a câmera de mira
 * vê: de dentro do cano não existe labareda para olhar, existe a tela
 * estourando por um instante. Acende no mesmo quadro e apaga sozinho.
 */
export function criarClaraoDeTela(): ClaraoDeTela {
  const el = document.createElement('div');
  el.style.cssText = [
    'position: fixed',
    'inset: 0',
    'z-index: 8',
    'pointer-events: none',
    'opacity: 0',
    'background: radial-gradient(circle at 50% 50%,' +
      ' rgba(255, 236, 190, 0.55), rgba(255, 176, 90, 0) 62%)',
  ].join(';');
  document.body.appendChild(el);

  return {
    disparar() {
      // Acende sem transição (mesmo quadro do tiro) e só depois liga o
      // esmaecimento; sem o reflow no meio o navegador funde os dois e
      // o clarão nunca aparece.
      el.style.transition = 'none';
      el.style.opacity = '1';
      void el.offsetHeight;
      el.style.transition = 'opacity 110ms ease-out';
      el.style.opacity = '0';
    },
  };
}

/**
 * Hash curto do commit deste deploy. Fica em todas as câmeras porque é
 * DOM, não cena: sem isso não dá para saber qual versão gerou o número
 * que você acabou de ver.
 */
export function criarVersao(texto: string): HTMLElement {
  const el = document.createElement('div');
  el.textContent = texto;
  el.style.cssText = [
    'position: fixed',
    'z-index: 10',
    'bottom: max(6px, env(safe-area-inset-bottom))',
    'left: 8px',
    'font: 10px ui-monospace, monospace',
    'color: #cfe3cf',
    'opacity: 0.35',
    'letter-spacing: 0.5px',
    'pointer-events: none',
  ].join(';');
  document.body.appendChild(el);
  return el;
}

export interface BarraDeBotoes {
  /** Adiciona um botão ao fim da coluna e devolve o elemento. */
  adicionar(texto: string): HTMLButtonElement;
}

/**
 * Coluna de botões no canto superior direito.
 *
 * Existe porque a lista cresceu — câmera, módulos, munição, tela cheia,
 * ajustes — e posicionar cada um por `top` calculado à mão erra em
 * paisagem de celular, que é onde o app roda. O flex resolve e o
 * `safe-area-inset` mantém tudo fora do entalhe.
 */
export function criarBarraDeBotoes(): BarraDeBotoes {
  const barra = document.createElement('div');
  barra.style.cssText = [
    'position: fixed',
    'z-index: 10',
    'top: max(12px, env(safe-area-inset-top))',
    'right: max(12px, env(safe-area-inset-right))',
    'display: flex',
    'flex-direction: column',
    'align-items: flex-end',
    'gap: 6px',
  ].join(';');
  document.body.appendChild(barra);

  return {
    adicionar(texto) {
      const el = document.createElement('button');
      el.type = 'button';
      el.textContent = texto;
      el.style.cssText = [
        'padding: 7px 11px',
        'font: 11px ui-monospace, monospace',
        'background: #10140f',
        'color: #cfe3cf',
        'border: 1px solid #3a4a3a',
        'border-radius: 6px',
        'touch-action: manipulation',
        'white-space: nowrap',
      ].join(';');
      barra.appendChild(el);
      return el;
    },
  };
}
