"""Synthetic PDF fixture. Regenerate with reportlab; no personal bank data."""
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter

output = Path(__file__).with_name('citizens-synthetic.pdf')
c = canvas.Canvas(str(output), pagesize=letter, invariant=1, pageCompression=1)
c.setTitle('Synthetic Citizens checking statement parser fixture')
for page, month in enumerate((7, 8, 9), 1):
    c.setFont('Helvetica-Bold', 16)
    c.drawString(40, 752, 'Citizens Bank - Checking')
    c.setFont('Helvetica', 10)
    c.drawString(40, 730, 'SYNTHETIC TEST DATA - NO REAL ACCOUNT')
    c.drawString(40, 710, f'Statement period {month:02}/01/2026 - {month:02}/{31 if month != 9 else 30}/2026')
    c.drawString(40, 690, 'Account number: 00000000')
    c.setFont('Helvetica-Bold', 12)
    c.drawString(40, 650, 'Deposits & Credits')
    c.setFont('Helvetica', 10)
    c.drawString(40, 628, 'Date'); c.drawString(110, 628, 'Description'); c.drawString(460, 628, 'Amount')
    c.drawString(40, 607, f'{month:02}/02'); c.drawString(110, 607, 'Payroll deposit'); c.drawString(460, 607, '2,000.00')
    c.drawString(40, 585, 'Total deposits 2,000.00')
    c.setFont('Helvetica-Bold', 12)
    c.drawString(40, 550, 'Withdrawals & Debits')
    c.setFont('Helvetica', 10)
    # Test amount-before-description and amount-after-description layouts.
    date_x, description_x, amount_x = (40, 190, 100) if month == 8 else (40, 110, 460)
    c.drawString(date_x, 528, 'Date'); c.drawString(amount_x, 528, 'Amount'); c.drawString(description_x, 528, 'Description')
    for y, day, amount, description in [(507, 5, '16.99', 'Recurring POS NETFLIX'), (477, 8, '11.99', 'SPOTIFY'), (447, 12, '5.50', 'Corner Cafe'), (417, 15, '250.00', 'Online transfer to savings'), (387, 18, '500.00', 'Credit card payment'), (357, 22, '3.00', 'Service fee')]:
        c.drawString(date_x, y, f'{month:02}/{day:02}'); c.drawString(amount_x, y, amount); c.drawString(description_x, y, description)
        if day == 12: c.drawString(description_x, y-13, 'Downtown location')
    c.drawString(40, 327, 'Total withdrawals 787.48')
    c.drawString(40, 300, 'Daily balance')
    c.drawString(40, 280, f'{month:02}/30'); c.drawString(110, 280, 'Closing balance'); c.drawString(460, 280, '1,212.52')
    c.drawString(40, 45, f'Page {page} of 3')
    c.showPage()
c.save()
print(output)
