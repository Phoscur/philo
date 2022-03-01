import type { Context, Scenes, Telegraf } from 'telegraf'
import type {
  InputFile,
  InputMediaAnimation,
  InputMediaPhoto,
  Message,
  MessageId,
} from 'telegraf/typings/core/types/typegram'
export { InputFile, InputMediaPhoto, Message } from 'telegraf/typings/core/types/typegram'
import type {
  ExtraCopyMessage,
  ExtraReplyMessage,
  ExtraPhoto,
  ExtraAnimation,
} from 'telegraf/typings/telegram-types'
export { ExtraAnimation } from 'telegraf/typings/telegram-types'
import type { Message as DiscordMessage } from './lib/discord'
import type { Storage, Readable } from './lib/storage'
import type { StreamContainer } from './lib/tasks'
import type { FormattedDate } from './lib/time'
import type { Preset } from './presets'

export type { Storage, Readable } from './lib/storage'
export type { Preset } from './presets'

/**
 * InputFile(ByBuffer) as declared by Typegram
 */
export interface InputFileByBuffer {
  source: Buffer
}

export type InputFileStillPhotoBuffer = InputFile & InputFileByBuffer
export interface InputMediaCameraPhoto extends InputMediaPhoto {
  media: InputFileStillPhotoBuffer
}

export interface AnimationMessage extends Message.AnimationMessage {
  editMedia(animation: InputMediaCameraPhoto | InputMediaAnimation): Promise<void>
  editCaption(caption: string, extra?: ExtraAnimation): Promise<void>
  delete(): Promise<void>
}

export type AnimationMessageConstructor = (
  animation: string | InputFile,
  extra?: ExtraAnimation
) => Promise<AnimationMessage>

type SpinnerAnimationMessageConstructor = (extra?: ExtraAnimation) => Promise<AnimationMessage>

export interface TimelapseContext {
  randomEmulation: number
  now: FormattedDate
  preset: Preset
  storage: Storage
  streams: StreamContainer
  /* const animationMessageFactory = group // the bind is just to make typescript happy, they were bound before
    ? ctx.sendGroupAnimation.bind(ctx)
    : ctx.replyWithAnimation.bind(ctx) */
  animationMessageFactory: AnimationMessageConstructor
  spinnerAnimationMessageFactory: SpinnerAnimationMessageConstructor
  takePhoto: (preset: Preset) => Promise<InputMediaCameraPhoto>
  onFinish: (caption: string, file: Readable) => Promise<void>
}
/**
 * Philo BotContext
 * with presets, reusable media and storage
 */
export default interface PhiloContext extends Context {
  randomEmulation: number
  sunsetTimings: number[]
  presets: { [name: string]: Preset }
  presetName: string
  preset: Preset
  storage: Storage
  streams: StreamContainer
  takePhoto: (preset: Preset) => Promise<InputMediaCameraPhoto>
  sendGroupMessage: (message: string, extra?: ExtraReplyMessage) => Promise<Message.TextMessage>
  sendGroupPhoto: (photo: string | InputFile, extra?: ExtraPhoto) => Promise<Message.PhotoMessage>
  sendGroupAnimation: AnimationMessageConstructor
  sendChannelMessage: (message: string, extra?: ExtraReplyMessage) => Promise<Message.TextMessage>
  sendChannelPhoto: (photo: string | InputFile, extra?: ExtraPhoto) => Promise<Message.PhotoMessage>
  sendChannelAnimation: AnimationMessageConstructor
  sendChannelMessageCopy: (extra?: ExtraCopyMessage) => Promise<MessageId>
  sendDiscordAnimation: (caption: string, file: Readable) => Promise<DiscordMessage | undefined>
  randomImage: InputMediaPhoto
  spinnerAnimation: InputMediaAnimation
  now: FormattedDate
  // declare scene type
  scene: Scenes.SceneContextScene<PhiloContext>
}

export interface PhiloBot extends Telegraf<PhiloContext> {}
export interface PhiloScene extends Scenes.BaseScene<PhiloContext> {}
