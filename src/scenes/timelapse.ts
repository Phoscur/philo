import { Markup } from 'telegraf'
import stitchImages from '../lib/ffmpeg'
import type TasksContainer from '../lib/tasks'
import type { PhiloScene, Preset } from '../PhiloContext.interface'
import { getFormattedDate } from '../lib/time'

export default function enhancePhotoScene(photoScene: PhiloScene, running: TasksContainer) {
  photoScene.action('timelapse', async (ctx) => {
    // TODO const size = 10 max group size
    if (ctx.randomEmulation) {
      return ctx.answerCbQuery(
        `Sorry! Random Emulation Mode is enabled [${ctx.randomEmulation}ms] - no timelapses`
      )
    }
    const preset: Preset = ctx.preset.lapse({
      duration: 60 * 1, // hours total
      minutely: 3,
    })
    const nowFormatted = getFormattedDate().fullFormatted
    await ctx.answerCbQuery(`Starting Timelapse now: ${nowFormatted}`)
    // remove the message because there is an ongoing task TODO should edit markup instead to because parallel timelapses are not supported
    await ctx.deleteMessage()

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
    const count = preset.count || 10 // should always have a count (with duration&minutely set), ten is also the max count of images in an album
    const markup = Markup.inlineKeyboard([Markup.button.callback('Cancel', 'cancelRunning')])
    const status = await ctx.replyWithAnimation(ctx.spinnerAnimation.media, {
      caption: `${preset}\nTaking ${count} shots ...`,
      ...markup,
    })
    const taskId = `${status.chat.id}-${status.message_id}` // common format with cancelRunning action
    let counter = 0
    let wait = 1
    // break off execution flow (to answer other commands while waiting)
    setImmediate(async () => {
      try {
        while (wait > 0 && ++counter < count) {
          await running.createWaitTask(taskId, wait)
          const name = `${taskId}-${counter}.jpg`
          wait = preset.interval || 333
          const image = await ctx.takePhoto(preset)
          console.log('Saving image:', name)
          await ctx.storage.save(name, image.media.source)
          await ctx.telegram.editMessageMedia(status.chat.id, status.message_id, undefined, image)
          await ctx.telegram.editMessageCaption(
            status.chat.id,
            status.message_id,
            undefined,
            `${preset}\nTaking more shots (${count - counter}) ...`,
            markup
          )
        }

        /* TODO need to overwrite this again when setting resetting the message
        if (firstMessage) {
          await ctx.telegram.editMessageCaption(
            firstMessage.chat.id,
            firstMessage.message_id,
            undefined,
            sunset.fullFormatted
          )
        }*/

        await ctx.telegram.editMessageCaption(
          status.chat.id,
          status.message_id,
          undefined,
          `Rendering timelapse consisting ${count} images ...`,
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
        /* delete album preview when cancelled
        for (const m of messages) {
          await ctx.telegram.deleteMessage(m.chat.id, m.message_id)
        }*/
        await ctx.telegram.editMessageCaption(
          status.chat.id,
          status.message_id,
          undefined,
          `Fail! $error`,
          markup
        )
      }
    })
  })
}
