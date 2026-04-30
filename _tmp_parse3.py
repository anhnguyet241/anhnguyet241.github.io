import pandas as pd
import sys

xls = pd.ExcelFile('/home/thien/chum/anhnguyet/2025河内周期明细表.xlsx')
print("SHEETS:", xls.sheet_names)

target = None
for sn in xls.sheet_names:
    if '明细' in sn:
        target = sn
        break
if not target:
    target = xls.sheet_names[0]

df = pd.read_excel(xls, sheet_name=target, header=None)
print(f"\n=== Sheet: {target}, Shape: {df.shape} ===\n")

# Print first 200 rows, first 10 columns
for i in range(min(200, len(df))):
    row = df.iloc[i, :10].tolist()
    vals = [str(v)[:35] if pd.notna(v) else '' for v in row]
    if any(v for v in vals):
        print(f"R{i+1:3d}: {'|'.join(vals)}")

# Print ALL markers (month boundaries etc)
print("\n=== ALL MARKERS (col A with keywords) ===")
for i in range(len(df)):
    cell = df.iloc[i, 0]
    if pd.notna(cell):
        s = str(cell)
        if any(k in s for k in ['月', '每周', '付', '总', '刀', '交易', '汇报']):
            print(f"R{i+1:3d}: {s[:80]}")
