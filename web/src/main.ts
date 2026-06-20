import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene';
import { UIScene } from './scenes/UIScene';
import { network } from './network/NakamaClient';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: window.innerWidth,
  height: window.innerHeight,
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.RESIZE,
  },
  scene: [GameScene, UIScene]
};

// Start Phaser Game
const game = new Phaser.Game(config);

// Connect to Nakama automatically using a random local dev name
const randomName = "Player_" + Math.floor(Math.random() * 1000);
network.connect(randomName).then(() => {
  console.log("Connected to Nakama!");
  return network.joinIsland();
}).catch(e => {
  console.error("Failed to connect to Nakama. Is the server running on port 7350?", e);
});
