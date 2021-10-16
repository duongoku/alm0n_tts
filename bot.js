const {Client, Intents} = require('discord.js');
const prefix = require('discord-prefix');
const {
	AudioPlayerStatus,
	StreamType,
	VoiceConnectionStatus,
	createAudioPlayer,
	createAudioResource,
	entersState,
	joinVoiceChannel,
} = require('@discordjs/voice');

const dotenv = require('dotenv'); dotenv.config();
const fs = require('fs');
const util = require('util');
const textToSpeech = require('@google-cloud/text-to-speech');

const token = process.env.TOKEN;
const invitation_url = process.env.INVITE;
const keyFilename = process.env.CREPATH;

const client = new Client({
	intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_VOICE_STATES]
});

const tts = new textToSpeech.TextToSpeechClient({keyFilename});

let defaultPrefix = '"';

const player = createAudioPlayer();

async function create_tts_audio(text) {
    const request = {
        input: {text: text},
        voice: {languageCode: 'vi-VN', ssmlGender: 'NEUTRAL'},
        audioConfig: {audioEncoding: 'MP3'},
    };

    const [response] = await tts.synthesizeSpeech(request);
    const writeFile = util.promisify(fs.writeFile);
    await writeFile('tts.mp3', response.audioContent, 'binary');
    console.log('Audio content written to file: tts.mp3');
  }

function playTTS(message) {
    if (player.state.status == AudioPlayerStatus.Playing) {
        message.reply('Wait for the previous tts to finish first!');
        return false;
    }

	const resource = createAudioResource('./tts.mp3', {
		inputType: StreamType.Arbitrary,
	});

	player.play(resource);

	return entersState(player, AudioPlayerStatus.Playing, 5e3);
}

async function connectToChannel(channel) {
    var check = false;
    channel.members.each(member => {
        if (member.user == client.user) {
            check = true;
        }
    });

    if (check) {
        return null;
    }

	const connection = joinVoiceChannel({
		channelId: channel.id,
		guildId: channel.guild.id,
		adapterCreator: channel.guild.voiceAdapterCreator,
	});

	try {
		await entersState(connection, VoiceConnectionStatus.Ready, 30e3);
		return connection;
	} catch (error) {
		connection.destroy();
		throw error;
	}
}

client.once('ready', () => {
    console.log('p1nto_tts is online!');
})

client.on('messageCreate', async (message) => {
    //stop code execution if message is received in DMs
    if (!message.guild) return;

    //get the prefix for the discord server
    let guildPrefix = prefix.getPrefix(message.guild.id);

    //set prefix to the default prefix if there isn't one
    if (!guildPrefix) guildPrefix = defaultPrefix;

    //rest of the message event
    let args = message.content.slice(guildPrefix.length).split(' ');
    if (!message.content.startsWith(guildPrefix)) return;

    if (args[0].toLowerCase() === 'ping') {
        return message.reply('Pong!');
    };

    if (args[0].toLowerCase() === 'invite') {
        return message.reply(invitation_url);
    };

    if (args[0].toLowerCase() === 'tts') {
        const channel = message.member?.voice.channel;
        const sentence = args.slice(1).join(' ')

        if (channel) {
            try {
                const connection = await connectToChannel(channel);
                if (!connection) {
                    await create_tts_audio(sentence);
                    playTTS(message);
                } else {
                    connection.subscribe(player);
                    await create_tts_audio(sentence);
                    playTTS(message);
                }
            } catch (error) {
                console.error(error);
            }
		} else {
			message.reply('Join a voice channel then try again!');
		}

        return true;
    };
});

client.login(token);

process.on('SIGINT', () => {
    client.destroy();
});