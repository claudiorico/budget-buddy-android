# Feature Graphic 1024×500 + Screenshots — briefing

## Feature Graphic (banner do app na Play Store)

**Especificação técnica:**
- Tamanho: **1024×500 pixels** (exato — não maior, não menor)
- Formato: PNG ou JPG, sem transparência
- Tamanho máximo: 1MB
- Sem texto duplicado do título do app (Google sobrepõe o nome do app)
- Compatível com letterbox em telas pequenas (elementos críticos no centro)

### Prompt pra Midjourney / Gemini Image / Imagen 4

```
Modern minimalist banner for an Android personal finance app named "Gestão de Gastos" (Portuguese). 1024x500 horizontal landscape composition. Color palette: deep navy blue (#0F172A) as background with vibrant emerald green (#10B981) and bright blue (#2563EB) accents. On the left third: a stylized abstract padlock icon merged with a shield in clean geometric line-art style, in soft green-blue gradient, suggesting privacy and security. On the right two-thirds: a clean, modern bar chart in 3-4 ascending bars (small to tall) using the green/blue palette, plus a small floating donut/pie chart fragment overlapping subtly. Above the chart, a soft glowing tagline in elegant sans-serif: "Seus gastos. Sua privacidade." in white with subtle drop shadow. Geometric accents: thin diagonal lines and small circular dots scattered, suggesting data flow. Slight gradient overlay top-to-bottom from #0F172A to #1F2937. Flat 2D style, no people, no realistic objects, no logos of other companies. Premium fintech aesthetic, banking-app vibes, clean and trustworthy. Centered safe area for letterbox.
```

**Variações se quiser testar:**

- Trocar "padlock+shield" por "wallet+lock" se preferir referência financeira mais direta
- Mudar tagline pra `"Privacidade real pros seus gastos."` (mais curto)
- Versão claro: trocar background #0F172A por #F9FAFB e accents por #2563EB / #059669

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
