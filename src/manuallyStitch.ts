import stitchImages from './lib/ffmpeg'

//const taskId = '42095079-1462'
const taskId = '-1001404797626-5663'
const parts = 420
const monthFormatted = '2022-07'
const dayFormatted = '2022-07-05'
const storageName = process.env.GITHUB_REPO_NAME_PREFIX || 'storage'
const inFolder = `${storageName}-${dayFormatted}`
const outFolder = `${storageName}-${monthFormatted}`
const outFile = `${outFolder}/${dayFormatted}.${taskId}.mp4`

async function main() {
  await stitchImages(
    taskId,
    process.cwd(),
    {
      parts,
      outFile,
    },
    inFolder,
    outFolder
  )
}

main()
