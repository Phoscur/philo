import { inject, injectable } from '@joist/di';
import { FileSystem } from './FileSystem.js';
import { Logger } from './Logger.js';
import { Publisher } from './Publisher.js';
import { Producer } from './Producer.js';
import { ChatMessenger } from '../context.js';
import { I18nService } from './I18n.js';
import { Publication } from './PublicationInventory.js';

/**
 * This is basically me, I need functionality when something goes wrong
 */
@injectable()
export class Stakeholder {
  #i18n = inject(I18nService);
  #logger = inject(Logger);
  #fileSystem = inject(FileSystem);
  #producer = inject(Producer);
  #publisher = inject(Publisher);

  async checkPublications(last = 5, expectedCount = 541) {
    const publisher = this.#publisher();
    const fs = this.#fileSystem();
    const logger = this.#logger();

    let message = `\nLast ${last} unpublished publications:`;

    try {
      const inventory = await publisher.getInventory();
      const drafts = await inventory.getDrafs();

      // TODO? instead of sorting just take the last?
      const unpublished = drafts.sort((a, b) => b.created - a.created).slice(0, last);

      if (unpublished.length === 0) {
        return '\nNo unpublished publications found.';
      }

      for (const pub of unpublished) {
        const folderName = this.getFrameFolderName(pub);
        let fileCount = 0;
        let missing: number[] = [];
        try {
          const repoDir = fs.dir(folderName);
          const files = await repoDir.list();
          fileCount = files.length;
          if (fileCount !== expectedCount) {
            missing = await this.getMissingFrames(files, expectedCount);
          }
        } catch (e) {
          if (!(e instanceof Error && 'code' in e)) {
            throw e;
          }
          logger.log(
            `[error][${folderName}] Could not list files -`,
            e.code === 'ENOENT' ? 'directory does not exist (anymore)' : e.code
          );
          fileCount = -1;
        }

        message += `\n- ${pub.type}-${pub.name}: ${fileCount} files`;
        if (missing.length > 0) {
          message += ` (missing ${missing.length}: ${missing.slice(0, 10).join(', ')}${
            missing.length > 10 ? ', ...' : ''
          })`;
        }
      }
    } catch (e) {
      logger.log('Error checking publications', e);
      message += '\nError checking publications. See logs for details.';
    }

    return message;
  }

  async getPublicationByName(name: string) {
    const inventory = await this.#publisher().getInventory();
    return inventory.getDraftByName(name);
  }

  getFramePrefixFromFiles(files: string[]) {
    if (files.length < 2) {
      return '';
    }
    const splitName = files[1].split('-');
    splitName.pop();
    return splitName.join('-');
  }

  async getMissingFrames(files: string[], expectedCount: number) {
    if (files.length < 2) {
      return [-1];
    }
    const missing: number[] = [];
    const prefix = this.getFramePrefixFromFiles(files);
    const l = expectedCount.toString().length;
    for (let i = 1; i <= expectedCount; i++) {
      const fileName = `${prefix}-${String(i).padStart(l, '0')}.jpg`;
      if (!files.includes(fileName)) {
        missing.push(i);
      }
    }
    return missing;
  }

  /**
   * On the 19. & 20.9.2025, quite a few frames were missing due to unclear reasons.
   * This could fix missing frames by copying previous ones...
   */
  async fixFrames(folderName: string, missing: number[], prefix: string, counterLength: number) {
    const dir = this.#fileSystem().dir(folderName);
    // copy previous frame even for consecutively missing frames
    for (const i of missing) {
      const fileName = `${prefix}-${String(i).padStart(counterLength, '0')}.jpg`;
      const previousFrameFile = dir.join(
        `${prefix}-${String(i - 1).padStart(counterLength, '0')}.jpg`
      );
      await dir.copyFile(previousFrameFile, fileName);
      this.#logger().log(`[fix][${folderName}] Created missing frame ${fileName}`);
    }
  }

  getFrameFolderName(pub: Publication) {
    return `${pub.type}-${pub.name.slice(0, 10)}`;
  }
  getVideoFolderName(pub: Publication) {
    return `${pub.type}-${pub.name.slice(0, 7)}`;
  }

  async redraftLatest(chat: ChatMessenger, index = 0) {
    const publisher = this.#publisher();
    const inventory = await publisher.getInventory();
    const drafts = await inventory.getDrafs();
    const pub = drafts.sort((a, b) => b.created - a.created)[index];
    const message = await this.redraft(chat, pub);
    return message;
  }

  async redraft(chat: ChatMessenger, pub: Publication) {
    const { t } = this.#i18n();
    const fs = this.#fileSystem();
    const producer = this.#producer();
    const message = await producer.createAnimation(chat, 'Loading...');
    const langKey = (pub.type + '.title') as 'timelapse.title' | 'sunset.title' | 'shot.title';
    const caption = t(langKey, new Date(pub.created));
    await message.editMedia({
      type: 'animation',
      caption,
      media: producer.getMedia(pub.name + '.mp4', fs.dir(this.getVideoFolderName(pub))),
      // TODO buttons
    });
    // TODO reinsert new publication message, copy attributes (and likes?) from old one
    return message;
  }

  getVideoFolderNameFromName(name: string) {
    const [type, ...rest] = name.split('-');
    const n = rest.join('-');
    return `${type}-${n.slice(0, 7)}`;
  }
  getDateFromName(name: string) {
    const [prefix, minutes] = name.split('--');
    const [_, ...days] = prefix.split('-');
    const d = days.join('-');
    const m = minutes.replace('-', ':');
    // 2023-10-05--14-30 -> 2023-10-05T14:30:00Z
    return new Date(`${d}T${m}:00Z`);
  }

  async redraftByName(chat: ChatMessenger, name: string) {
    const { t } = this.#i18n();
    const fs = this.#fileSystem();
    const producer = this.#producer();
    const message = await producer.createAnimation(chat, 'Loading...');
    const type = name.startsWith('sunset-')
      ? 'sunset'
      : name.startsWith('timelapse-')
      ? 'timelapse'
      : 'shot';
    const langKey = (type + '.title') as 'timelapse.title' | 'sunset.title' | 'shot.title';
    const caption = t(langKey, this.getDateFromName(name));
    await message.editMedia({
      type: 'animation',
      caption,
      media: producer.getMedia(name + '.mp4', fs.dir(this.getVideoFolderNameFromName(name))),
      // TODO buttons
    });
    // TODO reinsert new publication message, copy attributes (and likes?) from old one
    return message;
  }
}
