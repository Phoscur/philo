import { MiddlewareFn, Scenes, Markup, Telegraf, Input } from 'telegraf';
import type { Message, InlineKeyboardMarkup, InputMediaPhoto } from 'telegraf/types';
import { PhiloContext, setupChatContext, setupContext } from './context.js';
import {
  Assets,
  createInjector,
  Director,
  Hardware,
  Logger,
  Preset,
  Producer,
} from './services/index.js';
import fancyCount from './lib/fancyCount.js';

const ADMINS = process.env.ADMINS?.split(',') || ['Phoscur'];

const DAILY = process.env.ENABLE_DAILY_TIMELAPSE_SUNSET === 'true';

const emojiButtons = [
  Markup.button.callback('❤️', 'like-❤️'), // like ⭐🌟❤️‍🔥
  Markup.button.callback('💙', 'like-💙'), // uncloudy ☀️🌞🌝🌙🌚🌛🌜🌃 🌑🌒🌓🌔🌕🌖🌗🌘
  Markup.button.callback('💚', 'like-💚'), // ?
  Markup.button.callback('💜', 'like-💜'), // colorful
  Markup.button.callback('💖', 'like-💖'), // brilliant
  Markup.button.callback('💗', 'like-💗'), // nice
  Markup.button.callback('🤍', 'like-🤍'), // cloud study ☁️🌧️⛅🌦️⛈️🌩️🌨️🌬️
  Markup.button.callback('🖤', 'like-🖤'), // dark clouds/no sunset
  // 8 is max in a row, rather 7 for Telegram Desktop
];

/**
 * Setup scene(s), Context with DI: Commands
 */
