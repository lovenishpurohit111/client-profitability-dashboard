from fastapi import FastAPI, UploadFile, File, HTTPException
import pandas as pd
import numpy as np
import io, os, json, re, csv
from datetime import datetime
from typing import Optional
from urllib.parse import quote_plus

app = FastAPI()
_processed_data: Optional[pd.DataFrame] = None
_DATA_PATH = "/tmp/vendorlens_data.pkl"


def _save_data(df: pd.DataFrame):
    """Persist dataframe to /tmp so all Vercel function instances can read it."""
    global _processed_data
    _processed_data = df
    try:
        df.to_pickle(_DATA_PATH)
    except Exception:
        pass


def _load_data() -> Optional[pd.DataFrame]:
    """Return in-memory df if available, else reload from /tmp."""
    global _processed_data
    if _processed_data is not None:
        return _processed_data
    try:
        import os
        if os.path.exists(_DATA_PATH):
            _processed_data = pd.read_pickle(_DATA_PATH)
            return _processed_data
    except Exception:
        pass
    return None

# ── Transaction type sets ─────────────────────────────────────────────────────
EXPENSE_TX_TYPES = {
    "cash expense", "credit card expense", "bill", "check", "expense",
    "journal entry", "bill payment", "bill payment (check)",
    "bill payment (credit card)", "purchase order", "paycheck",
    "liability payment", "inventory qty adjust",
}
SKIP_TX_TYPES = {"bill payment (check)", "bill payment (credit card)", "liability payment"}

# ── Category taxonomy for rule-based classification ───────────────────────────
CATEGORY_RULES = {
    "Meals & Entertainment": [
        "lunch", "dinner", "breakfast", "meal", "food", "restaurant", "coffee",
        "cafe", "catering", "snack", "drink", "burger", "pizza", "sushi",
        "entertainment", "concert", "event", "team lunch", "client dinner",
    ],
    "Travel & Transportation": [
        "flight", "hotel", "airbnb", "uber", "lyft", "taxi", "car rental",
        "gas", "fuel", "mileage", "parking", "toll", "train", "transit",
        "travel", "accommodation", "lodging", "airline",
    ],
    "Software & Subscriptions": [
        "software", "subscription", "saas", "license", "app", "tool",
        "platform", "stripe", "quickbooks", "slack", "zoom", "dropbox",
        "notion", "figma", "github", "gitlab", "jira", "monday", "asana",
        "hubspot", "salesforce", "adobe", "microsoft", "google workspace",
        "canva", "hootsuite", "mailchimp", "klaviyo", "ahrefs", "semrush",
        "datadog", "new relic", "hotjar", "buffer",
    ],
    "Cloud & Hosting": [
        "aws", "amazon web services", "azure", "google cloud", "gcp", "heroku",
        "digitalocean", "linode", "vultr", "cloudflare", "hosting", "server",
        "compute", "gpu", "storage", "cdn", "bandwidth", "ec2", "s3", "rds",
        "container", "docker", "kubernetes",
    ],
    "Advertising & Marketing": [
        "advertising", "ads", "google ads", "facebook ads", "meta ads",
        "linkedin ads", "ppc", "seo", "sem", "campaign", "marketing",
        "promotion", "sponsored", "influencer", "newsletter", "email campaign",
    ],
    "Office Supplies & Equipment": [
        "office", "supplies", "stationery", "paper", "printer", "toner",
        "desk", "chair", "equipment", "hardware", "laptop", "computer",
        "monitor", "keyboard", "mouse", "headset", "cable", "usb",
    ],
    "Utilities": [
        "electricity", "water", "gas", "utilities", "internet", "broadband",
        "phone", "telephone", "mobile", "cell", "cable", "utility bill",
        "pg&e", "pacific gas", "at&t", "verizon", "comcast",
    ],
    "Legal & Professional Fees": [
        "legal", "lawyer", "attorney", "law firm", "compliance", "contract",
        "accounting", "bookkeeper", "bookkeeping", "cpa", "auditor", "audit",
        "consulting", "consultant", "advisor", "advisory", "professional",
        "notary", "filing fee",
    ],
    "Insurance": [
        "insurance", "premium", "coverage", "policy", "liability", "workers comp",
        "health insurance", "dental", "vision", "life insurance", "indemnity",
    ],
    "Rent & Facilities": [
        "rent", "lease", "office rent", "warehouse", "storage unit", "coworking",
        "wework", "regus", "facility", "maintenance", "repairs", "janitorial",
        "cleaning", "landscaping", "property",
    ],
    "Payroll & Contractors": [
        "payroll", "salary", "wages", "contractor", "freelancer", "subcontractor",
        "staffing", "temp", "invoice payment", "consultant fee",
    ],
    "Bank & Finance Charges": [
        "bank fee", "wire transfer", "transaction fee", "service charge",
        "interest", "loan payment", "credit card fee", "paypal fee", "stripe fee",
        "finance charge", "overdraft",
    ],
    "Materials & Inventory": [
        "materials", "inventory", "stock", "parts", "components", "raw materials",
        "supplies", "merchandise", "product", "lumber", "hardware", "tools",
        "equipment rental", "machinery",
    ],
    "Miscellaneous": [
        "misc", "miscellaneous", "other", "general", "opening balance",
    ],
}

