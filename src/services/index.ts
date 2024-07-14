export * from './FileSystem.js';
export * from './Git.js';
export * from './Logger.js';
export * from './Repository.js';
export * from './Camera.js';
export * from './CameraStub.js';
export * from './SunMoonTime.js';
export * from './Hardware.js';
export * from './Timelapse.js';
export * from './TimelapseVideoRendererStub.js';
export * from './Assets.js';
export * from './Preset.js';
export * from './Director.js';
export * from './Producer.js';

export * from '@joist/di';
import { Injector, Provider } from '@joist/di';
import { consoleProvider } from './Logger.js';
import { cameraStubProvider } from './CameraStub.js';
import { rendererStubProvider } from './TimelapseVideoRendererStub.js';

export function createInjector(providers: Provider<any>[] = []) {
  return new Injector([...providers, consoleProvider]);
}

export function createInjectorWithStubbedDependencies(providers: Provider<any>[] = []) {
  return createInjector([...providers, cameraStubProvider, rendererStubProvider]);
}
