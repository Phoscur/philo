import PhiloContext, { Preset } from './PhiloContext.interface'
import { StreamContainer } from './lib/tasks'
import { getNextSunset, Sunset } from './lib/sunset'
import { timelapse } from './scenes/timelapse'

const SUNDOWN_DELAY_MS = 15000
const SUNDOWN_REPEAT_DELAY_MS = 20 * 60 * 60 * 1000 // 20h (< 24h)

export function dailyMiddlewareFactory(streams: StreamContainer) {
  return function dailyMiddleware(ctx: PhiloContext, next: () => {}) {
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
        await timelapse(ctx, streams, preset, diff + Date.now())
      } catch (error) {
        console.error(`Failed timelapse: ${error}`)
      }
      // TODO storage check
      setTimeout(sundownTimer, SUNDOWN_DELAY_MS + SUNDOWN_REPEAT_DELAY_MS)
    }
    setTimeout(() => {
      ctx.sendGroupMessage(`Started daily sunset timer...`)
      sundownTimer()
    }, SUNDOWN_DELAY_MS)
    next()
  }
}
