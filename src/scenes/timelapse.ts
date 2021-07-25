import { Scenes, Markup } from 'telegraf'
import type PhiloContext from '../PhiloContext.interface'
import type { Preset } from '../PhiloContext.interface'

// Handler factories
const { leave } = Scenes.Stage
const timelapseScene = new Scenes.BaseScene<PhiloContext>('timelapse')
// TODO button keyboard for timelapse settings, including preview (modulo)
// TODO stop interval or queue timelapse rendering
timelapseScene.enter((ctx) => ctx.reply('TODO timelapse - echo scene'))
timelapseScene.leave((ctx) => ctx.reply('exiting echo scene'))
timelapseScene.command('done', leave<PhiloContext>())
timelapseScene.on('text', (ctx) => ctx.reply(ctx.message.text))
timelapseScene.on('message', (ctx) => ctx.reply('Only text messages please'))

export default timelapseScene
