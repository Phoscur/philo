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
import { FileStorage } from './FileStorage'

export interface GithubAuthor {
  name: string
  email: string
}

const README_FILE = 'README.md'

function readmeString(path: string, author: GithubAuthor, name: string): string {
  return `## Photography ${path} by [${author.name}](mailto:${author.email}),

  licensed under
  [CC BY-NC-SA](https://creativecommons.org/licenses/by-nc-sa/4.0/)
  
  ![CC BY-NC-SA](https://licensebuttons.net/l/by-nc-sa/4.0/88x31.png)

  ${name}
  `
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
  ): Promise<GithubStorage | GlacierStorage | FileStorage> {
    console.log(`[Storage: ${path}] Github enabled: ${process.env.GITHUB_ENABLED}`)
    if ('true' === process.env.GITHUB_ENABLED) {
      return new GithubStorage(path, token, organisation, author).setup()
    }
    return GlacierStorage.create(path)
  }

  protected async setup() {
    await super.setup()
    if ('true' !== process.env.GITHUB_ENABLED) {
      return this
    }
    await this.createRepo(this.path)
    await this.checkout()
    await this.addReadme()
    // TODO? await git.branch({ fs, dir, ref: 'main' })
    return this
  }

  /**
   * API call to create a (private) Github repository
   * @param name for the new repo
   * @param [privateFlag=true]
   * @returns true if created, false when already existing
   */
  async createRepo(name: string, privateFlag = true): Promise<boolean> {
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
      if (error.response?.status === 422) {
        return error.response
      }
      throw error
    })
    console.log(
      `[Github] Repository ${this.organisation}/${this.path} ${
        creation?.status === 422 ? 'already exists!' : 'created.'
      } Response: ${creation?.status} ${creation?.statusText}`
    )
    return creation?.status === 201
  }

  protected async addReadme() {
    if (await this.exists(README_FILE)) return
    await this.save(
      README_FILE,
      Buffer.from(readmeString(this.path, this.author, this.name), 'utf8')
    )
  }

  async deleteRepo(name: string) {
    throw new Error(`[Storage: ${name}] Repository deletion is not implemented (yet).`)
    // hint: requires extra scope on auth token: https://stackoverflow.com/questions/19319516/how-to-delete-a-github-repo-using-the-api
  }

  /**
   * Attempt `git clone`
   * @returns true when successful
   */
  async checkout(): Promise<boolean> {
    try {
      console.log('Checking out', this.path, '...')
      const dir = this.cwd
      await git.clone({ fs, dir, http, url: this.url, singleBranch: true, depth: 1 })
      console.log('Successfully cloned', this.path)
      return true
    } catch (err) {
      console.error('Checkout failed', this.path, err)
      return false
    }
  }

  async save(fileName: string, source: Buffer) {
    // also triggers add()
    await super.save(fileName, source)
  }

  protected async gitLog() {
    return git.log({ fs, dir: this.cwd })
  }
  protected async gitStatus(filepath: string) {
    return git.status({ fs, dir: this.cwd, filepath })
  }
  protected async gitAdd(fileName: string) {
    return git.add({ fs, dir: this.cwd, filepath: fileName })
  }
  protected async gitCommit(message: string) {
    return git.commit({ fs, dir: this.cwd, message, author: this.author })
  }
  protected async gitPush() {
    return git.push({ fs, dir: this.cwd, http, onAuth: () => ({ username: this.token }) })
  }
  protected async isUnmodified(fileName: string) {
    return 'unmodified' === (await this.gitStatus(fileName))
  }

  async add(fileName: string) {
    const message = `Add ${fileName}`
    // commit & push
    try {
      await this.gitAdd(fileName)
      if (await this.isUnmodified(fileName)) {
        console.log(fileName, 'is unmodified, skipping push.')
        return
      }
      await this.gitCommit(message)
      await this.gitPush()
      console.log('Git Status', fileName, await this.gitStatus(fileName))
      const commits = await this.gitLog()
      console.log('Git Log length:', commits.length, '- Last commit:', commits[0].commit.message)
    } catch (error) {
      console.log('Failed to push!', error)
    }
  }
}
