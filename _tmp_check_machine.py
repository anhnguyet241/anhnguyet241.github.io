import pandas as pd
import sys

path = '/home/thien/chum/anhnguyet/anhnguyet241.github.io/Máy 001 tháng 3_2026.xlsx'
xls = pd.ExcelFile(path, engine='openpyxl')
print("SHEETS:", xls.sheet_names)

for sn in xls.sheet_names[:1]:
    df = pd.read_excel(xls, sheet_name=sn, header=None, nrows=8)
    print(f"\n=== Sheet '{sn}', Shape: {df.shape} ===")
    for i in range(min(8, len(df))):
        row = df.iloc[i, :20].tolist()
        vals = [str(v)[:25] if pd.notna(v) else '' for v in row]
        print(f"R{i+1}: {'|'.join(vals)}")
