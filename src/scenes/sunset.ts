import { Markup } from 'telegraf'
import { getNextSunset, Sunset } from '../lib/sunset'
import type TasksContainer from '../lib/tasks'
import type PhiloContext from '../PhiloContext.interface'
import type { PhiloScene } from '../PhiloContext.interface'

export default function enhancePhotoScene(
  photoScene: PhiloScene,
  running: TasksContainer
) {
  photoScene.action('sunsetTimelapse', async (ctx: PhiloContext) => {
    const size = 10
    const timings = ctx.sunsetTimings
    let sunset: Sunset = await getNextSunset()
    let diff = sunset.diff + timings[0] > 0 ? sunset.diff : -1
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
    const status = await ctx.replyWithAnimation(ctx.storage.spinner.media, {
      caption: `Taking shots at ${sunset.hoursFormatted} ...`,
      ...markup,
    })
    const taskId = `${status.chat.id}:${status.message_id}`

    let wait = diff
    // break off execution flow (to answer other commands while waiting)
    setImmediate(async () => {
      await running.createWaitTask(taskId, diff)


      const [message] = messages
      if (message) {
        // the first images gets the album caption
        await ctx.telegram.editMessageCaption(
          message.chat.id,
          message.message_id,
          undefined,
          sunset.fullFormatted
        )
      }
      await ctx.telegram.deleteMessage(status.chat.id, status.message_id)
    })
  })
}
