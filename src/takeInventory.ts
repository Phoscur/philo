import StorageManager from './lib/storage'
import { InventoryStorage } from './lib/storage/InventoryStorage'

const storageName = 'storage-inventory-test'
//const taskId = '42095079-1462'
const taskId = '-1001404797626-5403'
const monthFormatted = '2022-05'
const dayFormatted = '2022-05-13'
const fileName = `${dayFormatted}.${taskId}.mp4`
const vaultName = `${storageName}-${monthFormatted}`

async function main() {
  // const storage = await StorageManager.create(storageName)
  const inventory = await InventoryStorage.create(storageName)
  console.log(inventory.index)
  await inventory.addMedia(monthFormatted, fileName, vaultName)
  console.log(inventory.index, inventory.index.media[monthFormatted].files)
}

main()
