import { PhiloContext } from './context.js';
import { SunMoonTime, Preset, Hardware, Director } from './services/index.js';

const MESSAGE_DELAY = 1000;
const RESCHEDULE_DELAY_MS = 15000;
const RESCHEDULE_REPEAT_DELAY_MS = 60000 * 60 * 14; // 14h (< 24h)
const GOLDEN_HOUR_TIMING_MS = -60000 * 60 * 1.2; // 1.2 hours before
//const SUNDOWN_DURATION_MIN = 60 * 1.8; // ~1.8 hours total
const minutelyCount = 5;
const count = minutelyCount * 110;
const intervalMS = 12000; // 12s

export function dailySunsetCronFactory(ctx: PhiloContext) {
  const sundownTimer = async () => {
    const hd = ctx.di.get(Hardware);
    const preset = ctx.di.get(Preset);
    const sunMoon = ctx.di.get(SunMoonTime);
    const director = ctx.di.get(Director);
    try {
      let diff = sunMoon.getSunsetDiff() + GOLDEN_HOUR_TIMING_MS;
      if (!diff || diff < 0) {
        console.log('Too late for a timelapse today, scheduling for tomorrow instead!');
        diff = sunMoon.getSunsetDiff(sunMoon.tomorrow) + GOLDEN_HOUR_TIMING_MS;
      }
      await sunMoon.sleep(diff - MESSAGE_DELAY);

      preset.setupSunset();
      ctx.group.sendMessage(`Sunset is soon... Starting daily timelapse!\n${await hd.getStatus()}`);
      await sunMoon.sleep(MESSAGE_DELAY);
      await director.timelapse('sunset', { count, intervalMS });
    } catch (error) {
      console.error(`Failed timelapse: ${error}`);
      console.log('Error:', error);
    }
    setTimeout(sundownTimer, RESCHEDULE_DELAY_MS + RESCHEDULE_REPEAT_DELAY_MS);
  };
  setTimeout(sundownTimer, RESCHEDULE_DELAY_MS);
}
