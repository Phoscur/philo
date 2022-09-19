import stitchImages from './lib/ffmpeg'

// ffmpeg -framerate 18 -i sunset-karlsruhe-2022-09-04/-1001404797626-6021-%03d.jpg
// -c:v libx264 -crf 28 -vf scale=2028:-1
// -an sunset-karlsruhe-2022-09/2022-09-04--14-13.-1001404797626-6021.mp4
const taskId = '42095079-1797'
//const taskId = '-1001404797626-6021'
const parts = 42
const monthFormatted = '2022-09'
const dayFormatted = '2022-09-06'
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
