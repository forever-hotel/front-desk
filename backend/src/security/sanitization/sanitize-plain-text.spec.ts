import { sanitizePlainText } from './sanitize-plain-text';

describe('sanitizePlainText', () => {
  it('trims normal plain text', () => {
    expect(sanitizePlainText('  Please send two towels  ')).toBe(
      'Please send two towels',
    );
  });

  it('removes script blocks completely', () => {
    expect(
      sanitizePlainText('<script>alert("xss")</script>Please send towels'),
    ).toBe('Please send towels');
  });

  it('removes HTML tags and event-handler markup', () => {
    expect(sanitizePlainText('<img src=x onerror=alert(1)>Extra towels')).toBe(
      'Extra towels',
    );
  });

  it('removes style blocks', () => {
    expect(
      sanitizePlainText(
        '<style>body{display:none}</style>Maintenance required',
      ),
    ).toBe('Maintenance required');
  });

  it('removes unsafe control characters', () => {
    expect(sanitizePlainText('Extra\u0000 towels')).toBe('Extra towels');
  });

  it('leaves ordinary non-string values unchanged for validation', () => {
    expect(sanitizePlainText(123)).toBe(123);
    expect(sanitizePlainText(null)).toBeNull();
  });
});
