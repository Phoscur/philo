import type FileStorage from '../lib/storage'
import type { PhiloBot, PhiloScene } from '../PhiloContext.interface'

export default function setupStorageCommands(bot: PhiloBot | PhiloScene, storage: FileStorage) {
  async function filterStorage(filter: string) {
    const files = await storage.list()
    return files.filter((name: string) => name.includes(filter))
  }

  bot.command(['list', 'l'], (ctx) => {
    setImmediate(async () => {
      const [_, filter] = ctx.message.text.split(' ')
      const files = await filterStorage(filter)
      // TODO cut or split into multiple messages if the list is too long
      ctx.reply(files.join(' ') || 'Storage is empty')
    })
  })

  bot.command(['status', 'storage', 's'], (ctx) => {
    setImmediate(async () => {
      const status = await ctx.storage.status()
      ctx.reply(`Storage space: ${status}`)
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
      source.on('error', (err: Error) => {
        ctx.reply(`Error: ${fileName} - ${err}`)
      })
      replyWithFile({
        source,
      })
    })
  })
}
