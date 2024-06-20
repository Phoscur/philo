import { Injector } from '@joist/di';
import { consoleInjector } from './services/index.js';
import type { Context, Scenes, Telegraf } from 'telegraf';
import type { Message, Convenience, Opts } from 'telegraf/types';
//import type { Message as DiscordMessage } from './lib/discord.js';
//import { createClient, DISCORD_ENABLED, sendAnnouncementEmptyStub } from './lib/discord.js';

export interface MessengerChat {
  sendMessage(message: string, extra?: Convenience.ExtraReplyMessage): Promise<Message.TextMessage>;
  sendPhoto(
    photo: Opts<'sendPhoto'>['photo'],
    extra?: Convenience.ExtraPhoto
  ): Promise<Message.PhotoMessage>;
  sendAnimation(
    animation: Opts<'sendAnimation'>['animation'],
    extra?: Convenience.ExtraAnimation
  ): Promise<Message.AnimationMessage>;
}

export function createMessengerChat(bot: Telegraf<PhiloContext>, chatId: string) {
  return {
    sendMessage: bot.telegram.sendMessage.bind(bot.telegram, chatId),
    sendPhoto: bot.telegram.sendPhoto.bind(bot.telegram, chatId),
    sendAnimation: bot.telegram.sendAnimation.bind(bot.telegram, chatId),
  };
}

/**
 * Philo BotContext
 * with two chats: channel and group
 */
export interface PhiloContext extends Context {
  channel: MessengerChat;
  group: MessengerChat;
  // sendDiscordAnimation: (caption: string, file: string) => Promise<DiscordMessage | undefined>;
  // declare scene type
  scene: Scenes.SceneContextScene<PhiloContext>;
  di: Injector;
}

export interface PhiloBot extends Telegraf<PhiloContext> {}
export interface PhiloScene extends Scenes.BaseScene<PhiloContext> {}

export function setupContext(bot: Telegraf<PhiloContext>, context?: PhiloContext) {
  const ctx = context || ({ telegram: bot.telegram } as PhiloContext);
  ctx.di ??= consoleInjector;

  ctx.group = createMessengerChat(bot, `${process.env.GROUP_CHAT_ID}`);
  ctx.channel = createMessengerChat(bot, `${process.env.CHANNEL_CHAT_ID}`);

  /*if (!DISCORD_ENABLED) {
    console.log('- Discord connection is disabled');
    ctx.sendDiscordAnimation = sendAnnouncementEmptyStub;
  } else {
    const dClient = createClient();
    ctx.sendDiscordAnimation = dClient.sendAnimationAnnouncement;
  }*/
  return ctx;
}
