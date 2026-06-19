# Política de Privacidade — Gestão de Gastos

**Última atualização:** 27 de maio de 2026

## Resumo em 1 minuto

- **Não armazenamos seus dados em nenhum servidor nosso.** Tudo fica no seu Google Drive, criptografado.
- **Não temos como ler seus gastos**, mesmo se quiséssemos — eles são criptografados no seu celular antes de subir.
- **Não usamos ads**, **não vendemos dados**, **não rastreamos você**.
- **Você é o dono dos seus dados.** Pode apagar tudo a qualquer momento revogando o acesso do app no Google Drive.

---

## 1. Quem somos

O **Gestão de Gastos** é um aplicativo Android desenvolvido individualmente por **Cláudio Luciano Rico**, sem fins lucrativos. Contato: [gestaodegastosapp@gmail.com](mailto:gestaodegastosapp@gmail.com).

## 2. O que o app coleta

### 2.1. Dados da sua conta Google
Ao fazer login com Google, recebemos do Google:
- **Nome** e **email** da sua conta
- **Foto de perfil** (somente exibida no app)
- **Token de acesso ao Google Drive** (escopo `drive.appdata`, restrito à pasta privada do próprio app)

Esses dados ficam **só no seu celular** (memória + cache local). **Nunca são enviados para nenhum servidor nosso** (não temos servidor).

### 2.2. Seus gastos
Você digita ou dita gastos. Cada gasto contém: descrição, valor (BRL e/ou USD), data e categoria.

**Antes de qualquer envio ao Google Drive**, todos os campos sensíveis (descrição, valor BRL e valor USD) são **criptografados no seu celular** usando AES-256-GCM com uma chave derivada da sua senha do cofre (PBKDF2-SHA256, 600.000 iterações).

A chave de criptografia (DEK) **nunca sai do seu celular** — fica apenas em memória RAM enquanto o cofre está desbloqueado. Quando você bloqueia o cofre ou fecha o app, a chave é apagada da memória.

### 2.3. Sua senha do cofre
**Nunca sai do seu celular.** É usada localmente para derivar a chave de criptografia e nunca é armazenada em texto plano em lugar nenhum.

**Se você ativar "Desbloqueio por digital"**, sua senha é armazenada no **Android Keystore** do seu próprio aparelho, protegida pela sua biometria. Mesmo o sistema operacional não consegue ler essa senha sem o seu dedo. Você pode desativar a qualquer momento em Perfil → Segurança → Desbloqueio por digital.

### 2.4. Sua chave de recuperação (12 palavras)
Gerada localmente no seu celular usando o padrão BIP-39 (mesmo de carteiras de criptomoedas). **Mostrada uma única vez na criação do cofre** e **nunca enviada a lugar nenhum**. Você é responsável por anotar e guardar em local seguro.

### 2.5. Chave de API do Gemini (opcional)
Se você optar por usar a funcionalidade de extração inteligente de gastos por voz/texto, **você fornece sua própria chave da API do Google Gemini** (gratuita no Google AI Studio). Essa chave é armazenada localmente no seu celular usando **SecureStore/Android Keystore** e usada exclusivamente para chamar a API do Google. **Não temos acesso a ela.**

### 2.6. O que **NÃO** coletamos
- Sem analytics (Firebase, Google Analytics, etc).
- Sem advertising IDs.
- Sem rastreamento de comportamento.
- Sem captura de tela ou logs remotos.
- Sem coleta de localização.
- Sem identificadores de dispositivo (IMEI, Android ID, etc) além do que o sistema operacional usa internamente para autenticação Google.

## 3. Como seus dados são usados

### 3.1. Armazenamento no Google Drive
Seus arquivos criptografados são salvos em uma pasta especial chamada **`appDataFolder`** do seu Google Drive. Essa pasta:
- É **oculta** na interface do Google Drive (você não vê na lista de arquivos).
- **Só este app consegue ler/escrever** nela. Outros apps não têm acesso.
- **Faz parte da sua conta Google**, não de uma conta nossa.

