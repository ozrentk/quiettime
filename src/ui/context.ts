import type { Dashboard } from "../types";
import type { RunOptions } from "./action-runner";

export interface UIContext {
  native: boolean;
  isBusy(): boolean;
  getData(): Dashboard | undefined;
  run(work: () => Promise<void>, options?: RunOptions): Promise<void>;
  refresh(): Promise<void>;
}
