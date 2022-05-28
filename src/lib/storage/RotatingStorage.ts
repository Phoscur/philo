import { Storage } from './Storage.interface'
import { ProxyStorage } from './ProxyStorage'
import { GithubStorage } from './GithubStorage'
import { getFormattedDate } from '../time'

type SuffixConstructor = () => Promise<string>
const counterSuffix: () => SuffixConstructor = () =>
  (() => {
    let counter = 0
    return () => Promise.resolve(`${++counter}`)
  })()

const folderDaySuffix = async () => {
  const { folderDayFormatted } = await getFormattedDate()
  return folderDayFormatted
}
const folderMonthSuffix = async () => {
  const { folderMonthFormatted } = await getFormattedDate()
  return folderMonthFormatted
}

/**
 * Rotating (Github)Storage
 * !TODO! free disk space afterwards!
 */
export class RotatingStorage extends ProxyStorage {
  public path = ''
  protected constructor(
    public pathPrefix: string,
    protected data?: Storage,
    public readonly pathSuffix: SuffixConstructor = counterSuffix()
  ) {
    super('', data)
  }

  static async create(
    path = `${process.env.GITHUB_REPO_NAME_PREFIX}`,
    data?: Storage,
    pathSuffix?: SuffixConstructor
  ) {
    return await new RotatingStorage(path, data, pathSuffix).rotate()
  }

  async rotate() {
    const suffix = await this.pathSuffix()
    if (this.data && ~this.data.path.indexOf(suffix)) {
      // fresh enough
      return this
    }
    if (this.data) {
      console.log(`TODO [Storage: ${this.data.path}] Delete old data`)
      // TODO remove older data folders
    }
    this.path = `${this.pathPrefix}-${suffix}`
    this.data = await GithubStorage.create(this.path)
    console.log(`[Storage: ${this.path}] Rotation enabled`)
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
export class MonthlyRotatingStorage extends RotatingStorage {
  static async create(path = `${process.env.GITHUB_REPO_NAME_PREFIX}`) {
    return await new MonthlyRotatingStorage(path, undefined, folderMonthSuffix).rotate()
  }
}

export class DailyRotatingStorage extends RotatingStorage {
  static async create(path = `${process.env.GITHUB_REPO_NAME_PREFIX}`) {
    return await new DailyRotatingStorage(path, undefined, folderDaySuffix).rotate()
  }
}
