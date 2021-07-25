import FileStorage from '../lib/storage'
import type { PhiloBot } from '../PhiloContext.interface'

export default function setupStorageCommands(
  bot: PhiloBot,
  storage: FileStorage
) {
  async function filterStorage(filter: string) {
    const files = await storage.list()
    return files.filter((name) => name.includes(filter))
  }

  bot.command(['list', 'l'], (ctx) => {
    setImmediate(async () => {
      const [_, filter] = ctx.message.text.split(' ')
      const files = await filterStorage(filter)
      // TODO cut or split into multiple messages if the list is too long
      ctx.reply(files.join(' '))
    })
  })

  bot.command(['view', 'v'], (ctx) => {
    setImmediate(async () => {
      const [, fileOrFilter] = ctx.message.text.split(' ')
      const files = await filterStorage(fileOrFilter)
      const fileName = files[0] || fileOrFilter
      const source = storage.readStream(fileName)
      const replyWithFile =
        fileName.endsWith('.gif') || fileName.endsWith('.mp4')
          ? ctx.replyWithAnimation.bind(ctx)
          : ctx.replyWithPhoto.bind(ctx)
      source.on('error', (err) => {
        ctx.reply(`Error: ${fileName} - ${err}`)
      })
      replyWithFile({
        source,
      })
    })
  })
}