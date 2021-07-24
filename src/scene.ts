import { Scenes } from 'telegraf'
import type PhiloContext from './PhiloContext.interface'

const ttl = 240

// Handler factories
const { enter, leave } = Scenes.Stage

const photoScene = new Scenes.BaseScene<PhiloContext>('photo')
photoScene.enter((ctx) => ctx.reply('Hi'))
photoScene.leave((ctx) => ctx.reply('Bye'))
photoScene.hears('hi', enter<PhiloContext>('photo'))
photoScene.command('bye', leave<PhiloContext>())
photoScene.on('message', (ctx) => ctx.replyWithMarkdown('Send `hi` or `bye`'))


const timelapseScene = new Scenes.BaseScene<PhiloContext>('timelapse')
timelapseScene.enter((ctx) => ctx.reply('echo scene'))
timelapseScene.leave((ctx) => ctx.reply('exiting echo scene'))
timelapseScene.command('back', leave<PhiloContext>())
timelapseScene.on('text', (ctx) => ctx.reply(ctx.message.text))
timelapseScene.on('message', (ctx) => ctx.reply('Only text messages please'))

export default new Scenes.Stage<PhiloContext>([photoScene, timelapseScene], {
  ttl,
})