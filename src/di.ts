import { inject, injectable, Injector } from '@joist/di';
import { assert } from 'console';

@injectable
class MyService {
  constructor() {
    console.log('MyService created');
  }

  sum() {
    return 42;
  }
}

@injectable
class MyServiceStub extends MyService {
  constructor() {
    super();
    console.log('MyStub created actually');
  }

  sum() {
    return 1;
  }
}

@injectable
class MyOtherService {
  #service = inject(MyService);
  constructor() {
    console.log('MyOtherService created');
  }

  async sum() {
    return this.#service().sum();
  }
}

const injector = new Injector([]);

const myService = injector.get(MyOtherService);
assert((await myService.sum()) === 42, 'unstubbed');

const injectorStub = new Injector(
  [
    { provide: MyService, use: MyServiceStub },
    { provide: MyOtherService, use: MyOtherService },
  ],
  injector
);

const myStub = injectorStub.get(MyService);
const myStud = injectorStub.get(MyOtherService);
assert((await myStub.sum()) === 1, 'stubbed');
assert((await myStud.sum()) === 1, 'studded');
