"""Synthetic Citizens sidebar layout regression; no personal bank data."""
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter

output = Path(__file__).with_name('citizens-sidebar-synthetic.pdf')
c = canvas.Canvas(str(output), pagesize=letter, invariant=1, pageCompression=1)
c.setTitle('Synthetic Citizens statement with summary sidebar')


def text(x, top, value, bold=False):
    c.setFont('Helvetica-Bold' if bold else 'Helvetica', 10)
    c.drawString(x, 792-top, value)


def header(number):
    text(40, 30, 'Citizens - Checking Account Statement', True)
    text(40, 48, 'SYNTHETIC TEST DATA - NO REAL ACCOUNT')
    text(500, 66, f'Page {number} of 4')


def table(top):
    text(40, top, 'Date', True)
    text(116, top, 'Amount', True)
    text(165, top, 'Description', True)


def row(top, date, amount, description):
    text(40, top, date)
    c.setFont('Helvetica', 10)
    c.drawRightString(150, 792-top, amount)
    text(165, top, description)


header(1)
text(390, 95, 'Beginning September 01, 2026')
text(390, 110, 'through September 30, 2026')
text(40, 150, 'Student Checking for XXXXXX-000-0', True)
text(40, 175, 'Balance Calculation', True)
for top, label, sign, amount in [
    (195, 'Previous Balance', '', '1,000.00'),
    (215, 'Checks', '-', '.00'),
    (235, 'Withdrawals & Debits', '-', '54.92'),
    (255, 'Deposits & Credit', '+', '110.00'),
    (275, 'Current Balance', '=', '1,055.08'),
]:
    text(40, top, label)
    text(195, top, sign)
    text(260, top, amount)
c.showPage()

header(2)
text(40, 90, 'Student Checking for XXXXXX-000-0 Continued', True)
text(40, 110, 'TRANSACTION DETAILS FOR CHECKING ACCOUNT ENDING 000-0', True)
text(489, 128, 'Previous Balance', True)
text(40, 132, 'Withdrawals & Debits **', True)
text(40, 145, '**May include checks processed electronically by the payee/merchant.')
text(525, 148, '1,000.00')
table(168)
text(475, 180, 'Total Withdrawals &', True)
text(40, 190, 'ATM/Purchases', True)
text(540, 190, 'Debits', True)
row(212, '09/08', '11.11', '0029 DBT PURCHASE - 777777 SAMPLE CAFE')
text(453, 212, '-')
text(540, 212, '54.92')
text(165, 226, 'DOWNTOWN LOCATION')
row(250, '09/08', '11.11', '0029 DBT PURCHASE - 777777 SAMPLE CAFE')
text(165, 264, 'DOWNTOWN LOCATION')
text(180, 748, 'Please See Additional Information on Next Page')
c.showPage()

header(3)
text(40, 90, 'Withdrawals & Debits (Continued) **', True)
text(40, 105, '**May include checks processed electronically by the payee/merchant.')
table(125)
text(40, 145, 'ATM/Purchases (Continued)', True)
row(165, '09/12', '7.25', '0029 DBT PURCHASE - 888888 eBay SAMPLE ORDER')
row(190, '09/12', '.45', 'FOREIGN CURRENCY FEE - SAMPLE ORDER')
text(40, 215, 'Other Withdrawals & Debits', True)
row(235, '09/14', '25.00', 'VENMO PAYMENT SAMPLE TRANSFER')
text(40, 275, 'Deposits & Credits', True)
text(455, 275, 'Total Deposits & Credits', True)
table(295)
text(450, 295, '+')
text(535, 295, '110.00')
row(315, '09/15', '100.00', 'ONLINE TRANSFER FROM CHECKING SAMPLE')
row(340, '09/20', '10.00', 'VENMO CASHOUT SAMPLE')
text(40, 375, 'Daily Balance', True)
text(495, 375, 'Current Balance', True)
for x in (40, 175, 310):
    text(x, 395, 'Date', True)
    text(x+85, 395, 'Balance', True)
text(450, 395, '=')
text(525, 395, '1,055.08')
for x in (40, 175, 310):
    text(x, 415, '09/30')
    text(x+85, 415, '1,055.08')
c.showPage()

header(4)
text(40, 90, 'Checking Account Balance Worksheet', True)
text(40, 125, 'Your current balance on this statement')
text(40, 145, 'Current Balance')
text(40, 160, '9,999.99')
text(40, 195, 'Date Amount Date Amount')
text(40, 215, '09/30 9,999.99')
c.showPage()
c.save()
print(output)
