import Phaser from 'phaser';
import { cartesianToIso, isoToCartesian, getTileCoordinate, TILE_W, TILE_H } from '../utils/IsoMath';
import { network } from '../network/NakamaClient';

const MAP_RADIUS = 5;

export class GameScene extends Phaser.Scene {
  private players: Map<string, Phaser.GameObjects.Container> = new Map();
  private localPlayerId: string = "";
  private myPlayerSprite?: Phaser.GameObjects.Container;
  
  // Movement logic (OSRS style straight line)
  private hasTarget = false;
  private targetIso = { x: 0, y: 0 };
  private moveSpeed = 120; // units per second
  
  private highlightGraphics!: Phaser.GameObjects.Graphics;

  constructor() {
    super('GameScene');
  }

  create() {
    // Create a beautiful premium background gradient using HTML CSS on the parent container,
    // and make the Phaser background transparent.
    this.cameras.main.setBackgroundColor('transparent');
    document.body.style.background = 'radial-gradient(circle at center, #2b3b55 0%, #0d1423 100%)';

    // Center camera
    this.cameras.main.centerOn(0, 0);
    this.cameras.main.setZoom(1.5);

    // Render Island Grid (Diamond / Square Isometric)
    this.renderIsland();

    // Setup input
    this.highlightGraphics = this.add.graphics();
    this.highlightGraphics.setDepth(1000);

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
      
      // Draw highlight (a glowing top face)
      this.highlightGraphics.clear();
      this.highlightGraphics.fillStyle(0xffffff, 0.4);
      this.drawDiamond(this.highlightGraphics, centerIso.x, centerIso.y - 10); // Elevated by 10 (block height)

      // Tell server we want to move
      network.sendMove(centerIso.x, centerIso.y);
    });

    // Handle Network Events
    network.onWorldSnapshot = (data: any) => {
      this.localPlayerId = network.session?.user_id || "";
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

  update(_time: number, delta: number) {
    if (!this.myPlayerSprite) return;

    if (this.hasTarget) {
      const dx = this.targetIso.x - this.myPlayerSprite.x;
      const dy = this.targetIso.y - this.myPlayerSprite.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 4) {
        // Arrived
        this.hasTarget = false;
        this.myPlayerSprite.setPosition(this.targetIso.x, this.targetIso.y - 10); // Offset by block height
        this.highlightGraphics.clear();
      } else {
        // Move towards
        const dt = delta / 1000.0;
        const vx = (dx / dist) * this.moveSpeed * dt;
        const vy = (dy / dist) * this.moveSpeed * dt;
        
        this.myPlayerSprite.x += vx;
        this.myPlayerSprite.y += vy;
      }
      
      // Bouncing animation while walking
      const bounce = this.hasTarget ? Math.abs(Math.sin(_time / 100)) * 5 : 0;
      this.myPlayerSprite.getChildren().forEach((child: any) => {
         if (child.name === 'body') child.y = -40 - bounce;
      });

      this.myPlayerSprite.setDepth(this.myPlayerSprite.y + 100);
      this.cameras.main.centerOn(this.myPlayerSprite.x, this.myPlayerSprite.y);
    }
  }

  private addPlayer(id: string, x: number, y: number) {
    const container = this.add.container(x, y - 10); // elevated by block height
    
    // Shadow
    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.4);
    shadow.fillEllipse(0, 0, 24, 12);
    container.add(shadow);

    // Body
    const p = this.add.graphics();
    p.name = 'body';
    p.fillStyle(id === this.localPlayerId ? 0x00d2ff : 0xff5555, 1);
    p.fillRoundedRect(-10, -40, 20, 40, 4);
    p.lineStyle(2, 0xffffff, 0.8);
    p.strokeRoundedRect(-10, -40, 20, 40, 4);
    container.add(p);

    container.setDepth(y + 100);
    this.players.set(id, container);

    if (id === this.localPlayerId) {
      this.myPlayerSprite = container;
    }
  }

  private renderIsland() {
    // We want to sort blocks back-to-front.
    // In an isometric grid, blocks with lower (x+y) are further back.
    const tiles = [];
    for (let x = -MAP_RADIUS; x <= MAP_RADIUS; x++) {
      for (let y = -MAP_RADIUS; y <= MAP_RADIUS; y++) {
        tiles.push({ x, y });
      }
    }
    
    // Sort by depth
    tiles.sort((a, b) => (a.x + a.y) - (b.x + b.y));

    for (const t of tiles) {
      const iso = cartesianToIso({ x: t.x, y: t.y });
      this.drawIsometricBlock(iso.x, iso.y);
    }
  }

  private drawIsometricBlock(x: number, y: number) {
    const depth = 10; // Block height
    const hw = TILE_W / 2;
    const hh = TILE_H / 2;
    
    const g = this.add.graphics();
    g.setDepth(y);

    // Right face (Dirt - Dark)
    g.fillStyle(0x6b4c3a, 1);
    g.beginPath();
    g.moveTo(x, y + hh - depth);
    g.lineTo(x + hw, y - depth);
    g.lineTo(x + hw, y);
    g.lineTo(x, y + hh);
    g.closePath();
    g.fillPath();
    g.lineStyle(1, 0x000000, 0.2);
    g.strokePath();

    // Left face (Dirt - Light)
    g.fillStyle(0x8c634c, 1);
    g.beginPath();
    g.moveTo(x - hw, y - depth);
    g.lineTo(x, y + hh - depth);
    g.lineTo(x, y + hh);
    g.lineTo(x - hw, y);
    g.closePath();
    g.fillPath();
    g.strokePath();

    // Top face (Grass)
    g.fillStyle(0x85c247, 1);
    this.drawDiamond(g, x, y - depth);
    g.lineStyle(1, 0x000000, 0.1);
    g.strokePath();
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