Você pode visualizar os arquivos e remover o acesso do app a qualquer momento em [drive.google.com/drive/u/0/settings](https://drive.google.com/drive/u/0/settings) → "Gerenciar apps".

### 3.2. Reconhecimento de voz (opcional)
Se você usar "Ditar gasto por voz", o áudio é transcrito pelo **serviço de reconhecimento de voz do próprio Android** (geralmente Google Speech). Configurações do app permitem que isso aconteça via serviço **online** do Google (qualidade melhor) ou **offline** (depende do que seu device suporta).

A transcrição **resultante** (texto puro) é então enviada para a **API do Google Gemini** (usando a chave que **você forneceu**) que extrai os campos do gasto.

O áudio em si **não é armazenado** pelo app. Os termos de uso e privacidade do Google se aplicam ao reconhecimento de voz e ao Gemini.

### 3.3. Reconhecimento de texto pela IA (opcional)
Quando você usa "Descrever em texto", o texto digitado é enviado para a **API do Google Gemini** (com sua chave) para extrair: descrição, valor, data e categoria sugerida. **Apenas o texto que você forneceu** é enviado — nenhum outro dado do seu app vai junto.

### 3.4. Mensagens de suporte
Quando você usa "Contato e suporte", o app abre o aplicativo de email do seu dispositivo com destinatário, assunto e mensagem preenchidos. O envio acontece pelo seu próprio app de email.

Termos do EmailJS: [emailjs.com/legal/terms-of-service](https://www.emailjs.com/legal/terms-of-service).

### 3.5. Doações (PIX e Bitcoin)
São transferências **diretas** entre você e o desenvolvedor, sem passar pelo app. As chaves PIX e Bitcoin são apenas exibidas/copiadas. Nenhuma transação é registrada pelo app.

## 4. Compartilhamento com terceiros

O app **não compartilha** seus dados financeiros com ninguém. Os únicos terceiros envolvidos são:

| Serviço | O que recebe | Por quê |
|---------|--------------|---------|
| **Google** (Drive API, Sign-In) | Arquivos criptografados (que ele não consegue descriptografar) e dados básicos do seu perfil Google | Autenticação e armazenamento |
| **Google** (Speech-to-Text, opcional) | Áudio da sua fala quando você usa o microfone | Transcrever áudio em texto |
| **Google** (Gemini API, opcional) | Texto que você digitou/falou, com sua própria chave de API | Extrair campos do gasto |
| **App de email do usuário** (somente quando você usa "Contato") | Conteúdo da mensagem de suporte | Enviar a mensagem para o desenvolvedor |

**Não temos servidor próprio.** Não há banco de dados do desenvolvedor armazenando nada seu.

## 5. Permissões do Android

O app pede:

- **Internet** — para falar com Google Drive e Gemini API
- **Microfone** — apenas quando você usa "Ditar gasto por voz" (opcional)
- **Biometria** — apenas quando você ativa "Desbloqueio por digital" (opcional)
Não pedimos: localização, contatos, câmera, SMS, ligações, armazenamento externo, receber compartilhamentos de outros apps, ou qualquer outra permissão sensível.

## 6. Crianças

O app não é direcionado a menores de 13 anos. Não coletamos intencionalmente dados de crianças.

## 7. Segurança

- **Criptografia AES-256-GCM** (autenticada) para todos os campos sensíveis
- **PBKDF2-SHA256 com 600.000 iterações** para derivar a chave da senha
- **HKDF-SHA256** para derivar sub-chaves
- **Chave nunca persistida em disco** — apenas em memória durante uso
- **Android Keystore** (hardware-backed quando disponível) para a senha protegida por biometria
- **BIP-39 padrão** para a chave de recuperação de 12 palavras

Detalhes técnicos sobre criptografia, armazenamento e permissões estão resumidos nesta política. O código-fonte do app não é publicado junto com a página de privacidade.

## 8. Seus direitos

Você pode, a qualquer momento:

1. **Visualizar todos os seus dados** baixando os arquivos `.json` da pasta `appDataFolder` do seu Drive (com ferramentas que aceitem essa pasta especial).
2. **Apagar tudo** — vá em Perfil → Sair da conta, e depois em [drive.google.com/drive/u/0/settings](https://drive.google.com/drive/u/0/settings) → Gerenciar apps → Remover acesso do "Gestão de Gastos". Os arquivos `appDataFolder` serão deletados pelo próprio Google.
3. **Exportar** — funcionalidade não implementada na v1.0. Os dados estão no seu Drive criptografados; sem a senha do cofre, **nem nós nem o Google conseguem ler**.
4. **Reclamar** — entre em contato em [gestaodegastosapp@gmail.com](mailto:gestaodegastosapp@gmail.com) ou diretamente pelo app em Perfil → Contato e suporte.

## 9. Mudanças nesta política

Se atualizarmos esta política, a data no topo será alterada. Mudanças significativas serão comunicadas dentro do app na próxima atualização.

## 10. Contato

**Cláudio Luciano Rico**
Email: [gestaodegastosapp@gmail.com](mailto:gestaodegastosapp@gmail.com)
