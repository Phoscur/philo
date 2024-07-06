import { Injector } from '@joist/di';
import type { Context, Scenes, Telegraf } from 'telegraf';
import type { Message, Convenience, Opts, InputMedia } from 'telegraf/types';
// TODO inform discord - also via github action?!
//import type { Message as DiscordMessage } from './lib/discord.js';
//import { createClient, DISCORD_ENABLED, sendAnnouncementEmptyStub } from './lib/discord.js';

export interface ChatAnimationMessage {
  editCaption(caption: string, extra?: Convenience.ExtraEditMessageCaption): Promise<void>;
  editMedia(
    media: Convenience.WrapCaption<InputMedia>,
    extra?: Convenience.ExtraEditMessageMedia
  ): Promise<void>;
  delete(): Promise<void>;
}

export interface ChatMessenger {
  sendMessage(message: string, extra?: Convenience.ExtraReplyMessage): Promise<Message.TextMessage>;
  sendPhoto(
    photo: Opts<'sendPhoto'>['photo'],
    extra?: Convenience.ExtraPhoto
  ): Promise<Message.PhotoMessage>;
  sendAnimation(
    animation: Opts<'sendAnimation'>['animation'],
    extra?: Convenience.ExtraAnimation
  ): Promise<Message.AnimationMessage>;
  createAnimation(
    animation: Opts<'sendAnimation'>['animation'],
    extra?: Convenience.ExtraAnimation
  ): Promise<ChatAnimationMessage>;
}

export function createTelegramMessengerChat(
  bot: Telegraf<PhiloContext>,
  chatId: string
): ChatMessenger {
  return {
    sendMessage: bot.telegram.sendMessage.bind(bot.telegram, chatId),
    sendPhoto: bot.telegram.sendPhoto.bind(bot.telegram, chatId),
    sendAnimation: bot.telegram.sendAnimation.bind(bot.telegram, chatId),
    createAnimation: async (
      animation: Opts<'sendAnimation'>['animation'],
      extra?: Convenience.ExtraAnimation
    ): Promise<ChatAnimationMessage> => {
      const msg = await bot.telegram.sendAnimation(chatId, animation, extra);
      return {
        editCaption: async (caption, extra) => {
          await bot.telegram.editMessageCaption(chatId, msg.message_id, undefined, caption, extra);
        },
        editMedia: async (media, extra) => {
          await bot.telegram.editMessageMedia(chatId, msg.message_id, undefined, media, extra);
        },
        delete: async () => {
          await bot.telegram.deleteMessage(chatId, msg.message_id);
        },
      };
    },
  };
}

export interface ChatContext {
  channel: ChatMessenger;
  group: ChatMessenger;
}

export function setupChatContext(
  bot: Telegraf<PhiloContext>,
  ctx: ChatContext = {} as ChatContext
): ChatContext {
  ctx.group = createTelegramMessengerChat(bot, `${process.env.TELEGRAM_CHAT_ID}`);
  ctx.channel = createTelegramMessengerChat(bot, `${process.env.TELEGRAM_CHANNEL_ID}`);
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
