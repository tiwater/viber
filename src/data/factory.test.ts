import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DataAdapterFactory } from './factory';
import { LocalDataAdapter } from './adapters/local';

describe('DataAdapterFactory', () => {
  const initialEnv = process.env;

  beforeEach(() => {
    DataAdapterFactory.reset();
    process.env = { ...initialEnv }; // Reset env
    // Default to test environment
    process.env.NODE_ENV = 'test';
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = initialEnv;
    vi.restoreAllMocks();
  });

  it('should use explicit VIBEX_DATA_MODE="local"', () => {
    process.env.VIBEX_DATA_MODE = 'local';
    const adapter = DataAdapterFactory.create();
    expect(adapter).toBeInstanceOf(LocalDataAdapter);
  });

  it('should use explicit VIBEX_DATA_MODE="database" and throw on client', () => {
    process.env.VIBEX_DATA_MODE = 'database';

    // Simulate client-side
    const originalWindow = global.window;
    global.window = {} as any;

    expect(() => DataAdapterFactory.create()).toThrow("Client-side direct database access is not supported");

    global.window = originalWindow;
  });

  it('should fallback to local in development without Supabase keys', () => {
    delete process.env.VIBEX_DATA_MODE;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    process.env.NODE_ENV = 'development';
    delete process.env.VERCEL;

    const adapter = DataAdapterFactory.create();
    expect(adapter).toBeInstanceOf(LocalDataAdapter);
  });

  it('should default to database when keys are present', () => {
    delete process.env.VIBEX_DATA_MODE;
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.com';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'key';

    // Server side sync creation throws for database
    expect(() => DataAdapterFactory.create()).toThrow("Synchronous creation of database adapter is not supported");
  });
});
