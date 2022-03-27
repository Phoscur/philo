import stitchImages from './lib/ffmpeg'
import FileStorage from './lib/storage'

//const taskId = '42095079-1462'
const taskId = '-1001404797626-5179'
const parts = 420
const fileNameFormatted = '2022-03-26'
const folder = 'karlsruhe-2022-03-26'

async function main() {
  const storage = await FileStorage.create(folder)
  const outFile = `${fileNameFormatted}.${taskId}.mp4`
  await stitchImages(taskId, storage.cwd, {
    parts,
    outFile,
  })
}

main()
