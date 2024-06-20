import { Context, Telegraf, Scenes, session } from 'telegraf';

import { type PhiloContext, setupContext } from './context.js';
import { getStorageStatus } from './lib/df.js';
import { readTemperatureSensor } from './lib/temperature.js';
import { setupPhotoControl } from './PhotoControl.js';
import { dailySunsetCronFactory } from './daily.js';

const { TELEGRAM_TOKEN, GROUP_CHAT_ID, DAILY } = process.env;

function buildStage() {
  // storage and temperature do not have a scenes (yet)
  const photoScene = new Scenes.BaseScene<PhiloContext>('photo');
  // basic utility commands
  photoScene.command(['status', 'storage', 's'], (ctx) => {
    setImmediate(async () => {
      const status = await getStorageStatus();
      ctx.reply(`Storage space: ${status}`);
    });
  });
  photoScene.command(['temperature', 't', 'temperatur', 'humidity'], async (ctx) => {
    try {
      const { temperature, humidity } = await readTemperatureSensor();
      ctx.reply(`Current temperature: ${temperature}°C, humidity: ${humidity}%`);
    } catch (error) {
      ctx.reply(`Sorry failed to read the sensor: ${error}`);
    }
  });
  setupPhotoControl(photoScene);
  return new Scenes.Stage<PhiloContext>([photoScene], {
    default: 'photo',
  });
}

async function setupBot() {
  if (!TELEGRAM_TOKEN) {
    throw new Error('BOT_TOKEN must be provided by ENV!');
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

  bot.use((ctx, next) => {
    setupContext(bot, ctx);
    return next();
  });

  bot.use(buildStage().middleware());

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

  bot.launch();
  if (DAILY) {
    console.log('Setting up daily timelapse ...');
    const ctx = setupContext(bot);
    dailySunsetCronFactory(ctx);
  }

  // Enable graceful stop
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

setupBot().then(() => console.log('🚀 Bot is running!'));
