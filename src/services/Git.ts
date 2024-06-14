import axios from 'axios'
import sodium from 'libsodium-wrappers'
import git from 'isomorphic-git'
import http from 'isomorphic-git/http/node/index.js'
import fs from 'fs/promises'
import { Octokit } from '@octokit/rest'
import { inject, injectable } from '@joist/di'
import { FileSystem } from './FileSystem.js'
import { Logger } from './Logger.js'

@injectable
export class Git {
  git = git
  #fs = inject(FileSystem)
  #logger = inject(Logger)

  author = {
    name: `${process.env.GITHUB_AUTHOR_NAME}`,
    email: `${process.env.GITHUB_AUTHOR_EMAIL}`,
  }
  token = `${process.env.GITHUB_TOKEN}`
  ref = 'main'
  /**
   * Special URL to clone a private github repo (refs https://github.com/isomorphic-git/isomorphic-git/issues/1170#issuecomment-653713207)
   */
  get privateUrlPrefix() {
    return `https://${this.author.name}:${this.token}@github.com/${this.author.name}/`
  }

  /**
   * Add, commit and push
   */
  async upload(fileName: string) {
    const { log } = this.#logger()
    const message = `Add ${fileName}`
    // commit & push
    try {
      await this.add(fileName)
      if (await this.isUnmodified(fileName)) {
        log(fileName, 'is unmodified, skipping push.')
        return
      }
      await this.commit(message)
      await this.push()
      log('Git Status', fileName, await this.status(fileName))
      const commits = await this.log()
      log('Git Log length:', commits.length.toString(), '- Last commit:', commits[0].commit.message)
    } catch (error: any) {
      log('Failed to push!', error?.message)
    }
  }

  /**
   * Attempt `git clone` including checkout
   */
  async checkout(repo: string) {
    const { log } = this.#logger()
    const dir = this.#fs().getAbsolutePath(repo)
    try {
      log('Checking out:', this.privateUrlPrefix + repo)
      await this.git.clone({
        fs,
        dir,
        http,
        url: this.privateUrlPrefix + repo,
        singleBranch: true,
        depth: 1,
      })
      log('Successfully cloned:', dir)
      await this.branch(this.ref)
      return true
    } catch (err: any) {
      log('Checkout failed:', dir, err?.message)
      return false
    }
  }

  /**
   * @typedef {object} Log
   * @property {{message: string}} commit
   */
  /**
   * @returns {Promise<Log[]>}
   */
  async log() {
    const dir = this.#fs().absolutePath
    return this.git.log({ fs, dir })
  }
  async status(filepath: string) {
    const dir = this.#fs().absolutePath
    return this.git.status({ fs, dir, filepath })
  }

  async add(fileName: string) {
    const dir = this.#fs().absolutePath
    await this.git.add({ fs, dir, filepath: fileName })
  }

  async branch(name: string) {
    const logger = this.#logger()
    const dir = this.#fs().absolutePath
    try {
      await this.git.branch({ fs, dir, ref: name, checkout: true })
    } catch (e: any) {
      if (e?.code === 'AlreadyExistsError') {
        logger.log(`Branch "${name}" already exists`)
      } else {
        throw new Error(e.message || e.code || 'Git Branch failed')
      }
    }
    this.ref = name
    logger.log('Using branch:', name)
  }

  async commit(message: string) {
    const dir = this.#fs().absolutePath
    return this.git.commit({ fs, dir, message, author: this.author })
  }

  /**
   * @returns {Promise<import('isomorphic-git').PushResult>}
   */
  async push() {
    const dir = this.#fs().absolutePath
    return this.git.push({
      fs,
      dir,
      http,
      // ref: this.ref,
      onAuth: () => ({ username: this.token }),
    })
  }

  async isUnmodified(fileName: string) {
    return 'unmodified' === (await this.status(fileName))
  }

  //
  // --- Following utilities are Github specific, but they fit better here
  //     (because they use the token) than in Repository.js
  //

