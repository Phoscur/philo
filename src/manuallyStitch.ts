import stitchImages from './lib/ffmpeg'
import Storage from './lib/storage'

const taskId = '42095079-1091'
const parts = 420
const fileNameFormatted = '2021-10-23-18-25'
const storage = new Storage('storage')

async function main() {
  const outFile = `${fileNameFormatted}.${taskId}.mp4`
  await stitchImages(taskId, storage.cwd, {
    parts,
    outFile,
  })
}

main()
