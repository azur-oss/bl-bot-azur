const { Client, IntentsBitField, EmbedBuilder, ActivityType } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();
const config = require('./config.json'); 


const client = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMembers,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.MessageContent,
    IntentsBitField.Flags.GuildBans,
  ],
});


const db = new sqlite3.Database('./blacklist.db');


db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS blacklist (
      user_id TEXT PRIMARY KEY,
      moderator_id TEXT,
      reason TEXT,
      date TEXT
    )
  `);
});


client.on('ready', () => {
  console.log(`Bot connecté en tant que ${client.user.tag}`);


  client.user.setPresence({
    activities: [{ name: 'bot de azur', type: ActivityType.Streaming, url: 'https://twitch.tv/discord' }],
    status: 'online',
  });
});


client.on('messageCreate', async (message) => {
  if (message.content.startsWith('+help')) {
    const embed = new EmbedBuilder()
      .setTitle('📝 Commandes du Bot')
      .setDescription('Voici la liste des commandes disponibles :')
      .addFields(
        { name: '+bl @utilisateur [raison]', value: 'Blacklist un utilisateur et le bannit de tous les serveurs.', inline: false },
        { name: '+unbl @utilisateur', value: 'Retire un utilisateur de la blacklist.', inline: false },
        { name: '+blacklist', value: 'Affiche la liste des utilisateurs blacklistés.', inline: false },
        { name: '+help', value: 'Affiche ce message d\'aide.', inline: false }
      )
      .setColor(0x00ff00);

    message.reply({ embeds: [embed] });
  }
});


client.on('messageCreate', async (message) => {
  if (message.content.startsWith('+bl')) {
    
    if (!message.member.permissions.has('ADMINISTRATOR')) {
      return message.reply('Vous n\'avez pas la permission d\'utiliser cette commande.');
    }

    
    const args = message.content.split(' ');
    const user = message.mentions.users.first();
    const reason = args.slice(2).join(' ') || 'Aucune raison spécifiée';

    if (!user) {
      return message.reply('Veuillez mentionner un utilisateur à blacklister.');
    }

   
    const date = new Date().toISOString();
    db.run(
      'INSERT INTO blacklist (user_id, moderator_id, reason, date) VALUES (?, ?, ?, ?)',
      [user.id, message.author.id, reason, date],
      (err) => {
        if (err) {
          return message.reply('Cet utilisateur est déjà blacklisté.');
        }

        
        client.guilds.cache.forEach(async (guild) => {
          const member = guild.members.cache.get(user.id);
          if (member) {
            await member.ban({ reason: `Blacklist globale : ${reason}` }).catch(console.error);
          }
        });

        message.reply(`${user.tag} (<@${user.id}>) a été blacklisté et banni de tous les serveurs par <@${message.author.id}>.`);
      }
    );
  }
});


client.on('messageCreate', async (message) => {
  if (message.content.startsWith('+unbl')) {
   
    if (!message.member.permissions.has('ADMINISTRATOR')) {
      return message.reply('Vous n\'avez pas la permission d\'utiliser cette commande.');
    }

    
    const user = message.mentions.users.first();

    if (!user) {
      return message.reply('Veuillez mentionner un utilisateur à retirer de la blacklist.');
    }


    db.run('DELETE FROM blacklist WHERE user_id = ?', [user.id], (err) => {
      if (err) {
        return message.reply('Une erreur s\'est produite.');
      }
      message.reply(`${user.tag} (<@${user.id}>) a été retiré de la blacklist avec succès par <@${message.author.id}>.`);
    });
  }
});


client.on('messageCreate', async (message) => {
  if (message.content.startsWith('+blacklist')) {
    // Vérifier les permissions de l'utilisateur
    if (!message.member.permissions.has('ADMINISTRATOR')) {
      return message.reply('Vous n\'avez pas la permission d\'utiliser cette commande.');
    }

    db.all('SELECT * FROM blacklist', (err, rows) => {
      if (err) {
        return message.reply('Une erreur s\'est produite lors de la récupération de la blacklist.');
      }

      if (rows.length === 0) {
        return message.reply('Aucun utilisateur n\'est actuellement blacklisté.');
      }

   
      const embed = new EmbedBuilder()
        .setTitle('Liste des utilisateurs blacklistés')
        .setColor(0xff0000);

      rows.forEach((row) => {
        embed.addFields({
          name: `Utilisateur : <@${row.user_id}>`,
          value: `Modérateur : <@${row.moderator_id}>\nRaison : ${row.reason}\nDate : ${row.date}`,
          inline: false,
        });
      });

      message.reply({ embeds: [embed] });
    });
  }
});
client.on('guildMemberAdd', async (member) => {
  db.get('SELECT * FROM blacklist WHERE user_id = ?', [member.id], (err, row) => {
    if (err) {
      console.error('Erreur lors de la vérification de la blacklist :', err);
      return;
    }

    if (row) {
 
      member.ban({ reason: `Blacklist globale : ${row.reason}` })
        .then(() => {
          console.log(`${member.user.tag} a été banni automatiquement.`);
        })
        .catch((err) => {
          console.error('Erreur lors du bannissement :', err);
        });
    }
  });
});


client.login(config.token);