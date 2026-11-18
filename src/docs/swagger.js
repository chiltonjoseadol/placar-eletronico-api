const idParam = (name) => ({ name, in: 'path', required: true, schema: { type: 'integer' } });
const secured = [{ bearerAuth: [] }];
const err = (description) => ({
  description,
  content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
});
const json = (schema, example) => ({
  required: true,
  content: { 'application/json': { schema, ...(example ? { example } : {}) } },
});
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const ok = (description, schema) => ({
  description,
  content: { 'application/json': { schema } },
});

module.exports = {
  openapi: '3.0.3',
  info: {
    title: 'API de Placar Eletrônico Genérico',
    version: '1.0.0',
    description:
      'Back-end de placar eletrônico para Futebol, Vôlei (quadra e praia) e Basquete. ' +
      'O placar é calculado automaticamente a partir dos eventos registrados. ' +
      'Para testar rotas protegidas: faça login em /auth/login, copie o token e clique em "Authorize".',
  },
  servers: [{ url: '/api' }],
  tags: [
    { name: 'Auth', description: 'Cadastro e login' },
    { name: 'Partidas', description: 'Gestão de partidas e configuração visual' },
    { name: 'Eventos', description: 'Eventos de jogo (gol, ponto, falta, cartão, tempo técnico)' },
  ],
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    schemas: {
      Error: { type: 'object', properties: { error: { type: 'string' } } },
      AuthResponse: {
        type: 'object',
        properties: {
          user: { type: 'object', properties: { id: { type: 'integer' }, name: { type: 'string' }, email: { type: 'string' } } },
          token: { type: 'string' },
        },
      },
      MatchInput: {
        type: 'object',
        required: ['sport', 'teamAName', 'teamBName'],
        properties: {
          sport: { type: 'string', enum: ['futebol', 'basquete', 'volei_quadra', 'volei_praia'] },
          teamAName: { type: 'string' },
          teamBName: { type: 'string' },
          teamAShortName: { type: 'string', maxLength: 5, description: 'Padrão: 3 primeiras letras' },
          teamBShortName: { type: 'string', maxLength: 5 },
          teamAColor: { type: 'string', example: '#FF0000' },
          teamBColor: { type: 'string', example: '#0000FF' },
          timerType: { type: 'string', enum: ['progressivo', 'regressivo', 'nenhum'], description: 'Padrão depende da modalidade' },
          periodDurationSeconds: { type: 'integer', description: 'Duração de cada período em segundos' },
        },
      },
      Match: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          userId: { type: 'integer' },
          sport: { type: 'string' },
          status: { type: 'string', enum: ['agendado', 'em_andamento', 'finalizado'] },
          teamAName: { type: 'string' },
          teamAShortName: { type: 'string' },
          teamAColor: { type: 'string' },
          teamBName: { type: 'string' },
          teamBShortName: { type: 'string' },
          teamBColor: { type: 'string' },
          timerType: { type: 'string' },
          periodDurationSeconds: { type: 'integer', nullable: true },
          scoreA: { type: 'integer' },
          scoreB: { type: 'integer' },
          setsA: { type: 'integer' },
          setsB: { type: 'integer' },
          currentPeriod: { type: 'integer' },
        },
      },
      Scoreboard: {
        type: 'object',
        description: 'Payload de exibição para o telão/front-end',
        example: {
          id: 1,
          sport: 'basquete',
          sportLabel: 'Basquete',
          status: 'em_andamento',
          period: { label: 'quarto', current: 1, total: 4 },
          timer: { type: 'regressivo', periodDurationSeconds: 600 },
          teams: {
            A: { name: 'Lakers', shortName: 'LAL', color: '#552583', score: 5 },
            B: { name: 'Celtics', shortName: 'BOS', color: '#007A33', score: 2 },
          },
        },
      },
      EventInput: {
        type: 'object',
        required: ['team', 'type'],
        properties: {
          team: { type: 'string', enum: ['A', 'B'] },
          type: {
            type: 'string',
            enum: ['gol', 'ponto', 'falta', 'cartao_amarelo', 'cartao_vermelho', 'tempo_tecnico'],
            description:
              'Futebol: gol, falta, cartao_amarelo, cartao_vermelho. Basquete: ponto (1, 2 ou 3), falta, tempo_tecnico. Vôlei: ponto, tempo_tecnico, cartao_amarelo, cartao_vermelho.',
          },
          points: { type: 'integer', description: 'Obrigatório apenas no basquete (ponto = 1, 2 ou 3)' },
          playerName: { type: 'string' },
          clock: { type: 'string', example: '07:32', description: 'Tempo de jogo no formato mm:ss' },
        },
      },
      Event: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          matchId: { type: 'integer' },
          team: { type: 'string' },
          type: { type: 'string' },
          points: { type: 'integer' },
          period: { type: 'integer' },
          playerName: { type: 'string', nullable: true },
          clock: { type: 'string', nullable: true },
        },
      },
    },
  },
  paths: {
    '/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Cadastra um usuário',
        requestBody: json(
          { type: 'object', required: ['name', 'email', 'password'], properties: { name: { type: 'string' }, email: { type: 'string' }, password: { type: 'string', minLength: 6 } } },
          { name: 'Maria', email: 'maria@email.com', password: '123456' }
        ),
        responses: { 201: ok('Usuário criado', ref('AuthResponse')), 400: err('Dados inválidos'), 409: err('E-mail já cadastrado') },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Autentica e retorna o token JWT',
        requestBody: json(
          { type: 'object', required: ['email', 'password'], properties: { email: { type: 'string' }, password: { type: 'string' } } },
          { email: 'maria@email.com', password: '123456' }
        ),
        responses: { 200: ok('Login realizado', ref('AuthResponse')), 400: err('Dados inválidos'), 401: err('Credenciais inválidas') },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Retorna o usuário autenticado',
        security: secured,
        responses: { 200: { description: 'Usuário' }, 401: err('Token ausente ou inválido') },
      },
    },
    '/matches': {
      get: {
        tags: ['Partidas'],
        summary: 'Lista partidas (paginado)',
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['agendado', 'em_andamento', 'finalizado'] } },
          { name: 'sport', in: 'query', schema: { type: 'string', enum: ['futebol', 'basquete', 'volei_quadra', 'volei_praia'] } },
          { name: 'team', in: 'query', schema: { type: 'string' }, description: 'Busca pelo nome de um dos times' },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 10, maximum: 100 } },
        ],
        responses: { 200: { description: 'Lista paginada: { data, meta }' }, 400: err('Parâmetros inválidos') },
      },
      post: {
        tags: ['Partidas'],
        summary: 'Cria uma partida (status inicial: agendado)',
        security: secured,
        requestBody: json(ref('MatchInput'), {
          sport: 'basquete',
          teamAName: 'Lakers',
          teamBName: 'Celtics',
          teamAShortName: 'LAL',
          teamBShortName: 'BOS',
          teamAColor: '#552583',
          teamBColor: '#007A33',
        }),
        responses: { 201: ok('Partida criada', ref('Match')), 400: err('Dados inválidos'), 401: err('Não autenticado') },
      },
    },
    '/matches/{id}': {
      get: {
        tags: ['Partidas'],
        summary: 'Busca uma partida',
        parameters: [idParam('id')],
        responses: { 200: ok('Partida', ref('Match')), 404: err('Não encontrada') },
      },
      put: {
        tags: ['Partidas'],
        summary: 'Atualiza dados e configuração visual da partida (somente o criador)',
        security: secured,
        parameters: [idParam('id')],
        requestBody: json(ref('MatchInput')),
        responses: { 200: ok('Partida atualizada', ref('Match')), 400: err('Dados inválidos'), 401: err('Não autenticado'), 403: err('Não é o criador'), 404: err('Não encontrada'), 409: err('Conflito de estado') },
      },
      delete: {
        tags: ['Partidas'],
        summary: 'Exclui a partida e seus eventos (somente o criador)',
        security: secured,
        parameters: [idParam('id')],
        responses: { 204: { description: 'Excluída' }, 401: err('Não autenticado'), 403: err('Não é o criador'), 404: err('Não encontrada') },
      },
    },
    '/matches/{id}/scoreboard': {
      get: {
        tags: ['Partidas'],
        summary: 'Payload de exibição do placar (cores, nomes, cronômetro, período, sets)',
        parameters: [idParam('id')],
        responses: { 200: ok('Placar', ref('Scoreboard')), 404: err('Não encontrada') },
      },
    },
    '/matches/{id}/status': {
      patch: {
        tags: ['Partidas'],
        summary: 'Altera o status (agendado → em_andamento → finalizado)',
        security: secured,
        parameters: [idParam('id')],
        requestBody: json(
          { type: 'object', required: ['status'], properties: { status: { type: 'string', enum: ['em_andamento', 'finalizado'] } } },
          { status: 'em_andamento' }
        ),
        responses: { 200: ok('Partida', ref('Match')), 400: err('Status inválido'), 401: err('Não autenticado'), 403: err('Não é o criador'), 404: err('Não encontrada'), 409: err('Transição inválida') },
      },
    },
    '/matches/{id}/period/next': {
      patch: {
        tags: ['Partidas'],
        summary: 'Avança o tempo (futebol) ou quarto (basquete). No vôlei o set avança automaticamente.',
        security: secured,
        parameters: [idParam('id')],
        responses: { 200: ok('Partida', ref('Match')), 400: err('Modalidade com avanço automático'), 401: err('Não autenticado'), 403: err('Não é o criador'), 404: err('Não encontrada'), 409: err('Partida não está em andamento ou já no último período') },
      },
    },
    '/matches/{matchId}/events': {
      get: {
        tags: ['Eventos'],
        summary: 'Lista os eventos da partida em ordem cronológica',
        parameters: [idParam('matchId')],
        responses: { 200: { description: 'Eventos', content: { 'application/json': { schema: { type: 'array', items: ref('Event') } } } }, 404: err('Partida não encontrada') },
      },
      post: {
        tags: ['Eventos'],
        summary: 'Registra um evento; o placar é recalculado automaticamente',
        security: secured,
        parameters: [idParam('matchId')],
        requestBody: json(ref('EventInput'), { team: 'A', type: 'ponto', points: 3, playerName: 'LeBron', clock: '09:12' }),
        responses: {
          201: { description: 'Evento criado e placar atualizado: { event, match }' },
          400: err('Evento/pontos inválidos para a modalidade'),
          401: err('Não autenticado'),
          403: err('Não é o criador'),
          404: err('Partida não encontrada'),
          409: err('Partida não está em andamento'),
        },
      },
    },
    '/matches/{matchId}/events/{eventId}': {
      delete: {
        tags: ['Eventos'],
        summary: 'Remove um evento (desfazer) e recalcula o placar',
        security: secured,
        parameters: [idParam('matchId'), idParam('eventId')],
        responses: { 200: ok('Placar atualizado', ref('Scoreboard')), 401: err('Não autenticado'), 403: err('Não é o criador'), 404: err('Não encontrado'), 409: err('No vôlei só o último evento pode ser desfeito') },
      },
    },
  },
};
