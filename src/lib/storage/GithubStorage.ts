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

/* TODO implement composite storage:
export default class FolderBackupStorage {
  // need to operate two (or more?) kinds of storage at the same time, or with different instances of this class
  // - store daily backup
  // - store vids yearly
  // reference daily backups in/for yearly vids
}

class DailyBackupStorage {}

class AlbumStorage {}
*/

import git from 'isomorphic-git'
import http from 'isomorphic-git/http/node'
import fs from 'fs'
import axios from 'axios'

import { GlacierStorage } from './GlacierStorage'

export interface GithubAuthor {
  name: string
  email: string
}

/**
 * Create Github Repo & Push added files
 * with env GITHUB_ENABLED=true
 */
export class GithubStorage extends GlacierStorage {
  // extends FileStorage (TODO? use a different pattern than inheritance)
  /**
   * Special URL to clone a private github repo (refs https://github.com/isomorphic-git/isomorphic-git/issues/1170#issuecomment-653713207)
   */
  private readonly url: string
  protected constructor(
    path: string,
    private readonly token: string,
    private readonly organisation: string,
    private readonly author: GithubAuthor
  ) {
    super(path)

    this.url = `https://${this.organisation}:${this.token}@github.com/${this.organisation}/${this.path}`
  }

  static async create(
    path: string = `${process.env.GITHUB_REPO_NAME_PREFIX || 'sunset-data-'}`,
    token: string = `${process.env.GITHUB_TOKEN}`,
    organisation: string = `${process.env.GITHUB_ORGANISATION}`,
    author: GithubAuthor = {
      name: `${process.env.GITHUB_AUTHOR_NAME}`,
      email: `${process.env.GITHUB_AUTHOR_EMAIL}`,
    }
  ): Promise<GithubStorage | GlacierStorage> {
    console.log(`[Storage: ${path}] Github enabled: ${process.env.GITHUB_ENABLED}`)
    if ('true' === process.env.GITHUB_ENABLED) {
      return new GithubStorage(path, token, organisation, author).setup()
    }
    return GlacierStorage.create(path)
  }

  async setup() {
    await super.setup()
    await this.createRepo(this.path)
    await this.checkout()
    // TODO? await git.branch({ fs, dir, ref: 'main' })
    return this
  }

  async createRepo(name: string, privateFlag = true) {
    const creation = await axios({
      url: 'https://api.github.com/user/repos',
      method: 'POST', // GET will give a list of repos instead
      data: {
        name,
        private: privateFlag,
      },
      headers: {
        Authorization: `token ${this.token}`,
      },
    }).catch((error) => {
      // github returns 422 if the repo already exists
      if (error.response.status === 422) {
        return error.response
      }
      throw error
    })
    console.log(
      `[Github] Repository created: ${this.organisation}/${this.path} - Response: ${creation.status} ${creation.statusText}`
    )
    return creation.status === 201 || creation.status === 422
  }

  async deleteRepo(name: string) {
    throw new Error('Repository deletion is not implemented (yet)')
    // hint: requires extra scope on auth token: https://stackoverflow.com/questions/19319516/how-to-delete-a-github-repo-using-the-api
  }

  async checkout() {
    const dir = this.cwd
    await git.clone({ fs, dir, http, url: this.url })
    console.log('Successfully cloned', this.path)
  }

  async save(fileName: string, source: Buffer) {
    // also triggers add()
    await super.save(fileName, source)
  }

  async add(fileName: string) {
    const message = `Add ${fileName}`
    // commit & push
    const dir = this.cwd
    /*??0|philo    | TypeError: Cannot create property 'caller' on string 'buffer error'
0|philo    |     at Object.clone (/home/pi/philo/node_modules/isomorphic-git/index.cjs:7785:16)*/
    await git.add({ fs, dir, filepath: fileName })
    await git.commit({ fs, dir, message, author: this.author })
    await git.push({ fs, dir, http, onAuth: () => ({ username: this.token }) })
    console.log('Git Status', fileName, await git.status({ fs, dir, filepath: fileName }))
    const commits = await git.log({ fs, dir })
    console.log('Git Log length:', commits.length, '- Last commit:', commits[0].commit.message)
  }
}
