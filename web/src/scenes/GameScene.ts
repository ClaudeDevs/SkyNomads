import Phaser from 'phaser';
import { cartesianToIso, isoToCartesian, getTileCoordinate, TILE_W, TILE_H } from '../utils/IsoMath';
import { network } from '../network/NakamaClient';

const MAP_RADIUS = 5;

export class GameScene extends Phaser.Scene {
  private players: Map<string, Phaser.GameObjects.Graphics> = new Map();
  private localPlayerId: string = "";
  private myPlayerSprite?: Phaser.GameObjects.Graphics;
  
  // Movement logic (OSRS style straight line)
  private hasTarget = false;
  private targetIso = { x: 0, y: 0 };
  private moveSpeed = 120; // units per second
  
  private highlightGraphics!: Phaser.GameObjects.Graphics;

  constructor() {
    super('GameScene');
  }

  create() {
    this.cameras.main.setBackgroundColor('#8b9bb4'); // Similar to kintara background

    // Center camera
    this.cameras.main.centerOn(0, 0);
    this.cameras.main.setZoom(1.5);

    // Render Island Grid (Diamond / Square Isometric)
    this.renderIsland();

    // Setup input
    this.highlightGraphics = this.add.graphics();
    this.highlightGraphics.setDepth(1);

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      // Calculate world point from screen pointer
      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      
      // Convert clicked world (iso) point to cartesian map coordinate
      const cartesian = isoToCartesian({ x: worldPoint.x, y: worldPoint.y });
      const tile = getTileCoordinate(cartesian);

      // Check bounds
      if (Math.abs(tile.x) > MAP_RADIUS || Math.abs(tile.y) > MAP_RADIUS) {
        return; // Clicked outside island
      }

      // Convert back to precise center of the tile in iso space
      const centerIso = cartesianToIso({ x: tile.x, y: tile.y });
      
      this.targetIso = centerIso;
      this.hasTarget = true;
      
      // Draw highlight
      this.highlightGraphics.clear();
      this.highlightGraphics.fillStyle(0xffff00, 0.4);
      this.drawDiamond(this.highlightGraphics, centerIso.x, centerIso.y);

      // Tell server we want to move
      network.sendMove(centerIso.x, centerIso.y);
    });

    // Handle Network Events
    network.onWorldSnapshot = (data: any) => {
      this.localPlayerId = network.session.user_id;
      for (const p of data.players) {
        this.addPlayer(p.id, p.x, p.y);
      }
    };

    network.onPlayerJoined = (p: any) => {
      this.addPlayer(p.id, p.x, p.y);
    };

    network.onPlayerLeft = (id: string) => {
      const g = this.players.get(id);
      if (g) {
        g.destroy();
        this.players.delete(id);
      }
    };

    network.onMoveBroadcast = (data: any) => {
      // If it's another player, just snap them for now (would interpolate in real game)
      if (data.id !== this.localPlayerId) {
        const g = this.players.get(data.id);
        if (g) {
          g.setPosition(data.x, data.y);
          g.setDepth(data.y); // depth sort
        }
      }
    };
  }

  update(time: number, delta: number) {
    if (!this.myPlayerSprite) return;

    if (this.hasTarget) {
      const dx = this.targetIso.x - this.myPlayerSprite.x;
      const dy = this.targetIso.y - this.myPlayerSprite.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 4) {
        // Arrived
        this.hasTarget = false;
        this.myPlayerSprite.setPosition(this.targetIso.x, this.targetIso.y);
        this.highlightGraphics.clear();
      } else {
        // Move towards
        const dt = delta / 1000.0;
        const vx = (dx / dist) * this.moveSpeed * dt;
        const vy = (dy / dist) * this.moveSpeed * dt;
        
        this.myPlayerSprite.x += vx;
        this.myPlayerSprite.y += vy;
      }
      
      this.myPlayerSprite.setDepth(this.myPlayerSprite.y);
      this.cameras.main.centerOn(this.myPlayerSprite.x, this.myPlayerSprite.y);
    }
  }

  private addPlayer(id: string, x: number, y: number) {
    const p = this.add.graphics();
    p.fillStyle(id === this.localPlayerId ? 0x32b0ff : 0xff5555, 1);
    // Draw simple character placeholder (a rectangle standing on the tile)
    p.fillRect(-10, -40, 20, 40);
    p.setPosition(x, y);
    p.setDepth(y); // simple depth sorting
    this.players.set(id, p);

    if (id === this.localPlayerId) {
      this.myPlayerSprite = p;
    }
  }

  private renderIsland() {
    const g = this.add.graphics();
    g.lineStyle(1, 0x000000, 0.2);

    for (let x = -MAP_RADIUS; x <= MAP_RADIUS; x++) {
      for (let y = -MAP_RADIUS; y <= MAP_RADIUS; y++) {
        const iso = cartesianToIso({ x, y });
        g.fillStyle(0x71a53f, 1); // Grass color
        this.drawDiamond(g, iso.x, iso.y);
        g.strokePath();
      }
    }
  }

  private drawDiamond(g: Phaser.GameObjects.Graphics, x: number, y: number) {
    const hw = TILE_W / 2;
    const hh = TILE_H / 2;
    g.beginPath();
    g.moveTo(x, y - hh); // top
    g.lineTo(x + hw, y); // right
    g.lineTo(x, y + hh); // bottom
    g.lineTo(x - hw, y); // left
    g.closePath();
    g.fillPath();
  }
}