QB_TO_STANDARD = {
    "meals and entertainment":                             "Meals & Entertainment",
    "meals & entertainment":                              "Meals & Entertainment",
    "travel":                                             "Travel & Transportation",
    "travel expense":                                     "Travel & Transportation",
    "automobile":                                         "Travel & Transportation",
    "automobile:fuel":                                    "Travel & Transportation",
    "automobile:auto insurance":                          "Travel & Transportation",
    "automobile:repairs and maintenance":                 "Repairs & Maintenance",
    "utilities":                                          "Utilities",
    "utilities:telephone":                                "Utilities",
    "utilities:gas and electric":                         "Utilities",
    "utilities:water":                                    "Utilities",
    "telephone":                                          "Utilities",
    "legal & professional fees":                          "Legal & Professional Fees",
    "legal & professional fees:bookkeeper":               "Legal & Professional Fees",
    "legal & professional fees:accounting":               "Legal & Professional Fees",
    "legal & professional fees:lawyer":                   "Legal & Professional Fees",
    "professional fees":                                  "Legal & Professional Fees",
    "insurance":                                          "Insurance",
    "insurance:disability insurance":                     "Insurance",
    "insurance:liability insurance":                      "Insurance",
    "insurance:workers compensation":                     "Insurance",
    "rent or lease":                                      "Rent & Facilities",
    "rent or lease:equipment rental":                     "Rent & Facilities",
    "rent or lease:other":                                "Rent & Facilities",
    "equipment rental":                                   "Rent & Facilities",
    "job expenses":                                       "Materials & Inventory",
    "job expenses:job materials":                         "Materials & Inventory",
    "job expenses:job materials:plants and soil":         "Materials & Inventory",
    "job expenses:job materials:fountain and garden lighting": "Materials & Inventory",
    "job expenses:job materials:decks and patios":        "Materials & Inventory",
    "job expenses:job materials:sprinklers and drip systems": "Materials & Inventory",
    "landscaping services:job materials:plants and soil": "Materials & Inventory",
    "cost of goods sold":                                 "Materials & Inventory",
    "maintenance and repair":                             "Repairs & Maintenance",
    "maintenance and repair:equipment repairs":           "Repairs & Maintenance",
    "maintenance and repair:building repairs":            "Repairs & Maintenance",
    "repairs":                                            "Repairs & Maintenance",
    "office supplies":                                    "Office Supplies & Equipment",
    "office expenses":                                    "Office Supplies & Equipment",
    "office supplies & software":                         "Office Supplies & Equipment",
    "advertising":                                        "Advertising & Marketing",
    "advertising and promotion":                          "Advertising & Marketing",
    "bank charges":                                       "Bank & Finance Charges",
    "bank service charges":                               "Bank & Finance Charges",
    "finance charge":                                     "Bank & Finance Charges",
    "payroll expenses":                                   "Payroll & Contractors",
    "payroll expenses:wages":                             "Payroll & Contractors",
    "contractor":                                         "Payroll & Contractors",
    # Transaction types that bleed into category column
    "purchase order":                                     "Materials & Inventory",
    "bill":                                               "Miscellaneous",
    "check":                                              "Miscellaneous",
    "uncategorized expense":                              "Miscellaneous",
    "miscellaneous":                                      "Miscellaneous",
    "ask my accountant":                                  "Miscellaneous",
    "opening balance equity":                             "Miscellaneous",
}

