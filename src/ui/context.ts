import type { Dashboard } from "../types";

export interface UIContext {
  native: boolean;
  isBusy(): boolean;
  getData(): Dashboard | undefined;
  run(work: () => Promise<void>): Promise<void>;
  refresh(): Promise<void>;
}
