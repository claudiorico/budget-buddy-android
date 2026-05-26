# Budget Buddy Android

App Android de controle de gastos pessoais com **criptografia end-to-end** e **zero servidor próprio**. Seus dados ficam apenas na sua conta Google — o desenvolvedor não tem acesso a nada.

---

## Objetivo

Registrar e visualizar gastos de cartão de crédito com **privacidade total**. Sincronização automática pelo Google Drive, sem custódia de terceiros, sem assinatura, sem anúncios.

---

## O que o app faz

### Registrar gastos — quatro caminhos
1. **Voz** — toque no microfone, fale `"café 8 reais hoje"` e a IA preenche tudo.
2. **Texto livre** — digite `"uber pro centro ontem 28,50"` e a IA extrai descrição, valor, data e categoria.
3. **Share intent** — receba uma notificação do banco, toque em *Compartilhar* → escolha Budget Buddy. O app abre direto no formulário com os dados pré-preenchidos.
4. **Manual** — formulário tradicional sempre disponível como fallback.

Todos os caminhos passam por um *preview sheet* onde você revisa antes de salvar.

### Visualizar
- **Dashboard** com cards de total mensal (BRL/USD), gráfico de barras dos 12 meses do ano, pizza por categoria.
- **Alertas de meta**: ícones amarelo (≥80%) e vermelho (≥100%) destacam categorias estourando o orçamento.
- **Lista de gastos** filtrável por mês com ordenação por data, edição e exclusão.

### Organizar
- 8 categorias padrão (alimentação, transporte, saúde, lazer, moradia, vestuário, educação, outros).
- Criar categorias customizadas com cor e ícone.
- Definir **metas mensais** por categoria com barra de progresso.

### Segurança e recuperação
- Senha do cofre (PBKDF2-SHA256, 600.000 iterações).
- **12 palavras BIP-39** para recuperar acesso se esquecer a senha.
- Regenerar a chave de recuperação a qualquer momento.
- *Bloquear cofre* sem deslogar — útil pra emprestar o celular.

---

## Funcionalidades exclusivas

| Recurso | Por que importa |
|--------|----------------|
| **Zero backend** | Não existe servidor do desenvolvedor. Nenhum dado seu sai do seu próprio Google Drive. |
| **Criptografia AES-256-GCM no device** | Descrição, valor BRL e USD são cifrados *antes* do upload. A chave (DEK) nunca persiste — vive só em memória. |
| **Entrada por voz on-device** | Reconhecimento de fala em pt-BR pelo próprio Android, sem mandar áudio pra nuvem. |
| **IA via sua API key** | Gemini 2.0 Flash extrai os campos do texto. Você cola sua key no Perfil, ela fica só no device. Free tier do Google cobre uso pessoal. |
| **Share intent nativo** | Compartilhe qualquer notificação/SMS do banco e o app vira gasto. Funciona com qualquer banco brasileiro. |
| **Recuperação BIP-39** | Mesmo padrão de seed phrase usado em carteiras de cripto — testado em produção há anos. |
| **Doações via Ko-fi** | Botão direto pra Ko-fi. Sem in-app purchase, sem 15-30% do Google, sem PCI/DSS. |
| **Sem assinatura, sem anúncios** | Gratuito. Sem dark patterns. Sem trial. |

---

## Stack técnica

- **Expo SDK 56** + **Expo Router v4** (managed workflow com dev build)
- **NativeWind 4** (Tailwind para React Native)
- **TypeScript** estrito
- **react-native-quick-crypto** (Web Crypto API nativa)
- **@google/genai** (Gemini 2.0 Flash com `responseSchema`)
- **expo-speech-recognition** (STT on-device pt-BR)
- **expo-share-intent** (recebe ACTION_SEND do Android)
- **@react-native-google-signin/google-signin** (auth + Drive scope)
- **Victory Native** (gráficos)
- **@shopify/flash-list** (lista virtualizada)
- **react-native-mmkv** (cache local — apenas IDs e API key, nunca dados sensíveis)

---

## Modelo de privacidade

```
Você → App → Sua conta Google (Drive appDataFolder)
              ↑
           (sem intermediários)
```

- Os arquivos ficam em `appDataFolder` — uma pasta oculta no seu Drive que **só o próprio app** consegue ler/escrever.
- O desenvolvedor **não tem acesso** aos seus arquivos.
- Trocou de celular? Faça login com a mesma conta Google e seu cofre volta inteiro.
- Apagou o app por engano? Os dados continuam lá — basta reinstalar.
- Quer abandonar o app? Acesse `drive.google.com/drive/u/0/settings` → *Gerenciar apps* → revogue o Budget Buddy. Pronto.

### O que **não** sai do seu device em plaintext
- Descrição do gasto
- Valor BRL e USD
- Senha do cofre
- DEK (chave de criptografia)
- 12 palavras de recuperação

### O que **fica** plaintext no Drive (não-sensível)
- Categorias (nome, cor, ícone)
- Metas (limite mensal por categoria)
- Data e categoria de cada gasto (sem valor nem descrição)

---

## Setup rápido (dev)

```powershell
npm install --legacy-peer-deps
npx expo prebuild --platform android
npx expo run:android
```

Requer:
- Node 20+
- JDK 17
- Android SDK + dispositivo/emulador
- Web Client ID configurado em `contexts/AuthContext.tsx` (Google Cloud Console)
- API key do Gemini (gratuita em [aistudio.google.com/apikey](https://aistudio.google.com/apikey)) — configurada *dentro* do app, em **Perfil → Configurar API Gemini**

Testes:
```powershell
npm test            # 55 testes Jest (crypto + aggregations)
npm run test:e2e    # suite Maestro (login, unlock, criar gasto)
```

---

## Status

- **Fases 1-4** do PRD completas (fundação, auth+vault, dashboard, CRUD)
- **Entrada inteligente** (voz/texto/share) implementada
- **Fase 5** (Play Store) pendente — keystore, ícones, Privacy Policy, declaração EAR
