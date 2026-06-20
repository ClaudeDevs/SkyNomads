import { Client, Session, Socket, Match } from '@heroiclabs/nakama-js';
import { OpCode } from './Opcodes';

export class NakamaClient {
  public client: Client;
  public session!: Session;
  public socket!: Socket;
  public match!: Match;
  private _useSSL = false;

  public onPlayerJoined: (player: any) => void = () => {};
  public onPlayerLeft: (userId: string) => void = () => {};
  public onMoveBroadcast: (move: any) => void = () => {};
  public onWorldSnapshot: (data: any) => void = () => {};
  public onNodesSnapshot: (data: any) => void = () => {};
  public onNodeState: (data: any) => void = () => {};
  public onIslandSnapshot: (data: any) => void = () => {};
  public onBuildBroadcast: (data: any) => void = () => {};

  constructor() {
    const env = (import.meta as any).env ?? {};
    const host = env.VITE_NAKAMA_HOST || "127.0.0.1";
    const port = env.VITE_NAKAMA_PORT || "7350";
    this._useSSL = (env.VITE_NAKAMA_SSL || "false") === "true";
    this.client = new Client("defaultkey", host, port, this._useSSL);
  }

  async connect(username: string): Promise<void> {
    this.session = await this.client.authenticateDevice(username, true, username);
    this.socket = this.client.createSocket(this._useSSL, false);
    await this.socket.connect(this.session, true);
    this.socket.onmatchdata = (result) => {
      this.handleMatchData(result);
    };
  }

  async joinIsland(): Promise<void> {
    const result = await this.client.rpc(this.session, "join_island", {});
    const payload = result.payload
      ? (typeof result.payload === 'string' ? JSON.parse(result.payload) : result.payload)
      : null;
    if (payload && payload.match_id) {
      this.match = await this.socket.joinMatch(payload.match_id);
      console.log("Joined island match:", this.match.match_id);
    } else {
      throw new Error("Failed to join island: " + result.payload);
    }
  }

  async getQuests(): Promise<any> {
    const result = await this.client.rpc(this.session, "get_quests", {});
    return result.payload
      ? (typeof result.payload === 'string' ? JSON.parse(result.payload) : result.payload)
      : null;
  }

  async claimQuest(questId: string): Promise<any> {
    const result = await this.client.rpc(this.session, "claim_quest", { quest_id: questId });
    return result.payload
      ? (typeof result.payload === 'string' ? JSON.parse(result.payload) : result.payload)
      : null;
  }

  private handleMatchData(result: any): void {
    const data = JSON.parse(new TextDecoder().decode(result.data));
    switch (result.op_code) {
      case OpCode.PLAYER_JOINED: this.onPlayerJoined(data); break;
      case OpCode.PLAYER_LEFT: this.onPlayerLeft(data.id); break;
      case OpCode.MOVE_BROADCAST: this.onMoveBroadcast(data); break;
      case OpCode.WORLD_SNAPSHOT: this.onWorldSnapshot(data); break;
      case OpCode.NODES_SNAPSHOT: this.onNodesSnapshot(data); break;
      case OpCode.NODE_STATE: this.onNodeState(data); break;
      case OpCode.ISLAND_SNAPSHOT: this.onIslandSnapshot(data); break;
      case OpCode.BUILD_BROADCAST: this.onBuildBroadcast(data); break;
    }
  }

  sendMove(x: number, y: number): void {
    if (!this.match) return;
    this.socket.sendMatchState(this.match.match_id, OpCode.MOVE_REQUEST, JSON.stringify({ x, y }));
  }

  sendBuild(q: number, r: number, itemId: string): void {
    if (!this.match) return;
    this.socket.sendMatchState(this.match.match_id, OpCode.BUILD_REQUEST, JSON.stringify({ q, r, item_id: itemId }));
  }
}

export const network = new NakamaClient();
