/**
 * Utilitário de rastreamento Meta Pixel (Facebook Pixel) em TypeScript.
 * Suporta Next.js (lendo NEXT_PUBLIC_META_PIXEL_ID) e SPA/estático.
 */

declare global {
  interface Window {
    fbq?: {
      (action: string, eventName: string, params?: Record<string, unknown>): void;
      callMethod?: (...args: unknown[]) => void;
      queue?: unknown[];
      loaded?: boolean;
      version?: string;
      push?: unknown;
    };
    _fbq?: Window['fbq'];
    __fbPixelInitialized?: boolean;
    __fbPixelId?: string;
  }
}

/**
 * Retorna o ID configurado via variável de ambiente do Next.js ou fallback no objeto window
 */
export const getPixelId = (): string | undefined => {
  if (typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_META_PIXEL_ID) {
    return process.env.NEXT_PUBLIC_META_PIXEL_ID;
  }
  if (typeof window !== 'undefined' && window.__fbPixelId) {
    return window.__fbPixelId;
  }
  return undefined;
};

/**
 * Inicializa o Meta Pixel com verificação anti-duplicação
 */
export const initPixel = (customId?: string): boolean => {
  if (typeof window === 'undefined') return false;

  const pixelId = customId || getPixelId();
  if (!pixelId) {
    console.warn('[Meta Pixel] ID não encontrado em NEXT_PUBLIC_META_PIXEL_ID ou window.__fbPixelId.');
    return false;
  }

  // Previne inicialização duplicada do mesmo ID
  if (window.__fbPixelInitialized) {
    return true;
  }

  if (!window.fbq) {
    const n = (window.fbq = function (...args: unknown[]) {
      if (n.callMethod) {
        n.callMethod(...args);
      } else {
        (n.queue = n.queue || []).push(args);
      }
    });
    if (!window._fbq) window._fbq = n;
    n.push = n;
    n.loaded = true;
    n.version = '2.0';
    n.queue = [];
  }

  window.fbq('init', pixelId);
  window.__fbPixelInitialized = true;
  return true;
};

/**
 * Envia evento genérico para o Meta Pixel
 */
export const event = (name: string, params?: Record<string, unknown>): void => {
  if (typeof window === 'undefined' || !window.fbq) return;
  if (!window.__fbPixelInitialized && !initPixel()) return;

  if (params) {
    window.fbq('track', name, params);
  } else {
    window.fbq('track', name);
  }
};

/**
 * Rastreia visualização de página (PageView)
 */
export const pageView = (): void => {
  event('PageView');
};

/**
 * Rastreia conversão de Lead (envio de formulários, pedido de demonstração)
 */
export const lead = (params?: Record<string, unknown>): void => {
  event('Lead', params);
};

/**
 * Rastreia clique em canais de contato (botões de WhatsApp, telefone, chat)
 */
export const contact = (params?: Record<string, unknown>): void => {
  event('Contact', params);
};

/**
 * Rastreia agendamento concluído
 */
export const schedule = (params?: Record<string, unknown>): void => {
  event('Schedule', params);
};

/**
 * Rastreia visualização de conteúdo chave (ex: visualização da landing page)
 */
export const viewContent = (params?: Record<string, unknown>): void => {
  event('ViewContent', params);
};
