# 🗺️ TripMap — Suas Viagens no Mapa

Plataforma web open-source e *self-hosted* para organizar, explorar e reviver milhares de fotos e vídeos de viagens (projetada especialmente para bibliotecas do **iPhone 16 Plus** e **Samsung Galaxy S25**).

Inspirada na visualização geográfica do app **Fotos do iOS**, com **Tema Claro (Light Mode)** minimalista por padrão, **Linha do Tempo multi-resolução (Por Dia e Por Mês)**, **Gestão de Viagens e Subgrupos de Passeios/Locais**, **Armazenamento S3 (RustFS)**, **Reconhecimento Facial Deep Learning (YuNet + SFace)** com filtro booleano (`E` / `OU`) e **Backup/Migração portátil de curadoria**.

---

## ✨ Funcionalidades Principais

1. **Mapa Interativo Estilo Apple Photos (Zero Chave de API)**
   - Motor **MapLibre GL JS** + **Supercluster** com tema claro minimalista (**CARTO Positron Light**) como padrão, além de opções para **OpenFreeMap Bright** e **Satélite (Esri)**.
   - Pinos quadrados com miniatura da foto de capa, contador numérico e etiqueta com o nome do **Passeio/Atrativo** ou **Cidade**, agrupando e desagrupando suavemente conforme o zoom.
   - Traçado opcional de **Rota Cronológica** conectando os pontos visitados na viagem.

2. **Viagens & Subgrupos de Passeios / Locais Específicos (2 Níveis)**
   - **Nível 1 — Momentos & Viagens**: Agrupe todas as fotos de uma grande viagem (ex: *"Chapada Diamantina"*) durante a importação (por nome, viagem existente ou subpastas de `/import`), por intervalo de datas, mesclando grupos automáticos ou movendo fotos selecionadas na galeria.
   - **Nível 2 — Passeios & Locais (Subgrupos)**: Dentro de cada viagem, agrupe e filtre atrações específicas (ex: *"Cachoeira do Buracão"* no município de *"Ibicoara-BA"*):
     - **Auto-detecção inteligente**: Agrupa paradas de raio curto (~4,5 km) consolidando fotos de múltiplos celulares sem fragmentar o passeio.
     - **Renomeação e Município**: Defina o nome exato do atrativo e corrija o município (atualizando também os rótulos no mapa e na galeria).
     - **Atribuição com 1 clique pelo Mapa ou Galeria**: Clique em um pino/cluster no mapa e use o botão **"Nomear Passeio"** na galeria lateral, ou una duas paradas próximas.

3. **Linha do Tempo Multi-Resolução (`Por Dia` / `Por Mês`) e Galeria Diária**
   - Alternância entre visualização **Por Dia** (ideal para explorar cada dia de uma viagem específica) e **Por Mês**, com *Range Slider* de início/fim, atalhos rápidos e botão **Play Viagem**.
   - A galeria lateral organiza automaticamente as fotos e vídeos em seções diárias cronológicas.

4. **Reconhecimento Facial Deep Learning (YuNet + SFace) & Filtro Booleano (`E` / `OU`)**
   - Detecção e extração de embeddings faciais de 128 dimensões usando **OpenCV 5 ONNX (`YuNet` + `SFace`)** com cache persistente de modelos (`/model_cache`).
   - Gerenciador de pessoas para **renomear**, **unir (`Merge`)** perfis da mesma pessoa e **descartar falsos positivos** (ex: quadros, pinturas, estátuas ou desconhecidos ao fundo) com confirmação, preservando as fotos originais intactas.
   - Filtro avançado **"Fotos com:"**:
     - **`Todos juntos (E / AND)`**: Retorna exclusivamente as fotos onde **todas** as pessoas selecionadas (ex: *Ricardo + Saulo + Michele + Lorena*) aparecem juntas na mesma foto.
     - **`Qualquer um (OU / OR)`**: Retorna fotos onde pelo menos uma das pessoas selecionadas está presente.