# Partial-match prefixes (applied when no exact match found)
QB_PREFIX_MAP = [
    ("job expenses",                "Materials & Inventory"),
    ("landscaping services",        "Materials & Inventory"),
    ("maintenance and repair",      "Repairs & Maintenance"),
    ("automobile",                  "Travel & Transportation"),
    ("legal & professional fees",   "Legal & Professional Fees"),
    ("insurance",                   "Insurance"),
    ("utilities",                   "Utilities"),
    ("payroll",                     "Payroll & Contractors"),
    ("rent or lease",               "Rent & Facilities"),
    ("advertising",                 "Advertising & Marketing"),
    ("office",                      "Office Supplies & Equipment"),
]


def _clean_amount(series: pd.Series) -> pd.Series:
    s = series.astype(str).str.replace(r"[,$₹€£\s]", "", regex=True)
    s = s.str.replace(r"^\((.+)\)$", r"-\1", regex=True)
    return pd.to_numeric(s, errors="coerce").fillna(0)


def _normalise_category(cat: str) -> str:
    low = cat.strip().lower()
    # Exact match
    if low in QB_TO_STANDARD:
        return QB_TO_STANDARD[low]
    # Prefix match
    for prefix, standard in QB_PREFIX_MAP:
        if low.startswith(prefix):
            return standard
    return cat.strip()


def _rule_classify(memo: str, vendor: str, assigned_cat: str) -> dict:
    text = f"{memo} {vendor}".lower()
    norm_assigned = _normalise_category(assigned_cat)

    best_cat, best_score = "Miscellaneous", 0
    for cat, keywords in CATEGORY_RULES.items():
        score = sum(2 if kw in text else 0 for kw in keywords if len(kw) > 3 and kw in text)
        score += sum(1 for kw in keywords if kw in text)
        if score > best_score:
            best_score, best_cat = score, cat

    # Check if assigned category already maps to our standard
    assigned_standard = _normalise_category(assigned_cat)
    assigned_low = assigned_standard.lower()
    suggested_low = best_cat.lower()

    # Fuzzy match: do both point to same concept?
    match = (
        assigned_low == suggested_low or
        best_cat.split("&")[0].strip().lower() in assigned_low or
        assigned_low.split(":")[0].strip() in suggested_low or
        best_score >= 3
    )

    confidence = "high" if best_score >= 4 else "medium" if best_score >= 2 else "low"
    if not memo or memo in ("—", "nan", ""):
        confidence = "low"

    return {
        "suggested_category": best_cat if best_score > 0 else assigned_standard,
        "match": match,
        "confidence": confidence,
        "reason": (
            f"Memo/vendor contains keywords matching '{best_cat}'" if best_score > 0
            else f"No strong keyword match — keeping assigned '{assigned_standard}'"
        ),
        "source": "rule-based",
    }


# ── QuickBooks XLSX detection & parsing ───────────────────────────────────────
def _detect_quickbooks_vendor_xlsx(raw_bytes: bytes) -> bool:
    try:
        df = pd.read_excel(io.BytesIO(raw_bytes), header=None, nrows=5)
        cell = str(df.iloc[0, 0]).strip().lower()
        return "transaction list by vendor" in cell
    except Exception:
        return False


def _detect_quickbooks_vendor_csv(raw_bytes: bytes) -> bool:
    try:
        text = raw_bytes.decode("utf-8", errors="ignore")
    except Exception:
        return False
    first = text[:500].lower()
    return "transaction list by vendor" in first or (
        "split" in first and ("transaction type" in first or "posting" in first)
    )


