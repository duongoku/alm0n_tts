import { Readable } from "stream";
import { config } from "dotenv";

config();

import { Client, Intents, Message, VoiceBasedChannel } from "discord.js";
import {
    AudioPlayer,
    AudioPlayerStatus,
    StreamType,
    VoiceConnection,
    VoiceConnectionStatus,
    createAudioPlayer,
    createAudioResource,
    entersState,
    getVoiceConnection,
    joinVoiceChannel,
} from "@discordjs/voice";
import { TextToSpeechClient, protos } from "@google-cloud/text-to-speech";

const invitation_url = process.env.INVITE;
const keyFilename = process.env.CREPATH;
const prefix = process.env.PREFIX;
const token = process.env.TOKEN;

// Check if environment variables are set
if (!token) {
    console.error("TOKEN environment variable not set");
    process.exit(1);
}
if (!invitation_url) {
    console.error("INVITE environment variable not set");
    process.exit(1);
}
if (!keyFilename) {
    console.error("CREPATH environment variable not set");
    process.exit(1);
}
if (!prefix) {
    console.error("PREFIX environment variable not set");
    process.exit(1);
}

const client = new Client({
    intents: [
        Intents.FLAGS.GUILDS,
        Intents.FLAGS.GUILD_MESSAGES,
        Intents.FLAGS.GUILD_VOICE_STATES,
    ],
});

const tts = new TextToSpeechClient({ keyFilename });

const players_map = new Map();

function is_playing(player: AudioPlayer) {
    if (
        player.state.status == AudioPlayerStatus.Playing ||
        player.state.status == AudioPlayerStatus.Buffering
    ) {
        return true;
    } else {
        return false;
    }
}

async function get_tts_audio(text: string) {
    const request =
        protos.google.cloud.texttospeech.v1.SynthesizeSpeechRequest.create({
            input: { text: text },
            voice: {
                languageCode: "vi-VN",
                ssmlGender:
                    protos.google.cloud.texttospeech.v1.SsmlVoiceGender.NEUTRAL,
            },
            audioConfig: {
                audioEncoding:
                    protos.google.cloud.texttospeech.v1.AudioEncoding.MP3,
                speakingRate: 0.75,
            },
        });

    const [response] = await tts.synthesizeSpeech(request);
    return Readable.from(response.audioContent! as Uint8Array);
}

async function playTTS(message: Message, text: string, player: AudioPlayer) {
    const audioContent = await get_tts_audio(text);

    const resource = createAudioResource(audioContent, {
        inputType: StreamType.Arbitrary,
    });

    if (is_playing(player)) {
        message.reply("Wait for the previous tts to finish first!");
        return false;
    }

    player.play(resource);

    return entersState(player, AudioPlayerStatus.Playing, 10e3);
}

function checkUserCount(
    channel: VoiceBasedChannel,
    connection: VoiceConnection
) {
    let userCount = channel.members.size;
    console.log(userCount);
    if (userCount < 2) {
        connection.destroy();
    } else {
        setTimeout(() => {
            checkUserCount(channel, connection);
        }, 10e3);
    }
}

async function connectToChannel(
    channel: VoiceBasedChannel,
    player: AudioPlayer
) {
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
        checkUserCount(channel, connection);
        return connection;
    } catch (error) {
        connection.destroy();
        throw error;
    }
}

client.once("ready", (c) => {
    client.user!.setActivity(`${prefix}help`, { type: "PLAYING" });
    console.log(`Logged in as ${c.user.tag}`);
    console.log(`Invitation URL is ${invitation_url}`);
    console.log(`Prefix is ${prefix}`);
});

client.on("messageCreate", async (message) => {
    //Check if the message comes from a guild or not
    if (!message.guild) {
        return;
    }

    let args = message.content.slice(prefix.length).split(" ");
    if (!message.content.startsWith(prefix)) {
        return;
    }

    if (args[0].toLowerCase() === "ping") {
        await message.reply("Pong!");
        return;
    }

    if (args[0].toLowerCase() === "invite") {
        await message.reply(invitation_url);
        return;
    }

    if (args[0].toLowerCase() === "help") {
        await message.reply(
            `Main commands:
            ${prefix}tts: Use text-to-speech(Vietnamese)
            ${prefix}disconnect: Disconnect this bot from current voice channel
            ${prefix}invite: Get this bot's invitation link
        `.replace(/  +/g, "")
        );
        return;
    }

    if (args[0].toLowerCase() === "disconnect") {
        const connection = getVoiceConnection(message.guildId!);
        if (connection) {
            connection.destroy();
        }
        return;
    }

    if (args[0].toLowerCase() === "tts") {
        const channel = message.member?.voice.channel;
        const text = args.slice(1).join(" ");

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
            message.reply("Join a voice channel then try again!");
        }

        return;
    }
});

client.login(token);

process.on("SIGINT", () => {
    client.destroy();
});

process.on("exit", () => {
    client.destroy();
});
