import Phaser from 'phaser';
import { network } from '../network/NakamaClient';

export class UIScene extends Phaser.Scene {
  private questContainer!: HTMLDivElement;

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

    // Right Side Quest Log
    this.questContainer = document.createElement('div');
    this.questContainer.style.position = 'absolute';
    this.questContainer.style.top = '20px';
    this.questContainer.style.right = '20px';
    this.questContainer.style.width = '300px';
    this.questContainer.style.background = 'rgba(15, 23, 42, 0.8)';
    this.questContainer.style.backdropFilter = 'blur(8px)';
    this.questContainer.style.padding = '16px';
    this.questContainer.style.borderRadius = '12px';
    this.questContainer.style.border = '1px solid rgba(255, 255, 255, 0.1)';
    this.questContainer.style.color = '#fff';
    this.questContainer.style.pointerEvents = 'auto'; // allow clicking claim buttons
    uiContainer.appendChild(this.questContainer);

    document.body.appendChild(uiContainer);

    // Start polling quests every 2 seconds
    setInterval(() => this.refreshQuests(), 2000);
  }

  private async refreshQuests() {
    if (!network.session) return;
    
    try {
      const data = await network.getQuests();
      if (!data || !data.quests) return;

      this.questContainer.innerHTML = '<h2 style="margin:0 0 12px 0;font-size:18px;color:#cbd5e1;">Active Quests</h2>';

      for (const [qId, quest] of Object.entries<any>(data.quests)) {
        if (quest.progress.claimed) continue; // Don't show claimed quests

        const def = quest.def;
        const prog = quest.progress;

        const qBox = document.createElement('div');
        qBox.style.background = 'rgba(255,255,255,0.05)';
        qBox.style.padding = '10px';
        qBox.style.borderRadius = '8px';
        qBox.style.marginBottom = '8px';

        qBox.innerHTML = `
          <strong style="display:block;color:#00d2ff;margin-bottom:4px;">${def.title}</strong>
          <div style="font-size:12px;color:#94a3b8;margin-bottom:8px;">${def.description}</div>
          <div style="display:flex;justify-content:space-between;align-items:center;font-size:13px;">
            <span>Progress: ${prog.amount} / ${def.amount}</span>
            <span style="color:#eab308;font-weight:bold;">${def.rewardCoins} Coins</span>
          </div>
        `;

        // Progress bar
        const barBg = document.createElement('div');
        barBg.style.width = '100%';
        barBg.style.height = '6px';
        barBg.style.background = '#334155';
        barBg.style.borderRadius = '3px';
        barBg.style.marginTop = '8px';
        barBg.style.overflow = 'hidden';

        const barFill = document.createElement('div');
        barFill.style.height = '100%';
        barFill.style.width = `${Math.min(100, (prog.amount / def.amount) * 100)}%`;
        barFill.style.background = prog.completed ? '#22c55e' : '#3b82f6';
        barFill.style.transition = 'width 0.3s ease';
        barBg.appendChild(barFill);
        qBox.appendChild(barBg);

        // Claim button
        if (prog.completed && !prog.claimed) {
          const btn = document.createElement('button');
          btn.innerText = 'Claim Reward';
          btn.style.marginTop = '10px';
          btn.style.width = '100%';
          btn.style.padding = '6px';
          btn.style.background = '#22c55e';
          btn.style.border = 'none';
          btn.style.borderRadius = '4px';
          btn.style.color = '#fff';
          btn.style.cursor = 'pointer';
          btn.style.fontWeight = 'bold';
          
          btn.onclick = async () => {
            btn.innerText = 'Claiming...';
            btn.disabled = true;
            await network.claimQuest(qId);
            this.refreshQuests();
          };
          qBox.appendChild(btn);
        }

        this.questContainer.appendChild(qBox);
      }
    } catch (e) {
      console.error("Failed to fetch quests", e);
    }
  }
}
