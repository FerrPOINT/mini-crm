const owners = new WeakMap<HTMLElement, { count: number; wasInert: boolean }>();

export function suppressBackgroundInteraction(content: HTMLElement) {
  const body = content.ownerDocument.body;
  const keep = [content, ...body.querySelectorAll('[aria-live], [data-radix-focus-guard], script')];
  const acquired: HTMLElement[] = [];
  function visit(parent: Element) {
    for (const child of parent.children) {
      if (keep.some((target) => child === target)) continue;
      if (keep.some((target) => child.contains(target))) visit(child);
      else if (child instanceof content.ownerDocument.defaultView!.HTMLElement) {
        const owner = owners.get(child) ?? { count: 0, wasInert: child.inert };
        owner.count++;
        owners.set(child, owner);
        if (!owner.wasInert) child.inert = true;
        acquired.push(child);
      }
    }
  }
  visit(body);
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    for (const element of acquired) {
      const owner = owners.get(element)!;
      if (--owner.count === 0) {
        if (!owner.wasInert) element.inert = false;
        owners.delete(element);
      }
    }
  };
}
