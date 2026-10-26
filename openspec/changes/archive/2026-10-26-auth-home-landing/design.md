## Context

O TripMap possui autenticação integrada com Google OAuth 2.0 e isolamento de privacidade. No entanto, quando um usuário não autenticado carrega o aplicativo (`currentUser === null`), o frontend carrega todo o shell da aplicação (mapa MapLibre, barra superior de ferramentas de curadoria, timeline vazia) e posiciona um botão de "Entrar com Google" no cabeçalho ao lado dos demais botões administrativos.

Essa abordagem expõe desnecessariamente controles restritos a visitantes anônimos e cria uma primeira impressão desorganizada para novos usuários e convidados que receberam links de compartilhamento.

## Goals / Non-Goals

**Goals:**
- Apresentar uma tela de Home/Boas-vindas dedicada e moderna para usuários não autenticados (`!currentUser`).
- Exibir a logo oficial centralizada com tipografia elegante e proposta de valor do TripMap.
- Fornecer um botão de ação destacado "Entrar com Google" que dispara o fluxo OAuth diretamente.
- Reconhecer parâmetros de convite (`joinToken`) na URL e exibir um card contextual convidando o usuário a fazer login para acessar e colaborar na viagem em questão.
- Assegurar transição suave para o dashboard completo assim que a autenticação for concluída.

**Non-Goals:**
- Não criar sistema próprio de usuário/senha local com formulários e recuperação por e-mail (permanece 100% Google OAuth).
- Não alterar a lógica de autorização do backend já existente.

## Decisions

1. **Componente dedicado `HomeLanding.tsx`**:
   - *Decisão*: Criar um componente isolado e reutilizável com layout responsivo (fundo em tons suaves de slate/blue, gradientes sutis, card central com sombra suave, logo e botão do Google).
   - *Alternativa considerada*: Renderizar a Home como um modal sobre o mapa. Descartada para evitar que o MapLibre e WebGL precisem ser inicializados antes do usuário estar logado.

2. **Detecção e Preservação de Token de Convite**:
   - *Decisão*: `HomeLanding` recebe a prop `inviteToken` e `inviteNotice` (se disponível) e passa o token para `handleLogin(inviteToken)` para que o retorno do OAuth continue redirecionando para a aceitação automática do convite.

3. **Estado de Carregamento Inicial (`authLoading`)**:
   - *Decisão*: Evitar *flash* de conteúdo da Home para usuários já logados enquanto a chamada assíncrona `/api/auth/me` estiver em andamento, exibindo um spinner de carregamento elegante até que o estado de autenticação seja resolvido.

## Risks / Trade-offs

- **[Risco] Flash de tela de login em conexões lentas** → **Mitigação**: Manter estado de `authLoading = true` até que `fetchCurrentUser()` retorne resposta.
- **[Risco] Perda do parâmetro de convite no fluxo de login** → **Mitigação**: O parâmetro `joinToken` já é persistido no cookie/sessão pelo backend ao iniciar o OAuth via `fetchLoginUrl(joinToken)`.
