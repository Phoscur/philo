import { Context, Telegraf, Markup, session } from 'telegraf'
import buildStage from './scenes'
import FileStorage from './lib/storage'
import type PhiloContext from './PhiloContext.interface'

import presets, { sunsetTimings } from './presets' // TODO? use storage instead?

const { BOT_TOKEN, GROUP_CHAT_ID, STORAGE_DIRECTORY, RANDOM_IMAGE_URL } = process.env
if (!BOT_TOKEN) {
  throw new Error('BOT_TOKEN must be provided by ENV!')
}
const storage = new FileStorage(STORAGE_DIRECTORY)
const bot = new Telegraf<PhiloContext>(BOT_TOKEN)

// bot.use(Telegraf.log())
bot.use(
  session({
    // session is required for scenes: one session per chat (not user bound)
    //getSessionKey: (ctx: Context) => ctx.from && `${ctx.from.id}:${ctx.chat?.id || GROUP_CHAT_ID}`
    getSessionKey: async (ctx: Context) => (ctx.chat && ctx.chat.id.toString()) || GROUP_CHAT_ID,
  })
)
bot.use((ctx, next) => {
  ctx.presetName ??= 'base'
  ctx.preset ??= presets.base
  ctx.presets ??= presets
  ctx.sunsetTimings ??= sunsetTimings
  ctx.storage ??= storage
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
console.log('Bot is running!')

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
