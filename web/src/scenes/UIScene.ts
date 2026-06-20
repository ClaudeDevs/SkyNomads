import Phaser from 'phaser';

export class UIScene extends Phaser.Scene {
  constructor() {
    super({ key: 'UIScene', active: true });
  }

  create() {
    // Instead of drawing canvas text, we will inject a beautiful HTML UI over the game!
    const uiContainer = document.createElement('div');
    uiContainer.style.position = 'absolute';
    uiContainer.style.top = '0';
    uiContainer.style.left = '0';
    uiContainer.style.width = '100%';
    uiContainer.style.height = '100%';
    uiContainer.style.pointerEvents = 'none'; // let clicks pass through to game
    uiContainer.style.fontFamily = '"Inter", "Segoe UI", sans-serif';
    
    // Top Left HUD
    const hud = document.createElement('div');
    hud.style.position = 'absolute';
    hud.style.top = '20px';
    hud.style.left = '20px';
    hud.style.background = 'rgba(15, 23, 42, 0.8)';
    hud.style.backdropFilter = 'blur(8px)';
    hud.style.padding = '16px 24px';
    hud.style.borderRadius = '12px';
    hud.style.border = '1px solid rgba(255, 255, 255, 0.1)';
    hud.style.color = '#fff';
    hud.style.boxShadow = '0 10px 25px rgba(0,0,0,0.5)';

    const title = document.createElement('h1');
    title.innerText = 'SkyNomads';
    title.style.margin = '0 0 8px 0';
    title.style.fontSize = '24px';
    title.style.background = 'linear-gradient(to right, #00d2ff, #3a7bd5)';
    title.style.webkitBackgroundClip = 'text';
    title.style.webkitTextFillColor = 'transparent';

    const subtitle = document.createElement('p');
    subtitle.innerText = 'Left click anywhere to move.';
    subtitle.style.margin = '0';
    subtitle.style.fontSize = '14px';
    subtitle.style.color = '#94a3b8';

    hud.appendChild(title);
    hud.appendChild(subtitle);
    uiContainer.appendChild(hud);

    document.body.appendChild(uiContainer);
  }
}
