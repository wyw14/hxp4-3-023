import { Game } from './game';
import type { LevelData } from './types';
import { healthCheck, exportLevels, importLevels } from './api';

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
const game = new Game(canvas);

const levelNumEl = document.getElementById('level-num')!;
const creatureNameEl = document.getElementById('creature-name')!;
const connectedCountEl = document.getElementById('connected-count')!;
const totalCountEl = document.getElementById('total-count')!;
const progressFillEl = document.getElementById('progress-fill')!;
const hintTitleEl = document.getElementById('hint-title')!;
const hintTextEl = document.getElementById('hint-text')!;
const completeModal = document.getElementById('complete-modal')!;
const modalTitleEl = document.getElementById('modal-title')!;
const modalDescEl = document.getElementById('modal-desc')!;

const btnUndo = document.getElementById('btn-undo') as HTMLButtonElement;
const btnReset = document.getElementById('btn-reset') as HTMLButtonElement;
const btnHint = document.getElementById('btn-hint') as HTMLButtonElement;
const btnNext = document.getElementById('btn-next') as HTMLButtonElement;
const btnExport = document.getElementById('btn-export') as HTMLButtonElement;
const btnImport = document.getElementById('btn-import') as HTMLButtonElement;
const fileInput = document.getElementById('file-input') as HTMLInputElement;
const toastContainer = document.getElementById('toast-container') as HTMLDivElement;

const MAX_LEVELS = 3;

