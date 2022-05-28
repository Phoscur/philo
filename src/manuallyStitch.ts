import stitchImages from './lib/ffmpeg'
import StorageManager from './lib/storage'

//const taskId = '42095079-1462'
const taskId = '-1001404797626-5403'
const parts = 420
const monthFormatted = '2022-05'
const dayFormatted = '2022-05-13'
const storageName = 'storage'
const inFolder = `${storageName}-${dayFormatted}`
const outFolder = `${storageName}-${monthFormatted}`
const outFile = `${outFolder}/${dayFormatted}.${taskId}.mp4`

async function main() {
  const storage = await StorageManager.create(storageName)
  await stitchImages(
    taskId,
    storage.workingDirectory,
    {
      parts,
      outFile,
    },
    inFolder,
    outFolder
  )
}

main()
