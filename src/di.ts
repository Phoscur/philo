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

  demo = 2;
}
@injectable
class UtilityService {
  #service = inject(MyService);
  ergo() {
    return this.#service().sum();
  }
}

@injectable
class UtilService {
  #service = inject(MyService);
  ergo() {
    return this.#service().sum();
  }
}

@injectable
class MyOtherService {
  #service = inject(MyService);
  #utility = inject(UtilityService);
  #util = inject(UtilService);
  constructor() {
    console.log('MyOtherService created');
  }

  async sum() {
    this.#utility().ergo();
    this.#util().ergo();
    return this.#service().sum();
  }
}

const injector = new Injector([]);

const myService = injector.get(MyOtherService);
assert((await myService.sum()) === 42, 'unstubbed');

const injectorStub = new Injector([{ provide: MyService, use: MyServiceStub }]);

const myStub = injectorStub.get(MyOtherService);
const myStud = injectorStub.get(UtilityService);
const myStudd = injectorStub.get(UtilService);
assert((await myStub.sum()) === 1, 'stubbed');
assert(myStud.ergo() === 1, 'stubbed');
assert(myStudd.ergo() === 1, 'stubbed');