function showToast(message: string, type: 'success' | 'error' | 'warning' = 'success'): void {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

function downloadJSON(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

game.setCallbacks({
  onLevelChange: (level: LevelData) => {
    levelNumEl.textContent = String(level.id);
    creatureNameEl.textContent = level.creatureName;
    totalCountEl.textContent = String(level.edges.length);
    connectedCountEl.textContent = '0';
    progressFillEl.style.width = '0%';
    completeModal.classList.remove('show');

    hintTitleEl.textContent = `关卡 ${level.id}: ${level.name}`;
    hintTextEl.textContent = '寻找闪烁频率成倍数关系的恒星，从一颗星拖动到另一颗星连接它们';
  },
  onProgressChange: (current: number, total: number) => {
    connectedCountEl.textContent = String(current);
    const pct = total > 0 ? (current / total) * 100 : 0;
    progressFillEl.style.width = `${pct}%`;

    if (current < total) {
      if (current === 0) {
        hintTitleEl.textContent = '观察星空';
        hintTextEl.textContent = '仔细观察星星的闪烁节奏，找到频率相同或成倍数的恒星';
      } else if (current < total * 0.3) {
        hintTitleEl.textContent = '初见端倪';
        hintTextEl.textContent = '做得好！继续寻找，你会发现恒星间的谐波共振关系';
      } else if (current < total * 0.6) {
        hintTitleEl.textContent = '星脉初现';
        hintTextEl.textContent = '神话生物的轮廓正在浮现，耐心连接剩余的星脉';
      } else if (current < total) {
        hintTitleEl.textContent = '即将完成';
        hintTextEl.textContent = '只剩最后几颗星了！神话生物即将显现';
      }
    }
  },
  onComplete: (desc: string) => {
    hintTitleEl.textContent = '✨ 星座完成 ✨';
    hintTextEl.textContent = '星界神话生物已显现！仔细欣赏它的光辉吧';

    modalTitleEl.textContent = `✨ ${creatureNameEl.textContent} 降临 ✨`;
    modalDescEl.textContent = desc;
    completeModal.classList.add('show');

    if (game.getCurrentLevel() >= MAX_LEVELS) {
      btnNext.textContent = '重新开始';
    } else {
      btnNext.textContent = '下一关';
    }
  }
});

btnUndo.addEventListener('click', () => {
  game.undoLastConnection();
});

btnReset.addEventListener('click', () => {
  if (confirm('确定要重置本关吗？所有连线将被清除。')) {
    game.resetLevel();
  }
});

btnHint.addEventListener('click', () => {
  const showing = game.toggleFrequencies();
  btnHint.textContent = showing ? '隐藏频率' : '显示频率';
});

btnNext.addEventListener('click', async () => {
  const nextLevel = game.getCurrentLevel() >= MAX_LEVELS
    ? 1
    : game.getCurrentLevel() + 1;

  completeModal.classList.remove('show');
  btnHint.textContent = '显示频率';
  await game.loadLevel(nextLevel);
});

btnExport.addEventListener('click', async () => {
  try {
    const result = await exportLevels();
    if (result.success && result.data) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `levels_export_${timestamp}.json`;
      downloadJSON(result.data, filename);
      showToast(`✅ 导出成功！共 ${result.totalLevels} 个关卡`, 'success');
    } else {
      if (result.errors && result.errors.length > 0) {
        const errorMsg = result.errors.slice(0, 3).join('；');
        const moreErrors = result.errors.length > 3 ? ` 等 ${result.errors.length} 个错误` : '';
        showToast(`⚠️ 导出失败: 数据校验不通过 - ${errorMsg}${moreErrors}`, 'warning');
      } else {
        showToast(`❌ 导出失败: ${result.error || '未知错误'}`, 'error');
      }
    }
  } catch (err) {
    showToast(`❌ 导出失败: ${err instanceof Error ? err.message : '未知错误'}`, 'error');
  }
});

btnImport.addEventListener('click', () => {
  fileInput.value = '';
  fileInput.click();
});

fileInput.addEventListener('change', async (e) => {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    let importData: unknown;

    try {
      importData = JSON.parse(text);
    } catch (parseErr) {
      showToast(`❌ 导入失败: JSON解析错误 - ${parseErr instanceof Error ? parseErr.message : '格式错误'}`, 'error');
      return;
    }

    if (!confirm('确定要导入并覆盖当前所有关卡数据吗？\n\n导入前将自动创建备份，若备份失败则会中止操作。')) {
      return;
    }

    const result = await importLevels(importData);

    if (result.success) {
      const backupInfo = result.backupCreated 
        ? ` (已备份: ${result.backupCreated})` 
        : '';
      showToast(`✅ ${result.message}${backupInfo}`, 'success');
      if (game.getCurrentLevel() > (result.importedLevels || 0)) {
        await game.loadLevel(1);
      } else {
        await game.loadLevel(game.getCurrentLevel());
      }
    } else {
      if (result.errors && result.errors.length > 0) {
        const errorMsg = result.errors.slice(0, 3).join('；');
        const moreErrors = result.errors.length > 3 ? ` 等 ${result.errors.length} 个错误` : '';
        showToast(`⚠️ 导入失败: 数据校验不通过 - ${errorMsg}${moreErrors}`, 'warning');
      } else if (result.error && result.error.includes('备份')) {
        showToast(`❌ 导入失败: ${result.error}，数据未被修改`, 'error');
      } else {
        showToast(`❌ 导入失败: ${result.error || '未知错误'}`, 'error');
      }
    }
  } catch (err) {
    showToast(`❌ 导入失败: ${err instanceof Error ? err.message : '未知错误'}`, 'error');
  }
});

async function init(): Promise<void> {
  hintTitleEl.textContent = '加载中...';
  hintTextEl.textContent = '正在连接星界数据库...';

  try {
    const backendOk = await healthCheck();
    if (!backendOk) {
      console.warn('后端未启动，尝试使用嵌入数据...');
    }
  } catch {
    console.warn('后端健康检查失败');
  }

  const loaded = await game.loadLevel(1);
  if (!loaded) {
    hintTitleEl.textContent = '⚠️ 加载失败';
    hintTextEl.textContent = '无法加载关卡数据，请确保后端服务器已启动 (npm run dev:backend)';
    return;
  }

  game.start();
}

init().catch(err => {
  console.error('初始化失败:', err);
  hintTitleEl.textContent = '错误';
  hintTextEl.textContent = String(err);
});
