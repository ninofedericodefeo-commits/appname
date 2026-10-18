import fixture from '../../../assets/samples/sample-citizens-statement.json';
import type { BankFile } from '../bank/bankFileTypes';
import { decodeBase64 } from '../data/encoding';

/** An explicit preview fixture; never archive or import it into a real account automatically. */
export const SAMPLE_CITIZENS_STATEMENT: Extract<BankFile, { kind: 'pdf' }> = {
  name: fixture.name, kind: 'pdf', base64: fixture.base64,
};
export function sampleStatementBytes() { return decodeBase64(fixture.base64, 100_000); }
