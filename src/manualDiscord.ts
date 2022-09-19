import { createClient, DISCORD_ENABLED, sendAnnouncementEmptyStub } from './lib/discord'
import { FileStorage } from './lib/storage'

// ffmpeg -framerate 18 -i sunset-karlsruhe-2022-09-04/-1001404797626-6021-%03d.jpg
// -c:v libx264 -crf 28 -vf scale=2028:-1
// -an sunset-karlsruhe-2022-09/2022-09-04--14-13.-1001404797626-6021.mp4
const taskId = '42095079-1797'
//const taskId = '-1001404797626-6021'
const parts = 42
const monthFormatted = '2022-09'
const dayFormatted = '2022-09-06'
const storageName = process.env.GITHUB_REPO_NAME_PREFIX || 'storage'
//const inFolder = `${storageName}-${dayFormatted}`
//const outFolder = `${storageName}-${monthFormatted}`
//const outFile = `${outFolder}/${dayFormatted}.${taskId}.mp4`
const folderName = `${storageName}-${monthFormatted}`
const fileName = '2022-09-06--18-42.-1001404797626-6048.mp4'

async function main() {
  const storage = await FileStorage.create(folderName)
  let sendDiscordAnimation
  if (!DISCORD_ENABLED) {
    console.log('- Discord connection is disabled')
    sendDiscordAnimation = sendAnnouncementEmptyStub
  } else {
    const dClient = createClient()
    sendDiscordAnimation = dClient.sendAnimationAnnouncement
  }
  const file = await storage.exists(fileName)
  if (!file) {
    throw new Error('Attachment to send does not exist: ' + fileName)
  }
  await new Promise((res) => setTimeout(res, 1500))
  await sendDiscordAnimation('Test', file)
}

main()
