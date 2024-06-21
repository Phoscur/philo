import { MiddlewareFn, Scenes, Telegraf } from 'telegraf';
import { Injector } from '@joist/di';
import { PhiloContext, setupChatContext, setupContext } from './context.js';
import { Assets, Director, Hardware, Producer } from './services/index.js';

const DAILY = process.env.DAILY === 'true';

export function buildStage(bot: Telegraf<PhiloContext>, di: Injector) {
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
    ctx.replyWithPhoto(assets.randomImage.media);
  });
  scene.command(['photo', 'p'], async (ctx) => {
    const director = ctx.di.get(Director);
    const photo = await director.photo('default');
    if (photo) {
      ctx.replyWithPhoto(photo);
    }
  });
  scene.command(['animation', 'a'], (ctx) => {
    ctx.replyWithAnimation(ctx.di.get(Assets).spinnerAnimation.media);
  });

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
