import { describe, expect, it, MockInstance, vi } from 'vitest';
import {
  Appraiser,
  Assets,
  CLOUD,
  createInjectorWithStubbedDependencies,
  Director,
  Directory,
  FileSystem,
  Injector,
  LIKE,
  Logger,
  Producer,
  PublicationInventoryStorage,
  Publisher,
  Repo,
  SunMoonTime,
  TimelapseEventMap,
} from './services/index.js';
import { ChatMessenger } from './context.js';
import EventEmitter from 'node:events';
import { dateFormat } from './i18n.js';

const DIR = 'storage-test-cloud-study';

function createInjectorSpies() {
  const spies: Record<string, MockInstance> = {};
  const emitter = new EventEmitter<TimelapseEventMap>();
  const directories: Record<string, Directory> = {};
  const injector = createInjectorWithStubbedDependencies([
    {
      provide: FileSystem,
      factory(injector: Injector) {
        class MockFileSystem extends FileSystem {
          async createDirectory(path: string) {
            if (directories[path]) {
              return directories[path];
            }
            // skip actual folder creation
            const dir = Object.create(new Directory(injector.get(Logger), this, path));
            // cache file contents
            const dataCache: Record<string, any> = {};
            dir.saveJSON = vi.fn((fileName: string, data: any) => {
              dataCache[fileName] = data;
            });
            dir.readJSON = vi.fn((fileName: string) => {
              return dataCache[fileName] ?? null;
            });
            spies[path] = dir.saveJSON;
            directories[path] = dir;
            return dir;
          }
        }
        return new MockFileSystem();
      },
    },
    {
      provide: Director,
      factory(_injector) {
        class StubDirector extends Director {
          scheduleSunset(onStart: (events: EventEmitter<TimelapseEventMap>, repo: Repo) => void) {
            onStart(emitter, {} as Repo);
          }
        }
        return new StubDirector();
      },
    },
    {
      provide: Appraiser,
      factory(_injector) {
        return new Appraiser(DIR);
      },
    },
    {
      provide: PublicationInventoryStorage,
      factory(_injector) {
        return new PublicationInventoryStorage(DIR);
      },
    },
  ]);
  return {
    injector,
    spies,
    emitter,
    directories,
  };
}

