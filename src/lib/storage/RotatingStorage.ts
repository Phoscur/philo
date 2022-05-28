import { Storage } from './Storage.interface'
import { ProxyStorage } from './ProxyStorage'
import { GithubStorage } from './GithubStorage'
import { getFormattedDate } from '../time'

/**
 * Daily Backups (GithubStorage)
 * !TODO! free disk space afterwards!
 */
export class DailyRotatingStorage extends ProxyStorage {
  public path = ''
  protected constructor(public pathPrefix: string, protected data?: Storage) {
    super('', data)
  }

  static async create(path = `${process.env.GITHUB_REPO_NAME_PREFIX}`) {
    return await new DailyRotatingStorage(path).rotate()
  }

  async rotate() {
    const { folderDayFormatted } = await getFormattedDate()
    if (this.data && ~this.data.path.indexOf(folderDayFormatted)) {
      // fresh enough
      return this
    }
    if (this.data) {
      console.log('TODO delete old data', this.data.path)
      // TODO remove older data folders
    }
    this.path = `${this.pathPrefix}-${folderDayFormatted}`
    console.log('Storage rotated', this.path)
    this.data = await GithubStorage.create(this.path)
    return this
  }

  /**
   * Get storage, rotated as necessary
   */
  async getData() {
    await this.rotate()
    const data = await super.getData()
    return data
  }
}

export class MonthlyRotatingStorage extends ProxyStorage {
  public path = ''
  protected constructor(public pathPrefix: string, protected data?: Storage) {
    super('', data)
  }

  static async create(path = `${process.env.GITHUB_REPO_NAME_PREFIX}`) {
    return await new MonthlyRotatingStorage(path).rotate()
  }

  async rotate() {
    const { folderMonthFormatted } = await getFormattedDate()
    if (this.data && ~this.data.path.indexOf(folderMonthFormatted)) {
      // fresh enough
      return this
    }
    if (this.data) {
      console.log('TODO delete old data', this.data.path)
      // TODO remove older data folders
    }
    this.path = `${this.pathPrefix}-${folderMonthFormatted}`
    console.log('Storage rotated', this.path)
    this.data = await GithubStorage.create(this.path)
    return this
  }

  /**
   * Get storage, rotated as necessary
   */
  async getData() {
    await this.rotate()
    const data = await super.getData()
    return data
  }
}
