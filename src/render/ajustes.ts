import type { AjustesDeMira, CurvaDeGanho } from './sensibilidade.js';

/** Extremos e passo de um deslizador. Vêm de `data/controles.json`. */
export interface FaixaDeAjuste {
  min: number;
  max: number;
  passo: number;
}

/** O bloco `mira` de `data/controles.json`. */
export interface ConfiguracaoMira extends AjustesDeMira {
  /** Trim do eixo vertical. Não é deslizador: é coerência entre eixos. */
  razaoVertical: number;
  ganho: CurvaDeGanho;
  faixas: Record<keyof AjustesDeMira, FaixaDeAjuste>;
}

export interface PainelDeAjustes {
  /**
   * Valores em vigor. O input lê isto no PRÓPRIO evento de toque, então
   * mexer no deslizador vale no gesto seguinte — sem recarregar, sem
   * reiniciar a cena.
   */
  valores(): AjustesDeMira;
  alternar(): void;
  aberto(): boolean;
  destruir(): void;
}

const CHAVE = 'treino-de-mira:ajustes:v1';

const CAMPOS: Array<{ chave: keyof AjustesDeMira; rotulo: string; dica: string }> = [
  {
    chave: 'sensibilidadeBase',
    rotulo: 'sensibilidade base',
    dica: '1,00 = arrastar a tela inteira gira o campo de visão inteiro',
  },
  {
    chave: 'intensidadeGanho',
    rotulo: 'ganho por velocidade',
    dica: '0 desliga a curva; 1 entrega a curva cheia no dedo rápido',
  },
  {
    chave: 'multiplicadorZoomMax',
    rotulo: 'sensib. no zoom máximo',
    dica: '1,00 mantém a sensação da tela; acima disso a mira fica mais solta',
  },
];

/**
 * Painel de ajustes vivo.
 *
 * Os padrões saem de `data/controles.json`; o que o jogador mexer fica
 * em `localStorage` e volta na próxima sessão. Nada aqui calcula regra:
 * o painel só guarda três números que `sensibilidade.ts` consome.
 */
export function criarAjustes(config: ConfiguracaoMira): PainelDeAjustes {
  const padroes: AjustesDeMira = {
    sensibilidadeBase: config.sensibilidadeBase,
    intensidadeGanho: config.intensidadeGanho,
    multiplicadorZoomMax: config.multiplicadorZoomMax,
  };
  const atual: AjustesDeMira = { ...padroes, ...ler(config.faixas) };

  const painel = document.createElement('div');
  painel.style.cssText = [
    'position: fixed',
    'z-index: 12',
    'top: calc(max(12px, env(safe-area-inset-top)) + 44px)',
    'left: max(12px, env(safe-area-inset-left))',
    'width: min(300px, calc(100vw - 24px))',
    'box-sizing: border-box',
    'padding: 12px 14px 14px',
    'font: 12px ui-monospace, monospace',
    'background: rgba(16, 20, 15, 0.95)',
    'color: #cfe3cf',
    'border: 1px solid #3a4a3a',
    'border-radius: 8px',
    'touch-action: manipulation',
    'display: none',
  ].join(';');

  const titulo = document.createElement('div');
  titulo.textContent = 'ajustes de mira';
  titulo.style.cssText = 'margin-bottom: 10px;opacity: 0.7;letter-spacing: 1px';
  painel.appendChild(titulo);

  const leitores: Array<() => void> = [];

  for (const campo of CAMPOS) {
    const faixa = config.faixas[campo.chave];
    const linha = document.createElement('label');
    linha.style.cssText = 'display: block;margin-bottom: 12px';

    const cabeca = document.createElement('div');
    cabeca.style.cssText = 'display: flex;justify-content: space-between;gap: 8px';
    const nome = document.createElement('span');
    nome.textContent = campo.rotulo;
    const valor = document.createElement('span');
    valor.style.cssText = 'color: #9fd39f';
    cabeca.append(nome, valor);

    const deslizador = document.createElement('input');
    deslizador.type = 'range';
    deslizador.min = String(faixa.min);
    deslizador.max = String(faixa.max);
    deslizador.step = String(faixa.passo);
    deslizador.value = String(atual[campo.chave]);
    deslizador.style.cssText = [
      'width: 100%',
      'margin: 6px 0 2px',
      'accent-color: #6c8a6c',
      'touch-action: none',
    ].join(';');

    const dica = document.createElement('div');
    dica.textContent = campo.dica;
    dica.style.cssText = 'font-size: 10px;opacity: 0.5;line-height: 1.3';

    const mostrar = () => {
      valor.textContent = atual[campo.chave].toFixed(2).replace('.', ',');
    };
    // `input`, não `change`: o valor tem que valer enquanto o dedo
    // ainda está no deslizador, senão não dá para calibrar olhando.
    deslizador.addEventListener('input', () => {
      atual[campo.chave] = travar(Number(deslizador.value), faixa);
      mostrar();
      gravar(atual);
    });
    mostrar();

    leitores.push(() => {
      deslizador.value = String(atual[campo.chave]);
      mostrar();
    });

    linha.append(cabeca, deslizador, dica);
    painel.appendChild(linha);
  }

  const restaurar = document.createElement('button');
  restaurar.type = 'button';
  restaurar.textContent = 'restaurar padrões';
  restaurar.style.cssText = [
    'width: 100%',
    'padding: 8px',
    'font: 11px ui-monospace, monospace',
    'color: #cfe3cf',
    'background: #1b2119',
    'border: 1px solid #3a4a3a',
    'border-radius: 6px',
    'touch-action: manipulation',
  ].join(';');
  restaurar.addEventListener('click', () => {
    Object.assign(atual, padroes);
    for (const ler of leitores) ler();
    gravar(atual);
  });
  painel.appendChild(restaurar);

  document.body.appendChild(painel);

  return {
    valores: () => atual,
    aberto: () => painel.style.display !== 'none',
    alternar() {
      painel.style.display = this.aberto() ? 'none' : 'block';
    },
    destruir() {
      painel.remove();
    },
  };
}

const travar = (valor: number, faixa: FaixaDeAjuste): number =>
  Number.isFinite(valor) ? Math.min(faixa.max, Math.max(faixa.min, valor)) : faixa.min;

/**
 * Leitura defensiva: `localStorage` pode não existir (aba privada,
 * armazenamento bloqueado) e o conteúdo pode ser de uma versão antiga.
 * Qualquer campo que não sobreviva à validação volta ao padrão.
 */
function ler(faixas: Record<keyof AjustesDeMira, FaixaDeAjuste>): Partial<AjustesDeMira> {
  try {
    const bruto = window.localStorage?.getItem(CHAVE);
    if (!bruto) return {};
    const salvo = JSON.parse(bruto) as Partial<Record<keyof AjustesDeMira, unknown>>;
    const saida: Partial<AjustesDeMira> = {};
    for (const campo of CAMPOS) {
      const valor = salvo[campo.chave];
      if (typeof valor === 'number' && Number.isFinite(valor)) {
        saida[campo.chave] = travar(valor, faixas[campo.chave]);
      }
    }
    return saida;
  } catch {
    return {};
  }
}

function gravar(ajustes: AjustesDeMira): void {
  try {
    window.localStorage?.setItem(CHAVE, JSON.stringify(ajustes));
  } catch {
    /* sem persistência é degradação aceitável; travar o treino não é. */
  }
}
