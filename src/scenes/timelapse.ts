import { Markup } from 'telegraf'
import { getNextSunset, Sunset } from '../lib/sunset'
import stitchImages from '../lib/ffmpeg'
import type PhiloContext from '../PhiloContext.interface'
import type {
  TimelapseContext,
  PhiloScene,
  Preset,
  Message,
  AnimationMessage,
  ExtraAnimation,
  InputFile,
  AnimationMessageConstructor,
  Readable,
} from '../PhiloContext.interface'
import { ExtraEditMessageCaption } from 'telegraf/typings/telegram-types'

const MINIMUM_TIMELAPSE_PARTS = 10

function padZero(s: string, length: number): string {
  return s.length >= length ? s : padZero('0' + s, length)
}

export function animationMessageFactory(
  ctx: PhiloContext,
  message: Message.AnimationMessage
): AnimationMessage {
  const m = Object.create(message)
  m.editMedia = ctx.telegram.editMessageMedia.bind(
    ctx.telegram,
    message.chat.id,
    message.message_id,
    undefined
  )
  m.editCaption = async (text: string, extra?: ExtraEditMessageCaption) => {
    try {
      return await ctx.telegram.editMessageCaption(
        message.chat.id,
        message.message_id,
        undefined,
        text,
        extra
      )
    } catch (err) {
      console.error(
        `Cannot edit message caption ${message.message_id} (${message.chat.id}): ${text}`
      )
      console.error(err)
    }
  }
  m.delete = ctx.telegram.deleteMessage.bind(ctx.telegram, message.chat.id, message.message_id)
  return m
}

export function animationMessageAsyncFactory(
  ctx: PhiloContext,
  sendAnimation: (
    animation: string | InputFile,
    extra?: ExtraAnimation
  ) => Promise<Message.AnimationMessage>
): AnimationMessageConstructor {
  return async function sendAnimationMessage(
    animation: string | InputFile,
    extra?: ExtraAnimation
  ): Promise<AnimationMessage> {
    return animationMessageFactory(ctx, await sendAnimation(animation, extra))
  }
}

export function timelapseContextFactory(
  ctx: PhiloContext,
  sendAnimation: (
    animation: string | InputFile,
    extra?: ExtraAnimation
  ) => Promise<Message.AnimationMessage>
): TimelapseContext {
  // TimelapseContext is related/similar to PhiloContext TODO properly declare inheritance
  const t = Object.create(ctx)
  t.animationMessageFactory = animationMessageAsyncFactory(ctx, sendAnimation)
  t.spinnerAnimationMessageFactory = animationMessageAsyncFactory(ctx, sendAnimation).bind(
    null,
    ctx.spinnerAnimation.media
  )
  t.onFinish = async (message: string, file: Readable) => {
    await t.sendDiscordAnimation(message, file)
  }
  return t
}

export async function timelapse(ctx: TimelapseContext, preset: Preset, due = Date.now()) {
  if (ctx.randomEmulation) {
    throw new Error(
      `Sorry! Random Emulation Mode is enabled [${ctx.randomEmulation}ms] - no timelapses`
    )
  }
  const { fileNameFormatted, fullFormatted } = ctx.now

  // remove the message because there is an ongoing task TODO should edit markup instead to because parallel timelapses are not supported
  // await ctx.deleteMessage() - parallel timelapses should be supported now!

  /* TODO album preview
  // TODO const size = 10 max group size
  const images = Array(size).fill(ctx.storage.random)
  const messages = await ctx.replyWithMediaGroup(images)
  // the first images gets the album caption
  const [firstMessage] = messages
  if (firstMessage) {
    await ctx.telegram.editMessageCaption(
      firstMessage.chat.id,
      firstMessage.message_id,
      undefined,
      sunset.dayFormatted
    )
  }*/
  /* delete album preview when cancelled
  for (const m of messages) {
    await ctx.telegram.deleteMessage(m.chat.id, m.message_id)
  }*/

  const count = preset.count || 10 // should always have a count (with duration&minutely set), ten is also the max count of images in an album
  const interval = preset.interval || 333
  const markup = Markup.inlineKeyboard([
    // TODO finish early Markup.button.callback('Finish', 'finishRunning'),
    Markup.button.callback('Cancel', 'cancelRunning'),
  ])
  const status = await ctx.spinnerAnimationMessageFactory({
    caption: `${preset}\nTaking ${count} shots ...`,
    ...markup,
  })
  const taskId = `${status.chat.id}-${status.message_id}` // common format with cancelRunning action
  console.log('Starting timelapse', taskId, count, interval)
  let photosTaken = 0,
    photoErrors = 0
  async function handlePart(part: number) {
    const partPaddedWithZeros = padZero(part.toString(), count.toString().length)
    const name = `${taskId}-${partPaddedWithZeros}.jpg`
    try {
      const image = await ctx.takePhoto(preset)
      console.log('Saving image:', name)
      await ctx.storage.save(name, image.media.source)
      await status.editMedia(image)
      await status.editCaption(`${preset}\nTaking more shots (${count - part}) ...`, markup)
      photosTaken++
    } catch (error) {
      console.error(error)
      await status.editCaption(`Fail (${photoErrors}! ${error}`, markup)
      photoErrors++
    }
  }

  async function handleFinish(parts: number) {
    try {
      if (photosTaken < MINIMUM_TIMELAPSE_PARTS) {
        const message = `Not rendering timelapse only has ${photosTaken}/${MINIMUM_TIMELAPSE_PARTS} parts. Errors: ${photoErrors}`
        console.log(message)
        await status.editCaption(message, markup)
        return
      }

      await status.editCaption(`Rendering timelapse consisting ${parts} images ...`, markup)
      const outFile = `${fileNameFormatted}.${taskId}.mp4`
      console.log('Stitching:', ctx.storage.cwd, outFile)
      await stitchImages(taskId, ctx.storage.cwd, { outFile, parts })

      await ctx.storage.add(outFile)
      const caption = `${fullFormatted}`
      await ctx.onFinish(caption, ctx.storage.readStream(outFile)) // TODO? cloning the stream should be more efficient
      await ctx.animationMessageFactory(
        {
          source: ctx.storage.readStream(outFile),
        },
        {
          caption,
          ...Markup.inlineKeyboard([[Markup.button.callback('Share 📢', 'share')]]),
        }
      )
      await status.delete()
    } catch (error) {
      console.error(error)
      await status.editCaption(`Fail (${photoErrors})! ${error}`, markup)
    }
  }
  try {
    await ctx.streams.run()
    /* TODO reuse emitter: const emitter = */
    ctx.streams.createPartEmitter(taskId, handlePart, handleFinish, count, interval, due)
  } catch (error) {
    console.log('Failed timelapse', taskId, error)
    const message = error ? error + '' : 'An error occured'
    await status.editCaption(message, markup)
  }
}

