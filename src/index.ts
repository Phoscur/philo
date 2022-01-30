import { Context, Telegraf, session } from 'telegraf'
import buildStage from './scenes'
import StillCamera from './lib/raspistill'
import { DailyRotatingStorage } from './lib/storage'
import { getFormattedDate } from './lib/time'
import type PhiloContext from './PhiloContext.interface'
import type { Preset, InputMediaCameraPhoto } from './PhiloContext.interface'

import presets, { sunsetTimings } from './presets' // TODO? use storage instead?

const randomEmulation = 0
const { BOT_TOKEN, GROUP_CHAT_ID, CHANNEL_CHAT_ID, STORAGE_DIRECTORY, RANDOM_IMAGE_URL } =
  process.env

async function setupBot() {
  if (!BOT_TOKEN) {
    throw new Error('BOT_TOKEN must be provided by ENV!')
  }

  const storage = await DailyRotatingStorage.create(/* config from env */)
  const bot = new Telegraf<PhiloContext>(BOT_TOKEN)

  async function takePhoto(preset: Preset): Promise<InputMediaCameraPhoto> {
    const source = await new StillCamera(preset).takeImage()
    const media = { source }
    return {
      type: 'photo',
      media,
    }
  }

  // bot.use(Telegraf.log())
  bot.use(
    session({
      // session is required for scenes: one session per chat (not user bound)
      //getSessionKey: (ctx: Context) => ctx.from && `${ctx.from.id}:${ctx.chat?.id || GROUP_CHAT_ID}`
      getSessionKey: async (ctx: Context) => (ctx.chat && ctx.chat.id.toString()) || GROUP_CHAT_ID,
    })
  )
  bot.use((ctx, next) => {
    ctx.randomEmulation ??= randomEmulation
    ctx.presetName ??= 'base'
    ctx.preset ??= presets.base
    ctx.presets ??= presets
    ctx.sunsetTimings ??= sunsetTimings
    ctx.storage ??= storage
    ctx.takePhoto = function (preset: Preset) {
      if (this.randomEmulation) {
        return new Promise((resolve) =>
          setTimeout(
            resolve.bind(null, this.randomImage as InputMediaCameraPhoto),
            this.randomEmulation
          )
        )
      }
      console.log('Taking photo with preset: ' + ctx.preset)
      return takePhoto(preset)
    }
    //function (x: string | InputFile, extra?: ExtraReplyMessage) => bot.telegram.sendX(CHANNEL_CHAT_ID as string, message, extra)
    ctx.sendChannelMessage = bot.telegram.sendMessage.bind(bot.telegram, CHANNEL_CHAT_ID as string)
    ctx.sendChannelPhoto = bot.telegram.sendPhoto.bind(bot.telegram, CHANNEL_CHAT_ID as string)
    ctx.sendChannelAnimation = bot.telegram.sendAnimation.bind(
      bot.telegram,
      CHANNEL_CHAT_ID as string
    )
    ctx.sendChannelMessageCopy = function (extra) {
      return this.copyMessage(CHANNEL_CHAT_ID as string, extra)
    }

    Object.defineProperties(ctx, {
      spinnerAnimation: {
        get() {
          return {
            media: {
              source: ctx.storage.readStream('../assets/cool-loading-animated-gif-3.gif'),
            },
            type: 'animation',
          }
        },
      },
      randomImage: {
        get() {
          return {
            media: {
              url: RANDOM_IMAGE_URL || 'https://picsum.photos/600/400/?random',
            },
            type: 'photo',
          }
        },
      },
      now: {
        get() {
          return getFormattedDate()
        },
      },
    })
    return next()
  })
  bot.use(buildStage(storage).middleware())

  bot.start((ctx) => {
    ctx.reply('Bot is ready!')
  })

  bot.command('photo', (ctx) => ctx.scene.enter('photo'))
  bot.command('timelapse', (ctx) => ctx.scene.enter('timelapse'))
  bot.on('message', (ctx) => ctx.reply('Try /photo'))

  bot.launch()

  // Enable graceful stop
  process.once('SIGINT', () => bot.stop('SIGINT'))
  process.once('SIGTERM', () => bot.stop('SIGTERM'))
}

setupBot().then(() => console.log('🚀 Bot is running!'))
