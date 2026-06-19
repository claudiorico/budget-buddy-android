# Play Console — textos prontos pra colar

Tudo que vai precisar copiar/colar no formulário do Google Play Console.
Limites de caracteres respeitados; revise antes de submeter.

---

## 1. Detalhes do app

### Nome do app (30 caracteres máx)
```
Gestão de Gastos
```
*(16 caracteres)*

### Descrição curta (80 caracteres máx)
```
Controle gastos com privacidade total. Criptografia local + Google Drive.
```
*(72 caracteres)*

### Descrição completa (4000 caracteres máx)
```
Gestão de Gastos é o app de controle financeiro para quem leva privacidade a sério.

Seus dados ficam criptografados no seu próprio Google Drive, com chave que NUNCA sai do seu celular. O desenvolvedor não tem acesso aos seus gastos — nem se quisesse, conseguiria ler.

✦ ZERO SERVIDOR PRÓPRIO
Tudo passa direto entre o app e a sua conta Google. Não armazenamos nada em servidores próprios. Sem analytics, sem ads, sem rastreamento.

✦ CRIPTOGRAFIA DE PONTA
• AES-256-GCM (autenticada) para todos os campos sensíveis
• PBKDF2-SHA256 com 600.000 iterações para derivar a chave
• Chave de criptografia jamais persiste em disco
• Padrão BIP-39 para chave de recuperação de 12 palavras

✦ ENTRADA INTELIGENTE POR IA
Adicione gastos de 3 formas:
• Voz — "café 8 reais hoje" e pronto
• Texto livre — IA extrai descrição, valor, data e categoria
• Manual — formulário tradicional para quando preferir

A IA usa Google Gemini com SUA chave gratuita (free tier do AI Studio cobre uso pessoal). Você fica no controle.

✦ DESBLOQUEIO POR DIGITAL
Atalho seguro via Android Keystore protegido por biometria. Senha como fallback sempre.

✦ DASHBOARD QUE FAZ SENTIDO
• Gastos do mês em BRL e USD
• Gráfico de barras dos 12 meses
• Pizza por categoria
• Alertas visuais quando categoria passa de 80% e 100% da meta mensal

✦ METAS POR CATEGORIA
Defina limite mensal por categoria, acompanhe progresso, receba alerta antes de estourar.

✦ DARK MODE
Toggle Sistema/Claro/Escuro. Respeitando o tema do seu Android.

✦ RECUPERAÇÃO TIPO CARTEIRA DE CRIPTO
12 palavras BIP-39 geradas localmente. Esqueceu a senha? Use a chave de recuperação para criar uma nova senha sem perder nenhum gasto.

✦ GRATUITO E SEM ANÚNCIOS
O app é gratuito. Se ele te ajuda, considere apoiar via PIX ou Bitcoin direto pelo app (sem passar por serviços de doação que cobram taxa).

—

Construído por um dev solo, com cuidado de quem usa o próprio app todo dia. Bugs e sugestões pelo botão Contato dentro do app.
```

### Categoria
**Finanças**

### Tags
- `finance`
- `budget`
- `expense-tracker`
- `privacy`
- `encryption`

### Email de contato
```
gestaodegastosapp@gmail.com
```

### Website (opcional mas recomendado)
```
https://jolly-meadow-3f54.claudiorico81.workers.dev/
```
*(Pode ser a própria Privacy Policy enquanto não tem landing page)*

---

## 2. Classificação de conteúdo

Responder o questionário **"IARC"** (in-app):

| Pergunta | Resposta |
|----------|----------|
| O app tem violência? | Não |
| Conteúdo sexual? | Não |
| Linguagem ofensiva? | Não |
| Substâncias controladas? | Não |
| Apostas? | Não |
| O app é financeiro? | **Sim** (faz gestão de finanças pessoais) |
| Coleta dados pessoais? | Sim — ver Data Safety |
| Compartilha dados com terceiros? | Não (Drive/Gemini são opt-in do usuário com chave própria) |

Resultado esperado: **Livre / Everyone (3+)**.

---

## 3. Data Safety form

### Dados coletados pelo app

