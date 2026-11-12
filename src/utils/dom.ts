export const el = <T extends HTMLElement = HTMLElement>(id: string): T =>
  document.getElementById(id) as T;

export const input = (id: string) => el<HTMLInputElement>(id);

export function textNode(tag: string, value: string, className = "") {
  const node = document.createElement(tag);
  node.textContent = value;
  node.className = className;
  return node;
}
