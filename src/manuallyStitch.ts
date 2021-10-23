import stitchImages from './lib/ffmpeg'
import Storage from './lib/storage'

const taskId = '42095079-1101'
const parts = 25
const fileNameFormatted = '2021-10-23'
const storage = new Storage('storage')

async function main() {
  const outFile = `${fileNameFormatted}.${taskId}.mp4`
  await stitchImages(taskId, storage.cwd, {
    parts,
    outFile,
  })
}

main()
