export type BankFile = { name: string; kind: 'csv'; text: string; base64?: string } | { name: string; kind: 'pdf'; base64: string };
