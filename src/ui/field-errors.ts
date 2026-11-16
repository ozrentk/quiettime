export class FieldValidationError extends Error {
  constructor(
    public readonly field: string,
    message: string,
  ) {
    super(message);
  }
}

export function displayError(target: HTMLElement, error: unknown) {
  target.textContent =
    error instanceof Error ? error.message : String(error ?? "");
  target.hidden = !target.textContent;
  if (error instanceof FieldValidationError)
    target.dataset.errorField = error.field;
  else delete target.dataset.errorField;
}

export function clearFieldError(field: string) {
  for (const node of document.querySelectorAll<HTMLElement>(
    "[data-error-field]",
  )) {
    if (node.dataset.errorField !== field) continue;
    node.textContent = "";
    node.hidden = true;
    delete node.dataset.errorField;
  }
}
