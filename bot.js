const { Client, Intents } = require('discord.js');
const {
    AudioPlayerStatus,
    StreamType,
    VoiceConnectionStatus,
    createAudioPlayer,
    createAudioResource,
    entersState,
    getVoiceConnection,
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

const tts = new textToSpeech.TextToSpeechClient({ keyFilename });

let prefix = '"';
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
        input: { text: text },
        voice: { languageCode: 'vi-VN', ssmlGender: 'NEUTRAL' },
        audioConfig: { audioEncoding: 'MP3', speakingRate: 0.75 },
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
    client.user.setActivity(`${prefix}help`, { type: 'PLAYING' });
    console.log('alm0n_tts is online!');
    console.log(`Invitation URL: ${invitation_url}`);
})

client.on('messageCreate', async (message) => {
    //Check if the message comes from a guild or not
    if (!message.guild) return;

    let args = message.content.slice(prefix.length).split(' ');
    if (!message.content.startsWith(prefix)) return;

    if (args[0].toLowerCase() === 'ping') {
        return message.reply('Pong!');
    }

    if (args[0].toLowerCase() === 'invite') {
        return message.reply(invitation_url);
    }

    if (args[0].toLowerCase() === 'help') {
        return message.reply(`\`Main commands:
            ${prefix}tts: Use text-to-speech(Vietnamese)
            ${prefix}disconnect: Disconnect this bot from current voice channel
            ${prefix}invite: Get this bot's invitation link
        \``.replace(/  +/g, ''));
    }

    if (args[0].toLowerCase() === 'disconnect') {
        const connection = getVoiceConnection(message.guildId);
        if (!connection) {
            return false;
        } else {
            connection.destroy();
            return true;
        }
    }

    if (args[0].toLowerCase() === 'tts') {
        const channel = message.member?.voice.channel;
        const text = args.slice(1).join(' ');

        if (!players_map.get(message.guildId)) {
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
    }
});

client.login(token);

process.on('SIGINT', () => {
    client.destroy();
});

process.on('exit', () => {
    client.destroy();
});