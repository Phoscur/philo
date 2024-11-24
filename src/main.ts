import { Context, Telegraf, session } from 'telegraf';
import { buildStage } from './photoStage.js';
import type { PhiloContext } from './context.js';

const { TELEGRAM_TOKEN, GROUP_CHAT_ID } = process.env;

async function setupBot() {
  if (!TELEGRAM_TOKEN) {
    throw new Error('TELEGRAM_TOKEN must be provided by ENV!');
  }
  const bot = new Telegraf<PhiloContext>(TELEGRAM_TOKEN);

  // bot.use(Telegraf.log())
  bot.use(
    session({
      // session is required for scenes: one session per chat (not user bound)
      //getSessionKey: (ctx: Context) => ctx.from && `${ctx.from.id}:${ctx.chat?.id || GROUP_CHAT_ID}`
      getSessionKey: async (ctx: Context) => (ctx.chat && ctx.chat.id.toString()) || GROUP_CHAT_ID,
    })
  );

  bot.use(buildStage(bot).middleware());

  bot.start((ctx) => {
    ctx.reply('Bot is ready!');
  });

  bot.command('photo', (ctx) => ctx.scene.enter('photo'));
  //bot.command('timelapse', (ctx) => ctx.scene.enter('timelapse'));
  bot.on('message', (ctx) => ctx.reply('Try /photo'));
  // when using this, the Bot is no longer restarted!
  bot.catch((error) => {
    console.error('Bot ERROR', error);
  }); //*/

  await bot.telegram.getMe();
  bot.launch();

  // Enable graceful stop
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

setupBot().then(() =>
  console.log(
    `🚀 Bot is running!\n(In chat [${process.env.TELEGRAM_CHAT_ID}], sharing to channel [${process.env.TELEGRAM_CHANNEL_ID}])`
  )
);
