import { Client, Intents, Message, MessageAttachment } from 'discord.js'
import { Readable } from 'stream'
export type { Message } from 'discord.js'

const { DISCORD_CLIENT_ID, DISCORD_GUILD_ID, DISCORD_TOKEN, DISCORD_ANNOUNCEMENT_CHANNEL_ID } =
  process.env

// TODO instead of extending Client, just (re)define what we actually use
interface DiscordClient extends Client {
  sendAnimationAnnouncement(message: string, file: Readable): Promise<Message | undefined>
}

export const DISCORD_ENABLED = DISCORD_CLIENT_ID && DISCORD_TOKEN

export async function sendAnnouncementEmptyStub(message: string, file: Readable) {
  return {} as Message
}

export function createClient(onReady = () => {}): DiscordClient {
  const client = new Client({
    intents: [
      Intents.FLAGS.GUILDS,
      Intents.FLAGS.GUILD_MESSAGES,
      Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
    ],
  })

  client.on('ready', async () => {
    console.log(`Logged in as ${client.user?.tag}! 🚀`)
    onReady()
  })

  client.login(DISCORD_TOKEN)
  console.log(
    `Discord Client configured:\n  Client ID: ${DISCORD_CLIENT_ID}\n  Guild  ID: ${DISCORD_GUILD_ID}`
  )
  return addMethods(client)
}

function addMethods(client: Client): DiscordClient {
  const discordClient = client as DiscordClient
  // stitch new method onto client
  discordClient.sendAnimationAnnouncement = async (content: string, file: Readable) => {
    if (!DISCORD_ANNOUNCEMENT_CHANNEL_ID) return
    const channel = await client.channels.fetch(DISCORD_ANNOUNCEMENT_CHANNEL_ID)
    console.log('Announcing to discord channel', channel?.toString())
    if (!channel || !channel.isText()) return
    const attachment = new MessageAttachment(file)

    const message = { content, components: [], embeds: [], files: [attachment] }
    return channel.send(message)
  }
  return discordClient
}
