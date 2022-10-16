import PhiloContext, {
  AnimationMessageConstructor,
  Preset,
  Message,
} from './PhiloContext.interface'
import { getNextSunset, Sunset } from './lib/sunset'
import { timelapse, timelapseContextFactory } from './scenes/timelapse'
import { ExtraReplyMessage } from 'telegraf/typings/telegram-types'
import senseTemperature from './lib/temperature'

const MESSAGE_DELAY = 1000
const SUNDOWN_DELAY_MS = 15000
const SUNDOWN_REPEAT_DELAY_MS = 60000 * 60 * 14 // 14h (< 24h)
const SUNDOWN_TIMING_MS = -60000 * 60 * 1.3 // 1.3 hours before
const SUNDOWN_DURATION_MIN = 60 * 1.8 // ~1.8 hours total
const SUNDOWN_MINUTELY_IMAGE_COUNT = 5
const SUNDOWN_SENSE_TEMPERATURE = true

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

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
      const preset: Preset = ctx.preset.lapse({
        duration: SUNDOWN_DURATION_MIN,
        minutely: SUNDOWN_MINUTELY_IMAGE_COUNT,
      })
      let sunset: Sunset = await getNextSunset()
      let diff = sunset.diff + SUNDOWN_TIMING_MS
      if (!diff || diff < 0) {
        console.log('Too late for a timelapse today, scheduling for tomorrow instead!')
        sunset = await getNextSunset(true)
        diff = sunset.diff + SUNDOWN_TIMING_MS
      }
      await sleep(diff - MESSAGE_DELAY)
      let temperatureMessage = ''
      if (SUNDOWN_SENSE_TEMPERATURE) {
        try {
          const { temperature, humidity } = await senseTemperature()
          temperatureMessage = `Current temperature: ${temperature}°C, humidity: ${humidity}%`
        } catch (err) {
          console.error('Failed to read temperature', err)
        }
      }

      sendText(
        `Sunset is in ${sunset.humanizedDiff}...
Starting daily timelapse!
${temperatureMessage}`
        //Current storage: ` + (await ctx.storage.status())
      )
      await timelapse(
        timelapseContextFactory(ctx, sendAnimation),
        preset,
        Date.now() + MESSAGE_DELAY
      )
    } catch (error) {
      console.error(`Failed timelapse: ${error}`)
      console.log('Error:', error)
    }
    setTimeout(sundownTimer, SUNDOWN_DELAY_MS + SUNDOWN_REPEAT_DELAY_MS)
  }
  setTimeout(sundownTimer, SUNDOWN_DELAY_MS)
}
