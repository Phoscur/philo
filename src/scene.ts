import { Scenes, Markup } from 'telegraf'
import type PhiloContext from './PhiloContext.interface'

// Handler factories
const { enter, leave } = Scenes.Stage

function showPresetSelect(ctx: PhiloContext) {
  const presetNames = Object.keys(ctx.presets).filter(name => name !== ctx.presetName)
  const buttons = presetNames.map((presetName) => Markup.button.callback(`${presetName} 📷`, presetName))
  return {
    message: `Current: ${ctx.presetName} 📷\n${ctx.preset}`, 
    markup: Markup.inlineKeyboard([
      // TODO more button rows
      buttons,
      [Markup.button.callback('Take a Shot 🥃', 'shot')],
    ]),
  }
}

function optionsInlineKeyboard() {
  return Markup.inlineKeyboard([
    Markup.button.callback('Switch Preset 📷', 'preset'),
    Markup.button.callback('Single Shot 🥃', 'shot'),
    Markup.button.callback('Timelapse 🎥', 'timelapse'),
    // Markup.button.callback('Done', 'done'),
  ])
}

function showSelectedOptions(ctx: PhiloContext) {
  ctx.reply(`Selected options: ${ctx.presetName}\n${ctx.preset}`, optionsInlineKeyboard())
}

const photoScene = new Scenes.BaseScene<PhiloContext>('photo')
// TODO transition to timelapse settings scene
photoScene.enter(showSelectedOptions)
photoScene.leave((ctx) => ctx.reply('Bye'))
photoScene.command(['photo', 'options'], showSelectedOptions)
photoScene.action('shot', (ctx) => {
  ctx.answerCbQuery('TODO taking image now...')
  ctx.reply('PICTURE')
})
//photoScene.action('done', leave<PhiloContext>())
photoScene.action('preset', async (ctx) => {
  ctx.answerCbQuery()
  const { message, markup } = showPresetSelect(ctx)
  ctx.reply(message, markup)
})
photoScene.action('timelapse', async (ctx) => {
  await ctx.answerCbQuery('Please check the interval options!')
  await ctx.deleteMessage()
  enter<PhiloContext>('timelapse')(ctx)
})
// handle all presets
photoScene.action(/.+/, async (ctx) => {
  const name = ctx.match[0]
  const preset = ctx.presets[name]
  if (preset) {
    ctx.presetName = name
    ctx.preset = preset
    const { message, markup } = showPresetSelect(ctx)
    ctx.editMessageText(message, markup)
  }
  ctx.answerCbQuery(`Selected ${name} 📷`)
})
photoScene.on('message', (ctx) => ctx.replyWithMarkdown('📷 Command not recognised - try /options'))

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
