// we want to stay below 5GB (warning limit) per backup (github repo) chunk,
// it seems to be a good idea to stay even lower with daily backups
// git repos are best kept below 1GB
// refs:
// - https://stackoverflow.com/questions/38768454/repository-size-limits-for-github-com
// - https://github.community/t/can-i-use-github-as-free-unlimited-cloud-storage-or-is-this-only-with-bitbucket-possible/1574/5

// 1. use the date for the new folder name, create new repo via api https://stackoverflow.com/questions/36753547/create-github-repository-from-api
// 2. save images to ./shots (daily named repo)
// 3. save vids & gifs (yearly named repo)
// 3. save metadata, git commit
// 4. clean up - delete folder (daily only)

import path from 'path'
import git from 'isomorphic-git'
import http from 'isomorphic-git/http/node'
import fs from 'fs'
import axios from 'axios'
// curl -H "Authorization: token ggeneratedtokenhp_5NGPkxrtnI8CWM187b7r"
// --data '{"name":"name-foo"}' https://api.github.com/user/repos

const author = { name: 'Philo', email: 'bluest@pheelgood.net' }
const githubOrg = 'BluestDragon'
const gitHubRepo = `${process.env.GITHUB_REPO_NAME_PREFIX || 'sunset-data-'}`

const token = `${process.env.GITHUB_TOKEN}`
// Special URL for cloning private github repo (refs https://github.com/isomorphic-git/isomorphic-git/issues/1170#issuecomment-653713207)
const url = `https://${githubOrg}:${token}@github.com/${githubOrg}/${gitHubRepo}`

async function createRepo(name: string, privateFlag = true) {
  const creation = await axios({
    url: 'https://api.github.com/user/repos',
    method: 'POST', // GET will give a list of repos instead
    data: {
      name,
      private: privateFlag,
    },
    headers: {
      Authorization: `token ${token}`,
    },
  })
  console.log('Repo creation response:', creation.status, creation.statusText)
  return creation.status === 201
}
createRepo(gitHubRepo).catch((err) =>
  console.error('Failed to create repo', err.message, err?.data?.message)
)

async function cloneAndUpdate() {
  const dir = path.join(process.cwd(), gitHubRepo)

  const fileName = 'newFile.txt'
  const filePath = path.join(dir, fileName)

  const message = 'Add new file'
  console.log('Clone:', await git.clone({ fs, dir, http, url }))
  await fs.promises.writeFile(filePath, 'Hey, I am new :)', 'utf8')
  console.log('Git Status', fileName, await git.status({ fs, dir, filepath: fileName }))
  await git.add({ fs, dir, filepath: fileName })
  await git.commit({ fs, dir, message, author })
  await git.push({ fs, dir, http, onAuth: () => ({ username: token }) })
  console.log('Git Status', fileName, await git.status({ fs, dir, filepath: fileName }))
  console.log('Git Log', await git.log({ fs, dir }))
}

cloneAndUpdate()
