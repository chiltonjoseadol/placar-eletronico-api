require('dotenv').config();
const app = require('./app');
const { sequelize } = require('./models');

const PORT = process.env.PORT || 3000;

async function start() {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET não definido. Copie .env.example para .env e configure.');
  }
  await sequelize.authenticate();
  await sequelize.sync();
  app.listen(PORT, () => {
    console.log(`API rodando em http://localhost:${PORT}`);
    console.log(`Swagger em http://localhost:${PORT}/apidocs`);
  });
}

start().catch((err) => {
  console.error('Falha ao iniciar a API:', err.message);
  process.exit(1);
});
