import { getFormattedDate } from '../time'
import { GithubStorage } from './GithubStorage'

const DAY_MS = 24 * 60 * 60 * 1000

async function main() {
  for (let d = 7; d > 0; d--) {
    const yesterday = await getFormattedDate(Date.now() - DAY_MS * d)
    const repoName = `${process.env.CONTENT_STORAGE_NAME_PREFIX}-${yesterday.folderDayFormatted}`
    console.log('Checking (out) Git Repo:', repoName)
    const storage = await GithubStorage.create(repoName)
    console.log('Storage has', (await storage.list()).length - 1, 'files in', repoName)
  }
}

main()
