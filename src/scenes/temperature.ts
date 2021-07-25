import type { PhiloBot, PhiloScene } from '../PhiloContext.interface'

import senseTemperature from '../lib/temperature'

export default function setupTemperatureCommands(bot: PhiloBot | PhiloScene) {
  bot.command(['temperature', 't', 'temperatur', 'humidity'], async (ctx) => {
    try {
      const { temperature, humidity } = await senseTemperature()
      ctx.reply(`Current temperature: ${temperature}°C, humidity: ${humidity}%`)
    } catch (error) {
      ctx.reply(`Sorry failed to read the sensor: ${error}`)
    }
  })
}
