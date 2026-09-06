import type { ResultadoImpacto, Veiculo } from '../core/index.js';

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
