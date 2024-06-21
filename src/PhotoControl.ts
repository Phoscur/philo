import { PhiloScene } from './context.js';
import { Assets, Camera } from './services/index.js';

export function setupPhotoControl(scene: PhiloScene) {
  scene.command(['photo', 'p'], (ctx) => {
    // const camera = ctx.di.get(Camera);
    const assets = ctx.di.get(Assets);
    ctx.replyWithPhoto(assets.randomImage.media);
  });
  scene.command(['animation', 'a'], (ctx) => {
    ctx.replyWithAnimation(ctx.di.get(Assets).spinnerAnimation.media);
  });
}
