import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import cron from 'node-cron';
import { google } from 'googleapis';
import crypto from 'node:crypto';

const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios.' });
    }
    const salt = crypto.randomBytes(16).toString('hex');
    const hashedPassword = crypto.scryptSync(password, salt, 64).toString('hex');
    const storedPassword = `${salt}:${hashedPassword}`;
    const newUser = await prisma.collaborator.create({
      data: {
        name,
        email,
        password: storedPassword,
      },
    });
    const { password: _, ...userWithoutPassword } = newUser;
    res.status(201).json(userWithoutPassword);
  } catch (error) {
    console.error("Erro ao registrar:", error);
    if (error.code === 'P2002') return res.status(409).json({ error: 'E-mail já em uso.' });
    res.status(500).json({ error: 'Erro interno ao registrar.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('\n--- NOVA TENTATIVA DE LOGIN ---');
    console.log('E-mail recebido do frontend:', email);
    console.log('Senha recebida do frontend:', `"${password}"`); // Aspas para ver espaços

    const user = await prisma.collaborator.findUnique({ where: { email } });
    if (!user) {
      console.log('Resultado: Usuário não encontrado no banco de dados.');
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    console.log('Usuário encontrado:', user.name);

    const [salt, storedHash] = user.password.split(':');
    console.log('Hash salvo no banco:', storedHash);

    const providedPasswordHash = crypto.scryptSync(password, salt, 64).toString('hex');
    console.log('Hash da senha digitada:', providedPasswordHash);

    const hashesMatch = crypto.timingSafeEqual(Buffer.from(storedHash), Buffer.from(providedPasswordHash));

    console.log('Resultado da comparação:', hashesMatch ? 'SENHAS BATEM' : 'SENHAS NÃO BATEM');

    if (hashesMatch) {
      const { password: _, ...userWithoutPassword } = user;
      res.status(200).json({ message: 'Login bem-sucedido!', user: userWithoutPassword });
    } else {
      res.status(401).json({ error: 'Credenciais inválidas.' });
    }
  } catch (error) {
    console.error("Erro no login:", error);
    res.status(500).json({ error: 'Erro interno ao tentar fazer login.' });
  }
});
app.get('/api/collaborators', async (req, res) => {
  try {
    const collaborators = await prisma.collaborator.findMany({
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, email: true, role: true, createdAt: true }
    });
    res.status(200).json(collaborators);
  } catch (error) {
    console.error("Erro ao listar colaboradores:", error);
    res.status(500).json({ error: 'Não foi possível listar os colaboradores.' });
  }
});

app.delete('/api/collaborators/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.collaborator.delete({
      where: { id: parseInt(id) },
    });
    res.status(204).send();
  } catch (error) {
    console.error("Erro ao deletar colaborador:", error);
    res.status(500).json({ error: 'Não foi possível deletar o colaborador.' });
  }
});

function getNextFridays(count = 10) {
  const fridays = [];
  let currentDate = new Date();
  while (fridays.length < count) {
    currentDate.setDate(currentDate.getDate() + 1);
    if (currentDate.getDay() === 5) {
      fridays.push(new Date(currentDate.getTime()));
    }
  }
  return fridays;
}

app.get('/api/schedule', async (req, res) => {
  try {
    const collaborators = await prisma.collaborator.findMany({
      orderBy: { createdAt: 'asc' },
    });
    const savedSchedules = await prisma.schedule.findMany({
      orderBy: { date: 'asc' },
      include: { collaborator: true },
    });
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const pastSchedules = savedSchedules.filter(s => new Date(s.date) < today);
    const futureSavedSchedules = savedSchedules.filter(s => new Date(s.date) >= today);
    let futureSchedules = [];
    if (collaborators.length > 0) {
      const lastRealSchedule = savedSchedules.length > 0 ? savedSchedules[savedSchedules.length - 1] : null;
      let nextCollaboratorIndex = 0;
      if (lastRealSchedule) {
        const lastCollaboratorIndex = collaborators.findIndex(c => c.id === lastRealSchedule.collaboratorId);
        if(lastCollaboratorIndex !== -1) {
          nextCollaboratorIndex = (lastCollaboratorIndex + 1) % collaborators.length;
        }
      }
      const nextFridays = getNextFridays(10);
      futureSchedules = nextFridays.map((date, index) => {
        const existingSavedSchedule = futureSavedSchedules.find(
          s => new Date(s.date).toISOString().split('T')[0] === date.toISOString().split('T')[0]
        );
        if (existingSavedSchedule) {
          return existingSavedSchedule;
        } else {
          const collaboratorIndex = (nextCollaboratorIndex + index) % collaborators.length;
          const collaborator = collaborators[collaboratorIndex];
          return {
            id: -1 * (index + 1),
            date: date,
            collaborator: { name: collaborator.name },
            isGenerated: true,
          };
        }
      });
    }
    res.status(200).json({ pastSchedules: pastSchedules.reverse(), futureSchedules });
  } catch (error) {
    console.error("Erro ao gerar a escala:", error);
    res.status(500).json({ error: 'Não foi possível gerar a escala.' });
  }
});

