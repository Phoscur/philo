import { describe, expect, it, MockInstance, vi } from 'vitest';
import {
  Appraiser,
  CLOUD,
  createInjectorWithStubbedDependencies,
  Directory,
  FileSystem,
  Injector,
  LIKE,
  Logger,
  PublicationInventoryStorage,
  Publisher,
} from './services/index.js';
import { ChatMessenger } from './context.js';

const DIR = 'storage-test-cloud-study';

function createInjectorSpies() {
  const spies: Record<string, MockInstance> = {};
  const directories: Record<string, Directory> = {};
  const injector = createInjectorWithStubbedDependencies([
    {
      provide: FileSystem,
      factory(injector: Injector) {
        const fs = Object.create(new FileSystem());
        fs.createDirectory = async (path: string) => {
          if (directories[path]) {
            return directories[path];
          }
          // skip actual folder creation
          const dir = Object.create(new Directory(injector.get(Logger), fs, path));
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
        };

        return fs;
      },
    },
    {
      provide: Appraiser,
      factory(injector) {
        return new Appraiser(DIR);
      },
    },
    {
      provide: PublicationInventoryStorage,
      factory(injector) {
        return new PublicationInventoryStorage(DIR);
      },
    },
  ]);
  return {
    injector,
    spies,
    directories,
  };
}

describe('CloudStudy', () => {
  it('is saved by the Publisher', async () => {
    const { injector } = createInjectorSpies();
    const publisher = injector.get(Publisher);

    const cloud = await publisher.saveCloudStudy(-111, 'c');
    expect(cloud).toEqual('Message Inventory [-111] not found');
  });
  it('is saved by the Publisher when found', async () => {
    const { injector } = createInjectorSpies();
    const publisher = injector.get(Publisher);
    const publications = injector.get(PublicationInventoryStorage);
    const name = 'timelapse-test';
    const messageId = -111;
    const created = Date.now();
    const cloud = CLOUD.Y;

    const pubs = await publications.loadOrCreate(publisher.publicationsFile);
    await pubs.setMessage(messageId, {
      messageId,
      name,
      created,
    });

    const cloudStudy = await publisher.saveCloudStudy(-111, `cloud-${cloud}`);
    expect(cloudStudy).toEqual(cloud);
    const appraisals = await injector.get(Appraiser).loadOrCreate(publisher.appraisalsFile, true);
    expect(appraisals.prettyIndex).toBe(`{\n  "${name}": "${cloud}#0"\n}`);
  });
});

describe('Publisher', () => {
  it('collects appraisals (likes)', async () => {
    const { injector, spies } = createInjectorSpies();
    const publisher = injector.get(Publisher);
    const publications = injector.get(PublicationInventoryStorage);
    const author = 'Phoscur';
    const name = 'timelapse-test';
    const messageId = -111;
    const created = Date.now();
    const like = LIKE.HEART;
    const pubs = await publications.loadOrCreate(publisher.publicationsFile);
    await pubs.setMessage(messageId, {
      messageId,
      name,
      created,
    });

    expect(publisher.callbackMessageShare).toBeDefined();
    const liking = await publisher.like(messageId, author, `like-${like}`);
    expect(liking).toEqual(like);
    expect(spies[DIR]).toHaveBeenCalledWith(publisher.publicationsFile, {
      messages: {
        '-111': {
          messageId,
          name,
          created,
        },
      },
      name: 'publications-2024.json',
      publications: {},
      version: 'Publication-1',
    });
    expect(spies[DIR]).toHaveBeenCalledWith(publisher.appraisalsFile, {
      name: 'appraisals-2024.json',
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
    } as unknown as ChatMessenger;
    const messageId = -111;
    const channelMessageId = -222;
    const name = 'timelapse-publication-test';
    const created = Date.now();
    const pubs = await publications.loadOrCreate(publisher.publicationsFile);
    await pubs.setMessage(messageId, {
      messageId,
      name,
      created,
    });
    expect(spies[DIR]).toHaveBeenCalledWith(publisher.publicationsFile, {
      messages: {
        '-111': {
          messageId,
          name,
          created,
        },
      },
      name: 'publications-2024.json',
      publications: {},
      version: 'Publication-1',
    });

    expect(publisher.callbackMessageShare).toBeDefined();
    const cid = await publisher.publish(chat, messageId);
    expect(chat.sendMessageCopy).toHaveBeenCalledOnce();
    expect(cid).toEqual(channelMessageId);
    expect(spies[DIR]).toHaveBeenCalledWith(publisher.publicationsFile, {
      messages: {
        '-111': {
          messageId,
          name,
          created,
          channelMessageId,
        },
      },
      name: 'publications-2024.json',
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
