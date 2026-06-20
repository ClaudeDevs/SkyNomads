import Phaser from 'phaser';

export class UIScene extends Phaser.Scene {
  constructor() {
    super({ key: 'UIScene', active: true });
  }

  create() {
    // Add Kintara-style UI text
    this.add.text(20, 20, 'SkyNomads Web Client', {
      fontSize: '24px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4
    });

    this.add.text(20, 50, 'Left click to move. Math is perfectly isometric.', {
      fontSize: '16px',
      color: '#dddddd',
      stroke: '#000',
      strokeThickness: 3
    });
  }
}
