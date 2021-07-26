import { Scenes, Markup } from 'telegraf'
import type {
  InputMediaAnimation,
  InputMediaPhoto,
  Message,
  InlineKeyboardMarkup,
} from 'telegraf/typings/core/types/typegram'

import type PhiloContext from '../PhiloContext.interface'
import type { Preset, Task } from '../PhiloContext.interface'
import type { Storage } from '../lib/storage'
import setupStorageCommands from './storage'
import setupTemperatureCommands from './temperature'
import { getNextSunset, Sunset } from '../lib/sunset'

const { LOADING_SPINNER_URL, RANDOM_IMAGE_URL, DATE_FORMAT } = process.env
const dateFormat = DATE_FORMAT || 'DD.MM.YYYY HH:MM'

const spinnerGif: InputMediaAnimation = {
  media: {
    url:
      LOADING_SPINNER_URL ||
      'https://loading.io/mod/spinner/spinner/sample.gif',
  },
  type: 'animation',
}
const randomImage: InputMediaPhoto = {
  media: {
    url: RANDOM_IMAGE_URL || 'https://picsum.photos/600/400/?random',
  },
  type: 'photo',
}
const randomDelayMS = 500
// Handler factories
const { enter, leave } = Scenes.Stage

function renderPhotoMessage(ctx: PhiloContext) {
  const text = `Selected options: ${ctx.presetName} 📷\n${ctx.preset}`
  const markup = Markup.inlineKeyboard([
    [Markup.button.callback('Single Shot 🥃', 'shot')],
    [
      Markup.button.callback('🌇🥃', 'sunsetShot'),
      Markup.button.callback('🌇🥃🥃🥃🥃', 'sunsetShots'),
    ],
    [Markup.button.callback('Switch Preset 📷', 'preset')],
    [Markup.button.callback('Timelapse 🎥', 'timelapse')],
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

async function takePhoto(preset: Preset): Promise<InputMediaPhoto> {
  if (preset.random) {
    return randomImage
  }
  // TODO use source instead of random url
  await new Promise((res) => setTimeout(res, randomDelayMS))
  return randomImage
}

async function prepareShot(
  ctx: PhiloContext,
  preset: Preset,
  meanwhile?: (m: Message.MediaMessage) => Promise<boolean>
) {
  const message = await ctx.replyWithAnimation(spinnerGif.media, {
    caption: 'Taking a shot 🥃...',
  })
  let aborted = false
  if (meanwhile) {
    aborted = await meanwhile(message)
  }
  if (aborted) return message
  await ctx.telegram.editMessageMedia(
    message.chat.id,
    message.message_id,
    undefined,
    await takePhoto(preset)
  )
  return message
}

async function prepareGroupShots(
  ctx: PhiloContext,
  preset: Preset,
  size = 10,
  meanwhile?: (
    m: Message.MediaMessage,
    index: number,
    status: Message.MediaMessage
  ) => Promise<boolean>
) {
  const markup = Markup.inlineKeyboard([
    Markup.button.callback('Cancel', 'cancelRunning'),
  ])
  const images = Array(size).fill(randomImage)
  const messages = await ctx.replyWithMediaGroup(images)
  const status = await ctx.replyWithAnimation(spinnerGif.media, {
    caption: 'Taking shots ... ',
    ...markup,
  })
  if (meanwhile) {
    let caption = status.caption
    let aborted = false
    for (const [index, message] of messages.entries()) {
      caption += '🥃'
      aborted = await meanwhile(message, index, status)

      if (aborted) {
        for (const m of messages) {
          await ctx.telegram.deleteMessage(m.chat.id, m.message_id)
        }
        return []
      }
      console.log(caption)
      await ctx.telegram.editMessageCaption(
        status.chat.id,
        status.message_id,
        undefined,
        caption,
        markup
      )
      await ctx.telegram.editMessageMedia(
        message.chat.id,
        message.message_id,
        undefined,
        await takePhoto(preset)
      )
    }
  }
  await ctx.telegram.deleteMessage(status.chat.id, status.message_id)
  return messages
}

function sunsetTaskHandler(ctx: PhiloContext, running: { [id: string]: Task }, sunset: Sunset) {
  let aborted = false
  return async (
    message: Message.MediaMessage,
    index: number,
    status: Message.MediaMessage
  ) => {
    const wait = sunset.diff + ctx.sunsetTimings[index] * 1000
    await ctx.telegram.editMessageCaption(
      message.chat.id,
      message.message_id,
      undefined,
      `${sunset.date.format(dateFormat)} (waiting ${Math.round(wait / 1000)}s)`
    )
    const taskId = `${status.chat.id}:${status.message_id}`
    try {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(resolve, wait)
        running[taskId] = {
          message,
          abort: async () => {
            clearTimeout(timeout)
            reject('Aborted: ' + taskId)
          },
        }
        console.log(`Sunset Task ${taskId} running`)
      })
    } catch (error) {
      console.error(error)
      aborted = true
    } finally {
      delete running[taskId]
      console.log(`Task ${taskId} is finished`, aborted ? '(was aborted)' : '')
    }
    return aborted
  }
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
  return false
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
  const running: { [id: string]: Task } = {} // (needs sharing beyond the context lifetime of setImmediate)
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
    await prepareShot(ctx, ctx.preset)
    // TODO add share button (repost in CHANNEL_CHAT_ID with different caption)
    /* ctx.telegram.editMessageCaption(
      message.chat.id,
      message.message_id,
      undefined,
      'filename/date todo'
    )*/
  })
  photoScene.action('sunsetShots', async (ctx) => {
    const timings = ctx.sunsetTimings
    const sunset = await getNextSunset()
    const diff = sunset.diff + timings[0] > 0 ? sunset.diff : -1 // TODO take image the next day instead?
    if (diff < 0)
      return ctx.answerCbQuery(`Sorry! Sunset was ${sunset.humanizedDiff} ago.`)
    await ctx.answerCbQuery(
      `Taking image in ${sunset.humanizedDiff}... (${diff}ms)`
    )
    // break off execution flow (to answer other commands while waiting)
    setImmediate(async () => {
      const [message] = await prepareGroupShots(
        ctx,
        ctx.preset,
        timings.length,
        sunsetTaskHandler(ctx, running, sunset)
      )
      if (!message) return
      // the first images gets the album caption
      await ctx.telegram.editMessageCaption(
        message.chat.id,
        message.message_id,
        undefined,
        sunset.date.format(dateFormat)
      )
    })
  })

  photoScene.action('sunsetShot', async (ctx) => {
    const sunset = await getNextSunset()
    const diff = sunset.diff > 0 ? sunset.diff : -1 // TODO take image the next day instead?
    if (diff < 0)
      return ctx.answerCbQuery(`Sorry! Sunset was ${sunset.humanizedDiff} ago.`)
    await ctx.answerCbQuery(
      `Taking image in ${sunset.humanizedDiff}... (${diff}ms)`
    )
    // break off execution flow (to answer other commands while waiting)
    setImmediate(async () => {
      const markup = Markup.inlineKeyboard([
        Markup.button.callback('Cancel', 'cancelRunning'),
      ])
      let aborted = false
      const message = await prepareShot(ctx, ctx.preset, async (message) => {
        await ctx.telegram.editMessageCaption(
          message.chat.id,
          message.message_id,
          undefined,
          `${sunset.date.format(dateFormat)} (waiting ${diff}ms)`,
          markup
        )
        const taskId = `${message.chat.id}:${message.message_id}`
        try {
          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(resolve, diff)
            running[taskId] = {
              message,
              abort: async () => {
                clearTimeout(timeout)
                reject('Aborted: ' + taskId)
              },
            }
          })
        } catch (error) {
          console.error(error)
          aborted = true
        } finally {
          delete running[taskId]
        }
        return aborted
      })
      if (aborted) return aborted

      /*await ctx.telegram.editMessageCaption(
        message.chat.id,
        message.message_id,
        undefined,
        sunset.date.format(dateFormat)
      )*/
      return false
    })
  })
  photoScene.action('cancelRunning', async (ctx) => {
    const { message } = ctx.callbackQuery
    const id = `${message?.chat.id}:${message?.message_id}`
    const task: Task = running[id]
    if (!task) {
      return ctx.answerCbQuery(`Error Message ID[${id}] not found!`)
    }
    await ctx.answerCbQuery(`Cancelled!`)
    await task.abort()
    await ctx.deleteMessage()
  })

  photoScene.action('timelapse', async (ctx) => {
    await ctx.answerCbQuery('Please check the interval options!')
    // TODO extract to time
    // await ctx.deleteMessage()
    // enter<PhiloContext>('timelapse')(ctx)
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
    await ctx.editMessageMedia(await takePhoto(ctx.preset))
    await ctx.editMessageCaption(text, markup)
  })

  photoScene.hears(/\/random ?(\d+)?/, async (ctx) => {
    const telegramMediaGroupLimit = 10
    const images: InputMediaPhoto[] = Array(
      parseInt(ctx.match[1]) || telegramMediaGroupLimit
    ).fill(randomImage)
    // const group =
    await ctx.replyWithMediaGroup(images) /*[
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
    /*for (const message of group) {
      // await new Promise((res) => setTimeout(res, randomDelayMS))
      // we can shrink albums but as the media group is just an array, I could not find out how to grow it
      // await ctx.telegram.deleteMessage(message.chat.id, message.message_id)
      await ctx.telegram.editMessageMedia(
        message.chat.id,
        message.message_id,
        undefined,
        {
          media: { url: 'https://picsum.photos/200/300/?random' },
          caption: 'Piped from URL',
          type: 'photo',
        }
      )
    }*/
  })

  photoScene.on('message', (ctx) =>
    ctx.replyWithMarkdown('📷 Command not recognised - try /options')
  )

  return photoScene
}
