import type { PhiloBot, PhiloScene } from '../PhiloContext.interface'

import StorageManager from '../lib/storage'

export default function setupStorageCommands(bot: PhiloBot | PhiloScene, storage: StorageManager) {
  async function filterStorage(store: StorageManager, filter: string) {
    const files = await store.list()
    return files.filter((name: string) => name.includes(filter))
  }

  bot.command(['list', 'l'], (ctx) => {
    setImmediate(async () => {
      const [_, filter] = ctx.message.text.split(' ')
      const files = await filterStorage(storage, filter)
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
      const [, filter] = ctx.message.text.split(' ')
      let [folder, fileOrFilter] = filter.split('/')
      console.log('View', filter, folder, fileOrFilter)
      if (!fileOrFilter) {
        fileOrFilter = folder
      }
      try {
        const files = await filterStorage(storage, fileOrFilter)
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
      } catch (err) {
        console.log('View Command failed')
        console.error(err)
        ctx.reply(`Could not find: ${fileOrFilter}`)
      }
    })
  })
}
