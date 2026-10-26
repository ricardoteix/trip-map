## 1. Componente HomeLanding

- [x] 1.1 Criar o componente `frontend/src/components/HomeLanding.tsx` com design minimalista, responsivo, logo do TripMap, subtítulo, botão "Entrar com Google" e suporte a card de convite
- [x] 1.2 Exportar e estilizar o botão com o ícone oficial do Google e animação sutil de hover

## 2. Integração no App.tsx e Estado de Carregamento

- [x] 2.1 Adicionar estado de controle `isAuthLoading` no `frontend/src/App.tsx` para evitar *flicker* durante a verificação inicial de sessão
- [x] 2.2 Renderizar condicionalmente `HomeLanding` caso `!currentUser && !isAuthLoading`
- [x] 2.3 Conectar a ação de login e repasse do `inviteToken` do convite de viagem no `HomeLanding`

## 3. Verificação e Polimento

- [x] 3.1 Testar build e renderização visual do frontend no container Docker
- [x] 3.2 Verificar fluxo de login com o Google e retorno para o mapa
