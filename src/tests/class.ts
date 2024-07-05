const tree = "🌳";

export default class DefaultClass {
  public static foo: string = tree;
  public bar: string[] = [];

  constructor(baz: number[]) {
    this.bar = baz.map((n) => DefaultClass.foo.repeat(n));
  }
}

export class NamedClass extends DefaultClass {
  private static version: number = 1;

  get version() {
    return NamedClass.version;
  }

  constructor() {
    super([1, 2, 3]);
  }

  double() {
    this.bar = this.bar.map((n) => n.repeat(2));
  }

  private triple() {
    this.bar = this.bar.map((n) => n.repeat(3));
  }

  protected quadruple() {
    this.bar = this.bar.map((n) => n.repeat(4));
  }

  public octuple() {
    for (let i = 0; i < 2; i++) {
      this.quadruple();
    }
  }
}

export { DefaultClass };
