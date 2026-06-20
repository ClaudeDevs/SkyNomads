import Phaser from 'phaser';
import { cartesianToIso, isoToCartesian, getTileCoordinate, TILE_W, TILE_H } from '../utils/IsoMath';
import { network } from '../network/NakamaClient';

const MAP_RADIUS = 5;

export class GameScene extends Phaser.Scene {
  private players: Map<string, Phaser.GameObjects.Container> = new Map();
  private localPlayerId: string = "";
  private myPlayerSprite?: Phaser.GameObjects.Container;

  private hasTarget = false;
  private targetIso = { x: 0, y: 0 };
  private moveSpeed = 120;

  private highlightGraphics!: Phaser.GameObjects.Graphics;
  private treeSprites: Map<string, Phaser.GameObjects.Image> = new Map();

  constructor() {
    super('GameScene');
  }

  preload() {
    this.load.image('grass_tile', '/assets/grass_tile.png');
    this.load.image('dirt_tile', '/assets/dirt_tile.png');
    this.load.image('tree', '/assets/tree.png');
    this.load.image('player', '/assets/player.png');
  }

  create() {
    this.cameras.main.setBackgroundColor('transparent');
    document.body.style.background = 'radial-gradient(circle at center, #2b3b55 0%, #0d1423 100%)';
    this.cameras.main.centerOn(0, 0);
    this.cameras.main.setZoom(1.5);

    this.renderIsland();

    this.highlightGraphics = this.add.graphics();
    this.highlightGraphics.setDepth(1000);

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const cartesian = isoToCartesian({ x: worldPoint.x, y: worldPoint.y });
      const tile = getTileCoordinate(cartesian);
      if (Math.abs(tile.x) > MAP_RADIUS || Math.abs(tile.y) > MAP_RADIUS) return;
      const centerIso = cartesianToIso({ x: tile.x, y: tile.y });
      this.targetIso = centerIso;
      this.hasTarget = true;
      this.highlightGraphics.clear();
      this.highlightGraphics.fillStyle(0xffffff, 0.4);
      this.drawDiamond(this.highlightGraphics, centerIso.x, centerIso.y - 10);
      network.sendMove(centerIso.x, centerIso.y); // no-op offline (guards on match)
    });

    // --- Spawn a LOCAL player immediately so the game is playable with no server ---
    this.localPlayerId = "local";
    this.addPlayer("local", 0, 0);

    // When the server connects, re-key our local player to the real user id.
    network.onWorldSnapshot = (data: any) => {
      const myId = network.session?.user_id || "local";
      if (myId !== this.localPlayerId) {
        const mine = this.players.get(this.localPlayerId);
        if (mine) { this.players.delete(this.localPlayerId); this.players.set(myId, mine); }
        this.localPlayerId = myId;
        this.myPlayerSprite = mine ?? this.myPlayerSprite;
      }
      for (const p of data.players) {
        if (p.id !== myId && !this.players.has(p.id)) this.addPlayer(p.id, p.x, p.y);
      }
    };

    network.onNodesSnapshot = (data: any) => {
      for (const n of data.nodes) {
        if (n.type === 'tree') {
          const iso = cartesianToIso({ x: n.x, y: n.y });
          const treeSprite = this.add.image(iso.x, iso.y - 10, 'tree');
          treeSprite.setOrigin(0.5, 1);
          treeSprite.setDepth(iso.y + 10);
          this.treeSprites.set(n.id, treeSprite);
        }
      }
    };

    network.onNodeState = (data: any) => {
      const sprite = this.treeSprites.get(data.node_id);
      if (sprite) sprite.setVisible(data.available);
    };

    network.onPlayerJoined = (p: any) => {
      if (p.id !== this.localPlayerId && !this.players.has(p.id)) this.addPlayer(p.id, p.x, p.y);
    };

    network.onPlayerLeft = (id: string) => {
      const g = this.players.get(id);
      if (g) { g.destroy(); this.players.delete(id); }
    };

    network.onMoveBroadcast = (data: any) => {
      if (data.id !== this.localPlayerId) {
        const g = this.players.get(data.id);
        if (g) { g.setPosition(data.x, data.y); g.setDepth(data.y); }
      }
    };
  }

  update(_time: number, delta: number) {
    if (!this.myPlayerSprite) return;

    if (this.hasTarget) {
      const dx = this.targetIso.x - this.myPlayerSprite.x;
      const dy = this.targetIso.y - this.myPlayerSprite.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 4) {
        this.hasTarget = false;
        this.myPlayerSprite.setPosition(this.targetIso.x, this.targetIso.y - 10);
        this.highlightGraphics.clear();
      } else {
        const dt = delta / 1000.0;
        this.myPlayerSprite.x += (dx / dist) * this.moveSpeed * dt;
        this.myPlayerSprite.y += (dy / dist) * this.moveSpeed * dt;
      }

      const bounce = Math.abs(Math.sin(_time / 100)) * 5;
      this.myPlayerSprite.each((child: any) => {
        if (child.name === 'body') child.y = -40 - bounce;
      });

      this.myPlayerSprite.setDepth(this.myPlayerSprite.y + 100);
      this.cameras.main.centerOn(this.myPlayerSprite.x, this.myPlayerSprite.y);
    }
  }

  private addPlayer(id: string, x: number, y: number) {
    const container = this.add.container(x, y - 10);

    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.4);
    shadow.fillEllipse(0, 0, 24, 12);
    container.add(shadow);

    const p = this.add.image(0, -20, 'player');
    p.name = 'body';
    p.setOrigin(0.5, 1);
    container.add(p);

    if (id !== this.localPlayerId) p.setTint(0xff8888);

    container.setDepth(y + 100);
    this.players.set(id, container);

    if (id === this.localPlayerId) this.myPlayerSprite = container;
  }

  private renderIsland() {
    const tiles: { x: number; y: number }[] = [];
    for (let x = -MAP_RADIUS; x <= MAP_RADIUS; x++) {
      for (let y = -MAP_RADIUS; y <= MAP_RADIUS; y++) {
        tiles.push({ x, y });
      }
    }
    tiles.sort((a, b) => (a.x + a.y) - (b.x + b.y));

    for (const t of tiles) {
      const iso = cartesianToIso({ x: t.x, y: t.y });
      const tile = this.add.image(iso.x, iso.y, 'grass_tile');
      tile.setOrigin(0.5, 0.5);
      tile.setDepth(iso.y);
    }
  }

  private drawDiamond(g: Phaser.GameObjects.Graphics, x: number, y: number) {
    const hw = TILE_W / 2;
    const hh = TILE_H / 2;
    g.beginPath();
    g.moveTo(x, y - hh);
    g.lineTo(x + hw, y);
    g.lineTo(x, y + hh);
    g.lineTo(x - hw, y);
    g.closePath();
    g.fillPath();
  }
}
