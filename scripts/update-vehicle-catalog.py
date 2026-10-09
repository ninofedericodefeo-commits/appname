"""Refresh the offline make/model MPG picker from the public EPA vehicle dataset."""
import csv
import io
import json
import re
from pathlib import Path
import urllib.request
import zipfile

SOURCE = 'https://www.fueleconomy.gov/feg/epadata/vehicles.csv.zip'
with urllib.request.urlopen(SOURCE, timeout=60) as response:
    archive = zipfile.ZipFile(io.BytesIO(response.read()))
rows = list(csv.DictReader(io.TextIOWrapper(archive.open('vehicles.csv'), encoding='utf-8-sig')))
latest = max(int(row['year']) for row in rows)
groups = {}
for row in rows:
    if int(row['year']) < latest - 5 or 'Gasoline' not in row['fuelType1'] or row['atvType'] in ('Plug-in Hybrid', 'EV'):
        continue
    model = re.sub(r'\b(?:AWD|4WD|2WD|FWD|RWD|2Dr|4Dr|5Dr)\b', '', row['model'], flags=re.I)
    name = f"{row['make']} {' '.join(model.split())}"
    entry = groups.setdefault(name, {'name': name, 'mpg': 100, 'vehicleClass': row['VClass'], 'fromYear': latest, 'toYear': 0})
    entry['mpg'] = min(entry['mpg'], int(row['comb08']))
    entry['fromYear'] = min(entry['fromYear'], int(row['year']))
    entry['toYear'] = max(entry['toYear'], int(row['year']))
output = {'source': SOURCE, 'latestYear': latest, 'vehicles': sorted(groups.values(), key=lambda item: item['name'].casefold())}
Path(__file__).resolve().parents[1].joinpath('src/features/vehicles/catalog.json').write_text(json.dumps(output, separators=(',', ':')) + '\n')
print(f"Saved {len(groups)} make/model estimates through {latest}")
