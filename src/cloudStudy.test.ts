import { describe, expect, it, MockInstance, vi } from 'vitest';
import {
  Appraisement,
  Appraiser,
  createInjectorWithStubbedDependencies,
  Directory,
  FileSystem,
  Injector,
  LIKE,
  Logger,
  PublicationInventory,
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
          //console.log('CREATE DIR', path);
          // skip actual folder creation
          const dir = Object.create(new Directory(injector.get(Logger), fs, path));
          // cache file contents
          let dataCache: any = null;
          dir.saveJSON = vi.fn((fileName: string, data: any) => {
            //console.log('save', fileName, data);
            dataCache = data;
          });
          dir.readJSON = vi.fn((fileName: string) => {
            //console.log('read', fileName, dataCache);
            return dataCache;
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
        const decorated = new Appraiser(DIR);
        //return decorated;
        const appraiser = Object.create(decorated);

        appraiser.loadOrCreate = async (fileName: string) => {
          const dir = await injector.get(FileSystem).createDirectory(DIR);
          //const inventory = await decorated.loadOrCreate(fileName);
          const inventory = new Appraisement(dir, injector.get(Logger), fileName);
          spies[fileName] = vi.spyOn(inventory, 'addAppraisal');
          return inventory;
        };
        return appraiser;
      },
    },
    {
      provide: PublicationInventoryStorage,
      factory(injector) {
        const decorated = new PublicationInventoryStorage(DIR);
        return decorated;
        const storage = Object.create(decorated);

        storage.loadOrCreate = async (fileName: string) => {
          //const dir = await injector.get(FileSystem).createDirectory(DIR);
          const inventory = await decorated.loadOrCreate(fileName);
          //new PublicationInventory(dir, injector.get(Logger), fileName);
          spies[fileName] = vi.spyOn(inventory, 'readIndex');
          return inventory;
        };
        return storage;
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
    const publisher = createInjectorSpies().injector.get(Publisher);

    const cloud = await publisher.saveCloudStudy(-111, 'c');
    expect(cloud).toEqual('Message Inventory [-111] not found');
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
    const like = LIKE.HEART;
    const pubs = await publications.loadOrCreate(publisher.publicationsFile);
    await pubs.setMessage(messageId, {
      id: messageId,
      name,
      created: Date.now(),
    });

    expect(publisher.callbackMessageShare).toBeDefined();
    const liking = await publisher.like(messageId, author, `like-${like}`);
    expect(spies[publisher.appraisalsFile]).toHaveBeenCalledWith(name, { author, like, rating: 1 });
    expect(liking).toEqual(like);
  });
  it('takes over when timelapses (or great shots) are to be published', async () => {
    const { injector, spies } = createInjectorSpies();
    const publisher = injector.get(Publisher);
    //const publications = injector.get(PublicationInventoryStorage);
    const chat = {
      sendMessageCopy: vi.fn(async () => {
        return {
          message_id: channelMessageId,
        };
      }),
    } as unknown as ChatMessenger;
    const messageId = -111;
    const channelMessageId = -222;

    expect(publisher.callbackMessageShare).toBeDefined();
    const cid = await publisher.publish(chat, messageId);
    expect(chat.sendMessageCopy).toHaveBeenCalledOnce();
    expect(cid).toEqual(channelMessageId);
    //expect(spies[publisher.publicationsFile]).toHaveBeenCalledOnce();
    expect(spies[DIR]).toHaveBeenCalledWith(publisher.publicationsFile, {
      messages: {},
      name: 'publications-2024.json',
      publications: {
        '-222': -111,
      },
      version: 'Publication-1',
    });
  });
});