  /**
   * Setup Github Action Secret
   * using Octokit & libsodium
   */
  async setActionSecret(repo: string, name: string, value: string) {
    const owner = this.author.name
    const octokit = new Octokit({
      auth: this.token,
    })
    await sodium.ready
    try {
      // Step 0: Thank ChatGPT4o for putting this procedure together, also see: https://medium.com/cocoaacademymag/how-to-integrate-github-actions-with-slack-telegram-and-whatsapp-67a4dca0f17d
      // Step 1: Get the public key for the repository
      const { data: publicKey } = await octokit.request(
        `GET /repos/${owner}/${repo}/actions/secrets/public-key`
      )

      const publicKeyBase64 = publicKey.key
      const publicKeyId = publicKey.key_id

      // Step 2: Encrypt the secret value using the public key
      const binaryKey = sodium.from_base64(publicKeyBase64, sodium.base64_variants.ORIGINAL)
      const binarySecret = sodium.from_string(value)
      const encryptedBinarySecret = sodium.crypto_box_seal(binarySecret, binaryKey)
      const encryptedSecret = sodium.to_base64(
        encryptedBinarySecret,
        sodium.base64_variants.ORIGINAL
      )

      // Step 3: Create or update the secret
      await octokit.request(`PUT /repos/${owner}/${repo}/actions/secrets/${name}`, {
        owner,
        repo,
        secret_name: name,
        encrypted_value: encryptedSecret,
        key_id: publicKeyId,
      })

      console.log(`Secret ${name} has been set successfully`)
      return true
    } catch (error) {
      console.error(`Failed to set secret: ${error}`)
      return false
    }
  }

  /**
   * API call to create a (private) Github repository
   * @returns {Promise<boolean>} true if created, false when already existing
   */
  async createRepository(name: string, privateFlag = true) {
    // TODO? use octokit instead
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
    this.#logger().log(
      `[Github] Repository ${name} ${
        creation?.status === 422 ? 'already exists!' : 'created.'
      } Response: ${creation?.status} ${creation?.statusText}`
    )
    return creation?.status === 201
  }

  /**
   * API call to enable Github Pages for the repository
   * https://docs.github.com/en/rest/pages#create-a-github-pages-site
   * @returns {Promise<boolean>} true if enabled, false when already enabled
   */
  async enablePages(repo: string) {
    const owner = this.author.name
    // TODO? use octokit instead
    const creation = await axios({
      url: `https://api.github.com/repos/${owner}/${repo}/pages`,
      method: 'POST', // GET will give current settings instead
      data: {
        owner,
        repo,
        source: {
          branch: 'gh-pages',
          path: '/',
        },
      },
      headers: {
        Authorization: `token ${this.token}`,
      },
    }).catch((error) => {
      if (~[404, 409, 422].indexOf(error.response?.status)) {
        return error.response
      }
      throw error
    })
    this.#logger().log(
      `[Github] Repository ${repo} ${
        creation?.status === 409
          ? 'has pages already enabled.'
          : creation?.status === 404
          ? 'was not found!'
          : creation?.status === 422
          ? "can't enable pages!"
          : 'now has pages enabled.'
      } Response: ${creation?.status} ${creation?.statusText}`,
      creation?.data
    )
    return creation?.status === 201 || creation?.status === 409
  }

  getPageUrl(repo: string) {
    const owner = this.author.name
    return `https://${owner}.github.io/${repo}/`
  }

  /**
   * Check for a file on the Github Page to be up
   * @returns {Promise<boolean>} success
   */
  async checkPage(repo: string, file: string) {
    const url = `${this.getPageUrl(repo)}${file}`
    try {
      const check = await axios({
        url,
        method: 'HEAD',
      })
      const length = check.headers['content-length'] || ''
      this.#logger().log(`Checked ${url}: ${check.headers['content-type']}, length: ${length}`)
      return parseInt(length) > 0
    } catch (e) {
      this.#logger().log(`Failed to check ${url}`)
      return false
    }
  }

  async deleteRepository(name: string) {
    throw new Error(`[Storage: ${name}] Repository deletion is not implemented (yet).`)
    // hint: requires extra scope on auth token: https://stackoverflow.com/questions/19319516/how-to-delete-a-github-repo-using-the-api
  }
}
