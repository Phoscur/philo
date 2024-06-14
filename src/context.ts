import type { Telegraf } from 'telegraf'
import type PhiloContext from './PhiloContext.interface'
import type { Preset, InputMediaCameraPhoto, StorageManager } from './PhiloContext.interface'
import type { StreamContainer } from './lib/tasks'

import { getFormattedDate } from './lib/time'
import StillCamera from './lib/raspistill'
import presets, { sunsetTimings } from './presets'
import { animationMessageAsyncFactory } from './scenes/timelapse'
import { createClient, DISCORD_ENABLED, sendAnnouncementEmptyStub } from './lib/discord'
import { consoleInjector } from './services'

const { GROUP_CHAT_ID, CHANNEL_CHAT_ID, RANDOM_IMAGE_URL } = process.env

const randomEmulation = 0

export function setupContext(
  bot: Telegraf<PhiloContext>,
  storage: StorageManager,
  streams: StreamContainer,
  context?: PhiloContext
) {
  async function takePhoto(preset: Preset): Promise<InputMediaCameraPhoto> {
    const source = await new StillCamera(preset).takeImage()
    const media = { source }
    return {
      type: 'photo',
      media,
    }
  }
  const ctx = context || ({ telegram: bot.telegram } as PhiloContext)
  ctx.injector ??= consoleInjector
  ctx.randomEmulation ??= randomEmulation
  ctx.presetName ??= 'base'
  ctx.preset ??= presets.base
  ctx.presets ??= presets
  ctx.sunsetTimings ??= sunsetTimings
  ctx.storage ??= storage
  ctx.streams ??= streams
  ctx.takePhoto = function (preset: Preset) {
    if (this.randomEmulation) {
      return new Promise((resolve) =>
        setTimeout(
          resolve.bind(null, this.randomImage as InputMediaCameraPhoto),
          this.randomEmulation
        )
      )
    }
    console.log('Taking photo with preset: ' + ctx.preset)
    return takePhoto(preset)
  }
  //function (x: string | InputFile, extra?: ExtraReplyMessage) => bot.telegram.sendX(CHANNEL_CHAT_ID as string, message, extra)
  ctx.sendGroupMessage = bot.telegram.sendMessage.bind(bot.telegram, GROUP_CHAT_ID as string)
  ctx.sendGroupPhoto = bot.telegram.sendPhoto.bind(bot.telegram, GROUP_CHAT_ID as string)
  ctx.sendGroupAnimation = animationMessageAsyncFactory(
    ctx,
    bot.telegram.sendAnimation.bind(bot.telegram, GROUP_CHAT_ID as string)
  )
  ctx.sendChannelMessage = bot.telegram.sendMessage.bind(bot.telegram, CHANNEL_CHAT_ID as string)
  ctx.sendChannelPhoto = bot.telegram.sendPhoto.bind(bot.telegram, CHANNEL_CHAT_ID as string)
  ctx.sendChannelAnimation = animationMessageAsyncFactory(
    ctx,
    bot.telegram.sendAnimation.bind(bot.telegram, CHANNEL_CHAT_ID as string)
  )
  ctx.sendChannelMessageCopy = function (extra) {
    return this.copyMessage(CHANNEL_CHAT_ID as string, extra)
  }
  if (!DISCORD_ENABLED) {
    console.log('- Discord connection is disabled')
    ctx.sendDiscordAnimation = sendAnnouncementEmptyStub
  } else {
    const dClient = createClient()
    ctx.sendDiscordAnimation = dClient.sendAnimationAnnouncement
  }
  Object.defineProperties(ctx, {
    spinnerAnimation: {
      get() {
        return {
          media: {
            source: ctx.storage.readStream('../assets/cool-loading-animated-gif-3.gif'),
          },
          type: 'animation',
        }
      },
    },
    randomImage: {
      get() {
        return {
          media: {
            url: RANDOM_IMAGE_URL || 'https://picsum.photos/600/400/?random',
          },
          type: 'photo',
        }
      },
    },
    now: {
      get() {
        return getFormattedDate()
      },
    },
  })
  return ctx
}
