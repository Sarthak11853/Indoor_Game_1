// Socket.IO event names and payloads. Both sides import these interfaces,
// so a renamed or reshaped event is a compile error on both ends.

export interface ServerInfo {
  name: string;
  serverTime: number;
}

export interface ClientToServerEvents {
  hello: (ack: (info: ServerInfo) => void) => void;
}

export interface ServerToClientEvents {
  serverInfo: (info: ServerInfo) => void;
}
