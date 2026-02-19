import json
from datetime import datetime, date
import pandas as pd
import numpy as np

INPUT_XLSX = "data/so-diem.xlsx"
OUTPUT_JSON = "data/grades.json"

def to_jsonable(v):
    """Convert pandas/numpy types to JSON-serializable + nice string for dates."""
    # NaN / NaT
    if v is None:
        return ""
    try:
        if pd.isna(v):
            return ""
    except Exception:
        pass

    # Datetime / Date
    if isinstance(v, (pd.Timestamp, datetime, date)):
        # Nếu là ngày sinh thường không cần giờ
        if isinstance(v, (pd.Timestamp, datetime)) and getattr(v, "hour", 0) == 0 and getattr(v, "minute", 0) == 0 and getattr(v, "second", 0) == 0:
            return v.strftime("%d/%m/%Y")
        return v.strftime("%d/%m/%Y %H:%M:%S")

    # Numpy types
    if isinstance(v, (np.integer,)):
        return int(v)
    if isinstance(v, (np.floating,)):
        fv = float(v)
        # nếu là số nguyên (vd 10.0) thì ép int cho gọn
        if fv.is_integer():
            return int(fv)
        return fv
    if isinstance(v, (np.bool_,)):
        return bool(v)

    # String / others
    s = str(v).strip()
    # tránh trường hợp "nan"
    if s.lower() == "nan":
        return ""
    return s

def main():
    xls = pd.ExcelFile(INPUT_XLSX)
    records = {}
    dup_codes = []

    for sheet in xls.sheet_names:
        df = pd.read_excel(
            INPUT_XLSX,
            sheet_name=sheet,
            dtype={"Mã định danh": str, "MSHS": str}
        )

        # Strip tên cột cho chắc
        df.columns = [str(c).strip() for c in df.columns]

        if "Mã định danh" not in df.columns:
            continue

        # Chuẩn hóa mã định danh
        df["Mã định danh"] = df["Mã định danh"].astype(str).str.strip()
        df = df[
            df["Mã định danh"].notna()
            & (df["Mã định danh"].str.lower() != "nan")
            & (df["Mã định danh"] != "")
        ]

        # NaN -> ""
        df = df.where(pd.notnull(df), "")

        for _, row in df.iterrows():
            rec = {}
            for col in df.columns:
                rec[col] = to_jsonable(row[col])

            code = str(rec.get("Mã định danh", "")).strip()
            if not code or code.lower() == "nan":
                continue

            # Nếu thiếu "Tên lớp" thì lấy theo tên sheet
            if "Tên lớp" not in rec or rec["Tên lớp"] == "":
                rec["Tên lớp"] = sheet

            # Phát hiện trùng mã (nếu có)
            if code in records:
                dup_codes.append(code)

            records[code] = rec

    payload = {
        "last_updated": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "records": records
    }

    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    print(f"✅ Wrote {OUTPUT_JSON} with {len(records)} records.")
    if dup_codes:
        # in tối đa 20 mã trùng để Thầy kiểm tra
        sample = ", ".join(dup_codes[:20])
        print(f"⚠️ Warning: Duplicate 'Mã định danh' found ({len(dup_codes)}). Sample: {sample}")

if __name__ == "__main__":
    main()
