// Minimal typings for the Web NFC API (Android Chrome only; not in TypeScript's DOM lib yet).
interface NDEFRecord {
  recordType: string;
  mediaType?: string;
  encoding?: string;
  data?: DataView;
}

interface NDEFMessage {
  records: NDEFRecord[];
}

interface NDEFReadingEvent extends Event {
  serialNumber: string;
  message: NDEFMessage;
}

interface NDEFWriteRecord {
  recordType: string;
  data: string;
}

declare class NDEFReader extends EventTarget {
  scan(options?: { signal?: AbortSignal }): Promise<void>;
  write(message: string | { records: NDEFWriteRecord[] }, options?: { overwrite?: boolean; signal?: AbortSignal }): Promise<void>;
  onreading: ((event: NDEFReadingEvent) => void) | null;
  onreadingerror: ((event: Event) => void) | null;
}
