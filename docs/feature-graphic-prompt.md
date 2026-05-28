# Feature Graphic 1024×500 + Screenshots — briefing

## Feature Graphic (banner do app na Play Store)

**Especificação técnica:**
- Tamanho: **1024×500 pixels** (exato — não maior, não menor)
- Formato: PNG ou JPG, sem transparência
- Tamanho máximo: 1MB
- Sem texto duplicado do título do app (Google sobrepõe o nome do app)
- Compatível com letterbox em telas pequenas (elementos críticos no centro)

### Prompt pra Midjourney / Gemini Image / Imagen 4

> Paleta consistente com o ícone do app: laranja queimado (carteira/barras) + roxo profundo (fundo) + dourado (cadeado/acentos).

```
Modern minimalist banner for an Android personal finance app named "Gestão de Gastos" (Portuguese). 1024x500 horizontal landscape composition. Color palette: deep purple (#3B0764) as the dominant background with a faint radial brightening at center toward indigo-purple (#581C87), warm burnt orange (#EA580C to #F97316) for primary subjects, and bright gold (#FCD34D to #F59E0B) for accents and the padlock — a distinctive warm/bold scheme. On the left third: a stylized abstract padlock icon merged with a shield in clean geometric line-art style, padlock rendered in bright gold gradient (#FCD34D to #F59E0B) with a thin darker amber outline for a metallic feel, shield in burnt orange (#EA580C to #F97316), suggesting privacy and security with a premium gold-on-orange contrast. On the right two-thirds: a clean modern bar chart in 3-4 ascending bars (small to tall) in burnt orange to amber-orange gradient (#EA580C to #F97316), plus a small floating donut/pie chart fragment in mixed gold and orange overlapping subtly. Above the chart, a soft glowing tagline in elegant sans-serif: "Seus gastos. Sua privacidade." in warm cream (#FEF3C7) with a subtle gold-amber glow. Geometric accents: thin diagonal lines in gold and small circular dots in amber scattered, suggesting data flow. Slight gradient overlay top-to-bottom from #3B0764 to #1E1B4B (deep purple to deeper indigo). Flat 2D style, no people, no realistic objects, no logos of other companies. Premium fintech aesthetic with a distinctive warm/bold personality (not the typical cold teal/green fintech look), clean and trustworthy. Centered safe area for letterbox.
```

**Variações se quiser testar:**

- Trocar "padlock+shield" por "wallet with small gold padlock accent" pra refletir literalmente o ícone do app
- Mudar tagline pra `"Privacidade real pros seus gastos."` (mais curto)
- Suavizar o roxo: trocar `#3B0764` por `#4C1D95` se a primeira saída ficar muito escura
- Mais contraste no cadeado: descrever o cadeado como `"cool teal/mint gradient (#5EEAD4 to #2DD4BF)"` em vez de gold — fica complementar real ao laranja (mais ousado, menos "premium banking")

### Plano B (sem IA, usando Canva)

1. Abre canva.com → busca "Google Play Feature Graphic" (template 1024×500)
2. Pega um template clean estilo "fintech app"
3. Substitui texto pelo tagline e logo pelo icon.png (`assets/images/icon.png`)
4. Exporta como PNG, salva em `assets/store/feature-graphic.png`

---

## Screenshots — telas a capturar

Mínimo 2, ideal 4-8. Tudo na resolução do seu celular (1080x2400 está ótimo — Play aceita 16:9 a 19.5:9).

### Lista priorizada (capture nessa ordem; pode parar nas 4-5 primeiras se quiser):

| # | Tela | Como chegar | Por que importa |
|---|------|-------------|-----------------|
| 1 | **Login** | Sair da conta (Perfil → Conta → Sair) | Mostra valor: "Criptografia AES-256 + Drive privado" — é o pitch |
| 2 | **Dashboard com dados** | Abra após desbloquear cofre. Tela inicial. | Gráficos vendem app financeiro |
| 3 | **Adicionar gasto via IA (Texto)** | Aba Gastos → "+" → "Descrever em texto" → digita "almoço 25 reais hoje" | Mostra o diferencial da IA |
| 4 | **Preview do gasto extraído** | Após tap "Extrair com IA" da tela 3 | Mostra que IA funciona certinho |
| 5 | **Tela de Metas com alerta** | Aba Metas (precisa ter uma meta com >80% gasto) | Mostra alerta colorido — destaque visual |
| 6 | **Perfil completo** | Aba Perfil | Mostra todas as features (Apoiar, Aparência, IA, Segurança, Suporte) — vitrine |
| 7 | **Modal de Doação com QR PIX** | Perfil → "Apoie o desenvolvedor" → tab PIX | Mostra que app é gratuito + opções de apoio |
| 8 | **Modal de Desbloqueio com digital** | Perfil → "Desbloqueio por digital" (precisa ativar antes) | Mostra biometria — feature técnica |

### Como capturar

No celular físico:
- Volume Down + Power simultâneos
- Ou via ADB: `adb -s ZF5255Z9VN exec-out screencap -p > screenshot.png`

**Dica:** capture com **dark mode** se preferir visual mais moderno. Mas pra Play Store, **light mode** geralmente vende mais (telas mais "limpas" no thumbnail).

### Onde salvar

Crie `assets/store/screenshots/` e nomeie `01-login.png`, `02-dashboard.png`, etc. (gitignored automaticamente se quiser — não precisa commitar).

---

## Ícone 512×512 — Play Store

Já temos `assets/images/icon.png` em **1024×1024**. O Play Store aceita até 512×512 — vai **automaticamente reescalar** o icon do AAB. **Não precisa fazer nada extra.**

Se quiser subir manualmente um 512×512 pra controlar a qualidade:
- Abra `assets/images/icon.png`
- Exporte/redimensione pra 512×512 PNG (com transparência se já tem)
- Salva como `assets/store/icon-512.png`

---

## Quando enviar tudo isso

Tudo isso vai pro formulário do **Google Play Console** (`docs/play-console.md` tem os textos e a sequência completa).
