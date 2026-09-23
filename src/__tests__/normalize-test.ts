import { getGoogleWalletSaveUrl, normalizeApplePasses, normalizeGooglePass } from '../normalize';

describe(normalizeApplePasses, () => {
  it('treats a string as a uri', () => {
    expect(normalizeApplePasses('https://example.com/a.pkpass')).toEqual({
      sources: [{ uri: 'https://example.com/a.pkpass' }],
      blobs: [],
    });
  });

  it('keeps headers for uris', () => {
    const headers = { Authorization: 'Bearer token' };
    expect(normalizeApplePasses({ uri: 'https://example.com/a.pkpass', headers }).sources).toEqual([
      { uri: 'https://example.com/a.pkpass', headers },
    ]);
  });

  it('turns base64 data: URIs into base64', () => {
    const dataUri = 'data:application/vnd.apple.pkpass;base64,UEsDBA==';
    expect(normalizeApplePasses(dataUri).sources).toEqual([{ base64: 'UEsDBA==' }]);
    expect(normalizeApplePasses({ base64: dataUri }).sources).toEqual([{ base64: 'UEsDBA==' }]);
  });

  it('rejects data: URIs that are not base64', () => {
    expect(() => normalizeApplePasses('data:text/plain,hello')).toThrow(
      expect.objectContaining({ code: 'ERR_WALLET_INVALID_PASS' })
    );
  });

  it('sends binary data as Uint8Array blobs referenced by index', () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const buffer = new Uint8Array([4, 5]).buffer;
    const { sources, blobs } = normalizeApplePasses([
      { data: bytes },
      'file:///tmp/b.pkpass',
      { data: buffer },
    ]);
    expect(sources).toEqual([{ dataIndex: 0 }, { uri: 'file:///tmp/b.pkpass' }, { dataIndex: 1 }]);
    expect(blobs[0]).toBe(bytes);
    expect(blobs[1]).toBeInstanceOf(Uint8Array);
    expect(Array.from(blobs[1])).toEqual([4, 5]);
  });

  it('rewraps other typed arrays as Uint8Array without copying', () => {
    const view = new Uint16Array([1, 2]);
    const { blobs } = normalizeApplePasses({ data: view as unknown as Uint8Array });
    expect(blobs[0]).toBeInstanceOf(Uint8Array);
    expect(blobs[0].buffer).toBe(view.buffer);
    expect(blobs[0].byteLength).toBe(4);
  });

  it('rejects empty arrays and unknown shapes with the index', () => {
    expect(() => normalizeApplePasses([])).toThrow(
      expect.objectContaining({ code: 'ERR_WALLET_MISSING_PASS' })
    );
    expect(() => normalizeApplePasses(['https://a', {} as never])).toThrow(/apple\[1\]/);
    expect(() => normalizeApplePasses(42 as never)).toThrow(
      expect.objectContaining({ code: 'ERR_WALLET_INVALID_PASS' })
    );
    expect(() => normalizeApplePasses({ uri: '' })).toThrow(/uri is empty/);
  });
});

describe(normalizeGooglePass, () => {
  it('treats strings as JWTs', () => {
    expect(normalizeGooglePass(' eyJ.abc.def ')).toEqual({ kind: 'jwt', value: 'eyJ.abc.def' });
    expect(normalizeGooglePass({ jwt: 'eyJ.abc.def' })).toEqual({
      kind: 'jwt',
      value: 'eyJ.abc.def',
    });
  });

  it('extracts the JWT from a save link', () => {
    expect(normalizeGooglePass('https://pay.google.com/gp/v/save/eyJ.abc.def?utm=x')).toEqual({
      kind: 'jwt',
      value: 'eyJ.abc.def',
    });
  });

  it('sends JSON to the unsigned save API', () => {
    const payload = { genericObjects: [{ id: '1' }] };
    expect(normalizeGooglePass({ json: payload })).toEqual({
      kind: 'json',
      value: JSON.stringify(payload),
    });
    expect(normalizeGooglePass({ json: '{"a":1}' })).toEqual({ kind: 'json', value: '{"a":1}' });
    expect(normalizeGooglePass('{"a":1}')).toEqual({ kind: 'json', value: '{"a":1}' });
  });

  it('rejects empty input', () => {
    expect(() => normalizeGooglePass('')).toThrow(
      expect.objectContaining({ code: 'ERR_WALLET_INVALID_PASS' })
    );
    expect(() => normalizeGooglePass({ jwt: ' ' })).toThrow(
      expect.objectContaining({ code: 'ERR_WALLET_INVALID_PASS' })
    );
  });
});

it('builds Google Wallet save links', () => {
  expect(getGoogleWalletSaveUrl('eyJ.abc.def')).toBe(
    'https://pay.google.com/gp/v/save/eyJ.abc.def'
  );
});
