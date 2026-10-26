## Why

Hoje, visitantes não autenticados que acessam o TripMap caem diretamente na interface principal da aplicação (mapa com visualização em branco, linha do tempo vazia e múltiplos botões de gerenciamento avançado), com um botão discreto de login misturado no canto da barra de navegação. Uma tela inicial (Home/Landing) limpa e acolhedora com a logo em destaque, proposta de valor e botão claro de "Entrar com Google" estabelece um ponto de entrada profissional, preserva a privacidade do sistema e orienta claramente novos usuários e convidados de viagens.

## What Changes

- **Tela de Boas-Vindas / Home Landing**: Para usuários não autenticados (`!currentUser`), exibe uma tela dedicada com a logo oficial, título de boas-vindas e botão proeminente de autenticação via Google OAuth.
- **Card Contextual de Convite de Viagem**: Ao acessar por link de compartilhamento com token (`/join?token=...` ou parâmetro de convite), a Home exibe um card informando a viagem para a qual o usuário foi convidado e convida a fazer login para participar.
- **Transição Fluida Pós-Login**: Após autenticação bem-sucedida pelo Google OAuth, o sistema carrega o mapa e as viagens sem exibir botões desnecessários antes da hora.

## Capabilities

### New Capabilities
- `home-landing-auth`: Componente e fluxo de tela inicial de boas-vindas para visitantes deslogados com suporte a convites e login via Google.

### Modified Capabilities
*(Nenhuma especificação existente teve seus requisitos centrais alterados)*

## Impact

- **Frontend**: Componente `HomeLanding.tsx` introduzido; `App.tsx` passa a renderizar a Home quando `!currentUser && !loadingAuth`.
- **Rotas e Parâmetros**: Tratamento integrado para parâmetros de convite (`joinToken`) na tela de entrada.
- **Dependências**: Nenhuma nova dependência externa necessária (utiliza Tailwind CSS, Lucide Icons e assets existentes).
