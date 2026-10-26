## Context

O TripMap possui visualização de fotos em alta resolução através do `LightboxModal`, que permite navegação sequencial (teclas de seta, botões próximo/anterior) e gerenciamento de pessoas. Para localização, atualmente o usuário precisa selecionar fotos na galeria e abrir o `BatchLocationModal`. Esta mudança traz o poder de edição e cópia de localização diretamente para o fluxo foto a foto do Lightbox.

## Goals / Non-Goals

**Goals:**
- Permitir edição de coordenadas e nome personalizado de local diretamente no `LightboxModal`.
- Suportar busca por nome de ponto turístico ou endereço via OpenStreetMap Nominatim.
- Permitir ajuste visual no mapa principal em tela cheia com retorno automático ao Lightbox.
- Implementar área de transferência de localização da sessão com suporte a `Ctrl + C` e `Ctrl + V`.
- Exibir coordenadas exatas decimais e nome personalizado de atração nos detalhes da foto.

**Non-Goals:**
- Modificar o algoritmo de agrupamento automático de viagens ou passeios.
- Reescrever a biblioteca de mapas Leaflet existente.

## Decisions

### 1. Reutilização do endpoint `PATCH /api/media/batch-location`
- **Decisão**: Utilizar o endpoint existente passando `media_ids: [item.id]`, `latitude`, `longitude` e `location_name`.
- **Por quê**: O backend já calcula cidade, país e geocodificação reversa de forma atômica e atualiza o resumo da viagem.
- **Alternativa descartada**: Criar endpoint separado `PATCH /api/media/{id}/location`, o que duplicaria lógica desnecessariamente.

### 2. Fluxo de Ida e Volta com o Mapa Principal
- **Decisão**: Em `App.tsx`, manter o estado `pendingMapPickForMedia: MediaItem | null`. Ao clicar em "Ajustar no Mapa", o Lightbox fica temporariamente suspenso (`isSuspendedForMapPick = true`). O `MapView` exibe mira e banner explicativo. Ao clicar no mapa, as coordenadas são capturadas, o Lightbox reaparece e preenche os campos.
- **Por quê**: O mapa principal em tela cheia oferece muito mais contexto visual, zoom e precisão do que um mini-mapa apertado na barra lateral.

### 3. Clipboard de Localização na Sessão e Atalhos de Teclado
- **Decisão**: Estado `copiedLocation: { lat: number; lng: number; locationName?: string } | null` gerenciado em `App.tsx` e compartilhado com `LightboxModal`.
- **Atalhos**:
  - `Ctrl + C` / `Cmd + C`: copia se o item tiver coordenadas e nenhum input estiver em foco.
  - `Ctrl + V` / `Cmd + V`: cola e salva na foto atual.
- **Por quê**: Permite curar rapidamente 50 fotos da mesma cachoeira ou ponto turístico em segundos apenas navegando com seta direita e pressionando `Ctrl + V`.

## Risks / Trade-offs

- **[Risco]** Conflito entre atalhos de copiar texto (`Ctrl+C` em um input) e copiar localização da foto.
  → **Mitigação**: O listener de teclado verifica explicitamente se `document.activeElement` é um `INPUT`, `TEXTAREA` ou elemento editável, repassando o evento padrão de cópia de texto nesses casos.
- **[Risco]** Limite de requisições na API do Nominatim ao buscar locais.
  → **Mitigação**: Busca acionada sob demanda (ao submeter o formulário ou clicar na lupa), sem debounce excessivo a cada letra.