export default function enhancePhotoScene(photoScene: PhiloScene) {
  const timelapseDuration = 60 * 1.4 // 1.4 hours total
  photoScene.action('timelapse', async (ctx) => {
    try {
      const preset: Preset = ctx.preset.lapse({
        duration: timelapseDuration,
        minutely: 5,
      })
      await ctx.answerCbQuery(`Starting Timelapse now!`)
      await timelapse(timelapseContextFactory(ctx, ctx.replyWithAnimation.bind(ctx)), preset)
    } catch (error) {
      await ctx.answerCbQuery(`Failed timelapse: ${error}`)
    }
  })

  photoScene.action('half-timelapse', async (ctx) => {
    try {
      const preset: Preset = ctx.preset.lapse({
        duration: timelapseDuration / 2,
        minutely: 5,
      })
      await ctx.answerCbQuery(`Starting Timelapse now!`)
      await timelapse(timelapseContextFactory(ctx, ctx.replyWithAnimation.bind(ctx)), preset)
    } catch (error) {
      await ctx.answerCbQuery(`Failed timelapse: ${error}`)
    }
  })

  photoScene.action('third-timelapse', async (ctx) => {
    try {
      const preset: Preset = ctx.preset.lapse({
        duration: timelapseDuration / 3,
        minutely: 5,
      })
      await ctx.answerCbQuery(`Starting Timelapse now!`)
      await timelapse(timelapseContextFactory(ctx, ctx.replyWithAnimation.bind(ctx)), preset)
    } catch (error) {
      await ctx.answerCbQuery(`Failed timelapse: ${error}`)
    }
  })

  photoScene.action('short-timelapse', async (ctx) => {
    try {
      const preset: Preset = ctx.preset.lapse({
        duration: 5, // 5 mins
        minutely: 5,
      })
      await ctx.answerCbQuery(`Starting Short Timelapse now!`)
      await timelapse(timelapseContextFactory(ctx, ctx.replyWithAnimation.bind(ctx)), preset)
    } catch (error) {
      await ctx.answerCbQuery(`Failed timelapse: ${error}`)
    }
  })
  photoScene.action('super-short-timelapse', async (ctx) => {
    try {
      const preset: Preset = ctx.preset.lapse({
        duration: 0.5,
        minutely: 30,
      })
      await ctx.answerCbQuery(`Starting Super Short Timelapse now!`)
      await timelapse(timelapseContextFactory(ctx, ctx.replyWithAnimation.bind(ctx)), preset)
    } catch (error) {
      await ctx.answerCbQuery(`Failed timelapse: ${error}`)
    }
  })

  photoScene.action('short-delayed-timelapse', async (ctx) => {
    const delay = 3 * 60 * 1000 // 3 mins
    try {
      const preset: Preset = ctx.preset.lapse({
        duration: 5, // 5 mins
        minutely: 5,
      })
      await ctx.answerCbQuery(`Starting Short Timelapse soon!`)
      await timelapse(timelapseContextFactory(ctx, ctx.replyWithAnimation.bind(ctx)), preset, delay)
    } catch (error) {
      await ctx.answerCbQuery(`Failed timelapse: ${error}`)
    }
  })

  photoScene.action('sunsetTimelapse', async (ctx) => {
    try {
      const timing = -60000 * 60 * 0.75 // hours before
      const preset: Preset = ctx.preset.lapse({
        duration: 60 * 1.4, // 1.4 hours total
        minutely: 5,
      })
      let sunset: Sunset = await getNextSunset()
      let diff = sunset.diff + timing
      if (!diff || diff < 0) {
        //return ctx.answerCbQuery(`Sorry! Sunset was ${sunset.humanizedDiff} ago.`)
        sunset = await getNextSunset(true)
        diff = sunset.diff + timing
      }
      await ctx.answerCbQuery(
        `Sunset is in ${sunset.humanizedDiff}... (wait ${Math.round(diff / 1000)}s)`
      )
      await timelapse(
        timelapseContextFactory(ctx, ctx.replyWithAnimation.bind(ctx)),
        preset,
        diff + Date.now()
      )
    } catch (error) {
      await ctx.answerCbQuery(`Failed timelapse: ${error}`)
    }
  })
}
