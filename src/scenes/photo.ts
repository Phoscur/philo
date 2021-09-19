import { Scenes, Markup } from 'telegraf'
import type {
  InputMediaPhoto,
  Message,
  InlineKeyboardMarkup,
} from 'telegraf/typings/core/types/typegram'

import type PhiloContext from '../PhiloContext.interface'
import type { Preset } from '../PhiloContext.interface'
import type { Storage } from '../lib/storage'
import setupStorageCommands from './storage'
import setupTemperatureCommands from './temperature'
import setupSunsetTimelapse from './sunset'
import setupTimelapse from './timelapse'
import { getNextSunset, Sunset } from '../lib/sunset'
import fancyCount from '../lib/fancyCount'
import { TasksContainer, StreamContainer } from '../lib/tasks'

const ADMINS = ['Phoscur']

// Handler factories
const { enter, leave } = Scenes.Stage

function renderPhotoMessage(ctx: PhiloContext) {
  const text = `Selected options: ${ctx.presetName} 📷\n${ctx.preset}`
  const markup = Markup.inlineKeyboard([
    [Markup.button.callback('Single Shot 🥃', 'shot')],
    [
      Markup.button.callback('Sunset Shot 🌇🥃', 'sunsetShot'),
      Markup.button.callback('🌇🥃🥃🥃🥃', 'sunsetShots'),
    ],
    [
      Markup.button.callback('Timelapse 🎥🌇', 'sunsetTimelapse'),
      Markup.button.callback('🎥 now', 'timelapse'),
    ],
    [Markup.button.callback('Switch Preset 📷', 'preset')],
    // Markup.button.callback('Done', 'done'), TODO? delete preview message?
  ])
  return {
    text,
    markup,
  }
}

