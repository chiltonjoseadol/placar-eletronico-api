const { Router } = require('express');
const asyncHandler = require('../middlewares/asyncHandler');
const authenticate = require('../middlewares/auth');
const auth = require('../controllers/authController');
const matches = require('../controllers/matchController');
const events = require('../controllers/eventController');

const router = Router();
const h = asyncHandler;

// Autenticação
router.post('/auth/register', h(auth.register));
router.post('/auth/login', h(auth.login));
router.get('/auth/me', authenticate, h(auth.me));

// Partidas: leitura pública (o telão não precisa de login), escrita protegida
router.get('/matches', h(matches.list));
router.get('/matches/:id', h(matches.getById));
router.get('/matches/:id/scoreboard', h(matches.scoreboard));
router.post('/matches', authenticate, h(matches.create));
router.put('/matches/:id', authenticate, h(matches.update));
router.patch('/matches/:id/status', authenticate, h(matches.changeStatus));
router.patch('/matches/:id/timer', authenticate, h(matches.timer));
router.patch('/matches/:id/period/next', authenticate, h(matches.nextPeriod));
router.delete('/matches/:id', authenticate, h(matches.remove));

// Eventos de jogo
router.get('/matches/:matchId/events', h(events.list));
router.post('/matches/:matchId/events', authenticate, h(events.create));
router.delete('/matches/:matchId/events/:eventId', authenticate, h(events.remove));

module.exports = router;
