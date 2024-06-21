import { PhiloScene } from './context.js';
import { Assets, Camera, Director } from './services/index.js';

export function setupPhotoControl(scene: PhiloScene) {
  scene.command(['random', 'r'], (ctx) => {
    const assets = ctx.di.get(Assets);
    ctx.replyWithPhoto(assets.randomImage.media);
  });
  scene.command(['photo', 'p'], async (ctx) => {
    const director = ctx.di.get(Director);
    const photo = await director.photo('default');
    if (photo) {
      ctx.replyWithPhoto(photo);
    }
  });
  scene.command(['animation', 'a'], (ctx) => {
    ctx.replyWithAnimation(ctx.di.get(Assets).spinnerAnimation.media);
  });
}
