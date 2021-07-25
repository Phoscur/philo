import { Scenes, Markup } from 'telegraf'
import type PhiloContext from '../PhiloContext.interface'
import type { Preset } from '../PhiloContext.interface'

// Handler factories
const { enter, leave } = Scenes.Stage

function renderPhotoMessage(ctx: PhiloContext) {
  const text = `Selected options: ${ctx.presetName} 📷\n${ctx.preset}`
  const markup = Markup.inlineKeyboard([
    Markup.button.callback('Switch Preset 📷', 'preset'),
    Markup.button.callback('Single Shot 🥃', 'shot'),
    Markup.button.callback('Timelapse 🎥', 'timelapse'),
    // Markup.button.callback('Done', 'done'), TODO? delete preview message?
  ])
  return {
    text,
    markup,
  }
}

function renderPresetSelect(ctx: PhiloContext) {
  const presetNames = Object.keys(ctx.presets).filter(name => name !== ctx.presetName)
  const buttons = presetNames.map((presetName) => Markup.button.callback(`${presetName} 📷`, presetName))
  return {
    text: `Current: ${ctx.presetName} 📷\n${ctx.preset}`, 
    markup: Markup.inlineKeyboard([
      // TODO more button rows
      buttons,
      [Markup.button.callback('Take a Shot 🥃', 'shot')],
    ]),
  }
}

async function takePhoto(preset: Preset) {
  // TODO use source instead of random url 
  return { url: 'https://picsum.photos/400/300/?random' }
}

async function showSelectedOptions(ctx: PhiloContext) {
  const { text, markup } = renderPhotoMessage(ctx)
  const image = await takePhoto(ctx.preset)
  return ctx.replyWithPhoto(image, {
    caption: text,
    ...markup,
  })
}

const photoScene = new Scenes.BaseScene<PhiloContext>('photo')
// TODO transition to timelapse settings scene
photoScene.enter(showSelectedOptions)
photoScene.leave((ctx) => ctx.reply('Bye'))
photoScene.command(['photo', 'options'], showSelectedOptions)
photoScene.action('shot', async (ctx) => {
  ctx.answerCbQuery('TODO taking image now...')
  // const message = await ctx.reply('PICTURE...')
  const message = await ctx.replyWithPhoto(await takePhoto(ctx.preset))
  await new Promise((res) => setTimeout(res, 1000))
  //ctx.telegram.editMessageText(message.chat.id, message.message_id, undefined, 'pic')
  ctx.telegram.editMessageMedia(message.chat.id, message.message_id, undefined, {
    type: 'photo',
    media: await takePhoto(ctx.preset),
  })
  //ctx.reply('AFTER PICTURE')
})
photoScene.action('done', leave<PhiloContext>())
// TODO? should image presets have their own scene (because of the all presets handler)?
photoScene.action('preset', async (ctx) => {
  await ctx.answerCbQuery()
  const { text, markup } = renderPresetSelect(ctx)
  await ctx.editMessageMedia({
    type: 'photo',
    media: await takePhoto(ctx.preset),
  })
  await ctx.editMessageCaption(text, markup)
})
photoScene.action('timelapse', async (ctx) => {
  await ctx.answerCbQuery('Please check the interval options!')
  await ctx.deleteMessage()
  enter<PhiloContext>('timelapse')(ctx)
})
// handle all presets
photoScene.action(/.+/, async (ctx) => {
  const name = ctx.match[0]
  await ctx.answerCbQuery(`Selected ${name} 📷, updating...`)
  const preset = ctx.presets[name]
  if (preset) {
    ctx.presetName = name
    ctx.preset = preset
    const { text, markup } = renderPresetSelect(ctx)
    await ctx.editMessageMedia({
      type: 'photo',
      media: await takePhoto(ctx.preset),
    })
    await ctx.editMessageCaption(text, markup)
  }
})
photoScene.on('message', (ctx) => ctx.replyWithMarkdown('📷 Command not recognised - try /options'))

export default photoScene