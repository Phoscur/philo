import PhiloContext, {
  AnimationMessageConstructor,
  Preset,
  TimelapseContext,
  Message,
} from './PhiloContext.interface'
import { getNextSunset, Sunset } from './lib/sunset'
import { timelapse } from './scenes/timelapse'
import { ExtraReplyMessage } from 'telegraf/typings/telegram-types'

export function timelapseCronContextFactory(
  ctx: PhiloContext,
  sendAnimation: AnimationMessageConstructor
): TimelapseContext {
  // TimelapseContext is related/similar to PhiloContext TODO properly declare inheritance
  const t = Object.create(ctx)
  t.animationMessageFactory = sendAnimation
  t.spinnerAnimationMessageFactory = sendAnimation.bind(null, ctx.spinnerAnimation.media)
  return t
}

const SUNDOWN_DELAY_MS = 15000
const SUNDOWN_REPEAT_DELAY_MS = 20 * 60 * 60 * 1000 // 20h (< 24h)

export function dailySunsetCronFactory(
  ctx: PhiloContext,
  sendText: (
    message: string,
    extra?: ExtraReplyMessage | undefined
  ) => Promise<Message.TextMessage>,
  sendAnimation: AnimationMessageConstructor
) {
  const sundownTimer = async () => {
    try {
      const timing = -60000 * 60 * 0.8 // hours before
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
      await timelapse(timelapseCronContextFactory(ctx, sendAnimation), preset, diff + Date.now())
    } catch (error) {
      console.error(`Failed timelapse: ${error}`)
    }
    // TODO storage check
    setTimeout(sundownTimer, SUNDOWN_DELAY_MS + SUNDOWN_REPEAT_DELAY_MS)
  }
  setTimeout(() => {
    sendText(`Started daily sunset timer...`)
    sundownTimer()
  }, SUNDOWN_DELAY_MS)
}
