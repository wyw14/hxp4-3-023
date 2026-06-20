import type { LevelData, VerifyResult } from './types';

const API_BASE = '/api';

export async function getLevelList(): Promise<{ id: number; name: string; creatureName: string }[]> {
  try {
    const res = await fetch(`${API_BASE}/levels`);
    const data = await res.json();
    if (data.success) {
      return data.levels;
    }
    return [];
  } catch {
    return [];
  }
}

export async function getLevel(id: number): Promise<LevelData | null> {
  try {
    const res = await fetch(`${API_BASE}/levels/${id}`);
    const data = await res.json();
    if (data.success) {
      return data.level as LevelData;
    }
    return null;
  } catch {
    return null;
  }
}

export async function verifyEdge(levelId: number, from: string, to: string): Promise<VerifyResult> {
  try {
    const res = await fetch(`${API_BASE}/levels/${levelId}/verify?edge=${from}-${to}`);
    return await res.json() as VerifyResult;
  } catch {
    return {
      success: false,
      valid: false,
      isHarmonic: false,
      isDefinedEdge: false
    };
  }
}

export async function healthCheck(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`);
    const data = await res.json();
    return data.success && data.status === 'running';
  } catch {
    return false;
  }
}

export async function exportLevels(): Promise<{
  success: boolean;
  data?: unknown;
  exportedAt?: string;
  totalLevels?: number;
  error?: string;
  errors?: string[];
}> {
  try {
    const res = await fetch(`${API_BASE}/levels/export`);
    const data = await res.json();
    return data;
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : '导出失败'
    };
  }
}

export async function importLevels(levelsData: unknown): Promise<{
  success: boolean;
  message?: string;
  backupCreated?: string;
  importedLevels?: number;
  error?: string;
  errors?: string[];
}> {
  try {
    const res = await fetch(`${API_BASE}/levels/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(levelsData)
    });
    const data = await res.json();
    return data;
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : '导入失败'
    };
  }
}
