# Publicar site e politica no Cloudflare Pages

Use Direct Upload para publicar a landing page e a politica de privacidade sem
conectar ou expor o repositorio.

## Preparar a pasta de upload

```powershell
Remove-Item -Recurse -Force C:\tmp\budget-buddy-site -ErrorAction SilentlyContinue
New-Item -ItemType Directory C:\tmp\budget-buddy-site
Copy-Item docs\index.html C:\tmp\budget-buddy-site\index.html
Copy-Item docs\privacy-policy.html C:\tmp\budget-buddy-site\privacy-policy.html
```

Depois do upload:

- Site do app: `https://jolly-meadow-3f54.claudiorico81.workers.dev/`
- Politica de privacidade: `https://jolly-meadow-3f54.claudiorico81.workers.dev/privacy-policy.html`

## Criar ou atualizar o projeto

1. Abra Cloudflare Dashboard.
2. Entre em Workers & Pages.
3. Abra o projeto que gera a URL `jolly-meadow-3f54.claudiorico81.workers.dev`.
4. Use Upload assets / Direct Upload.
5. Envie a pasta `C:\tmp\budget-buddy-site`.

## Configurar no app

Use a URL especifica da politica:

```env
EXPO_PUBLIC_PRIVACY_POLICY_URL=https://jolly-meadow-3f54.claudiorico81.workers.dev/privacy-policy.html
```

Depois reinicie o bundler ou gere uma nova build para a variavel entrar no app.