5. **Lightbox com Navegação Sequencial e Curadoria Rápida**
   - Navegue entre as fotos e vídeos da lista ativa sem fechar o modal usando os botões **Anterior (`‹`) / Próxima (`›`)** ou as setas do teclado (**`←`**, **`→`** e **`Esc`**), com contador de posição (`14 / 290`) e pré-carregamento (*preload*) automático das imagens vizinhas.
   - **Edição e Correção de Localização (Geotagging Manual)**:
     - Permite corrigir ou definir o local de qualquer foto individual ou em lote.
     - **Copiar de outra foto**: Selecione visualmente outra foto da viagem para clonar as coordenadas exatas.
     - **Localizar no mapa**: Clique interativamente no mapa para apontar o ponto exato.
     - **Busca por endereço/atrativo**: Pesquise nomes de pontos turísticos ou cidades via geocodificação integrada.
     - **Coordenadas diretas**: Insira manualmente Latitude e Longitude, além de definir nomes personalizados para o local.
   - **Exclusão Direta (Sem Lixeira)**: Exclua fotos individualmente ou em lote. Ao excluir dentro do Lightbox, ele avança automaticamente para a próxima foto. O hash `SHA-256` das mídias excluídas é salvo em `deleted_media_hashes` para que escaneamentos futuros da pasta `/import` jamais reimportem fotos descartadas.

6. **Tela de Entrada (Home / Landing), Autenticação Google OAuth & Privacidade**
   - **Home de Boas-Vindas Exclusiva**: Visitantes não autenticados são recepcionados por uma tela inicial elegante com a logo oficial, proposta de valor e botão destacado de login via Google, mantendo o mapa e as ferramentas protegidos até a autenticação.
   - **Login seguro com Google**: Autenticação OAuth 2.0 moderna sem necessidade de infraestrutura própria de envio de e-mails para recuperação de senha.
   - **Privacidade por Padrão**: Viagens e fotos privadas só podem ser acessadas por seu proprietário ou por membros autorizados.
   - **Compartilhamento por Link Único & Convites**:
     - Gere links de convite para amigos e familiares (`/join?token=...`).
     - A tela de Home reconhece o convite automaticamente e apresenta um card contextualizado convidando a fazer login para participar e colaborar.
     - Membros convidados autenticados podem visualizar a viagem e contribuir enviando suas próprias fotos e vídeos para o mesmo álbum.

7. **Backup & Migração Portátil de Curadoria (Local ➔ Servidor)**
   - Botão **"Backup / Migrar"** no topo da interface que exporta um arquivo leve (`tripmap-curation-backup.json`) contendo:
     - Todas as **Viagens** e **Passeios/Locais**;
     - Todas as **Pessoas nomeadas**, seus vetores faciais (`centroid_embedding`) e os avatares de rosto em Base64;
     - Todos os **hashes `SHA-256` excluídos**;
     - Todos os **vínculos de curadoria por `SHA-256`** de cada foto (viagem, passeio, localização/cidade manual e rostos).
   - **Importação flexível no servidor**: Funciona tanto **antes** quanto **depois** de escanear a pasta `/import` no servidor (memorizando as regras na tabela `media_curation_cache` e aplicando-as automaticamente pelo `SHA-256` durante o escaneamento).

8. **Ingestão Múltipla (Upload Web, Scanner `/import` e Google Drive Recursivo)**
   - Suporte nativo a fotos (`.HEIC`, `.HEIF`, `.JPG`, `.PNG`, `.WEBP`) e vídeos (`.MOV`, `.MP4`) do iPhone 16 Plus e Samsung Galaxy S25.
   - Deduplicação automática via hash `SHA-256`.
   - Filtro **"Sem GPS"** e atribuição manual de coordenadas em lote.
   - **Google Drive com Varredura Recursiva**: Sincronização direta de pastas do Google Drive com descoberta automática de todas as subpastas aninhadas, gerando miniaturas leves e aplicando regras de curadoria restauradas por `SHA-256`.

---

## 🏗️ Arquitetura e Estrutura do Projeto

```text
trip-map/
├── docker-compose.yml       # Orquestração única: Postgres, RustFS (S3), Backend e Frontend
├── .env.example             # Exemplo de variáveis de ambiente
├── import_media/            # Pasta local padrão mapeada para /import dentro do container
├── backend/                 # Python 3.12 + FastAPI + SQLAlchemy + Pillow-HEIF + OpenCV (YuNet/SFace)
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py          # Inicialização da API e migrações automáticas de schema
│       ├── models.py        # Modelos (Trip, Outing, MediaItem, Person, FaceDetection, DeletedMediaHash, MediaCurationCache)
│       ├── routers/         # Endpoints (media.py, people.py, trips.py, backup.py)
│       └── services/        # Cliente S3 (RustFS), EXIF/Thumbnails, IA Facial (YuNet/SFace) e Viagens/Passeios
└── frontend/                # React 18 + TypeScript + Vite + Tailwind CSS + MapLibre GL
    ├── Dockerfile
    ├── nginx.conf
    └── src/
        ├── api/client.ts    # Cliente HTTP tipado
        └── components/      # MapView, TimelineBar, PeopleFilterBar, TripsPanel, OutingsBar,
                             # GalleryDrawer, LightboxModal, BackupModal, OutingsModal, TripsModal...
```

