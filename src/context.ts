import { Injector } from '@joist/di';
import type { Context, Scenes, Telegraf } from 'telegraf';
import type { Message, Convenience, Opts } from 'telegraf/types';
// TODO inform discord - also via github action?!
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

export interface ChatContext {
  channel: MessengerChat;
  group: MessengerChat;
}

export function setupChatContext(
  bot: Telegraf<PhiloContext>,
  ctx: ChatContext = {} as ChatContext
): ChatContext {
  ctx.group = createMessengerChat(bot, `${process.env.TELEGRAM_CHAT_ID}`);
  ctx.channel = createMessengerChat(bot, `${process.env.TELEGRAM_CHANNEL_ID}`);
  return ctx;
}

/**
 * Philo BotContext
 * with two chats: channel and group
 */
export interface PhiloContext extends Context, ChatContext {
  // sendDiscordAnimation: (caption: string, file: string) => Promise<DiscordMessage | undefined>;
  // declare scene type
  scene: Scenes.SceneContextScene<PhiloContext>;
  di: Injector;
}

export interface PhiloBot extends Telegraf<PhiloContext> {}

export function setupContext(
  bot: Telegraf<PhiloContext>,
  injector: Injector,
  context?: PhiloContext
): PhiloContext {
  const ctx = context ?? ({ telegram: bot.telegram } as PhiloContext);
  ctx.di = injector;

  setupChatContext(bot, ctx);

  /*if (!DISCORD_ENABLED) {
    console.log('- Discord connection is disabled');
    ctx.sendDiscordAnimation = sendAnnouncementEmptyStub;
  } else {
    const dClient = createClient();
    ctx.sendDiscordAnimation = dClient.sendAnimationAnnouncement;
  }*/
  return ctx;
}
