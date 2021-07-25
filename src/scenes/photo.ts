import { Scenes, Markup } from 'telegraf'
import { InlineKeyboardMarkup, Message } from 'typegram'
import type PhiloContext from '../PhiloContext.interface'
import type { Preset } from '../PhiloContext.interface'
import type { Storage } from '../lib/storage'
import setupStorageCommands from './storage'
import setupTemperatureCommands from './temperature'

const spinnerGif = { url: 'https://loading.io/mod/spinner/spinner/sample.gif' }
const randomImage = { url: 'https://picsum.photos/600/400/?random' }
const randomDelayMS = 500
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
  const presetNames = Object.keys(ctx.presets).filter(
    (name) => name !== ctx.presetName
  )
  const buttons = presetNames.map((presetName) =>
    Markup.button.callback(`${presetName} 📷`, presetName)
  )
  return {
    text: `Current: ${ctx.presetName} 📷\n${ctx.preset}`,
    markup: Markup.inlineKeyboard([
      // TODO? more button rows
      buttons,
      [Markup.button.callback('Take a Shot 🥃', 'shot')],
    ]),
  }
}

async function takePhoto(preset: Preset) {
  if (preset.random) {
    return randomImage
  }
  // TODO use source instead of random url
  await new Promise((res) => setTimeout(res, randomDelayMS))
  return randomImage
}

async function prepareShot(
  ctx: PhiloContext,
  meanwhile?: (m: Message.MediaMessage) => Promise<void>
) {
  const message = await ctx.replyWithAnimation(spinnerGif, {
    caption: 'Taking a shot 🥃...',
  })
  if (meanwhile) {
    await meanwhile(message)
  }
  await ctx.telegram.editMessageMedia(
    message.chat.id,
    message.message_id,
    undefined,
    {
      type: 'photo',
      media: await takePhoto(ctx.preset),
    }
  )
  return message
}

async function setCaption(
  ctx: PhiloContext,
  text: string,
  markup: Markup.Markup<InlineKeyboardMarkup>,
  message: Message.MediaMessage
) {
  await ctx.telegram.editMessageCaption(
    message.chat.id,
    message.message_id,
    undefined,
    text,
    markup
  )
}

async function showSelectedOptions(ctx: PhiloContext) {
  const { text, markup } = renderPhotoMessage(ctx)
  const message = await prepareShot(
    ctx,
    setCaption.bind(null, ctx, text, markup)
  )
  await setCaption(ctx, text, markup, message)
}

export default function createPhotoScene(storage: Storage) {
  const photoScene = new Scenes.BaseScene<PhiloContext>('photo')
  setupStorageCommands(photoScene, storage)
  setupTemperatureCommands(photoScene)
  
  photoScene.enter(showSelectedOptions)
  photoScene.leave((ctx) => ctx.reply('Bye'))
  photoScene.command(['done', 'exit'], leave<PhiloContext>())
  photoScene.action(['done', 'exit'], leave<PhiloContext>())
  
  photoScene.command(['photo', 'options'], showSelectedOptions)
  photoScene.action('shot', async (ctx) => {
    await ctx.answerCbQuery('Taking image now...')
    // const message = 
    await prepareShot(ctx)
    // TODO add share button (repost in CHANNEL_CHAT_ID with different caption)
    /* ctx.telegram.editMessageCaption(
      message.chat.id,
      message.message_id,
      undefined,
      'filename/date todo'
    )*/
  })
  
  photoScene.command('album', async (ctx) => {
    const group = await ctx.replyWithMediaGroup([
      {
        media: { url: 'https://picsum.photos/200/300/?random' },
        caption: 'Piped from URL', // If you'll specify captions for more than one element telegram will show them only when you click on photo preview for each photo separately. - https://stackoverflow.com/questions/58893142/how-to-send-telegram-mediagroup-with-caption-text
        type: 'photo',
      },
      {
        media: { url: 'https://picsum.photos/200/300/?random' },
        type: 'photo',
      },
      {
        media: { url: 'https://picsum.photos/200/300/?random' },
        type: 'photo',
      },
    ])
    for (const message of group) {
      // await new Promise((res) => setTimeout(res, randomDelayMS))
      // we can shrink albums but as the media group is just an array, I could not find out how to grow it
      // await ctx.telegram.deleteMessage(message.chat.id, message.message_id)
      /*await ctx.telegram.editMessageMedia(
        message.chat.id,
        message.message_id,
        undefined,
        {
          media: { url: 'https://picsum.photos/200/300/?random' },
          caption: 'Piped from URL',
          type: 'photo',
        }
      )*/
    }
  })
  
  photoScene.action('timelapse', async (ctx) => {
    await ctx.answerCbQuery('Please check the interval options!')
    await ctx.deleteMessage()
    enter<PhiloContext>('timelapse')(ctx)
  })
  
  // TODO? should image presets have their own scene (because of the all presets handler)?
  photoScene.action('preset', async (ctx) => {
    await ctx.answerCbQuery()
    const { text, markup } = renderPresetSelect(ctx)
  
    await ctx.editMessageCaption(text, markup)
    /* update preview image, flickers in random mode
    await ctx.editMessageMedia({
      type: 'photo',
      media: await takePhoto(ctx.preset),
    })
    // again because changing the media replaces the whole message
    await ctx.editMessageCaption(text, markup)
    */
  })
  // handle all presets
  photoScene.action(/.+/, async (ctx) => {
    const name = ctx.match[0]
    await ctx.answerCbQuery(`Selected ${name} 📷, updating...`)
    const preset = ctx.presets[name]
    if (!preset) {
      return
    }
    ctx.presetName = name
    ctx.preset = preset
    const { text, markup } = renderPresetSelect(ctx)
    await ctx.editMessageMedia({
      type: 'photo',
      media: await takePhoto(ctx.preset),
    })
    await ctx.editMessageCaption(text, markup)
  })
  photoScene.on('message', (ctx) =>
    ctx.replyWithMarkdown('📷 Command not recognised - try /options')
  )
  return photoScene;
}

