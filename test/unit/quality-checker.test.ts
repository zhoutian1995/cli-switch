import { describe, it, expect, vi } from 'vitest';
import { evaluateQuality, type QualityReport } from '../../src/core/aggregator/quality-checker.js';
import { LLMService } from '../../src/core/llm/service.js';

function mockLLM(response: object): LLMService {
  const svc = new LLMService({ baseUrl: 'http://test', apiKey: 'k', model: 'm' });
  vi.spyOn(svc, 'chatJSON').mockResolvedValue(response as never);
  return svc;
}

describe('evaluateQuality', () => {
  it('should return QualityReport with pass=true when score >= 7', async () => {
    const llm = mockLLM({ score: 8, issues: [], suggestions: ['Add tests'] });
    const report = await evaluateQuality('const x = 1;', 'declare a variable', llm);

    expect(report.score).toBe(8);
    expect(report.pass).toBe(true);
    expect(report.suggestions).toEqual(['Add tests']);
  });

  it('should return pass=false when score < 7', async () => {
    const llm = mockLLM({ score: 4, issues: ['Missing error handling'], suggestions: [] });
    const report = await evaluateQuality('bad code', 'do something', llm);

    expect(report.score).toBe(4);
    expect(report.pass).toBe(false);
    expect(report.issues).toEqual(['Missing error handling']);
  });

  it('should default missing arrays to empty', async () => {
    const llm = mockLLM({ score: 9 });
    const report = await evaluateQuality('code', 'task', llm);

    expect(report.issues).toEqual([]);
    expect(report.suggestions).toEqual([]);
  });
});