def _parse_quickbooks_vendor_xlsx(raw_bytes: bytes) -> pd.DataFrame:
    df_raw = pd.read_excel(io.BytesIO(raw_bytes), header=None, dtype=str).fillna("")
    header_row_idx = None
    for i, row in df_raw.iterrows():
        if str(row.iloc[1]).strip().lower() == "date":
            header_row_idx = i
            break
    if header_row_idx is None:
        raise ValueError("Could not find column header row in QuickBooks XLSX export.")

    header = [str(c).strip().lower() for c in df_raw.iloc[header_row_idx]]
    col_date   = next((i for i, h in enumerate(header) if h == "date"), 1)
    col_txtype = next((i for i, h in enumerate(header) if "transaction type" in h), 2)
    col_memo   = next((i for i, h in enumerate(header) if "memo" in h), 5)
    col_acct   = next((i for i, h in enumerate(header) if "account" in h), 6)
    col_amount = next((i for i, h in enumerate(header) if h == "amount"), 7)
    col_split  = next((i for i, h in enumerate(header) if "split" in h), 8)

    rows = []
    current_vendor = "Unknown"
    internal_accts = {"accounts payable (a/p)", "accounts receivable (a/r)",
                      "checking", "mastercard", "savings", "credit card"}

    for i, row in df_raw.iloc[header_row_idx + 1:].iterrows():
        vendor_cell = str(row.iloc[0]).strip()
        date_cell   = str(row.iloc[col_date]).strip()
        amount_cell = str(row.iloc[col_amount]).strip()
        if not vendor_cell and not date_cell:
            continue
        if date_cell.upper() == "TOTAL":
            continue
        if vendor_cell.lower().startswith("total") or re.match(
            r"^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)", vendor_cell.lower()
        ):
            continue
        if vendor_cell and not date_cell:
            current_vendor = re.sub(r"\s*\(\d+\)\s*$", "", vendor_cell).strip()
            continue
        if not date_cell:
            continue

        txtype = str(row.iloc[col_txtype]).strip()
        memo   = str(row.iloc[col_memo]).strip()
        acct   = str(row.iloc[col_acct]).strip()
        split  = str(row.iloc[col_split]).strip()

        # Skip pure payment/transfer rows
        if txtype.lower() in SKIP_TX_TYPES and split.lower() in internal_accts:
            continue

        # Memo: only use if it's meaningful — not an account/payment name
        meaningful_memo = memo not in ("-", "nan", "") and memo.lower() not in internal_accts
        description = memo if meaningful_memo else ""

        category = split if split and split.lower() not in ("", "nan") else acct
        if category.lower() in internal_accts:
            category = acct if acct.lower() not in internal_accts else txtype

        rows.append({
            "Date": date_cell, "Vendor": current_vendor,
            "Memo": description or "—", "Amount": amount_cell,
            "Category": category, "TxType": txtype,
        })

    if not rows:
        raise ValueError("No transaction rows found in QuickBooks XLSX export.")

    df = pd.DataFrame(rows)
    df["Date"]   = pd.to_datetime(df["Date"], errors="coerce")
    df = df.dropna(subset=["Date"])
    df["Amount"]   = _clean_amount(df["Amount"]).abs()
    df["Category"] = df["Category"].astype(str).str.strip().apply(_normalise_category)
    df["Vendor"]   = df["Vendor"].astype(str).str.strip()
    df["Month"]    = df["Date"].dt.to_period("M").astype(str)
    return df[["Date", "Vendor", "Memo", "Amount", "Category", "TxType", "Month"]]


