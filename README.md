# API de Placar Eletrônico Genérico

Atividade Prática Final: Desenvolvimento de Serviços e APIs (FATESE, ADS), **Equipe 1**.

Back-end RESTful de um placar eletrônico para **Futebol**, **Basquete** e **Vôlei** (quadra e praia). Ele registra partidas e eventos de jogo, calcula o placar automaticamente e fornece os metadados de exibição (cores, nomes abreviados, tipo de cronômetro) para um telão ou aplicativo.

## Tecnologias

Node.js, Express, Sequelize (SQLite por padrão, ou MySQL/PostgreSQL), JWT (`jsonwebtoken` + `bcryptjs`) e Swagger UI (OpenAPI 3).

## Como rodar

```bash
git clone <URL-DO-REPOSITORIO>
cd placar
npm install
cp .env.example .env     # Windows PowerShell: Copy-Item .env.example .env
# edite o .env e defina JWT_SECRET
npm start                # ou: npm run dev (com nodemon)
```

- API: <http://localhost:3000/api>
- Swagger: <http://localhost:3000/apidocs>

As tabelas são criadas automaticamente na primeira execução (`sequelize.sync`).

### Variáveis de ambiente (`.env`)

| Variável | Descrição | Padrão |
|---|---|---|
| `PORT` | Porta da API | `3000` |
| `JWT_SECRET` | Segredo de assinatura do JWT (**obrigatório**) | n/a |
| `JWT_EXPIRES_IN` | Validade do token | `1d` |
| `DB_DIALECT` | `sqlite`, `mysql` ou `postgres` | `sqlite` |
| `DB_STORAGE` | Arquivo do SQLite | `./database.sqlite` |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS` | Conexão MySQL/PostgreSQL | n/a |

Exemplo para MySQL: `DB_DIALECT=mysql`, `DB_HOST=localhost`, `DB_PORT=3306`, `DB_NAME=placar` (o banco precisa existir).

### Teste de fumaça

`npm run smoke` sobe a API em um banco temporário e executa os principais fluxos (autenticação, cálculo de placar nas três modalidades, permissões, paginação e Swagger).

## Arquitetura

```
src/
├── config/        conexão com o banco (Sequelize)
├── models/        User, Match, MatchEvent e relacionamentos
├── repositories/  acesso a dados
├── services/      regras de negócio
├── controllers/   camada HTTP (req/res)
├── routes/        mapeamento das rotas
├── middlewares/   autenticação JWT, tratamento de erros
├── utils/         regras por modalidade, cálculo do placar, validações
└── docs/          especificação OpenAPI
```

Fluxo: `route → controller → service → repository → model`.

Relacionamentos: `User 1:N Match` e `Match 1:N MatchEvent` (exclusão em cascata).

## Regras de negócio

- **Placar derivado dos eventos.** O placar é sempre recalculado a partir dos eventos. Desfazer (excluir) um evento corrige o placar.
- **Status:** `agendado → em_andamento → finalizado`. Eventos só podem ser registrados com a partida em andamento.
- **Futebol:** `gol` vale 1. Há também `falta`, `cartao_amarelo` e `cartao_vermelho`. São 2 tempos, avançados em `PATCH /matches/{id}/period/next`. Cronômetro progressivo (45 min).
- **Basquete:** `ponto` vale 1, 2 ou 3 (informado em `points`). Há também `falta` e `tempo_tecnico`. São 4 quartos. Cronômetro regressivo (10 min).
- **Vôlei de quadra:** melhor de 5 sets. Os sets vão a 25 pontos e o 5º vai a 15, sempre com diferença mínima de 2.
- **Vôlei de praia:** melhor de 3 sets. Os sets vão a 21 pontos e o 3º vai a 15, com diferença mínima de 2.
- **Vôlei, controle de sets:** o set é computado e o placar do set zera automaticamente. A partida é finalizada quando um time vence os sets necessários. Só é possível desfazer o último evento.
- **Configuração visual** (por partida): `teamAColor`/`teamBColor` (hex `#RRGGBB`), `teamAShortName`/`teamBShortName` (até 5 letras), `timerType` (`progressivo`, `regressivo`, `nenhum`) e `periodDurationSeconds`.
- **Permissões:** leitura é pública (o telão não precisa de login). Criar, alterar e excluir exige JWT, e somente o criador da partida pode modificá-la (403 para os demais).

## Endpoints principais

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| POST | `/api/auth/register` | não | Cadastro |
| POST | `/api/auth/login` | não | Login (retorna JWT) |
| GET | `/api/auth/me` | sim | Usuário autenticado |
| GET | `/api/matches` | não | Lista (filtros `status`, `sport`, `team`; `page`, `limit`) |
| POST | `/api/matches` | sim | Cria partida |
| GET | `/api/matches/{id}` | não | Detalhe |
| PUT | `/api/matches/{id}` | sim | Atualiza dados/estilo |
| DELETE | `/api/matches/{id}` | sim | Exclui |
| GET | `/api/matches/{id}/scoreboard` | não | Payload de exibição do placar |
| PATCH | `/api/matches/{id}/status` | sim | Muda o status |
| PATCH | `/api/matches/{id}/period/next` | sim | Próximo tempo/quarto |
| GET | `/api/matches/{id}/events` | não | Lista eventos |
| POST | `/api/matches/{id}/events` | sim | Registra evento |
| DELETE | `/api/matches/{id}/events/{eventId}` | sim | Desfaz evento |

Códigos usados: 200, 201, 204, 400, 401, 403, 404, 409 (conflito de estado) e 500.

## Exemplo rápido

```bash
# 1. cadastro (o retorno traz o token)
curl -X POST localhost:3000/api/auth/register -H "Content-Type: application/json" \
  -d '{"name":"Maria","email":"maria@email.com","password":"123456"}'

# 2. criar partida de basquete
curl -X POST localhost:3000/api/matches -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
  -d '{"sport":"basquete","teamAName":"Lakers","teamBName":"Celtics","teamAColor":"#552583","teamBColor":"#007A33"}'

# 3. iniciar, pontuar e consultar o placar
curl -X PATCH localhost:3000/api/matches/1/status -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" -d '{"status":"em_andamento"}'
curl -X POST localhost:3000/api/matches/1/events -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" -d '{"team":"A","type":"ponto","points":3}'
curl localhost:3000/api/matches/1/scoreboard
```

## Equipe

- Carlos Henrique de Lima Junior
- Miquissene Visa
- Matheus Kenzo Sasaki de Carvalho
- Leonardo da Costa Loureiro
- Carlos Eduardo de Andrade Ferreira
