import stitchImages from './lib/ffmpeg'
import FileStorage from './lib/storage'

const taskId = '42095079-1101'
const parts = 25
const fileNameFormatted = '2021-10-23'

async function main() {
  const storage = await FileStorage.create('storage')
  const outFile = `${fileNameFormatted}.${taskId}.mp4`
  await stitchImages(taskId, storage.cwd, {
    parts,
    outFile,
  })
}

main()
