import { Markup } from 'telegraf'
import { getNextSunset, Sunset } from '../lib/sunset'
import type TasksContainer from '../lib/tasks'
import type PhiloContext from '../PhiloContext.interface'
import type { PhiloScene, Preset } from '../PhiloContext.interface'

export default function enhancePhotoScene(
  photoScene: PhiloScene,
  running: TasksContainer
) {
  photoScene.action('sunsetTimelapse', async (ctx: PhiloContext) => {
    const size = 10
    const timing = -60000 * 10
    const preset: Preset = Object.create(ctx.preset) // clone preset
    preset.duration = 60 * 3
    preset.minutely = 3
    let sunset: Sunset = await getNextSunset()
    let diff = sunset.diff + timing > 0 ? sunset.diff : -1
    if (diff < 0) {
      //return ctx.answerCbQuery(`Sorry! Sunset was ${sunset.humanizedDiff} ago.`)
      sunset = await getNextSunset(true)
      diff = sunset.diff
    }
    await ctx.answerCbQuery(
      `Taking image in ${sunset.humanizedDiff}... (wait ${Math.round(
        diff / 1000
      )}s)`
    )
    const markup = Markup.inlineKeyboard([
      Markup.button.callback('Cancel', 'cancelRunning'),
    ])
    const images = Array(size).fill(ctx.storage.random)
    const messages = await ctx.replyWithMediaGroup(images)
    // the first images gets the album caption
    const [firstMessage] = messages
    const status = await ctx.replyWithAnimation(ctx.storage.spinner.media, {
      caption: `${preset}\nTaking shots ${sunset.dayFormatted} ...`,
      ...markup,
    })
    if (firstMessage) {
      await ctx.telegram.editMessageCaption(
        firstMessage.chat.id,
        firstMessage.message_id,
        undefined,
        sunset.dayFormatted
      )
    }
    const taskId = `${status.chat.id}:${status.message_id}`
    let counter = preset.count || 10
    let wait = diff
    // break off execution flow (to answer other commands while waiting)
    setImmediate(async () => {
      try {
        while (wait > 0) {
          await running.createWaitTask(taskId, wait)
          if (--counter > 0) {
            wait = preset.interval || 333
          }
          console.log('TODO take image')
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
      } catch (error) {
        console.error(error)
        for (const m of messages) {
          await ctx.telegram.deleteMessage(m.chat.id, m.message_id)
        }
      }
    })
  })
}
