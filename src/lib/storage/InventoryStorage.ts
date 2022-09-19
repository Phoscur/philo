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

import { getFormattedDate } from '../time'

type PrefixConstructor = () => Promise<string>
const folderMonthPrefix = async () => {
  const { folderMonthFormatted } = await getFormattedDate()
  return folderMonthFormatted
}

const INVENTORY_FILE_SUFFIX = '-inventory.json'

/**
 * Provide Inventory in JSON format (infos.json) for media and references to raw files
 */
export class InventoryStorage extends GithubStorage {
  private mediaIndex: MediaIndex
  private inventoryFilePrefix: PrefixConstructor
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
    this.mediaIndex = index || newMediaIndex('initial') // 'initial' is just a placeholder, need async call to create dynamic name: see setup()
    this.inventoryFilePrefix = folderMonthPrefix
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

  protected async inventoryFilePath(): Promise<string> {
    return (await this.inventoryFilePrefix()) + INVENTORY_FILE_SUFFIX
  }

  async writeIndex(index?: MediaIndex) {
    if (index) {
      this.mediaIndex = index
    }
    const fileName = await this.inventoryFilePath()
    await this.save(fileName, Buffer.from(JSON.stringify(this.mediaIndex, null, 2), 'utf8'))
  }

  async add(fileName: string) {
    if ('true' !== process.env.GITHUB_ENABLED) {
      return
    }
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
    const fileName = await this.inventoryFilePath()
    try {
      const inv = await this.read(fileName)
      console.log(`[Inventory: ${fileName}] Loaded!`)
      return JSON.parse(inv.toString()) as MediaIndex
    } catch (error: any) {
      if ('ENOENT' === error.code) {
        console.log(`[Inventory: ${fileName}}] Created new ${fileName}`)
        return newMediaIndex(fileName)
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
