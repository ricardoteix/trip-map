## Why

Ao organizar viagens e trilhas fotográficas, algumas fotos possuem coordenadas de GPS imprecisas, ausentes ou incorretas (ex: fotos tiradas em cânions, cavernas ou com câmeras dedicadas/drones sem GPS integrado). Atualmente, a única forma de ajustar locais é através do modal em lote (`BatchLocationModal`), que exige sair da foto, selecionar checkboxes e não permite navegação fluida foto a foto no Lightbox, nem a cópia rápida de coordenadas entre fotos da mesma parada.

## What Changes

- **Edição Direta no Lightbox**: Adiciona painel de edição de localização dentro da barra lateral do Lightbox para a foto em visualização.
- **Nome Personalizado de Local**: Permite ao usuário definir um rótulo customizado para o ponto de interesse (ex: *"Cachoeira do Buracão"*, *"Mirante do Vale"*), além da geocodificação reversa de cidade e país.
- **Seleção Interativa no Mapa Principal**: Permite clicar em "Ajustar no Mapa" para minimizar temporariamente o Lightbox, selecionar/arrastar a coordenada exata no mapa principal em tela cheia e retornar automaticamente ao Lightbox da foto com o local atualizado.
- **Área de Transferência de Coordenadas (Copiar / Colar)**: Suporte a `Ctrl + C` (ou botão de copiar) para memorizar a coordenada e nome da foto atual, e `Ctrl + V` (ou botão de colar) para aplicar na próxima foto da sequência com 1 clique.

## Capabilities

### New Capabilities
- `photo-location-curation`: Edição interativa de localização por foto individual no Lightbox, busca por nome com Nominatim, ajuste interativo no mapa principal, nome personalizado de local e atalhos de copiar/colar coordenadas (`Ctrl+C` / `Ctrl+V`).

### Modified Capabilities

*(Nenhuma especificação anterior modificada)*

## Impact

- Frontend: `frontend/src/components/LightboxModal.tsx`, `frontend/src/App.tsx`, `frontend/src/components/MapView.tsx`.
- Backend: Endpoint já existente `PATCH /api/media/batch-location` utilizado para persistência atômica das coordenadas e `location_name`.