def _parse_quickbooks_vendor_csv(raw_bytes: bytes) -> pd.DataFrame:
    text = raw_bytes.decode("utf-8", errors="ignore")
    reader = list(csv.reader(io.StringIO(text)))
    header_idx = None
    for i, row in enumerate(reader):
        low = [c.strip().lower() for c in row]
        if "date" in low and "amount" in low:
            header_idx = i
            break
    if header_idx is None:
        raise ValueError("Could not find header row.")
    headers = [c.strip() for c in reader[header_idx]]
    col_idx = {}
    for i, h in enumerate(headers):
        hl = h.lower()
        if hl == "date":                            col_idx["Date"] = i
        elif "transaction type" in hl:              col_idx["TxType"] = i
        elif "memo" in hl or "description" in hl:  col_idx["Memo"] = i
        elif "account" in hl:                       col_idx["Account"] = i
        elif hl == "amount":                        col_idx["Amount"] = i
        elif "split" in hl:                         col_idx["Category"] = i

    rows = []
    current_vendor = "Unknown"
    for row in reader[header_idx + 1:]:
        non_empty = [c.strip() for c in row if c.strip()]
        if not non_empty:
            continue
        first = non_empty[0].lower()
        if first.startswith("total") or not non_empty:
            continue
        date_val = row[col_idx.get("Date", 0)].strip() if col_idx.get("Date") is not None else ""
        try:
            pd.to_datetime(date_val, errors="raise")
            is_data = True
        except Exception:
            is_data = False
        if not is_data:
            current_vendor = re.sub(r"\s*\(\d+\)\s*$", "", non_empty[0]).strip()
            continue

        def get(key, default=""):
            idx = col_idx.get(key)
            if idx is None or idx >= len(row): return default
            return row[idx].strip()

        txtype = get("TxType")
        if txtype.lower() in SKIP_TX_TYPES:
            continue
        rows.append({
            "Date": date_val, "Vendor": current_vendor,
            "Memo": get("Memo") or get("Account") or "—",
            "Amount": get("Amount"), "Category": get("Category"),
            "TxType": txtype,
        })

    df = pd.DataFrame(rows)
    df["Date"]   = pd.to_datetime(df["Date"], errors="coerce")
    df = df.dropna(subset=["Date"])
    df["Amount"]   = _clean_amount(df["Amount"]).abs()
    df["Category"] = df["Category"].astype(str).str.strip().apply(_normalise_category)
    df["Vendor"]   = df["Vendor"].astype(str).str.strip()
    df["Month"]    = df["Date"].dt.to_period("M").astype(str)
    return df[["Date", "Vendor", "Memo", "Amount", "Category", "TxType", "Month"]]


def _parse_standard(df_raw: pd.DataFrame) -> pd.DataFrame:
    df_raw.columns = [c.strip().title().replace(" ", "_") for c in df_raw.columns]
    col_map = {}
    for col in df_raw.columns:
        low = col.lower()
        if "date" in low:                                           col_map["Date"] = col
        elif "vendor" in low or "payee" in low or "supplier" in low: col_map["Vendor"] = col
        elif "client" in low or "name" in low:                      col_map.setdefault("Vendor", col)
        elif "memo" in low or "desc" in low or "note" in low:       col_map["Memo"] = col
        elif "amount" in low or "value" in low:                     col_map["Amount"] = col
        elif "split" in low:                                         col_map["Category"] = col
        elif "cat" in low:                                           col_map["Category"] = col
    missing = [r for r in ["Date", "Vendor", "Amount", "Category"] if r not in col_map]
    if missing:
        raise ValueError(f"Missing columns: {missing}. Found: {list(df_raw.columns)}")
    df = df_raw.rename(columns={v: k for k, v in col_map.items()})
    df["Date"]     = pd.to_datetime(df["Date"], errors="coerce")
    df = df.dropna(subset=["Date"])
    df["Amount"]   = _clean_amount(df["Amount"]).abs()
    df["Category"] = df["Category"].astype(str).str.strip().apply(_normalise_category)
    df["Vendor"]   = df["Vendor"].astype(str).str.strip()
    df["Memo"]     = df.get("Memo", pd.Series([""] * len(df))).astype(str).str.strip()
    df["TxType"]   = ""
    df["Month"]    = df["Date"].dt.to_period("M").astype(str)
    return df[["Date", "Vendor", "Memo", "Amount", "Category", "TxType", "Month"]]


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/api/health")
def api_health():
    return {"status": "ok"}


