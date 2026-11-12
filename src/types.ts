export interface Entry {
  id: number;
  project: string;
  note: string;
  start: number;
  end: number;
}

export interface Activity {
  id: number;
  app: string;
  title: string;
  kind: string;
  start: number;
  end: number;
}

export interface Dashboard {
  startupEnabled: boolean;
  startupAvailable: boolean;
  paused: boolean;
  captureTitles: boolean;
  shortcut: string;
  shortcutError: string | null;
  captureError: string | null;
  databasePath: string;
  entries: Entry[];
  projects: string[];
  activity: Activity[];
}
