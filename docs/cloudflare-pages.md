# Publicar a politica no Cloudflare Pages

Use Direct Upload para publicar somente a pagina de politica, sem conectar ou
expor o repositorio.

## Preparar a pasta de upload

```powershell
Remove-Item -Recurse -Force C:\tmp\budget-buddy-policy -ErrorAction SilentlyContinue
New-Item -ItemType Directory C:\tmp\budget-buddy-policy
Copy-Item docs\privacy-policy.html C:\tmp\budget-buddy-policy\index.html
```

O arquivo precisa se chamar `index.html` e ficar na raiz da pasta enviada. Se o
upload for feito com `privacy-policy.html`, a URL raiz do Pages pode abrir como
404.

## Criar o projeto

1. Abra Cloudflare Dashboard.
2. Entre em Workers & Pages.
3. Crie um projeto Pages usando Upload assets / Direct Upload.
4. Envie a pasta `C:\tmp\budget-buddy-policy`.
5. Copie a URL final, por exemplo `https://nome-do-projeto.pages.dev`.

## Configurar no app

Crie um arquivo `.env` local:

```env
EXPO_PUBLIC_PRIVACY_POLICY_URL=https://nome-do-projeto.pages.dev
```

Depois reinicie o bundler do Expo para a variavel entrar no app.
