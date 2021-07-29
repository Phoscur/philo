import { Markup } from 'telegraf'
import { getNextSunset, Sunset } from '../lib/sunset'
import stitchImages from '../lib/ffmpeg'
import type TasksContainer from '../lib/tasks'
import type PhiloContext from '../PhiloContext.interface'
import type { PhiloScene, Preset } from '../PhiloContext.interface'

export default function enhancePhotoScene(photoScene: PhiloScene, running: TasksContainer) {
  photoScene.action('sunsetTimelapse', async (ctx: PhiloContext) => {
    // TODO const size = 10 max group size
    if (ctx.randomEmulation) {
      return ctx.answerCbQuery(
        `Sorry! Random Emulation Mode is enabled [${ctx.randomEmulation}ms] - no timelapses`
      )
    }
    const timing = -60000 * 60 * 2 // 2h before
    const preset: Preset = Object.create(ctx.preset) // clone preset
    preset.duration = 60 * 3 // 3h
    preset.minutely = 3
    let sunset: Sunset = await getNextSunset()
    let diff = sunset.diff + timing > 0 ? sunset.diff : -1
    if (diff < 0) {
      //return ctx.answerCbQuery(`Sorry! Sunset was ${sunset.humanizedDiff} ago.`)
      sunset = await getNextSunset(true)
      diff = sunset.diff + timing
    }
    await ctx.answerCbQuery(
      `Taking images in ${sunset.humanizedDiff}... (wait ${Math.round(diff / 1000)}s)`
    )
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
    const markup = Markup.inlineKeyboard([Markup.button.callback('Cancel', 'cancelRunning')])
    const status = await ctx.replyWithAnimation(ctx.spinnerAnimation.media, {
      caption: `${preset}\nTaking shots ${sunset.dayFormatted} ...`,
      ...markup,
    })
    const taskId = `${status.chat.id}-${status.message_id}` // common format with cancelRunning action
    const count = preset.count || 10 // should always have a count (with duration&minutely set), ten is also the max count of images in an album
    let counter = 0
    let wait = diff
    // break off execution flow (to answer other commands while waiting)
    setImmediate(async () => {
      try {
        while (wait > 0 && ++counter < count) {
          await running.createWaitTask(taskId, wait)
          const name = `${taskId}-${counter}`
          wait = preset.interval || 333
          const image = await ctx.takePhoto(preset)
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
        const outFile = `${sunset.dayFormatted} (${taskId}).mp4`
        await stitchImages(taskId, { outFile })
        await ctx.telegram.editMessageMedia(
          status.chat.id,
          status.message_id,
          undefined,
          // image.media: InputFile|string? that leads to a typing error if not casted manually
          {
            type: 'animation',
            media: {
              source: ctx.storage.readStream(outFile),
            },
          }
        )
        await ctx.telegram.editMessageCaption(
          status.chat.id,
          status.message_id,
          undefined,
          `${sunset.dayFormatted}`
          // removed markup
        )
      } catch (error) {
        console.error(error)
        /* delete album preview when cancelled
        for (const m of messages) {
          await ctx.telegram.deleteMessage(m.chat.id, m.message_id)
        }*/
      }
    })
  })
}
