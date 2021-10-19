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
const players_map = new Map();

function is_playing(player) {
    if (player.state.status == AudioPlayerStatus.Playing ||
        player.state.status == AudioPlayerStatus.Buffering) {
        return true;
    } else {
        return false;
    }
}

async function get_tts_audio(text) {
    const request = {
        input: {text: text},
        voice: {languageCode: 'vi-VN', ssmlGender: 'NEUTRAL'},
        audioConfig: {audioEncoding: 'MP3', speakingRate: 0.75},
    };

    const [response] = await tts.synthesizeSpeech(request);
    return response.audioContent;
}

async function playTTS(message, text, player) {
	const resource = createAudioResource(get_tts_audio(text), {
		inputType: StreamType.Arbitrary,
	});

    if (is_playing(player)) {
        message.reply('Wait for the previous tts to finish first!');
        return false;
    }

	player.play(resource);

	return entersState(player, AudioPlayerStatus.Playing, 10e3);
}

async function connectToChannel(channel, player) {
    if (is_playing(player)) {
        return false;
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
    console.log('alm0n_tts is online!');
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
        const text = args.slice(1).join(' ');

        if(!players_map.get(message.guildId)) {
            players_map.set(message.guildId, createAudioPlayer());
        }

        if (channel) {
            var player = players_map.get(message.guildId);
            try {
                const connection = await connectToChannel(channel, player);
                if (!connection) {
                    await playTTS(message, text, player);
                } else {
                    connection.subscribe(player);
                    await playTTS(message, text, player);
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

process.on('exit', () => {
    client.destroy();
});