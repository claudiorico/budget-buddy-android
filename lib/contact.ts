// Configurações de contato e doações.
// Trocar aqui se mudar email, chave PIX, endereço Bitcoin ou chave Web3Forms.

export const APP_NAME = 'Gestão de Gastos';

// ── Suporte ────────────────────────────────────────────────────────────────

export const SUPPORT_EMAIL = 'gestaodegastosapp@gmail.com';

// Chave pública Web3Forms — encaminha mensagens do form direto pro SUPPORT_EMAIL
// sem precisar de backend. Trocar em web3forms.com se quiser nova key/email.
// Por design, esta key é pública (vai no APK); a segurança vem do throttling
// do próprio Web3Forms (250 msg/mês no free tier).
export const WEB3FORMS_KEY = '287113a6-6115-44cd-ba71-7219142a05aa';
export const WEB3FORMS_ENDPOINT = 'https://api.web3forms.com/submit';

// ── Doações ────────────────────────────────────────────────────────────────

export const PIX_KEY = '0fd1dcd7-4db0-4888-bd44-6384b7d3d888';
export const PIX_KEY_TYPE = 'aleatória (UUID)';
export const PIX_RECIPIENT = 'Claudio Luciano Rico';
export const PIX_INSTITUTION = 'Nubank';

export const BTC_ADDRESS = 'bc1qtf0y90vgxvq39wvypddzm034jz7c62xj7pf64x';
export const BTC_NETWORK = 'Bitcoin (BTC)';
