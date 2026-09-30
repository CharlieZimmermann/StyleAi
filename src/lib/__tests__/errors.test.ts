import { errorMessage } from '@/lib/errors';

describe('errorMessage', () => {
  it('reads the message off an Error instance', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom');
  });

  it('reads the message off a plain object shaped like an error (e.g. Supabase errors)', () => {
    expect(errorMessage({ message: 'not found', code: '404' })).toBe('not found');
  });

  it('falls back on an Error with an empty message', () => {
    expect(errorMessage(new Error(''))).toBe('Something went wrong. Please try again.');
  });

  it('falls back on a non-string message field', () => {
    expect(errorMessage({ message: 42 })).toBe('Something went wrong. Please try again.');
  });

  it('falls back on completely unrecognizable input', () => {
    expect(errorMessage('just a string')).toBe('Something went wrong. Please try again.');
    expect(errorMessage(null)).toBe('Something went wrong. Please try again.');
    expect(errorMessage(undefined)).toBe('Something went wrong. Please try again.');
  });

  it('uses a custom fallback when given one', () => {
    expect(errorMessage(null, 'custom fallback')).toBe('custom fallback');
  });
});
