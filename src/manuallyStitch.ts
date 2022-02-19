import stitchImages from './lib/ffmpeg'
import FileStorage from './lib/storage'

//const taskId = '42095079-1369'
const taskId = '-1001404797626-4981'
const parts = 420
const fileNameFormatted = '2022-02-10'
const folder = 'karlsruhe-2022-02-10'

async function main() {
  const storage = await FileStorage.create(folder)
  const outFile = `${fileNameFormatted}.${taskId}.mp4`
  await stitchImages(taskId, storage.cwd, {
    parts,
    outFile,
  })
}

main()
