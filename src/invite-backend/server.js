import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { Resend } from 'resend';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;
const resend = new Resend(process.env.RESEND_API_KEY);

app.use(cors());
app.use(express.json());

app.post('/send-invite', async (req, res) => {
  const { to, link, groupName } = req.body;

  if (!to || !link || !groupName) {
    return res.status(400).json({ error: 'Fehlende Felder' });
  }

  try {
    const result = await resend.emails.send({
      from: 'Gruppeneinladung <no-reply@deine-domain.de>',
      to,
      subject: `Einladung zur Gruppe „${groupName}“`,
      html: `
        <h2>Du wurdest zur Gruppe <b>${groupName}</b> eingeladen</h2>
        <p>Klicke auf den folgenden Link, um der Gruppe beizutreten:</p>
        <a href="${link}" target="_blank">${link}</a>
        <p>Wenn du nicht eingeladen werden wolltest, kannst du die Einladung ignorieren.</p>
      `
    });

    res.status(200).json({ success: true, result });
  } catch (error) {
    console.error('Fehler beim E-Mail-Versand:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Resend-Mailserver läuft auf http://localhost:${port}`);
});