describe('CloudStudy', () => {
  it('is saved by the Publisher', async () => {
    const { injector } = createInjectorSpies();
    const publisher = injector.get(Publisher);

    const cloud = await publisher.saveCloudStudy(-111, 'c');
    expect(cloud).toEqual('Error: Message [-111] not found');
  });
  it('is saved by the Publisher when found', async () => {
    const { injector } = createInjectorSpies();
    const publisher = injector.get(Publisher);
    const appraiser = injector.get(Appraiser);
    const publications = injector.get(PublicationInventoryStorage);
    const name = 'timelapse-test';
    const messageId = -111;
    const created = Number(new Date(2024, 9, 13, 18, 45));
    const cloud = CLOUD.Y;

    const pubs = await publications.loadOrCreate(publisher.publicationsFile);
    await pubs.setDraft(messageId, {
      messageId,
      name,
      type: 'timelapse',
      created,
    });

    const cloudStudy = await publisher.saveCloudStudy(messageId, `cloud-${cloud}`);
    expect(cloudStudy).toEqual(cloud);
    const appraisals = await appraiser.loadOrCreate(publisher.appraisalsFile, true);
    expect(appraisals.prettyIndex).toBe(`{\n  "${name}": "${cloud}#0"\n}`);
    expect(await publisher.getCaption(messageId)).toBe(`🎥${cloud}  13.10.2024 18:45`);
  });

  it('is part of the production, appraisal & publishing process for sunset timelapses', async () => {
    const { injector, emitter } = createInjectorSpies();
    const director = injector.get(Director);
    const producer = injector.get(Producer);
    const publisher = injector.get(Publisher);
    const appraiser = injector.get(Appraiser);
    const assets = injector.get(Assets);
    const fs = injector.get(FileSystem);
    const sunMoon = injector.get(SunMoonTime);

    const name = director.nameNow;
    const messageId = -111;
    const channelMessageId = -222;
    const created = dateFormat();

    const editMedia = vi.fn(async () => {});
    const editCaption = vi.fn(async () => {});
    const editCaptionLater = vi.fn(async () => {}).mockName('editCaptionGroup');
    const editCaptionChannel = vi.fn(async () => {}).mockName('editCaptionChannel');
    const chat = {
      createAnimation: vi.fn(async () => {
        return {
          id: messageId,
          editMedia,
          editCaption,
        };
      }),
      sendMessage: vi.fn(async () => {
        return {
          message_id: messageId,
        };
      }),
      sendMessageCopy: vi.fn(async () => {
        return {
          message_id: channelMessageId,
        };
      }),
      getMessage: vi.fn(() => {
        return {
          messageId: messageId,
          editCaption: editCaptionLater,
        };
      }),
      getChannelMessage: vi.fn(() => {
        return {
          messageId: channelMessageId,
          editCaption: editCaptionChannel,
        };
      }),
    } as unknown as ChatMessenger;

    producer.scheduleDailySunset(chat);
    emitter.emit('started');
    //await Promise.resolve();
    //await Promise.resolve();
    await sunMoon.sleep(0); // = 2x await
    expect(chat.sendMessage).toHaveBeenCalledWith(
      `🌇 Sunset is soon...\n⤵️ Starting daily timelapse 🎥\n💾 Storage (-1): -1\nStubbed Temperature`
    );
    expect(chat.createAnimation).toHaveBeenCalledWith(assets.telegramSpinner, {
      caption: undefined,
    });
    const dir = await fs.createDirectory(name);

    emitter.emit('file', name, dir);
    await producer.settled;
    expect(editMedia).toBeCalledWith(
      {
        caption: `📷 Last Timelapse frame created:\n${name}`,
        media: {
          filename: undefined,
          source: dir.joinAbsolute(name),
        },
        type: 'photo',
      },
      producer.markupCancel
    );
    expect(editMedia).toHaveBeenCalledOnce();

    emitter.emit('frame', name, 'fps');
    await producer.settled;
    expect(editCaption).toBeCalledWith(`🎞️ Rendered Frames: ${name} (fps FPS)`);

    emitter.emit('rendered', name, dir);
    await producer.settled;
    expect(editMedia).toBeCalledWith({
      caption: '🎥  ' + created,
      media: {
        filename: name,
        source: dir.joinAbsolute(name),
      },
      type: 'animation',
    });
    expect(editMedia).toHaveBeenCalledTimes(2);

    const author = 'Phoscur';
    const anotherAuthor = 'NonAnon';
    const like = LIKE.HEART;
    const cloud = CLOUD.LESS;
    await publisher.saveLike(messageId, author, `like-${like}`);
    await publisher.updateCaptions(chat, messageId);
    expect(editCaptionLater).toBeCalledWith(
      `🌇 ${like} ${created} `,
      publisher.getMarkupPublished(true)
    );
    await publisher.saveCloudStudy(messageId, `cloud-${cloud}`);

    const appraisals = await appraiser.loadOrCreate(publisher.appraisalsFile, true);
    expect(appraisals.prettyIndex).toBe(`{\n  "${name}": "${cloud}#1"\n}`);

    await publisher.share(chat, messageId);
    expect(chat.sendMessageCopy).toHaveBeenCalledWith(
      messageId,
      publisher.getMarkupPublished(false, true, true)
    );
    expect(editCaptionLater).toBeCalledTimes(2);

    // same author should stack likes
    await publisher.saveLike(messageId, author, `like-${like}`);
    await publisher.saveLike(messageId, author, `like-${like}`);
    await publisher.saveLike(messageId, anotherAuthor, `like-${like}`);
    await publisher.updateCaptions(chat, messageId);
    expect(editCaptionLater).toBeCalledWith(
      `${cloud}🌇 ${LIKE.GROWING} ${created} - shared ✔️- published ✖️`,
      publisher.getMarkupPublished(false, true)
    );
    expect(editCaptionLater).toBeCalledTimes(3);
    expect(editCaptionChannel).toBeCalledWith(
      `${cloud}🌇 ${LIKE.GROWING} ${created}`,
      publisher.getMarkupPublished(false, true)
    );
    expect(editCaptionChannel).toBeCalledTimes(1);
  });
});

