import type { DimensaoTela } from './sensibilidade.js';

/**
 * Viewport e tela cheia.
 *
 * Uma fonte só para "qual é a área visível AGORA", em pixels CSS. Ela
 * alimenta três coisas que precisam concordar ou a mira sai do lugar:
 * o tamanho do canvas, a razão de aspecto das câmeras e o ângulo por
 * pixel do input.
 *
 * `window.innerHeight` não serve sozinho no celular: com a barra de
 * endereço na tela ele conta a área que está atrás dela. Quem sabe o
 * que o dedo realmente enxerga é `visualViewport`; `innerWidth/Height`
 * fica de reserva para onde ele não existe.
 */
export interface ControleDeTela {
  /** Área visível em px CSS. Sempre inteira: canvas não gosta de subpixel. */
  tamanho(): DimensaoTela;
  emTelaCheia(): boolean;
  /** Falso onde a API não existe — iPhone no Safari, por exemplo. */
  suportaTelaCheia(): boolean;
  /** Entra em tela cheia. Só funciona dentro de um gesto do usuário. */
  entrar(): void;
  sair(): void;
  alternar(): void;
  /** Chamado a cada mudança de área visível, já com o tamanho novo. */
  aoMudar(ouvinte: (tamanho: DimensaoTela) => void): void;
  /** Chamado quando o navegador CONFIRMA entrada ou saída da tela cheia. */
  aoMudarTelaCheia(ouvinte: (cheia: boolean) => void): void;
  destruir(): void;
}

type RaizComPrefixo = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};
type DocumentoComPrefixo = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

export function criarControleDeTela(raiz: HTMLElement): ControleDeTela {
  const doc = document as DocumentoComPrefixo;
  const alvo = raiz as RaizComPrefixo;
  const ouvintes: Array<(tamanho: DimensaoTela) => void> = [];
  let agendado = 0;

  const medir = (): DimensaoTela => {
    const vv = window.visualViewport;
    // A escala só é ≠ 1 sob pinça do navegador; o viewport da página
    // proíbe isso, mas se algum navegador ignorar, dividir devolve a
    // medida em px CSS da página, que é a unidade do PointerEvent.
    const largura = vv ? vv.width * vv.scale : window.innerWidth;
    const altura = vv ? vv.height * vv.scale : window.innerHeight;
    return {
      largura: Math.max(1, Math.round(largura)),
      altura: Math.max(1, Math.round(altura)),
    };
  };

  const emTelaCheia = () =>
    Boolean(document.fullscreenElement ?? doc.webkitFullscreenElement);

  function entrar(): void {
    if (emTelaCheia()) return;
    try {
      // `navigationUI: hide` é o que tira a barra no Android; onde não
      // for suportado o navegador ignora a opção e entra assim mesmo.
      const pedido =
        alvo.requestFullscreen?.({ navigationUI: 'hide' }) ??
        alvo.webkitRequestFullscreen?.();
      void Promise.resolve(pedido)
        .then(() => {
          // Travar a orientação só é permitido em tela cheia, e só em
          // parte dos navegadores. Falhar aqui é irrelevante.
          const orientacao = screen.orientation as ScreenOrientation & {
            lock?: (o: string) => Promise<void>;
          };
          return orientacao?.lock?.('landscape');
        })
        .catch(() => {
          /* sem tela cheia ou sem trava: o app continua funcionando. */
        });
    } catch {
      /* idem. */
    }
  }

  function sair(): void {
    if (!emTelaCheia()) return;
    void Promise.resolve(
      document.exitFullscreen?.() ?? doc.webkitExitFullscreen?.(),
    ).catch(() => {
      /* nada a fazer. */
    });
  }

  /** Um aviso por quadro: girar o aparelho dispara vários eventos juntos. */
  function avisar(): void {
    if (agendado) return;
    agendado = requestAnimationFrame(() => {
      agendado = 0;
      const tamanho = medir();
      for (const ouvinte of ouvintes) ouvinte(tamanho);
    });
  }

  const vv = window.visualViewport;
  window.addEventListener('resize', avisar);
  window.addEventListener('orientationchange', avisar);
  document.addEventListener('fullscreenchange', avisar);
  document.addEventListener('webkitfullscreenchange', avisar);
  vv?.addEventListener('resize', avisar);
  vv?.addEventListener('scroll', avisar);

  return {
    tamanho: medir,
    emTelaCheia,

    suportaTelaCheia: () =>
      Boolean(document.fullscreenEnabled ?? true) &&
      (typeof alvo.requestFullscreen === 'function' ||
        typeof alvo.webkitRequestFullscreen === 'function'),

    entrar,
    sair,

    alternar() {
      if (emTelaCheia()) sair();
      else entrar();
    },

    /**
     * Só `fullscreenchange` diz se o pedido foi aceito: entrar e sair
     * são assíncronos, e ler o estado logo depois de pedir devolve o
     * estado ANTIGO. Quem depende disso — o rótulo do botão — escuta.
     */
    aoMudarTelaCheia(ouvinte) {
      const aviso = () => ouvinte(emTelaCheia());
      document.addEventListener('fullscreenchange', aviso);
      document.addEventListener('webkitfullscreenchange', aviso);
    },

    aoMudar(ouvinte) {
      ouvintes.push(ouvinte);
    },

    destruir() {
      if (agendado) cancelAnimationFrame(agendado);
      window.removeEventListener('resize', avisar);
      window.removeEventListener('orientationchange', avisar);
      document.removeEventListener('fullscreenchange', avisar);
      document.removeEventListener('webkitfullscreenchange', avisar);
      vv?.removeEventListener('resize', avisar);
      vv?.removeEventListener('scroll', avisar);
      ouvintes.length = 0;
    },
  };
}
