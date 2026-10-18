"""Generate a fully invented Citizens parser demo; no account or customer data."""
from pathlib import Path
import base64
import json

folder = Path(__file__).parent
commands = []
def text(x, y, value, size=11):
    escaped = value.replace('\\', '\\\\').replace('(', '\\(').replace(')', '\\)')
    commands.append(f'BT /F1 {size} Tf 1 0 0 1 {x} {y} Tm ({escaped}) Tj ET')

text(40, 752, 'Citizens Bank - Sample checking statement', 16)
text(40, 726, 'SAMPLE - NOT REAL - SYNTHETIC TEST DATA', 14)
text(40, 704, 'Not issued by Citizens. No real customer or account.', 10)
text(40, 681, 'Statement period 09/01/2026 - 09/30/2026')
text(40, 660, 'Account number: 00000000 - SAMPLE ONLY')
text(40, 630, 'Beginning balance $1,200.00')
text(40, 610, 'Ending balance $3,280.54')
text(40, 573, 'Deposits & Credits', 13)
for x, label in [(40, 'Date'), (110, 'Description'), (460, 'Amount')]: text(x, 550, label)
for y, date, name, amount in [(529, '09/02', 'Sample payroll deposit', '2,500.00'), (508, '09/16', 'Sample reimbursement', '35.00')]:
    text(40, y, date); text(110, y, name); text(460, y, amount)
text(40, 470, 'Withdrawals & Debits', 13)
for x, label in [(40, 'Date'), (110, 'Description'), (460, 'Amount')]: text(x, 448, label)
rows = [('09/04', 'Sample Harbor Fuel', '42.99'), ('09/06', 'Sample Market Basket', '68.50'), ('09/08', 'Sample Music Plus', '7.99'), ('09/10', 'Sample Movie Night', '12.99'), ('09/13', 'Sample Corner Cafe', '32.00'), ('09/20', 'Online transfer to savings - SAMPLE', '250.00'), ('09/24', 'Sample Auto Supplies', '39.99')]
for i, (date, name, amount) in enumerate(rows):
    y = 426 - i * 23
    text(40, y, date); text(110, y, name); text(460, y, amount)
text(40, 205, 'All names, transactions and amounts are invented.', 11)
text(40, 185, 'For testing GasFinder only. Do not use as proof of funds.', 11)
text(40, 42, 'SAMPLE - NOT REAL | Page 1 of 1', 10)
stream = '\n'.join(commands).encode('ascii')
objects = [b'<< /Type /Catalog /Pages 2 0 R >>', b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>', b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', b'<< /Length ' + str(len(stream)).encode() + b' >>\nstream\n' + stream + b'\nendstream']
pdf = bytearray(b'%PDF-1.4\n'); offsets = [0]
for i, obj in enumerate(objects, 1):
    offsets.append(len(pdf)); pdf.extend(f'{i} 0 obj\n'.encode() + obj + b'\nendobj\n')
xref = len(pdf); pdf.extend(f'xref\n0 {len(objects)+1}\n0000000000 65535 f \n'.encode())
for offset in offsets[1:]: pdf.extend(f'{offset:010d} 00000 n \n'.encode())
pdf.extend(f'trailer\n<< /Size {len(objects)+1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n'.encode())
(folder / 'sample-citizens-statement.pdf').write_bytes(pdf)
(folder / 'sample-citizens-statement.json').write_text(json.dumps({'name': 'SAMPLE-NOT-REAL-Citizens-September-2026.pdf', 'kind': 'pdf', 'base64': base64.b64encode(pdf).decode()}, indent=2) + '\n')
