import { Injector } from '@joist/di';
import type { Context, Scenes, Telegraf } from 'telegraf';
import type { Message, Convenience, Opts, InputMedia, MessageId } from 'telegraf/types';
// TODO inform discord - also via github action?!
//import type { Message as DiscordMessage } from './lib/discord.js';
//import { createClient, DISCORD_ENABLED, sendAnnouncementEmptyStub } from './lib/discord.js';
/* onFinish = async (message: string, file: string) => {
    try {
      const attachment = await storage.exists(file);
      if (!attachment) {
        throw new Error('Attachment to send does not exist: ' + file);
      }
      await client.sendDiscordAnimation(message, attachment);
    } catch (err) {
      console.warn('Discord sharing failed', message);
      console.error(err);
    }
  }; */

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
  sendMessageCopy(messageId: number, extra?: Convenience.ExtraReplyMessage): Promise<MessageId>;
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
  chatId: string,
  copyTargetChatId: string
): ChatMessenger {
  return {
    sendMessage: bot.telegram.sendMessage.bind(bot.telegram, chatId),
    sendMessageCopy: bot.telegram.copyMessage.bind(bot.telegram, chatId, copyTargetChatId),
    sendPhoto: bot.telegram.sendPhoto.bind(bot.telegram, chatId),
    sendAnimation: bot.telegram.sendAnimation.bind(bot.telegram, chatId),
    createAnimation: async (
      animation: Opts<'sendAnimation'>['animation'],
      extra?: Convenience.ExtraAnimation
    ): Promise<ChatAnimationMessage> => {
      const message = await bot.telegram.sendAnimation(chatId, animation, extra);
      return {
        editCaption: async (caption, extra) => {
          try {
            await bot.telegram.editMessageCaption(
              chatId,
              message.message_id,
              undefined,
              caption,
              extra
            );
          } catch (err) {
            console.error(
              `Cannot edit message caption ${message.message_id} (${message.chat.id}): ${caption}`
            );
            console.error(err);
          }
        },
        editMedia: async (media, extra) => {
          await bot.telegram.editMessageMedia(chatId, message.message_id, undefined, media, extra);
        },
        delete: async () => {
          await bot.telegram.deleteMessage(chatId, message.message_id);
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
  ctx.group = createTelegramMessengerChat(
    bot,
    `${process.env.TELEGRAM_CHAT_ID}`,
    `${process.env.TELEGRAM_CHANNEL_ID}`
  );
  ctx.channel = createTelegramMessengerChat(
    bot,
    `${process.env.TELEGRAM_CHANNEL_ID}`,
    'no copy target'
  );
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
  presetName: string;
}

export interface PhiloBot extends Telegraf<PhiloContext> {}

export function setupContext(
  bot: Telegraf<PhiloContext>,
  injector: Injector,
  context?: PhiloContext
): PhiloContext {
  const ctx = context ?? ({ telegram: bot.telegram } as PhiloContext);
  ctx.di = injector;
  ctx.presetName = 'default';

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