describe('Publisher', () => {
  it('collects appraisals (likes)', async () => {
    const { injector, spies } = createInjectorSpies();
    const publisher = injector.get(Publisher);
    const publications = injector.get(PublicationInventoryStorage);
    const name = 'timelapse-test';
    const messageId = -111;
    // TODO read/merge older likes from the previous year?
    const year = new Date().getFullYear();
    const created = Number(new Date(year, 9, 13, 18, 45));
    const author = 'Phoscur';
    const like = LIKE.HEART;
    const pubs = await publications.loadOrCreate(publisher.publicationsFile);
    await pubs.setDraft(messageId, {
      messageId,
      name,
      type: 'timelapse',
      created,
    });

    expect(publisher.callbackMessageShare).toBeDefined();
    const liking = await publisher.saveLike(messageId, author, `like-${like}`);
    expect(liking).toEqual(like);
    expect(spies[DIR]).toHaveBeenCalledWith(publisher.publicationsFile, {
      messages: {
        '-111': {
          messageId,
          name,
          type: 'timelapse',
          created,
        },
      },
      name: `publications-${year}.json`,
      publications: {},
      version: 'Publication-1',
    });
    expect(spies[DIR]).toHaveBeenCalledWith(publisher.appraisalsFile, {
      name: `appraisals-${year}.json`,
      appraisals: {
        'timelapse-test': {
          votes: [
            {
              author: 'Phoscur',
              like: '❤️',
              rating: 1,
            },
          ],
        },
      },
      version: 'Appraisals-1',
    });
    expect(pubs.prettyIndex).toBe(`{\n  "-111": "not shared"\n}`);
    const appraisals = await injector.get(Appraiser).loadOrCreate(publisher.appraisalsFile, true);
    expect(appraisals.prettyIndex).toBe(`{\n  "${name}": "#1"\n}`);
    expect(await publisher.getCaption(messageId)).toBe(`🎥 ${like} 13.10.${year} 18:45`);
  });
  it('takes over when timelapses (or great shots) are to be published', async () => {
    const { injector, spies } = createInjectorSpies();
    const publisher = injector.get(Publisher);
    const publications = injector.get(PublicationInventoryStorage);
    const chat = {
      sendMessageCopy: vi.fn(async () => {
        return {
          message_id: channelMessageId,
        };
      }),
      getChannelMessage: vi.fn(() => {
        return {
          editCaption: vi.fn(),
        };
      }),
      getMessage: vi.fn(() => {
        return {
          editCaption: vi.fn(),
        };
      }),
    } as unknown as ChatMessenger;
    const messageId = -111;
    const channelMessageId = -222;
    const name = 'timelapse-publication-test';
    const year = new Date().getFullYear();
    const created = Date.now();
    const pubs = await publications.loadOrCreate(publisher.publicationsFile);
    await pubs.setDraft(messageId, {
      messageId,
      name,
      type: 'timelapse',
      created,
    });
    expect(spies[DIR]).toHaveBeenCalledWith(publisher.publicationsFile, {
      messages: {
        '-111': {
          messageId,
          name,
          type: 'timelapse',
          created,
        },
      },
      name: `publications-${year}.json`,
      publications: {},
      version: 'Publication-1',
    });

    expect(publisher.callbackMessageShare).toBeDefined();

    const shared = Date.now();
    vi.setSystemTime(shared); // test can be a bit flaky without mocking Date.now() below

    const cid = await publisher.share(chat, messageId);
    expect(chat.sendMessageCopy).toHaveBeenCalledOnce();
    expect(cid).toEqual(channelMessageId);
    expect(spies[DIR]).toHaveBeenCalledWith(publisher.publicationsFile, {
      messages: {
        '-111': {
          messageId,
          name,
          type: 'timelapse',
          created,
          shared,
          channelMessageId,
        },
      },
      name: `publications-${year}.json`,
      publications: {
        '-222': -111,
      },
      version: 'Publication-1',
    });
    expect(pubs.prettyIndex).toBe(
      `{\n  "-111": "shared as -222",\n  "-222": "shared from -111"\n}`
    );

    await publisher.publish(messageId);
    const published = Date.now();
    expect(spies[DIR]).toHaveBeenCalledWith(publisher.publicationsFile, {
      messages: {
        '-111': {
          messageId,
          name,
          type: 'timelapse',
          created,
          shared,
          channelMessageId,
          published,
        },
      },
      name: `publications-${year}.json`,
      publications: {
        '-222': -111,
      },
      version: 'Publication-1',
    });
    expect(pubs.prettyIndex).toBe(
      `{\n  "-111": "shared as -222",\n  "-222": "shared from -111"\n}`
    );
  });
});