export function buildStage(bot: Telegraf<PhiloContext>) {
  const di = createInjector();
  // storage and temperature do not have a scenes (yet)
  const scene = new Scenes.BaseScene<PhiloContext>('photo');
  // basic utility commands
  scene.command(['status', 's'], (ctx) => {
    const hd = ctx.di.get(Hardware);
    setImmediate(async () => {
      ctx.reply(await hd.getStatus());
    });
  });
  scene.command(['random', 'r'], (ctx) => {
    const assets = ctx.di.get(Assets);
    ctx.replyWithPhoto(assets.randomImage);
  });
  scene.command(['preview', 'p'], async (ctx) => {
    const director = ctx.di.get(Director);
    const { filename, dir } = await director.photo('default');
    ctx.replyWithPhoto(Input.fromLocalFile(dir.joinAbsolute(filename)));
  });
  scene.command(['animation', 'a'], (ctx) => {
    ctx.replyWithAnimation(ctx.di.get(Assets).telegramSpinner);
  });

  scene.command(['photo', 'options'], async function (ctx: PhiloContext) {
    const producer = ctx.di.get(Producer);
    await producer.options(ctx.group, ctx.presetName);
  });

  scene.action('shot', async (ctx) => {
    await ctx.answerCbQuery('Taking image now...');
    const producer = ctx.di.get(Producer);
    const { message, name: title } = await producer.shot(ctx.group, ctx.presetName);
    // add share button (repost in CHANNEL_CHAT_ID with different caption)
    const markup = Markup.inlineKeyboard([[Markup.button.callback('Share 📢', 'share')]]);
    await message.editCaption(title, markup);
  });

  scene.action('share', async (ctx, next) => {
    const { message } = ctx.callbackQuery;
    await ctx.answerCbQuery('Sharing to channel!');
    if (!message) return next();
    if ('text' in message) return next();
    //if (!('photo' in message)) return next()
    //if ('video' in message) return next()
    console.log(
      'Message Photo',
      (message as Message.PhotoMessage).photo,
      (message as Message.AnimationMessage).animation
    );
    const markup = Markup.inlineKeyboard([emojiButtons]);
    await ctx.group.sendMessageCopy(message.message_id, markup);
    //await ctx.deleteMessage(message.message_id);
    //if (!('video' in ctx.message)) return next()
    //if (ctx.message.video) {}
  });

  scene.action(/like-.+/, async (ctx, next) => {
    const match = ctx.match[0]?.split('-');
    const emoji = match[1] || '💖';
    console.log('Match', ctx.match, match);
    const { message } = ctx.callbackQuery;
    if (!message) return next();
    if ('text' in message) return next();
    if (!('photo' in message || 'animation' in message || 'video' in message)) return next();
    try {
      const markup = Markup.inlineKeyboard([emojiButtons]);
      const caption = message.caption + emoji;
      const emojis = fancyCount(caption);
      await ctx.editMessageCaption(emojis.count < 13 ? caption : emojis.unfancy + ' ❤️‍🔥', markup);
      await ctx.answerCbQuery('💖');
    } catch (error) {
      console.error(error);
      await ctx.answerCbQuery('Failed :(');
    }
    // removes discussion await ctx.editMessageCaption ReplyMarkup({      inline_keyboard: [emojiButtons],    })
  });

  scene.action('cancelRunning', async (ctx) => {
    try {
      const { message } = ctx.callbackQuery;
      if (!message?.message_id) return;
      const user = ctx.from?.username || '';
      // TODO use list from channel, doesn't work in private channel though! await ctx.getChatAdministrators(),
      console.log('Admin Check', user, ADMINS, ctx.from, message.message_id);
      if (!~ADMINS.indexOf(user)) {
        return ctx.answerCbQuery(`Only Admins can cancel`);
      }
      await ctx.answerCbQuery(`Cancelling!`);
      const canceling = ctx.di.get(Producer).cancel();
      if (canceling) {
        await canceling;
      }
      await ctx.deleteMessage(message.message_id);
    } catch (error) {
      console.error('Failed to cancel', error);
    }
  });

  function renderPresetSelect(ctx: PhiloContext) {
    const presets = ctx.di.get(Preset);
    const presetNames = Object.keys(presets.presets).filter((name) => name !== ctx.presetName);
    const buttons = presetNames.map((presetName) =>
      // TODO? buttons split into multiple rows
      Markup.button.callback(`${presetName} 📷`, `presetSelect-${presetName}`)
    );
    return {
      text: `Current: ${ctx.presetName} 📷\n${presets.printPreset(presets.get(ctx.presetName))}`,
      markup: Markup.inlineKeyboard([buttons, [Markup.button.callback('Take a Shot 🥃', 'shot')]]),
    };
  }

  scene.command(['presets', 'preset'], async (ctx) => {
    const producer = ctx.di.get(Producer);

    const { text, markup } = renderPresetSelect(ctx);
    const { message, name: title } = await producer.shot(ctx.group, ctx.presetName);
    await message.editCaption(`${title}\n${text}`, markup);
  });

  scene.action(/presetSelect-.+/, async (ctx, next) => {
    const presets = ctx.di.get(Preset);
    const director = ctx.di.get(Director);

    const name = ctx.match[0].replace('presetSelect-', '');
    const preset = presets.get(name);
    if (!preset) {
      return next();
    }
    await ctx.answerCbQuery(`Selected ${name} 📷, updating...`);
    ctx.presetName = name;
    const { filename, dir } = await director.photo(name);
    const media = dir.joinAbsolute(filename);

    const { text, markup } = renderPresetSelect(ctx);
    await ctx.editMessageMedia({ type: 'photo', media });
    await ctx.editMessageCaption(text, markup);
  });

  // ---------------------------------------------------------------------------------------------------
  // Timelapses

  function timelapseAction(options: {
    count: number;
    intervalMS: number;
    prefix?: string;
    presetName?: string;
  }) {
    return async (ctx: PhiloContext) => {
      try {
        const producer = ctx.di.get(Producer);
        await ctx.answerCbQuery(`Starting Timelapse now!`);
        await producer.timelapse(ctx.group, options);
      } catch (error) {
        ctx.di.get(Logger).log('Failed timelapse!', error);
        await ctx.reply(`Failed timelapse: ${error}`);
      }
    };
  }

  for (const setting of [
    { count: 420, intervalMS: 12000, prefix: 'timelapse' },
    { count: 210, intervalMS: 12000, prefix: 'timelapse-half' },
    { count: 140, intervalMS: 12000, prefix: 'timelapse-third' },
    { count: 30, intervalMS: 2000, prefix: 'timelapse-short' },
    { count: 14, intervalMS: 2000, prefix: 'timelapse-super-short' },
  ]) {
    scene.action(setting.prefix, timelapseAction(setting));
  }

  // ---------------------------------------------------------------------------------------------------
  // Daily Schedule

  if (DAILY) {
    console.log('Setting up daily timelapse ...');
    const producer = di.get(Producer);
    const chat = setupChatContext(bot).group;
    producer.scheduleDailySunset(chat);
  }

  const stage = new Scenes.Stage<PhiloContext>([scene], {
    default: 'photo',
  });

  const stageMiddleware: MiddlewareFn<PhiloContext> = stage.middleware();
  const contextMiddleware: MiddlewareFn<PhiloContext> = (
    ctx: PhiloContext,
    next: () => Promise<void>
  ) => {
    setupContext(bot, di, ctx);
    stageMiddleware(ctx, next);
  };

  return {
    middleware: () => contextMiddleware,
  };
}
