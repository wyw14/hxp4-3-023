import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import type { LevelsData, LevelData } from './types';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3003;

app.use(cors());
app.use(express.json());

const DATA_DIR = path.resolve(process.cwd(), 'data');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const LEVELS_FILE = path.join(DATA_DIR, 'levels.json');

function loadLevels(): LevelsData {
  try {
    const raw = fs.readFileSync(LEVELS_FILE, 'utf-8');
    return JSON.parse(raw) as LevelsData;
  } catch (err) {
    console.error('Failed to load levels:', err);
    return { levels: [] };
  }
}

function createBackup(): { success: boolean; backupPath?: string; error?: string } {
  try {
    if (!fs.existsSync(LEVELS_FILE)) {
      return { success: true, backupPath: undefined };
    }
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(BACKUP_DIR, `levels_${timestamp}.json`);
    fs.copyFileSync(LEVELS_FILE, backupFile);
    console.log(`✅ 已创建备份: ${path.basename(backupFile)}`);
    return { success: true, backupPath: backupFile };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('创建备份失败:', errorMsg);
    return { success: false, error: errorMsg };
  }
}

function validateLevelsData(data: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['数据格式错误，必须是JSON对象'] };
  }

  const levelsData = data as Record<string, unknown>;

  if (!Array.isArray(levelsData.levels)) {
    errors.push('缺少或无效的 levels 数组');
    return { valid: false, errors };
  }

  levelsData.levels.forEach((level: unknown, index: number) => {
    if (!level || typeof level !== 'object') {
      errors.push(`关卡 ${index}: 必须是对象`);
      return;
    }

    const l = level as Record<string, unknown>;

    if (typeof l.id !== 'number') {
      errors.push(`关卡 ${index}: id 必须是数字`);
    }
    if (typeof l.name !== 'string' || l.name.trim() === '') {
      errors.push(`关卡 ${index}: name 必须是非空字符串`);
    }
    if (typeof l.creatureName !== 'string' || l.creatureName.trim() === '') {
      errors.push(`关卡 ${index}: creatureName 必须是非空字符串`);
    }
    if (typeof l.creatureDescription !== 'string') {
      errors.push(`关卡 ${index}: creatureDescription 必须是字符串`);
    }
    if (typeof l.rotationSpeed !== 'number') {
      errors.push(`关卡 ${index}: rotationSpeed 必须是数字`);
    }

    if (!l.lightPollution || typeof l.lightPollution !== 'object') {
      errors.push(`关卡 ${index}: 缺少 lightPollution 对象`);
    } else {
      const lp = l.lightPollution as Record<string, unknown>;
      if (typeof lp.baseIntensity !== 'number') errors.push(`关卡 ${index}: lightPollution.baseIntensity 必须是数字`);
      if (typeof lp.variability !== 'number') errors.push(`关卡 ${index}: lightPollution.variability 必须是数字`);
      if (typeof lp.speed !== 'number') errors.push(`关卡 ${index}: lightPollution.speed 必须是数字`);
    }

    if (!Array.isArray(l.anchorPoints)) {
      errors.push(`关卡 ${index}: anchorPoints 必须是数组`);
    } else {
      l.anchorPoints.forEach((ap: unknown, apIndex: number) => {
        if (!ap || typeof ap !== 'object') {
          errors.push(`关卡 ${index} anchorPoint ${apIndex}: 必须是对象`);
          return;
        }
        const point = ap as Record<string, unknown>;
        if (typeof point.id !== 'string' || point.id.trim() === '') {
          errors.push(`关卡 ${index} anchorPoint ${apIndex}: id 必须是非空字符串`);
        }
        if (typeof point.x !== 'number') errors.push(`关卡 ${index} anchorPoint ${apIndex}: x 必须是数字`);
        if (typeof point.y !== 'number') errors.push(`关卡 ${index} anchorPoint ${apIndex}: y 必须是数字`);
        if (typeof point.frequency !== 'number') errors.push(`关卡 ${index} anchorPoint ${apIndex}: frequency 必须是数字`);
      });
    }

    if (!Array.isArray(l.edges)) {
      errors.push(`关卡 ${index}: edges 必须是数组`);
    } else {
      l.edges.forEach((edge: unknown, eIndex: number) => {
        if (!edge || typeof edge !== 'object') {
          errors.push(`关卡 ${index} edge ${eIndex}: 必须是对象`);
          return;
        }
        const e = edge as Record<string, unknown>;
        if (typeof e.from !== 'string' || e.from.trim() === '') {
          errors.push(`关卡 ${index} edge ${eIndex}: from 必须是非空字符串`);
        }
        if (typeof e.to !== 'string' || e.to.trim() === '') {
          errors.push(`关卡 ${index} edge ${eIndex}: to 必须是非空字符串`);
        }
        if (!Array.isArray(e.frequencyRatio) || e.frequencyRatio.length !== 2) {
          errors.push(`关卡 ${index} edge ${eIndex}: frequencyRatio 必须是包含2个数字的数组`);
        }
      });
    }
  });

  return { valid: errors.length === 0, errors };
}

function saveLevels(
  data: LevelsData,
  createBackupFirst: boolean = true
): { success: boolean; backupPath?: string; error?: string } {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    let backupPath: string | undefined;
    if (createBackupFirst && fs.existsSync(LEVELS_FILE)) {
      const backupResult = createBackup();
      if (!backupResult.success) {
        return {
          success: false,
          error: `备份创建失败: ${backupResult.error}`
        };
      }
      backupPath = backupResult.backupPath;
    }

    fs.writeFileSync(LEVELS_FILE, JSON.stringify(data, null, 2), 'utf-8');
    return { success: true, backupPath };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('保存关卡数据失败:', errorMsg);
    return { success: false, error: errorMsg };
  }
}

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b > 0.0001) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a;
}

