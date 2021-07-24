import { Scenes, Markup } from 'telegraf'
import type PhiloContext from './PhiloContext.interface'



// Handler factories
const { enter, leave } = Scenes.Stage

function optionsInlineKeyboard() {
  return Markup.inlineKeyboard([
    Markup.button.callback('Single Shot', 'take'),
    Markup.button.callback('Timelapse', 'timelapse'),
    // Markup.button.callback('Done', 'done'),
  ])
}

// TODO button keyboard for preset configuration
function showSelectedOptions(ctx: PhiloContext) {
  ctx.reply(`Selected options: ${ctx.presetName}\n${ctx.preset}`, optionsInlineKeyboard())
}

const photoScene = new Scenes.BaseScene<PhiloContext>('photo')
// TODO transition to timelapse settings scene
photoScene.enter(showSelectedOptions)
photoScene.leave((ctx) => ctx.reply('Bye'))
photoScene.command('options', showSelectedOptions)
photoScene.action('take', (ctx) => ctx.answerCbQuery('TODO taking image now...'))
//photoScene.action('done', leave<PhiloContext>())
photoScene.action('timelapse', async (ctx) => {
  await ctx.answerCbQuery('Please check the interval options!')
  await ctx.deleteMessage()
  enter<PhiloContext>('timelapse')(ctx)
})
photoScene.on('message', (ctx) => ctx.replyWithMarkdown('Command not recognised - in PhotoScene - try /options'))

const timelapseScene = new Scenes.BaseScene<PhiloContext>('timelapse')
// TODO button keyboard for timelapse settings, including preview (modulo)
// TODO stop interval or queue timelapse rendering
timelapseScene.enter((ctx) => ctx.reply('echo scene'))
timelapseScene.leave((ctx) => ctx.reply('exiting echo scene'))
timelapseScene.command('back', leave<PhiloContext>())
timelapseScene.on('text', (ctx) => ctx.reply(ctx.message.text))
timelapseScene.on('message', (ctx) => ctx.reply('Only text messages please'))

export default new Scenes.Stage<PhiloContext>([photoScene, timelapseScene], {
  default: 'photo'
})
