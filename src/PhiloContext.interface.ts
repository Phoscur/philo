import type { Context, Scenes, Telegraf } from 'telegraf'
import type {
  InputFile,
  InputMediaAnimation,
  InputMediaPhoto,
  Message,
  MessageId,
} from 'telegraf/typings/core/types/typegram'
import { ExtraCopyMessage, ExtraReplyMessage } from 'telegraf/typings/telegram-types'
import type { Storage } from './lib/storage'
import type { FormattedDate } from './lib/time'
import type { Preset } from './presets'

export type { Storage } from './lib/storage'
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
  takePhoto: (preset: Preset) => Promise<InputMediaCameraPhoto>
  sendChannelMessage: (message: string, extra?: ExtraReplyMessage) => Promise<Message.TextMessage>
  sendChannelPhoto: (
    photo: string | InputFile,
    extra?: ExtraReplyMessage
  ) => Promise<Message.PhotoMessage>
  sendChannelAnimation: (
    animation: string | InputFile,
    extra?: ExtraReplyMessage
  ) => Promise<Message.AnimationMessage>
  sendChannelMessageCopy: (extra?: ExtraCopyMessage) => Promise<MessageId>
  randomImage: InputMediaPhoto
  spinnerAnimation: InputMediaAnimation
  now: FormattedDate
  // declare scene type
  scene: Scenes.SceneContextScene<PhiloContext>
}

export interface PhiloBot extends Telegraf<PhiloContext> {}
export interface PhiloScene extends Scenes.BaseScene<PhiloContext> {}