function isSimpleFrequencyRatio(f1: number, f2: number, maxDenom: number = 10): boolean {
  const maxF = Math.max(f1, f2);
  const minF = Math.min(f1, f2);
  if (minF < 0.0001) return false;

  const ratio = maxF / minF;

  for (let denom = 1; denom <= maxDenom; denom++) {
    const numer = ratio * denom;
    const rounded = Math.round(numer);
    if (Math.abs(numer - rounded) < 0.02 && rounded <= maxDenom && rounded > 0) {
      return true;
    }
  }

  return false;
}

app.get('/api/levels', (_req, res) => {
  const data = loadLevels();
  res.json({
    success: true,
    total: data.levels.length,
    levels: data.levels.map((l: LevelData) => ({
      id: l.id,
      name: l.name,
      creatureName: l.creatureName
    }))
  });
});

app.get('/api/levels/export', (_req, res) => {
  const data = loadLevels();

  const validation = validateLevelsData(data);
  if (!validation.valid) {
    res.status(500).json({
      success: false,
      error: '导出数据校验失败，当前关卡数据结构不完整',
      errors: validation.errors
    });
    return;
  }

  res.json({
    success: true,
    data,
    exportedAt: new Date().toISOString(),
    totalLevels: data.levels.length
  });
});

app.post('/api/levels/import', (req, res) => {
  const importData = req.body;

  const validation = validateLevelsData(importData);
  if (!validation.valid) {
    res.status(400).json({
      success: false,
      error: '数据校验失败',
      errors: validation.errors
    });
    return;
  }

  const saveResult = saveLevels(importData as LevelsData, true);

  if (!saveResult.success) {
    res.status(500).json({
      success: false,
      error: saveResult.error || '导入失败，数据未被修改'
    });
    return;
  }

  res.json({
    success: true,
    message: `成功导入 ${importData.levels.length} 个关卡`,
    backupCreated: saveResult.backupPath ? path.basename(saveResult.backupPath) : null,
    importedLevels: importData.levels.length
  });
});

app.get('/api/levels/:id', (req, res) => {
  const id = parseInt(req.params.id);

  if (isNaN(id)) {
    res.status(400).json({
      success: false,
      error: 'Invalid level ID, must be a number'
    });
    return;
  }

  const data = loadLevels();
  const level = data.levels.find((l: LevelData) => l.id === id);

  if (!level) {
    res.status(404).json({
      success: false,
      error: `Level ${id} not found`
    });
    return;
  }

  res.json({
    success: true,
    level
  });
});

app.get('/api/levels/:id/verify', (req, res) => {
  const id = parseInt(req.params.id);

  if (isNaN(id)) {
    res.status(400).json({
      success: false,
      error: 'Invalid level ID, must be a number'
    });
    return;
  }

  const edgeParam = req.query.edge as string;

  if (!edgeParam) {
    res.status(400).json({
      success: false,
      error: 'Missing edge parameter'
    });
    return;
  }

  const [from, to] = edgeParam.split('-');
  if (!from || !to) {
    res.status(400).json({
      success: false,
      error: 'Invalid edge format, expected from-to'
    });
    return;
  }

  const data = loadLevels();
  const level = data.levels.find((l: LevelData) => l.id === id);

  if (!level) {
    res.status(404).json({
      success: false,
      error: `Level ${id} not found`
    });
    return;
  }

  const fromPoint = level.anchorPoints.find(p => p.id === from);
  const toPoint = level.anchorPoints.find(p => p.id === to);

  if (!fromPoint || !toPoint) {
    res.json({
      success: true,
      valid: false,
      reason: 'Unknown anchor point'
    });
    return;
  }

  const isDefinedEdge = level.edges.some(
    e => (e.from === from && e.to === to) || (e.from === to && e.to === from)
  );

  const f1 = fromPoint.frequency;
  const f2 = toPoint.frequency;
  const maxF = Math.max(f1, f2);
  const minF = Math.min(f1, f2);
  const isHarmonic = isSimpleFrequencyRatio(f1, f2);

  res.json({
    success: true,
    valid: isDefinedEdge && isHarmonic,
    isHarmonic,
    isDefinedEdge,
    frequencies: {
      [from]: f1,
      [to]: f2
    },
    ratio: isHarmonic ? [minF, maxF] : null
  });
});

app.post('/api/levels', (req, res) => {
  const newLevel = req.body as LevelData;

  if (!newLevel.id || !newLevel.anchorPoints || !newLevel.edges) {
    res.status(400).json({
      success: false,
      error: 'Invalid level data'
    });
    return;
  }

  const data = loadLevels();
  const existing = data.levels.findIndex(l => l.id === newLevel.id);

  if (existing >= 0) {
    data.levels[existing] = newLevel;
  } else {
    data.levels.push(newLevel);
  }

  const saveResult = saveLevels(data, true);

  if (!saveResult.success) {
    res.status(500).json({
      success: false,
      error: saveResult.error || '保存关卡失败'
    });
    return;
  }

  res.json({
    success: true,
    level: newLevel,
    backupCreated: saveResult.backupPath ? path.basename(saveResult.backupPath) : null
  });
});

app.get('/api/health', (_req, res) => {
  const data = loadLevels();
  res.json({
    success: true,
    status: 'running',
    port: PORT,
    levelsLoaded: data.levels.length
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n✨ 星座游戏服务器启动成功`);
  console.log(`📡 服务地址: http://localhost:${PORT}`);
  console.log(`📊 健康检查: http://localhost:${PORT}/api/health`);
  console.log(`🎮 关卡数量: ${loadLevels().levels.length}\n`);
});
