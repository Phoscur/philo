import { GithubStorage, GithubAuthor } from './GithubStorage'

interface Entry {
  vault?: string
  files: string[]
}

interface InventoryIndex {
  [folder: string]: Entry
}

interface MediaIndex {
  name: string
  media: InventoryIndex
  raw: InventoryIndex
}

function newMediaIndex(name: string): MediaIndex {
  return {
    name,
    media: {},
    raw: {},
  }
}

function newEntry(vault?: string): Entry {
  return {
    vault,
    files: [],
  }
}

const INVENTORY_FILE = 'inventory.json'

/**
 * Provide Inventory in JSON format (infos.json) for media and references to raw files
 */
export class InventoryStorage extends GithubStorage {
  private mediaIndex: MediaIndex
  get index() {
    return this.mediaIndex
  }

  protected constructor(
    path: string,
    token: string,
    organisation: string,
    author: GithubAuthor,
    index?: MediaIndex
  ) {
    super(path, token, organisation, author)
    this.mediaIndex = index || newMediaIndex(path)
  }
  static async create(
    path: string = `${process.env.GITHUB_REPO_NAME_PREFIX}`,
    token: string = `${process.env.GITHUB_TOKEN}`,
    organisation: string = `${process.env.GITHUB_ORGANISATION}`,
    author: GithubAuthor = {
      name: `${process.env.GITHUB_AUTHOR_NAME}`,
      email: `${process.env.GITHUB_AUTHOR_EMAIL}`,
    }
  ) {
    return new InventoryStorage(path, token, organisation, author).setup()
  }
  protected async setup() {
    await super.setup()
    this.mediaIndex = await this.readIndex()
    console.log(
      `[Inventory: ${this.path}] Inventory loaded with ${
        Object.keys(this.mediaIndex.media).length
      } entries`
    )
    return this
  }

  async writeIndex(index?: MediaIndex) {
    if (index) {
      this.mediaIndex = index
    }
    await this.save(INVENTORY_FILE, Buffer.from(JSON.stringify(this.mediaIndex, null, 2), 'utf8'))
  }

  async add(fileName: string) {
    const message = `Update ${fileName}`
    // commit & push
    await this.gitAdd(fileName)
    await this.gitCommit(message)
    await this.gitPush()
    console.log('Git Status', fileName, await this.gitStatus(fileName))
    const commits = await this.gitLog()
    console.log('Git Log length:', commits.length, '- Last commit:', commits[0].commit.message)
  }

  async readIndex(): Promise<MediaIndex> {
    try {
      const inv = await this.read(INVENTORY_FILE)
      return JSON.parse(inv.toString()) as MediaIndex
    } catch (error: any) {
      if ('ENOENT' === error.code) {
        console.log(`[Inventory: ${this.path}] Created new ${INVENTORY_FILE}`)
        return newMediaIndex(this.path)
      }
      throw error
    }
  }

  async addRaw(folder: string, name: string, vault?: string) {
    if (!this.mediaIndex.raw[folder]) {
      this.mediaIndex.raw[folder] = newEntry(vault)
    }
    this.mediaIndex.raw[folder].files.push(name)
    await this.writeIndex(this.mediaIndex)
  }

  async addMedia(folder: string, name: string, vault?: string) {
    if (!this.mediaIndex.media[folder]) {
      this.mediaIndex.media[folder] = newEntry(vault)
    }
    this.mediaIndex.media[folder].files.push(name)
    await this.writeIndex(this.mediaIndex)
  }
}
