import { describe, expect, it, vi } from 'vitest';
import {
  createInjectorWithStubbedDependencies,
  PublicationInventoryStorage,
  Publisher,
} from './services/index.js';
import { ChatMessenger } from './context.js';

const injector = createInjectorWithStubbedDependencies([
  {
    provide: PublicationInventoryStorage,
    factory() {
      console.log('hum??');
      const d = 'whaaat?';
      const storage = new PublicationInventoryStorage();

      return storage;
    },
  },
]);
/*const camera = injector.get(Camera);
//const camera = injector.get(CameraStub);
(camera as CameraStub).copyMode = true;
const timelapse = injector.get(Timelapse);
const director = injector.get(Director);
const git = injector.get(Git);
const logger = injector.get(Logger);
const fs = injector.get(FileSystem);
const repo = injector.get(Repository);
const archiver = injector.get(Archiver);*/

describe('CloudStudy', () => {
  it('is saved by the Publisher', async () => {
    const publisher = injector.get(Publisher);

    const cloud = await publisher.saveCloudStudy(-111, 'c');
    expect(cloud).toEqual('Message Inventory [-111] not found');
  });
});

describe('Publisher', () => {
  it('takes over when timelapses (or great shots) to be published', async () => {
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

    expect(publisher.callbackMessageShare).toBeDefined();
    const cid = await publisher.publish(chat, messageId);
    expect(chat.sendMessageCopy).toHaveBeenCalledOnce();
    expect(cid).toEqual(channelMessageId);
  });
});