| Tipo de dado | Coletado? | Compartilhado? | Opcional? | Por quê |
|--------------|-----------|----------------|-----------|---------|
| Nome | Sim | Não | Não | Mostrado no Perfil (vem do Google Sign-In) |
| Email | Sim | Não | Não | Identificar conta Google |
| Foto de perfil | Sim | Não | Sim | Mostrar no Perfil (cosmético) |
| Informações financeiras (gastos) | Sim | Não | Não | Funcionalidade principal — armazenado **criptografado** no Drive do próprio usuário |
| Voz / áudio | Sim | Sim (Google STT) | Sim | Reconhecimento de voz quando o usuário ativa (microfone) |
| Conteúdo do usuário (texto) | Sim | Sim (Google Gemini) | Sim | IA extrai gastos do texto quando o usuário usa esse caminho |

### Práticas de segurança

- ✅ **Dados criptografados em trânsito** (HTTPS)
- ✅ **Dados criptografados em repouso** (AES-256-GCM antes do upload)
- ✅ **Usuário pode pedir exclusão de dados** (revogar acesso ao Drive deleta tudo)
- ✅ **Dados não vendidos a terceiros**
- ✅ **Independent security review**: Não (mas o código é open-source observável)

### Justificativa do "dados financeiros = não compartilhados"
> Os dados financeiros do usuário (descrição, valores) são criptografados localmente com AES-256-GCM antes de serem enviados ao Google Drive. A chave de criptografia é derivada da senha do usuário (PBKDF2 600k iterations) e nunca sai do dispositivo. O Google armazena apenas os bytes criptografados, sem capacidade de leitura. O desenvolvedor não tem servidor nem acesso aos dados.

---

## 4. Declaração de criptografia (Export Compliance / EAR)

```
[X] Yes, my app uses cryptography
[X] My app qualifies for the exemption under category 5D992.c
    (Mass market encryption commodities) of the U.S. EAR
```

**Justificativa:**
> The app uses standard, commercial cryptography (AES-256-GCM, PBKDF2, HKDF) exclusively for end-user privacy protection of personal financial data. No proprietary cryptographic algorithms. Falls under EAR mass-market exemption 5D992.c. No annual self-classification report required.

---

## 5. Política de Privacidade

URL pública:
```
https://jolly-meadow-3f54.claudiorico81.workers.dev/
```

Conteúdo já hospedado, cobre tudo que o app coleta e como.

---

## 6. Public Key OAuth (Google Sign-In)

Antes de submeter, **cadastrar SHA-1 do keystore EAS** no Google Cloud Console:

1. `eas credentials --platform android` → escolher perfil `production` → "Show keystore details"
2. Copiar **SHA-1 fingerprint**
3. https://console.cloud.google.com/apis/credentials → projeto que tem o Web Client ID `849799119137-3susk1bcec9d5iukk8h2fpd5due5i8ne...`
4. "+ CREATE CREDENTIALS" → "OAuth client ID" → Application type: **Android**
   - Name: `Gestão de Gastos Production`
   - Package name: `com.budgetbuddy.app`
   - SHA-1: cola do EAS

---

## 7. Versionamento

| Item | Valor |
|------|-------|
| `versionName` | `1.0.0` (vem do `app.json`) |
| `versionCode` | auto-incremental via EAS (`appVersionSource: remote`) |
| Track inicial | **Internal testing** (recomendo — você testa com 1-10 emails antes de liberar pra Production) |

---

## 8. Sequência de submissão (resumo)

1. ✅ Criar conta Play Console ($25)
2. ✅ Criar app novo
3. ✅ Preencher: detalhes, content rating, data safety, target audience (13+)
4. ✅ Colar Privacy Policy URL
5. ✅ Subir ícone 512×512 (deixar o Play extrair do AAB ou subir manualmente)
6. ✅ Subir Feature Graphic 1024×500 (ver `docs/feature-graphic-prompt.md`)
7. ✅ Subir 4-8 screenshots (ver `docs/feature-graphic-prompt.md` pra lista de telas)
8. ✅ Upload AAB no track "Internal testing"
9. ✅ Adicionar emails de testers
10. ✅ Submit for review → 1-7 dias de espera Google
11. Quando aprovado: promover de Internal pra Production
