import { FileStorage, GlacierArchiver } from './lib/storage'

//const taskId = '42095079-1462'
const taskId = '-1001404797626-5403'
const dayFormatted = '2022-05-13'
const storageName = 'storage'
const fileName = `${taskId}-002.jpg`
const folder = `${storageName}-${dayFormatted}`

async function main() {
  const archiver = GlacierArchiver.instance
  const storage = await FileStorage.create(folder)
  const vault = await archiver.createVault(folder)
  const file = await storage.read(fileName)
  await vault.uploadArchive(file, fileName)
}

main()
