import { Context, Telegraf, session } from 'telegraf'
import buildStage from './scenes'
import { StorageManager } from './lib/storage'
import type PhiloContext from './PhiloContext.interface'

import { StreamContainer, TasksContainer } from './lib/tasks'
import { dailySunsetCronFactory } from './daily'
import { setupContext } from './context'

const { BOT_TOKEN, GROUP_CHAT_ID, DAILY } = process.env

async function setupBot() {
  if (!BOT_TOKEN) {
    throw new Error('BOT_TOKEN must be provided by ENV!')
  }
  const bot = new Telegraf<PhiloContext>(BOT_TOKEN)
  const storage = await StorageManager.create(/* config from env */)
  const running = new TasksContainer() // (needs sharing beyond the context lifetime of setImmediate)
  const streams = new StreamContainer(running)

  // bot.use(Telegraf.log())
  bot.use(
    session({
      // session is required for scenes: one session per chat (not user bound)
      //getSessionKey: (ctx: Context) => ctx.from && `${ctx.from.id}:${ctx.chat?.id || GROUP_CHAT_ID}`
      getSessionKey: async (ctx: Context) => (ctx.chat && ctx.chat.id.toString()) || GROUP_CHAT_ID,
    })
  )

  bot.use((ctx, next) => {
    setupContext(bot, storage, streams, ctx)
    return next()
  })

  bot.use(buildStage(storage, streams).middleware())

  bot.start((ctx) => {
    ctx.reply('Bot is ready!')
  })

  bot.command('photo', (ctx) => ctx.scene.enter('photo'))
  bot.command('timelapse', (ctx) => ctx.scene.enter('timelapse'))
  bot.on('message', (ctx) => ctx.reply('Try /photo'))
  // when using this, the Bot is no longer restarted!
  bot.catch((error) => {
    console.error('Bot ERROR', error)
  }) //*/

  bot.launch()
  if (DAILY) {
    console.log('Setting up daily timelapse ...')
    const ctx = setupContext(bot, storage, streams)
    dailySunsetCronFactory(ctx, ctx.sendGroupMessage, ctx.sendGroupAnimation)
  }

  // Enable graceful stop
  process.once('SIGINT', () => bot.stop('SIGINT'))
  process.once('SIGTERM', () => bot.stop('SIGTERM'))
}

setupBot().then(() => console.log('🚀 Bot is running!'))
