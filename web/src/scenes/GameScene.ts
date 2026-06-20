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

    // When the server connects, re-key our local player to the real user id
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
