import { MiddlewareFn, Scenes, Markup, Telegraf, Input } from 'telegraf';
import type { Message, InlineKeyboardMarkup, InputMediaPhoto } from 'telegraf/types';
import { PhiloContext, setupChatContext, setupContext } from './context.js';
import {
  Assets,
  createInjector,
  Director,
  Hardware,
  I18nService,
  Logger,
  Preset,
  Producer,
  Publisher,
} from './services/index.js';

export const COMMAND = {
  STATUS: 'status',
  RANDOM: 'random',
  PREVIEW: 'preview',
  PHOTO: 'photo',
  PRESET: 'preset',
} as const;

const ADMINS = process.env.ADMINS?.split(',') || ['Phoscur'];

const DAILY = process.env.ENABLE_DAILY_TIMELAPSE_SUNSET === 'true';

/**
 * Setup scene(s), Context with DI: Commands
 */
export function buildStage(bot: Telegraf<PhiloContext>) {
  const di = createInjector();
  // storage and temperature do not have a scenes (yet)
  const scene = new Scenes.BaseScene<PhiloContext>('photo');
  // basic utility commands
  scene.command([COMMAND.STATUS, 's'], (ctx) => {
    const hd = ctx.di.get(Hardware);
    setImmediate(async () => {
      ctx.reply(await hd.getStatus());
    });
  });

  // ---------------------------------------------------------------------------------------------------
  // Photos

  scene.command([COMMAND.RANDOM, 'r'], (ctx) => {
    const assets = ctx.di.get(Assets);
    ctx.replyWithPhoto(assets.randomImage);
    // or ctx.replyWithAnimation(ctx.di.get(Assets).telegramSpinner);
  });
  scene.command([COMMAND.PREVIEW, 'p'], async (ctx) => {
    const director = ctx.di.get(Director);
    const { filename, dir } = await director.photo('default');
    ctx.replyWithPhoto(Input.fromLocalFile(dir.joinAbsolute(filename)));
  });

  scene.command([COMMAND.PHOTO, 'options'], async function (ctx: PhiloContext) {
    const producer = ctx.di.get(Producer);
    await producer.options(ctx.group, ctx.presetName);
  });

  scene.action(Producer.ACTION.SHOT, async (ctx) => {
    const producer = ctx.di.get(Producer);
    await ctx.answerCbQuery(producer.callbackMessagePhotograph);
    await producer.photograph(ctx.group, ctx.presetName);
  });

  // ---------------------------------------------------------------------------------------------------
  // Sharing / Publishing: Collecting Appraisals

  scene.action(Publisher.ACTION.SHARE, async (ctx, next) => {
    const publisher = ctx.di.get(Publisher);
    const { t } = ctx.di.get(I18nService);
    const { message } = ctx.callbackQuery;

    const user = ctx.from?.username || '';
    if (!~ADMINS.indexOf(user)) {
      return ctx.answerCbQuery(t('message.noPermission'));
    }

    if (!message) return next();
    if (isTextMessage(message)) return next();
    await publisher.publish(ctx.group, message.message_id);
    await ctx.answerCbQuery(publisher.callbackMessageShare);
  });

  scene.action(Publisher.ACTION.LIKE, async (ctx, next) => {
    const publisher = ctx.di.get(Publisher);
    const data = ctx.match[0] || '';

    const { message } = ctx.callbackQuery;
    const user = ctx.from?.username || 'Anonymous';
    if (!(isPhotoMessage(message) || isVideoMessage(message))) return next();

    const liked = await publisher.saveLike(message.message_id, user, data);
    await publisher.updateCaptions(ctx.group, message.message_id);
    await ctx.answerCbQuery(liked);
  });

  scene.action(Publisher.ACTION.STUDY, async (ctx, next) => {
    const publisher = ctx.di.get(Publisher);
    const { t } = ctx.di.get(I18nService);
    const data = ctx.match[0] || '';

    const { message } = ctx.callbackQuery;
    const user = ctx.from?.username || '';
    if (!(isPhotoMessage(message) || isVideoMessage(message))) return next();

    if (!~ADMINS.indexOf(user)) {
      return ctx.answerCbQuery(t('message.noPermission'));
    }
    const cloud = await publisher.saveCloudStudy(message.message_id, data);
    await publisher.updateCaptions(ctx.group, message.message_id);
    await ctx.answerCbQuery(cloud);
  });

  // ---------------------------------------------------------------------------------------------------
  // Presets: Test different e.g. region of interest settings for the images taken

  function renderPresetSelect(ctx: PhiloContext) {
    const presets = ctx.di.get(Preset);
    const { t } = ctx.di.get(I18nService);
    const presetNames = Object.keys(presets.presets).filter((name) => name !== ctx.presetName);
    const buttons = presetNames.map((presetName) =>
      // TODO? buttons split into multiple rows
      Markup.button.callback(`${presetName} 📷`, `presetSelect-${presetName}`)
    );
    return {
      text: `Current: ${ctx.presetName} 📷\n${presets.printPreset(presets.get(ctx.presetName))}`,
      markup: Markup.inlineKeyboard([
        buttons,
        [Markup.button.callback(t('action.shotSingle'), 'shot')],
      ]),
    };
  }

  scene.command([COMMAND.PRESET, 'presets'], async (ctx) => {
    const producer = ctx.di.get(Producer);

    const { text, markup } = renderPresetSelect(ctx);
    const { message, name: title } = await producer.shot(ctx.group, ctx.presetName);
    await message.editCaption(`${title}\n${text}`, markup);
  });

  scene.action(/presetSelect-.+/, async (ctx, next) => {
    const presets = ctx.di.get(Preset);
    const director = ctx.di.get(Director);
    const { t } = ctx.di.get(I18nService);

    const name = ctx.match[0].replace('presetSelect-', '');
    const preset = presets.get(name);
    if (!preset) {
      return next();
    }
    await ctx.answerCbQuery(t('message.preset', name));
    ctx.presetName = name;
    const { filename, dir } = await director.photo(name);
    const media = dir.joinAbsolute(filename);

    const { text, markup } = renderPresetSelect(ctx);
    await ctx.editMessageMedia({ type: 'photo', media });
    await ctx.editMessageCaption(text, markup);
  });

  // ---------------------------------------------------------------------------------------------------
  // Timelapses

  scene.action(Producer.ACTION.CANCEL, async (ctx) => {
    try {
      const producer = ctx.di.get(Producer);
      const { t } = ctx.di.get(I18nService);
      const { message } = ctx.callbackQuery;
      if (!message?.message_id) return;
      const user = ctx.from?.username || '';
      // TODO use list from channel, doesn't work in private channel though! await ctx.getChatAdministrators(),
      console.log('Admin Check', user, ADMINS, ctx.from, message.message_id);
      if (!~ADMINS.indexOf(user)) {
        return ctx.answerCbQuery(t('message.noPermission'));
      }
      await ctx.answerCbQuery(producer.callbackMessageCancel);
      const canceling = producer.cancel();
      if (canceling) {
        await canceling;
      }
      await ctx.deleteMessage(message.message_id);
    } catch (error) {
      console.error('Failed to cancel', error);
    }
  });

  function timelapseAction(options: {
    count: number;
    intervalMS: number;
    prefix?: string;
    presetName?: string;
  }) {
    return async (ctx: PhiloContext) => {
      try {
        const producer = ctx.di.get(Producer);
        await ctx.answerCbQuery(producer.callbackMessageTimelapse);
        await producer.timelapse(ctx.group, options);
      } catch (error) {
        ctx.di.get(Logger).log('Failed timelapse!', error);
        await ctx.reply(`Failed timelapse: ${error}`);
      }
    };
  }

  for (const setting of Producer.TIMELAPSES) {
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

function isTextMessage(message: any): message is Message.TextMessage {
  return 'text' in message;
}
function isVideoMessage(message: any): message is Message.VideoMessage {
  return 'video' in message;
}
function isPhotoMessage(message: any): message is Message.PhotoMessage {
  return 'video' in message;
}