function renderPresetSelect(ctx: PhiloContext) {
  const presetNames = Object.keys(ctx.presets).filter((name) => name !== ctx.presetName)
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
export default function createPhotoScene(storage: Storage) {
  const running = new TasksContainer() // (needs sharing beyond the context lifetime of setImmediate)
  const photoScene = new Scenes.BaseScene<PhiloContext>('photo')
  setupStorageCommands(photoScene, storage)
  setupTemperatureCommands(photoScene)
  const streams: StreamContainer = new StreamContainer(running)
  setupSunsetTimelapse(photoScene, running) // TODO use streams
  setupTimelapse(photoScene, streams)

  async function prepareShot(
    ctx: PhiloContext,
    preset: Preset,
    meanwhile?: (m: Message.MediaMessage) => Promise<boolean>
  ) {
    const message = await ctx.replyWithAnimation(ctx.spinnerAnimation.media, {
      caption: 'Taking a shot 🥃...',
    })
    let aborted = false
    if (meanwhile) {
      aborted = await meanwhile(message)
    }
    if (aborted) return message
    const taskId = `${message.message_id}`
    await streams.run()
    await new Promise<void>((resolve) => {
      streams.createPartEmitter(taskId, async () => {
        const image = await ctx.takePhoto(preset)
        await ctx.telegram.editMessageMedia(message.chat.id, message.message_id, undefined, image)
        resolve()
      })
    })
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
    const markup = Markup.inlineKeyboard([Markup.button.callback('Cancel', 'cancelRunning')])
    const images = Array(size).fill(ctx.randomImage)
    const messages = await ctx.replyWithMediaGroup(images)
    const status = await ctx.replyWithAnimation(ctx.spinnerAnimation.media, {
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
        const image = await ctx.takePhoto(preset)
        await ctx.telegram.editMessageMedia(message.chat.id, message.message_id, undefined, image)
      }
    }
    await ctx.telegram.deleteMessage(status.chat.id, status.message_id)
    return messages
  }

  function sunsetTaskHandler(ctx: PhiloContext, running: TasksContainer, sunset: Sunset) {
    let aborted = false
    return async (message: Message.MediaMessage, index: number, status: Message.MediaMessage) => {
      const wait = sunset.diff + ctx.sunsetTimings[index] * 1000
      await ctx.telegram.editMessageCaption(
        message.chat.id,
        message.message_id,
        undefined,
        `${sunset.fullFormatted} (waiting ${Math.round(wait / 1000)}s)`
      )
      const taskId = `${status.chat.id}-${status.message_id}`
      try {
        await running.createWaitTask(taskId, wait)
      } catch (error) {
        console.error(error)
        aborted = true
      }
      return aborted
    }
  }

  async function showSelectedOptions(ctx: PhiloContext) {
    const { text, markup } = renderPhotoMessage(ctx)
    const message = await prepareShot(ctx, ctx.preset, setCaption.bind(null, ctx, text, markup))
    await setCaption(ctx, text, markup, message)
  }

  // ---------------------------------------------------------------------------------------------------
  // entering with /photo
  // ---------------------------------------------------------------------------------------------------
  photoScene.enter(showSelectedOptions)
  photoScene.leave((ctx) => ctx.reply('Bye'))
  photoScene.command(['done', 'exit'], leave<PhiloContext>())
  photoScene.action(['done', 'exit'], leave<PhiloContext>())

  photoScene.command(['photo', 'options'], showSelectedOptions)
  photoScene.action('shot', async (ctx) => {
    await ctx.answerCbQuery('Taking image now...')
    const message = await prepareShot(ctx, ctx.preset)
    // add share button (repost in CHANNEL_CHAT_ID with different caption)
    const markup = Markup.inlineKeyboard([[Markup.button.callback('Share 📢', 'share')]])
    ctx.telegram.editMessageCaption(
      message.chat.id,
      message.message_id,
      undefined,
      ctx.now.fullFormatted,
      markup
    )
  })

  const emojiButtons = [
    Markup.button.callback('❤️', 'like-❤️'),
    Markup.button.callback('💙', 'like-💙'),
    Markup.button.callback('💚', 'like-💚'),
    Markup.button.callback('💜', 'like-💜'),
    Markup.button.callback('💖', 'like-💖'),
    Markup.button.callback('💗', 'like-💗'),
    Markup.button.callback('🤍', 'like-🤍'),
    Markup.button.callback('🖤', 'like-🖤'), // 8 is max in a row
  ]

  photoScene.action('share', async (ctx, next) => {
    const { message } = ctx.callbackQuery
    await ctx.answerCbQuery('Sharing to channel!')
    console.log('Message', ctx.callbackQuery)
    if (!message) return next()
    if ('text' in message) return next()
    //if (!('photo' in message)) return next()
    //if ('video' in message) return next()
    console.log(
      'Message Photo',
      (message as Message.PhotoMessage).photo,
      (message as Message.AnimationMessage).animation
    )
    const markup = Markup.inlineKeyboard([emojiButtons])
    await ctx.sendChannelMessageCopy(markup)
    await ctx.deleteMessage()
    //if (!('video' in ctx.message)) return next()
    //if (ctx.message.video) {}
  })
  photoScene.action(/like-.+/, async (ctx, next) => {
    const match = ctx.match[0]?.split('-')
    const emoji = match[1] || '💖'
    console.log('Match', ctx.match, match)
    const { message } = ctx.callbackQuery
    if (!message) return next()
    if ('text' in message) return next()
    if (!('photo' in message || 'animation' in message || 'video' in message)) return next()
    try {
      const markup = Markup.inlineKeyboard([emojiButtons])
      const caption = message.caption + emoji
      const emojis = fancyCount(caption)
      await ctx.editMessageCaption(emojis.count < 13 ? caption : emojis.unfancy + ' ❤️‍🔥', markup)
      await ctx.answerCbQuery('💖')
    } catch (error) {
      console.error(error)
      await ctx.answerCbQuery('Failed :(')
    }
    // removes discussion await ctx.editMessageCaption ReplyMarkup({      inline_keyboard: [emojiButtons],    })
  })

  photoScene.action('sunsetShots', async (ctx) => {
    const timings = ctx.sunsetTimings
    let sunset = await getNextSunset()
    let diff = sunset.diff + timings[0] > 0 ? sunset.diff : -1
    if (diff < 0) {
      //return ctx.answerCbQuery(`Sorry! Sunset was ${sunset.humanizedDiff} ago.`)
      sunset = await getNextSunset(true)
      diff = sunset.diff
    }

    await ctx.answerCbQuery(`Taking image in ${sunset.humanizedDiff} ...`)
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
        sunset.fullFormatted
      )
    })
  })

  photoScene.action('sunsetShot', async (ctx) => {
    let sunset = await getNextSunset()
    let diff = sunset.diff > 0 ? sunset.diff : -1
    if (diff < 0) {
      //return ctx.answerCbQuery(`Sorry! Sunset was ${sunset.humanizedDiff} ago.`)
      sunset = await getNextSunset(true)
      diff = sunset.diff
    }
    await ctx.answerCbQuery(`Taking image in ${sunset.humanizedDiff} ...`)
    // break off execution flow (to answer other commands while waiting)
    setImmediate(async () => {
      const markup = Markup.inlineKeyboard([Markup.button.callback('Cancel', 'cancelRunning')])
      let aborted = false
      const message = await prepareShot(ctx, ctx.preset, async (message) => {
        await ctx.telegram.editMessageCaption(
          message.chat.id,
          message.message_id,
          undefined,
          `${sunset.fullFormatted} (waiting ${sunset.humanizedDiff})`,
          markup
        )
        const taskId = `${message.chat.id}-${message.message_id}`
        try {
          await running.createWaitTask(taskId, diff)
        } catch (error) {
          console.error(error)
          aborted = true
        }
        return aborted
      })
      if (aborted) return aborted

      await ctx.telegram.editMessageCaption(
        message.chat.id,
        message.message_id,
        undefined,
        sunset.fullFormatted
      )
      return false
    })
  })
  photoScene.action('cancelRunning', async (ctx) => {
    try {
      const { message } = ctx.callbackQuery
      const id = `${message?.chat.id}-${message?.message_id}`
      if (!running.ongoing(id)) {
        await ctx.answerCbQuery(`Warning - Task ID[${id}] not found! Nothing to cancel.`)
        await ctx.deleteMessage()
        return
      }
      const user = ctx.from?.username || ''
      // TODO use list from channel, doesn't work in private channel though! await ctx.getChatAdministrators(),
      console.log('Admin Check', ADMINS, ctx.from)
      if (!~ADMINS.indexOf(user)) {
        return ctx.answerCbQuery(`Only Admins can cancel`)
      }
      await ctx.answerCbQuery(`Cancelled!`)
      await running.cancel(id)
      await ctx.deleteMessage()
    } catch (error) {
      console.error('Failed to cancel', error)
    }
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
  photoScene.action(/.+/, async (ctx, next) => {
    const name = ctx.match[0]
    await ctx.answerCbQuery(`Selected ${name} 📷, updating...`)
    const preset = ctx.presets[name]
    if (!preset) {
      return next()
    }
    ctx.presetName = name
    ctx.preset = preset
    const { text, markup } = renderPhotoMessage(ctx)
    const image = preset.random ? ctx.randomImage : await ctx.takePhoto(preset)
    await ctx.editMessageMedia(image)
    await ctx.editMessageCaption(text, markup)
  })
  photoScene.hears(/\/randomEmulation ?(\d+)?/, async (ctx) => {
    const arg = parseInt(ctx.match[1])
    const delay = arg === 0 ? 0 : arg || 300
    const message =
      ctx.randomEmulation !== delay
        ? `${ctx.randomEmulation} -> ${delay}ms delay`
        : `${delay}ms delay`
    ctx.reply(
      !delay ? `Random Emulation Mode disabled` : `Random Emulation Mode enabled (${message})`
    )
    ctx.randomEmulation = delay
  })

  photoScene.hears(/\/random ?(\d+)?/, async (ctx) => {
    const telegramMediaGroupLimit = 10
    const images: InputMediaPhoto[] = Array(parseInt(ctx.match[1]) || telegramMediaGroupLimit).fill(
      ctx.randomImage
    )
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
