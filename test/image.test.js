import { describe, it, expect } from 'vitest';
import { fitSize, dataUrlBytes, isQuotaError, MAX_SIDE } from '../src/image.js';

describe('fitSize', () => {
  it('横图按长边缩到 1280', () => {
    expect(fitSize(4032, 3024)).toEqual({ width: 1280, height: 960 });
  });
  it('竖图按长边缩到 1280', () => {
    expect(fitSize(3024, 4032)).toEqual({ width: 960, height: 1280 });
  });
  it('小图不放大', () => {
    expect(fitSize(800, 600)).toEqual({ width: 800, height: 600 });
  });
  it('正好等于上限不变', () => {
    expect(fitSize(MAX_SIDE, 100)).toEqual({ width: MAX_SIDE, height: 100 });
  });
  it('可以自定义上限', () => {
    expect(fitSize(2000, 1000, 500)).toEqual({ width: 500, height: 250 });
  });
  it('尺寸无效时报错', () => {
    expect(() => fitSize(0, 100)).toThrow();
    expect(() => fitSize(100, NaN)).toThrow();
  });
});

describe('dataUrlBytes', () => {
  it('按字符长度计算', () => {
    expect(dataUrlBytes('data:image/jpeg;base64,AAAA')).toBe(27);
  });
});

describe('isQuotaError', () => {
  it('认得各浏览器的存储满错误', () => {
    expect(isQuotaError({ name: 'QuotaExceededError' })).toBe(true);
    expect(isQuotaError({ name: 'NS_ERROR_DOM_QUOTA_REACHED' })).toBe(true);
    expect(isQuotaError({ code: 22 })).toBe(true);
    expect(isQuotaError({ code: 1014 })).toBe(true);
  });
  it('其他错误不算', () => {
    expect(isQuotaError(new Error('x'))).toBe(false);
    expect(isQuotaError(null)).toBe(false);
  });
});
