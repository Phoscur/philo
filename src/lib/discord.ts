import { Client, GatewayIntentBits, Message, AttachmentBuilder, ChannelType } from 'discord.js';
export type { Message, DiscordAPIError } from 'discord.js';

const { DISCORD_CLIENT_ID, DISCORD_GUILD_ID, DISCORD_TOKEN, DISCORD_ANNOUNCEMENT_CHANNEL_ID } =
  process.env;

// TODO instead of extending Client, just (re)define what we actually use
interface DiscordClient extends Client {
  sendAnimationAnnouncement(message: string, file: string): Promise<Message | undefined>;
}

export const DISCORD_ENABLED = DISCORD_CLIENT_ID && DISCORD_TOKEN;

export async function sendAnnouncementEmptyStub(_message: string, _file: string) {
  return {} as Message;
}

export function createClient(onReady = () => {}): DiscordClient {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMessageReactions,
    ],
  });

  client.on('ready', async () => {
    console.log(`Logged in as ${client.user?.tag}! 🚀`);
    onReady();
  });

  client.login(DISCORD_TOKEN);
  console.log(
    `Discord Client configured:\n  Client ID: ${DISCORD_CLIENT_ID}\n  Guild  ID: ${DISCORD_GUILD_ID}`
  );
  return addMethods(client);
}

function addMethods(client: Client): DiscordClient {
  const discordClient = client as DiscordClient;
  // stitch new method onto client
  discordClient.sendAnimationAnnouncement = async (content: string, file: string) => {
    if (!DISCORD_ANNOUNCEMENT_CHANNEL_ID) return;
    const channel = await client.channels.fetch(DISCORD_ANNOUNCEMENT_CHANNEL_ID);
    console.log(
      'Announcing to discord channel',
      channel?.toString(),
      DISCORD_ANNOUNCEMENT_CHANNEL_ID
    );
    // console.log('Channel Type', channel?.type, ChannelType.GuildNews) // 5 5
    if (!channel || channel.type !== ChannelType.GuildNews) return;
    const attachment = new AttachmentBuilder(file);

    const message = { content, components: [], embeds: [], files: [attachment] };
    const sent = await channel.send(message);
    console.log('Announced to discord channel', channel?.toString(), sent?.content);
    return sent;
  };
  return discordClient;
}