### Stack de Serviços e Portas no `docker-compose.yml`
As portas externas foram configuradas para evitar conflitos com serviços comuns em servidores domésticos/VPS (`80`, `443`, `3000`, `3001`, `5432`, `8000`, `8001`, `9000`, `9443`):

| Serviço | Container | Tecnologia | Porta no Host | Papel |
| :--- | :--- | :--- | :--- | :--- |
| **`frontend`** | `tripmap-frontend` | React + Vite + Nginx | **`http://localhost:3002`** | Interface Web (Tema Claro) + Proxy `/api` (até 2 GB de upload) |
| **`backend`** | `tripmap-backend` | Python 3.12 + FastAPI | **`http://localhost:8002`** | API REST, EXIF/HEIC/Vídeo, IA Facial, Viagens, Passeios e Backup |
| **`rustfs`** | `tripmap-rustfs` | RustFS (Compatível S3) | **`9002`** (API) / **`9003`** (UI) | Object Storage S3 (`originals`, `thumbnails-map`, `thumbnails-web`, `face-crops`) |
| **`postgres`** | `tripmap-postgres` | PostgreSQL 16 + PostGIS | **`5433`** | Banco de dados relacional e geoespacial |

---

## 🚀 Como Executar com Docker Compose

### 1. Pré-requisitos
- [Docker](https://www.docker.com/) e Docker Compose instalados.

### 2. Configurar variáveis de ambiente (Opcional)
Por padrão, o `docker-compose.yml` mapeia a pasta `./import_media` do projeto para `/import` no container.
Você pode criar um arquivo `.env` para apontar para outra pasta de fotos e configurar o Google OAuth para login e compartilhamento seguro:

```bash
cp .env.example .env
```
Variáveis principais no `.env`:
- `LOCAL_IMPORT_HOST_PATH`: Caminho da sua pasta de fotos no host.
- `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET`: Credenciais do Google Cloud Console para Login Social e Google Drive.
- `SECRET_KEY`: Chave secreta para assinatura dos tokens JWT de sessão.

### 3. Subir todos os serviços
Na raiz do repositório, execute:

```bash
docker compose up --build -d
```

### 4. Acessar a Aplicação
- **Interface Web (TripMap)**: [http://localhost:3002](http://localhost:3002)
- **Documentação Interativa da API (Swagger)**: [http://localhost:8002/docs](http://localhost:8002/docs)
- **Console S3 (RustFS)**: [http://localhost:9003](http://localhost:9003) (Credenciais padrão: `rustfsadmin` / `rustfsadmin_secret`)

---

## 📦 Como Migrar sua Curadoria Local para o Servidor

1. **Na sua máquina local**:
   - Abra o TripMap em `http://localhost:3002` e clique em **"Backup / Migrar"** no topo direito.
   - Clique em **"Exportar Curadoria (.json)"** para baixar o arquivo `tripmap-curation-backup-YYYYMMDD-HHMM.json`.
2. **No servidor**:
   - Suba a stack com `docker compose up --build -d` e copie suas fotos para a pasta mapeada em `/import`.
   - Acesse a interface web do servidor, clique em **"Backup / Migrar"** e envie o arquivo `.json` exportado.
   - Em seguida (ou mesmo antes de importar o backup), clique em **"Importar Fotos" ➔ "Escanear Pasta Local (`/import`)"**. O servidor irá ignorar automaticamente as fotos que você excluiu e aplicará todas as suas **Viagens**, **Passeios & Locais**, **Cidades/GPS** e **Pessoas** pelo hash `SHA-256` de cada arquivo.

---

## 🛠️ Executando em Modo de Desenvolvimento (Sem Docker)

Caso queira rodar o backend e o frontend localmente fora do Docker:

### Backend (Python)
```bash
cd backend
python -m venv .venv
# No Windows:
.venv\Scripts\activate
# No Linux/macOS:
source .venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
*(Quando executado fora do Docker sem o RustFS ou Postgres ativos, o backend utiliza automaticamente SQLite local e armazenamento em disco em `./storage_data` como fallback transparente).*

### Frontend (React)
```bash
cd frontend
npm install
npm run dev
```

---

## 🧪 Executando os Testes Automatizados

```bash
cd backend
pytest
```
