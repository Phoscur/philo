import { Markup } from 'telegraf'
import stitchImages from '../lib/ffmpeg'
import type { StreamContainer } from '../lib/tasks'
import type { PhiloScene, Preset } from '../PhiloContext.interface'

const MINIMUM_TIMELAPSE_PARTS = 10

export default function enhancePhotoScene(photoScene: PhiloScene, running: StreamContainer) {
  // function updateStatusMessage(chatId, messageId, count, image) {}
  photoScene.action('timelapse', async (ctx) => {
    // TODO const size = 10 max group size
    if (ctx.randomEmulation) {
      return ctx.answerCbQuery(
        `Sorry! Random Emulation Mode is enabled [${ctx.randomEmulation}ms] - no timelapses`
      )
    }
    const preset: Preset = ctx.preset.lapse({
      duration: 60 * 1, // 1 hour total
      minutely: 3,
    })
    const nowFormatted = ctx.now.fullFormatted
    await ctx.answerCbQuery(`Starting Timelapse now: ${nowFormatted}`)

    // remove the message because there is an ongoing task TODO should edit markup instead to because parallel timelapses are not supported
    // await ctx.deleteMessage() - parallel timelapses should be supported now!

    /* TODO album preview
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
    const markup = Markup.inlineKeyboard([Markup.button.callback('Cancel', 'cancelRunning')])
    const status = await ctx.replyWithAnimation(ctx.spinnerAnimation.media, {
      caption: `${preset}\nTaking ${count} shots ...`,
      ...markup,
    })
    const taskId = `${status.chat.id}-${status.message_id}` // common format with cancelRunning action
    let photosTaken = 0,
      photoErrors = 0
    async function handlePart(part: number) {
      const name = `${taskId}-${part}.jpg`
      try {
        const image = await ctx.takePhoto(preset)
        console.log('Saving image:', name)
        await ctx.storage.save(name, image.media.source)
        await ctx.telegram.editMessageMedia(status.chat.id, status.message_id, undefined, image)
        await ctx.telegram.editMessageCaption(
          status.chat.id,
          status.message_id,
          undefined,
          `${preset}\nTaking more shots (${count - part}) ...`,
          markup
        )
        photosTaken++
      } catch (error) {
        console.error(error)
        await ctx.telegram.editMessageCaption(
          status.chat.id,
          status.message_id,
          undefined,
          `Fail (${photoErrors}! ${error}`,
          markup
        )
        photoErrors++
      }
    }
    async function handleFinish(parts: number) {
      try {
        if (photosTaken < MINIMUM_TIMELAPSE_PARTS) {
          await ctx.telegram.editMessageCaption(
            status.chat.id,
            status.message_id,
            undefined,
            `Not rendering timelapse only ${photosTaken}/${MINIMUM_TIMELAPSE_PARTS} parts. Errors: ${photoErrors}`,
            markup
          )
          return
        }
        await ctx.telegram.editMessageCaption(
          status.chat.id,
          status.message_id,
          undefined,
          `Rendering timelapse consisting ${parts} images ...`,
          markup
        )
        const outFile = `${nowFormatted} (${taskId}).mp4`
        console.log('Stitching:', ctx.storage.cwd, outFile)
        await stitchImages(taskId, ctx.storage.cwd, { outFile })

        await ctx.replyWithAnimation(
          {
            source: ctx.storage.readStream(outFile),
          },
          {
            caption: `${nowFormatted}`,
            ...Markup.inlineKeyboard([[Markup.button.callback('Share 📢', 'share')]]),
          }
        )
        await ctx.telegram.deleteMessage(status.chat.id, status.message_id)
      } catch (error) {
        console.error(error)
        await ctx.telegram.editMessageCaption(
          status.chat.id,
          status.message_id,
          undefined,
          `Fail (${photoErrors})! ${error}`,
          markup
        )
      }
    }
    const due = Date.now()
    await running.run()
    /* TODO reuse emitter: const emitter = */
    running.createPartEmitter(taskId, handlePart, handleFinish, count, interval, due)
  })
}
