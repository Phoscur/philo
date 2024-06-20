import { readTemperatureSensor } from './lib/temperature.js';
import { getStorageStatus } from './lib/df.js';
import { PhiloContext } from './context.js';
import { SunMoonTime } from './services/SunMoonTime.js';
import { Timelapse } from './services/Timelapse.js';

const SUNDOWN_SENSE_TEMPERATURE = true;
const MESSAGE_DELAY = 1000;
const RESCHEDULE_DELAY_MS = 15000;
const RESCHEDULE_REPEAT_DELAY_MS = 60000 * 60 * 14; // 14h (< 24h)
const GOLDEN_HOUR_TIMING_MS = -60000 * 60 * 1.2; // 1.2 hours before
//const SUNDOWN_DURATION_MIN = 60 * 1.8; // ~1.8 hours total
const minutelyCount = 5;
const count = minutelyCount * 110;
const interval = 12000; // 12s

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function dailySunsetCronFactory(ctx: PhiloContext) {
  const sundownTimer = async () => {
    const sunMoon = ctx.di.get(SunMoonTime);
    try {
      let diff = sunMoon.getSunsetDiff() + GOLDEN_HOUR_TIMING_MS;
      if (!diff || diff < 0) {
        console.log('Too late for a timelapse today, scheduling for tomorrow instead!');
        diff = sunMoon.getSunsetDiff(sunMoon.tomorrow) + GOLDEN_HOUR_TIMING_MS;
      }
      await sleep(diff - MESSAGE_DELAY);
      let temperatureMessage = '';
      if (SUNDOWN_SENSE_TEMPERATURE) {
        try {
          const { temperature, humidity } = await readTemperatureSensor();
          temperatureMessage = `Current temperature: ${temperature}°C, humidity: ${humidity}%`;
        } catch (err) {
          console.error('Failed to read temperature', err);
        }
      }
      const status = await getStorageStatus();
      const storageMessage = `Storage (${status.size}): ${status.percent}`;

      ctx.group.sendMessage(
        `Sunset is soon... Starting daily timelapse!
${temperatureMessage}
${storageMessage}`
      );
      await sleep(MESSAGE_DELAY);
      const service = ctx.di.get(Timelapse);
      await service.shoot(count, interval);
    } catch (error) {
      console.error(`Failed timelapse: ${error}`);
      console.log('Error:', error);
    }
    setTimeout(sundownTimer, RESCHEDULE_DELAY_MS + RESCHEDULE_REPEAT_DELAY_MS);
  };
  setTimeout(sundownTimer, RESCHEDULE_DELAY_MS);
}
