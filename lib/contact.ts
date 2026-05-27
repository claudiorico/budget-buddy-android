// Configurações de contato e doações.
// Trocar aqui se mudar email, chave PIX, endereço Bitcoin ou chave Web3Forms.

export const APP_NAME = 'Gestão de Gastos';

// ── Suporte ────────────────────────────────────────────────────────────────

export const SUPPORT_EMAIL = 'gestaodegastosapp@gmail.com';

// EmailJS — encaminha mensagens do form direto pro SUPPORT_EMAIL via Gmail
// conectado via OAuth no dashboard.emailjs.com. Sem backend próprio.
// Public/Private keys aqui vão no APK; segurança vem do throttling do EmailJS
// (200 msg/mês no free tier) + strict mode com Private Key.
// Para trocar: alterar em dashboard.emailjs.com e atualizar as 4 constantes abaixo.
export const EMAILJS_ENDPOINT = 'https://api.emailjs.com/api/v1.0/email/send';
export const EMAILJS_SERVICE_ID = 'service_0w7d3d7';
export const EMAILJS_TEMPLATE_ID = 'template_18ux6uf';
export const EMAILJS_PUBLIC_KEY = 'p-DbpgTCERsF9YA-z';
export const EMAILJS_PRIVATE_KEY = 'Z-ZJvAI9eiPc5AnO5Aggf';

// ── Doações ────────────────────────────────────────────────────────────────

export const PIX_KEY = '0fd1dcd7-4db0-4888-bd44-6384b7d3d888';
export const PIX_KEY_TYPE = 'aleatória (UUID)';
export const PIX_RECIPIENT = 'Claudio Luciano Rico';
export const PIX_INSTITUTION = 'Nubank';

export const BTC_ADDRESS = 'bc1qtf0y90vgxvq39wvypddzm034jz7c62xj7pf64x';
export const BTC_NETWORK = 'Bitcoin (BTC)';