@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    if not file.filename.endswith((".csv", ".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Only CSV or Excel files are supported.")
    contents = await file.read()
    is_csv  = file.filename.endswith(".csv")
    is_xlsx = file.filename.endswith((".xlsx", ".xls"))

    is_qb_xlsx = is_xlsx and _detect_quickbooks_vendor_xlsx(contents)
    is_qb_csv  = is_csv  and _detect_quickbooks_vendor_csv(contents)

    try:
        if is_qb_xlsx:
            df = _parse_quickbooks_vendor_xlsx(contents)
            fmt = "quickbooks-vendor"
        elif is_qb_csv:
            df = _parse_quickbooks_vendor_csv(contents)
            fmt = "quickbooks-vendor"
        else:
            df_raw = pd.read_csv(io.BytesIO(contents)) if is_csv else pd.read_excel(io.BytesIO(contents))
            df = _parse_standard(df_raw)
            fmt = "standard"
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not parse file: {str(e)}")

    _save_data(df)
    return {
        "file_format":   fmt,
        "rows":          len(df),
        "vendors":       df["Vendor"].nunique(),
        "total_spend":   round(float(df["Amount"].sum()), 2),
        "date_range":    {"min": df["Date"].min().strftime("%Y-%m-%d"), "max": df["Date"].max().strftime("%Y-%m-%d")},
        "vendor_list":   sorted(df["Vendor"].unique().tolist()),
        "category_list": sorted(df["Category"].unique().tolist()),
    }


@app.get("/api/summary")
def get_summary(vendor: Optional[str] = None, start_date: Optional[str] = None, end_date: Optional[str] = None):
    _df = _load_data()
    if _df is None:
        raise HTTPException(status_code=404, detail="No data uploaded.")
    df = _apply_filters(_df, vendor, start_date, end_date)
    if df.empty:
        return {"total_spend": 0, "vendor_count": 0, "transaction_count": 0,
                "avg_transaction": 0, "top_category": None, "top_vendor": None,
                "monthly_avg": 0, "categories": 0}
    months = df["Month"].nunique()
    top_cat = df.groupby("Category")["Amount"].sum().idxmax() if not df.empty else None
    top_vnd = df.groupby("Vendor")["Amount"].sum().idxmax() if not df.empty else None
    return {
        "total_spend":       round(float(df["Amount"].sum()), 2),
        "vendor_count":      int(df["Vendor"].nunique()),
        "transaction_count": int(len(df)),
        "avg_transaction":   round(float(df["Amount"].mean()), 2),
        "top_category":      top_cat,
        "top_vendor":        top_vnd,
        "monthly_avg":       round(float(df["Amount"].sum()) / max(months, 1), 2),
        "categories":        int(df["Category"].nunique()),
    }


@app.get("/api/vendors")
def get_vendors(start_date: Optional[str] = None, end_date: Optional[str] = None):
    _df = _load_data()
    if _df is None:
        raise HTTPException(status_code=404, detail="No data uploaded.")
    df = _apply_filters(_df, None, start_date, end_date)
    total = float(df["Amount"].sum()) or 1
    vendors = []
    for v, grp in df.groupby("Vendor"):
        spend = float(grp["Amount"].sum())
        top_cat = grp.groupby("Category")["Amount"].sum().idxmax()
        vendors.append({
            "vendor":        v,
            "spend":         round(spend, 2),
            "pct_of_total":  round(spend / total * 100, 1),
            "txn_count":     int(len(grp)),
            "avg_txn":       round(spend / len(grp), 2),
            "top_category":  top_cat,
            "last_date":     grp["Date"].max().strftime("%Y-%m-%d"),
        })
    vendors.sort(key=lambda x: x["spend"], reverse=True)
    return {"vendors": vendors}


@app.get("/api/categories")
def get_categories(vendor: Optional[str] = None, start_date: Optional[str] = None, end_date: Optional[str] = None):
    _df = _load_data()
    if _df is None:
        raise HTTPException(status_code=404, detail="No data uploaded.")
    df = _apply_filters(_df, vendor, start_date, end_date)
    total = float(df["Amount"].sum()) or 1
    cats = df.groupby("Category")["Amount"].agg(["sum", "count"]).reset_index()
    cats.columns = ["category", "amount", "count"]
    cats["pct"] = (cats["amount"] / total * 100).round(1)
    cats["amount"] = cats["amount"].round(2)
    return {"categories": cats.sort_values("amount", ascending=False).to_dict("records")}


@app.get("/api/trend")
def get_trend(vendor: Optional[str] = None):
    _df = _load_data()
    if _df is None:
        raise HTTPException(status_code=404, detail="No data uploaded.")
    df = _apply_filters(_df, vendor, None, None)
    monthly = df.groupby("Month")["Amount"].agg(["sum", "count"]).reset_index()
    monthly.columns = ["month", "spend", "transactions"]
    monthly["spend"] = monthly["spend"].round(2)
    return {"trend": monthly.sort_values("month").to_dict("records")}


@app.get("/api/transactions")
def get_transactions(
    vendor:     Optional[str] = None,
    category:   Optional[str] = None,
    start_date: Optional[str] = None,
    end_date:   Optional[str] = None,
    search:     Optional[str] = None,
    page:       int = 0,
    page_size:  int = 50,
):
    _df = _load_data()
    if _df is None:
        raise HTTPException(status_code=404, detail="No data uploaded.")
    df = _apply_filters(_df, vendor, start_date, end_date)
    if category and category != "All":
        df = df[df["Category"] == category]
    if search:
        mask = (
            df["Memo"].str.contains(search, case=False, na=False) |
            df["Vendor"].str.contains(search, case=False, na=False) |
            df["Category"].str.contains(search, case=False, na=False)
        )
        df = df[mask]
    df = df.sort_values("Date", ascending=False)
    total = len(df)
    page_df = df.iloc[page * page_size:(page + 1) * page_size]
    txns = []
    for _, row in page_df.iterrows():
        txns.append({
            "date":     row["Date"].strftime("%Y-%m-%d"),
            "vendor":   row["Vendor"],
            "memo":     str(row["Memo"]),
            "amount":   float(row["Amount"]),
            "category": str(row["Category"]),
            "tx_type":  str(row["TxType"]),
        })
    return {"transactions": txns, "total": total, "page": page, "pages": -(-total // page_size)}


@app.post("/api/reconcile")
async def reconcile(payload: dict):
    _processed_data = _load_data()
    if _processed_data is None:
        raise HTTPException(status_code=404, detail="No data uploaded. Please upload a file first.")
    vendor_filter = payload.get("vendor")
    df = _apply_filters(_processed_data, vendor_filter, None, None)
    if df.empty:
        return {"results": [], "summary": {"total": 0, "match": 0, "mismatch": 0, "uncertain": 0}}

    combos = df[["Vendor", "Memo", "Category"]].drop_duplicates().head(120)
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")

    if api_key:
        results = await _ai_reconcile(combos.to_dict("records"), api_key)
    else:
        results = await _ddg_reconcile(combos.to_dict("records"))

    match_count    = sum(1 for r in results if r["match"] and r["confidence"] != "low")
    mismatch_count = sum(1 for r in results if not r["match"])
    uncertain      = sum(1 for r in results if r["confidence"] == "low")
    total          = len(results)
    accuracy       = round(match_count / max(total - uncertain, 1) * 100, 1)

    return {
        "results": results,
        "summary": {
            "total":     total,
            "match":     match_count,
            "mismatch":  mismatch_count,
            "uncertain": uncertain,
            "accuracy":  accuracy,
            "source":    "claude+web" if api_key else "duckduckgo+rules",
        },
    }


async def _ddg_reconcile(combos: list) -> list:
    """DuckDuckGo + rule-based category verification (no API key needed)."""
    import httpx
    results = []
    async with httpx.AsyncClient(timeout=8.0) as hc:
        for c in combos:
            vendor   = c["Vendor"]
            memo     = c["Memo"] or ""
            category = c["Category"]

            # Rule-based first
            rule = _rule_classify(memo, vendor, category)

            # If low confidence, try DuckDuckGo for the vendor name
            ddg_context = ""
            if rule["confidence"] == "low" or not memo or memo == "—":
                try:
                    query = quote_plus(f"{vendor} type of business")
                    resp = await hc.get(
                        f"https://api.duckduckgo.com/?q={query}&format=json&no_html=1&skip_disambig=1",
                        headers={"User-Agent": "Mozilla/5.0"},
                    )
                    data = resp.json()
                    ddg_context = (
                        data.get("AbstractText", "") or
                        data.get("Answer", "") or
                        " ".join(
                            t.get("Text", "") for t in data.get("RelatedTopics", [])[:2]
                            if isinstance(t, dict)
                        )
                    )[:400]
                except Exception:
                    ddg_context = ""

            # Re-classify with DDG context if we got something
            if ddg_context:
                enriched = _rule_classify(f"{memo} {ddg_context}", vendor, category)
                if enriched["confidence"] != "low":
                    enriched["reason"] += " (verified via web search)"
                    enriched["source"] = "duckduckgo+rules"
                    results.append({
                        "vendor":             vendor,
                        "memo":               memo or "—",
                        "assigned_category":  category,
                        "suggested_category": enriched["suggested_category"],
                        "match":              enriched["match"],
                        "confidence":         enriched["confidence"],
                        "reason":             enriched["reason"],
                        "source":             enriched["source"],
                    })
                    continue

            results.append({
                "vendor":             vendor,
                "memo":               memo or "—",
                "assigned_category":  category,
                "suggested_category": rule["suggested_category"],
                "match":              rule["match"],
                "confidence":         rule["confidence"],
                "reason":             rule["reason"],
                "source":             rule["source"],
            })
    return results


async def _ai_reconcile(combos: list, api_key: str) -> list:
    """Use Claude with web_search to verify categories."""
    import httpx
    lines = "\n".join(
        f"{i+1}. Vendor: \"{c['Vendor']}\" | Memo: \"{c['Memo'] or '—'}\" | Assigned: \"{c['Category']}\""
        for i, c in enumerate(combos)
    )
    prompt = f"""You are an accounting reconciliation assistant. For each vendor transaction below:
1. Use the vendor name and memo to understand what the expense is (use web search if the vendor is unfamiliar)
2. Determine the correct accounting category
3. Check if the assigned category is correct

Transactions:
{lines}

Respond ONLY as a JSON array, one object per transaction in order:
[{{"vendor":"...","memo":"...","assigned_category":"...","suggested_category":"...","match":true/false,"confidence":"high/medium/low","reason":"one sentence"}}]"""

    try:
        async with httpx.AsyncClient() as hc:
            resp = await hc.post(
                "https://api.anthropic.com/v1/messages",
                headers={"x-api-key": api_key, "anthropic-version": "2023-06-01", "content-type": "application/json"},
                json={
                    "model": "claude-sonnet-4-20250514",
                    "max_tokens": 4096,
                    "tools": [{"type": "web_search_20250305", "name": "web_search"}],
                    "messages": [{"role": "user", "content": prompt}],
                },
                timeout=60.0,
            )
        content = resp.json().get("content", [])
        text = " ".join(b.get("text", "") for b in content if b.get("type") == "text")
        m = re.search(r"\[.*\]", text, re.DOTALL)
        ai = json.loads(m.group()) if m else None
        if ai:
            for r in ai:
                r.setdefault("source", "claude+web")
            return ai
    except Exception:
        pass
    return await _ddg_reconcile(combos)


def _apply_filters(df, vendor, start_date, end_date):
    df = df.copy()
    if vendor and vendor != "All":
        df = df[df["Vendor"] == vendor]
    if start_date:
        df = df[df["Date"] >= pd.to_datetime(start_date)]
    if end_date:
        df = df[df["Date"] <= pd.to_datetime(end_date)]
    return df