app.put('/api/schedule/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { newCollaboratorId } = req.body;
    const scheduleToUpdate = await prisma.schedule.findUnique({ where: { id: parseInt(id) } });
    const newCollaborator = await prisma.collaborator.findUnique({ where: { id: parseInt(newCollaboratorId) } });
    if (!scheduleToUpdate || !newCollaborator) {
      return res.status(404).json({ error: 'Agendamento ou colaborador não encontrado.' });
    }
    if (scheduleToUpdate.googleEventId) {
      await calendar.events.patch({
        calendarId: process.env.CALENDAR_ID,
        eventId: scheduleToUpdate.googleEventId,
        requestBody: {
          description: `Olá ${newCollaborator.name}! Sua vez de limpar o banheiro da empresa nesta sexta-feira, ${new Date(scheduleToUpdate.date).toLocaleDateString('pt-BR')}. Por favor, siga as instruções de limpeza padrão. Qualquer dúvida, fale com a administração.`,
        },
      });
    }
    const updatedSchedule = await prisma.schedule.update({
      where: { id: parseInt(id) },
      data: { collaboratorId: parseInt(newCollaboratorId) },
      include: { collaborator: true },
    });
    res.status(200).json(updatedSchedule);
  } catch (error) {
    console.error("Erro ao editar agendamento:", error);
    res.status(500).json({ error: 'Não foi possível editar o agendamento.' });
  }
});

const auth = new google.auth.GoogleAuth({
  keyFile: 'google-credentials.json',
  scopes: 'https://www.googleapis.com/auth/calendar',
});
const calendar = google.calendar({ version: 'v3', auth });

async function runScheduleCheck() {
  console.log('--- Rodando rotina de agendamento de limpeza ---');
  try {
    const today = new Date();
    const nextFriday = new Date();
    nextFriday.setDate(today.getDate() + (5 + 7 - today.getDay()) % 7);
    nextFriday.setHours(15, 0, 0, 0);
    const nextFridayString = nextFriday.toISOString().split('T')[0];
    const existingSchedule = await prisma.schedule.findFirst({
      where: {
        date: {
          gte: new Date(nextFridayString),
          lt: new Date(new Date(nextFridayString).getTime() + 24 * 60 * 60 * 1000)
        }
      }
    });
    if (existingSchedule) {
      console.log(`Agendamento para ${nextFriday.toLocaleDateString('pt-BR')} já existe. Pulando.`);
      return;
    }
    const lastSchedule = await prisma.schedule.findFirst({
      orderBy: { date: 'desc' }
    });
    const collaborators = await prisma.collaborator.findMany({
      orderBy: { createdAt: 'asc' }
    });
    if (collaborators.length === 0) {
      console.log("Nenhum colaborador cadastrado. Pulando agendamento.");
      return;
    }
    let nextCollaborator;
    if (lastSchedule) {
      const lastIndex = collaborators.findIndex(c => c.id === lastSchedule.collaboratorId);
      nextCollaborator = collaborators[(lastIndex + 1) % collaborators.length];
    } else {
      nextCollaborator = collaborators[0];
    }
    console.log(`Próximo responsável: ${nextCollaborator.name}`);
    const event = {
      summary: 'Limpeza do Banheiro da Empresa - Sua Vez!',
      description: `Olá ${nextCollaborator.name}! Sua vez de limpar o banheiro da empresa nesta sexta-feira, ${nextFriday.toLocaleDateString('pt-BR')}. Por favor, siga as instruções de limpeza padrão. Qualquer dúvida, fale com a administração.`,
      start: { dateTime: nextFriday.toISOString(), timeZone: 'America/Sao_Paulo' },
      end: { dateTime: new Date(nextFriday.getTime() + 60 * 60 * 1000).toISOString(), timeZone: 'America/Sao_Paulo' },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', 'minutes': 24 * 60 },
          { method: 'popup', 'minutes': 60 },
        ],
      },
    };
    const createdEvent = await calendar.events.insert({
      calendarId: process.env.CALENDAR_ID,
      requestBody: event,
    });
    console.log('Evento criado com sucesso no Google Calendar.');
    await prisma.schedule.create({
      data: {
        date: nextFriday,
        collaboratorId: nextCollaborator.id,
        googleEventId: createdEvent.data.id,
      },
    });
    console.log('Agendamento salvo no banco de dados local.');
  } catch (error) {
    console.error('Erro na rotina de agendamento:', error);
  }
}

cron.schedule('0 9 * * 1', runScheduleCheck);

app.get('/api/schedule/run-now', async (req, res) => {
    console.log('--- Forçando a execução da rotina de agendamento via API ---');
    await runScheduleCheck();
    res.status(200).send('Rotina de verificação executada com sucesso.');
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});