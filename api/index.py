from fastapi import FastAPI, UploadFile, File, HTTPException
import pandas as pd
import numpy as np
import io, os, json, re, csv
from datetime import datetime
from typing import Optional
from urllib.parse import quote_plus

app = FastAPI()

# ── Transaction type sets ─────────────────────────────────────────────────────
EXPENSE_TX_TYPES = {
    "cash expense", "credit card expense", "bill", "check", "expense",
    "journal entry", "bill payment", "bill payment (check)",
    "bill payment (credit card)", "purchase order", "paycheck",
    "liability payment", "inventory qty adjust",
}
SKIP_TX_TYPES = {"bill payment (check)", "bill payment (credit card)", "liability payment"}

# ── QB category normalisation ─────────────────────────────────────────────────
QB_TO_STANDARD = {
    "meals and entertainment":                             "Meals & Entertainment",
    "meals & entertainment":                               "Meals & Entertainment",
    "travel":                                              "Travel & Transportation",
    "travel expense":                                      "Travel & Transportation",
    "automobile":                                          "Travel & Transportation",
    "automobile:fuel":                                     "Travel & Transportation",
    "automobile:auto insurance":                           "Travel & Transportation",
    "automobile:repairs and maintenance":                  "Repairs & Maintenance",
    "utilities":                                           "Utilities",
    "utilities:telephone":                                 "Utilities",
    "utilities:gas and electric":                          "Utilities",
    "utilities:water":                                     "Utilities",
    "telephone":                                           "Utilities",
    "legal & professional fees":                           "Legal & Professional Fees",
    "legal & professional fees:bookkeeper":                "Legal & Professional Fees",
    "legal & professional fees:accounting":                "Legal & Professional Fees",
    "legal & professional fees:lawyer":                    "Legal & Professional Fees",
    "professional fees":                                   "Legal & Professional Fees",
    "insurance":                                           "Insurance",
    "insurance:disability insurance":                      "Insurance",
    "insurance:liability insurance":                       "Insurance",
    "insurance:workers compensation":                      "Insurance",
    "rent or lease":                                       "Rent & Facilities",
    "rent or lease:equipment rental":                      "Rent & Facilities",
    "rent or lease:other":                                 "Rent & Facilities",
    "equipment rental":                                    "Rent & Facilities",
    "job expenses":                                        "Materials & Inventory",
    "job expenses:job materials":                          "Materials & Inventory",
    "job expenses:job materials:plants and soil":          "Materials & Inventory",
    "job expenses:job materials:fountain and garden lighting": "Materials & Inventory",
    "job expenses:job materials:decks and patios":         "Materials & Inventory",
    "job expenses:job materials:sprinklers and drip systems": "Materials & Inventory",
    "landscaping services:job materials:plants and soil":  "Materials & Inventory",
    "cost of goods sold":                                  "Materials & Inventory",
    "maintenance and repair":                              "Repairs & Maintenance",
    "maintenance and repair:equipment repairs":            "Repairs & Maintenance",
    "maintenance and repair:building repairs":             "Repairs & Maintenance",
    "repairs":                                             "Repairs & Maintenance",
    "office supplies":                                     "Office Supplies & Equipment",
    "office expenses":                                     "Office Supplies & Equipment",
    "office supplies & software":                          "Office Supplies & Equipment",
    "advertising":                                         "Advertising & Marketing",
    "advertising and promotion":                           "Advertising & Marketing",
    "bank charges":                                        "Bank & Finance Charges",
    "bank service charges":                                "Bank & Finance Charges",
    "bank fees & service charges":                         "Bank & Finance Charges",
    "general business expenses:bank fees & service charges": "Bank & Finance Charges",
    "general business expenses:bank fees and service charges": "Bank & Finance Charges",
    "business expenses:bank fees":                         "Bank & Finance Charges",
    "finance charge":                                      "Bank & Finance Charges",
    "payroll expenses":                                    "Payroll & Contractors",
    "payroll expenses:wages":                              "Payroll & Contractors",
    "contractor":                                          "Payroll & Contractors",
    "purchase order":                                      "Materials & Inventory",
    "bill":                                                "Miscellaneous",
    "check":                                               "Miscellaneous",
    "uncategorized expense":                               "Miscellaneous",
    "miscellaneous":                                       "Miscellaneous",
    "ask my accountant":                                   "Miscellaneous",
    "opening balance equity":                              "Miscellaneous",
}

QB_PREFIX_MAP = [
    ("general business expenses:bank", "Bank & Finance Charges"),
    ("job expenses",                   "Materials & Inventory"),
    ("landscaping services",           "Materials & Inventory"),
    ("maintenance and repair",         "Repairs & Maintenance"),
    ("automobile",                     "Travel & Transportation"),
    ("legal & professional fees",      "Legal & Professional Fees"),
    ("insurance",                      "Insurance"),
    ("utilities",                      "Utilities"),
    ("payroll",                        "Payroll & Contractors"),
    ("rent or lease",                  "Rent & Facilities"),
    ("advertising",                    "Advertising & Marketing"),
    ("office",                         "Office Supplies & Equipment"),
]


def _normalise_category(cat: str) -> str:
    low = cat.strip().lower()
    if low in QB_TO_STANDARD:
        return QB_TO_STANDARD[low]
    for prefix, standard in QB_PREFIX_MAP:
        if low.startswith(prefix):
            return standard
    return cat.strip()


def _clean_amount(series: pd.Series) -> pd.Series:
    s = series.astype(str).str.replace(r"[,$₹€£\s]", "", regex=True)
    s = s.str.replace(r"^\((.+)\)$", r"-\1", regex=True)
    return pd.to_numeric(s, errors="coerce").fillna(0)


# ── Parsing ───────────────────────────────────────────────────────────────────
def _detect_quickbooks_vendor_xlsx(raw_bytes: bytes) -> bool:
    try:
        df = pd.read_excel(io.BytesIO(raw_bytes), header=None, nrows=5)
        return "transaction list by vendor" in str(df.iloc[0, 0]).strip().lower()
    except Exception:
        return False


def _detect_quickbooks_vendor_csv(raw_bytes: bytes) -> bool:
    try:
        text = raw_bytes.decode("utf-8", errors="ignore")[:500].lower()
        return "transaction list by vendor" in text or (
            "split" in text and ("transaction type" in text or "posting" in text)
        )
    except Exception:
        return False


def _parse_quickbooks_vendor_xlsx(raw_bytes: bytes) -> pd.DataFrame:
    df_raw = pd.read_excel(io.BytesIO(raw_bytes), header=None, dtype=str).fillna("")
    header_row_idx = None
    for i, row in df_raw.iterrows():
        if str(row.iloc[1]).strip().lower() == "date":
            header_row_idx = i
            break
    if header_row_idx is None:
        raise ValueError("Could not find column header row.")
    header = [str(c).strip().lower() for c in df_raw.iloc[header_row_idx]]
    col_date   = next((i for i, h in enumerate(header) if h == "date"), 1)
    col_txtype = next((i for i, h in enumerate(header) if "transaction type" in h), 2)
    col_memo   = next((i for i, h in enumerate(header) if "memo" in h), 5)
    col_acct   = next((i for i, h in enumerate(header) if "account" in h), 6)
    col_amount = next((i for i, h in enumerate(header) if h == "amount"), 7)
    col_split  = next((i for i, h in enumerate(header) if "split" in h), 8)
    internal_accts = {"accounts payable (a/p)", "accounts receivable (a/r)",
                      "checking", "mastercard", "savings", "credit card",
                      "visa", "amex", "discover", "-", "nan", ""}
    rows = []
    current_vendor = "Unknown"
    for i, row in df_raw.iloc[header_row_idx + 1:].iterrows():
        vendor_cell = str(row.iloc[0]).strip()
        date_cell   = str(row.iloc[col_date]).strip()
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
        amount_cell = str(row.iloc[col_amount]).strip()
        if txtype.lower() in SKIP_TX_TYPES and split.lower() in internal_accts:
            continue
        meaningful_memo = memo not in ("-", "nan", "") and memo.lower() not in internal_accts
        description = memo if meaningful_memo else ""
        category = split if split and split.lower() not in ("", "nan") else acct
        if category.lower() in internal_accts:
            category = acct if acct.lower() not in internal_accts else txtype
        rows.append({"Date": date_cell, "Vendor": current_vendor,
                     "Memo": description or "", "Amount": amount_cell,
                     "Category": category, "TxType": txtype})
    if not rows:
        raise ValueError("No transaction rows found.")
    df = pd.DataFrame(rows)
    df["Date"]     = pd.to_datetime(df["Date"], errors="coerce")
    df             = df.dropna(subset=["Date"])
    df["Amount"]   = _clean_amount(df["Amount"]).abs()
    df["Category"] = df["Category"].astype(str).str.strip().apply(_normalise_category)
    df["Vendor"]   = df["Vendor"].astype(str).str.strip()
    df["Month"]    = df["Date"].dt.to_period("M").astype(str)
    return df[["Date", "Vendor", "Memo", "Amount", "Category", "TxType", "Month"]]


def _parse_quickbooks_vendor_csv(raw_bytes: bytes) -> pd.DataFrame:
    text   = raw_bytes.decode("utf-8", errors="ignore")
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
        if non_empty[0].lower().startswith("total"):
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
        rows.append({"Date": date_val, "Vendor": current_vendor,
                     "Memo": get("Memo") or get("Account") or "",
                     "Amount": get("Amount"), "Category": get("Category"),
                     "TxType": txtype})
    df = pd.DataFrame(rows)
    df["Date"]     = pd.to_datetime(df["Date"], errors="coerce")
    df             = df.dropna(subset=["Date"])
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
        if "date" in low:                                             col_map["Date"] = col
        elif "vendor" in low or "payee" in low or "supplier" in low: col_map["Vendor"] = col
        elif "client" in low or "name" in low:                        col_map.setdefault("Vendor", col)
        elif "memo" in low or "desc" in low or "note" in low:        col_map["Memo"] = col
        elif "amount" in low or "value" in low:                       col_map["Amount"] = col
        elif "split" in low:                                           col_map["Category"] = col
        elif "cat" in low:                                             col_map["Category"] = col
    missing = [r for r in ["Date", "Vendor", "Amount", "Category"] if r not in col_map]
    if missing:
        raise ValueError(f"Missing columns: {missing}. Found: {list(df_raw.columns)}")
    df = df_raw.rename(columns={v: k for k, v in col_map.items()})
    df["Date"]     = pd.to_datetime(df["Date"], errors="coerce")
    df             = df.dropna(subset=["Date"])
    df["Amount"]   = _clean_amount(df["Amount"]).abs()
    df["Category"] = df["Category"].astype(str).str.strip().apply(_normalise_category)
    df["Vendor"]   = df["Vendor"].astype(str).str.strip()
    df["Memo"]     = df.get("Memo", pd.Series([""] * len(df))).fillna("").astype(str).str.strip()
    df["TxType"]   = ""
    df["Month"]    = df["Date"].dt.to_period("M").astype(str)
    return df[["Date", "Vendor", "Memo", "Amount", "Category", "TxType", "Month"]]


# ── Compute all dashboard data from a dataframe ───────────────────────────────
def _compute_all(df: pd.DataFrame) -> dict:
    """Compute summary, vendors, categories, trend and transactions all at once."""
    total = float(df["Amount"].sum())

    # Summary
    top_cat = df.groupby("Category")["Amount"].sum().idxmax() if not df.empty else None
    top_vnd = df.groupby("Vendor")["Amount"].sum().idxmax()   if not df.empty else None
    months  = df["Month"].nunique()
    summary = {
        "total_spend":       round(total, 2),
        "vendor_count":      int(df["Vendor"].nunique()),
        "transaction_count": int(len(df)),
        "avg_transaction":   round(float(df["Amount"].mean()), 2) if len(df) > 0 else 0,
        "top_category":      top_cat,
        "top_vendor":        top_vnd,
        "monthly_avg":       round(total / max(months, 1), 2),
        "categories":        int(df["Category"].nunique()),
    }

    # Vendors
    vendors = []
    for v, grp in df.groupby("Vendor"):
        spend   = float(grp["Amount"].sum())
        top_c   = grp.groupby("Category")["Amount"].sum().idxmax()
        vendors.append({
            "vendor":       v,
            "spend":        round(spend, 2),
            "pct_of_total": round(spend / total * 100, 1) if total > 0 else 0,
            "txn_count":    int(len(grp)),
            "avg_txn":      round(spend / len(grp), 2),
            "top_category": top_c,
            "last_date":    grp["Date"].max().strftime("%Y-%m-%d"),
        })
    vendors.sort(key=lambda x: x["spend"], reverse=True)

    # Categories
    cats = df.groupby("Category")["Amount"].agg(["sum", "count"]).reset_index()
    cats.columns = ["category", "amount", "count"]
    cats["pct"]    = (cats["amount"] / total * 100).round(1) if total > 0 else 0
    cats["amount"] = cats["amount"].round(2)
    categories = cats.sort_values("amount", ascending=False).to_dict("records")

    # Monthly trend
    monthly = df.groupby("Month")["Amount"].agg(["sum", "count"]).reset_index()
    monthly.columns = ["month", "spend", "transactions"]
    monthly["spend"] = monthly["spend"].round(2)
    trend = monthly.sort_values("month").to_dict("records")

    # Transactions (all, for client-side filtering)
    txns = []
    for _, row in df.sort_values("Date", ascending=False).iterrows():
        txns.append({
            "date":     row["Date"].strftime("%Y-%m-%d"),
            "vendor":   str(row["Vendor"]),
            "memo":     str(row["Memo"]),
            "amount":   float(row["Amount"]),
            "category": str(row["Category"]),
            "tx_type":  str(row["TxType"]),
        })

    # Reconciliation combos (vendor+memo+category, deduplicated)
    combos = (df[["Vendor", "Memo", "Category"]]
              .drop_duplicates()
              .to_dict("records"))

    return {
        "summary":     summary,
        "vendors":     vendors,
        "categories":  categories,
        "trend":       trend,
        "transactions": txns,
        "combos":      combos,
    }


# ── Category classifier ───────────────────────────────────────────────────────
CATEGORY_RULES = {
    "Bank & Finance Charges": [
        "bank fee", "bank charge", "service charge", "finance charge",
        "wire transfer", "transaction fee", "foreign exchange", "fx fee",
        "forex", "currency conversion", "rate adjustment", "exchange rate",
        "foreign transaction", "overdraft", "interest charge", "late fee",
        "annual fee", "monthly fee", "atm fee", "nsf fee", "returned item",
        "stripe fee", "paypal fee", "square fee", "merchant fee",
        "processing fee", "payment processing",
    ],
    "Meals & Entertainment": [
        "lunch", "dinner", "breakfast", "meal", "food", "restaurant", "coffee",
        "cafe", "catering", "snack", "drink", "burger", "pizza", "sushi",
        "entertainment", "concert", "event", "team lunch", "client dinner",
        "starbucks", "chipotle", "mcdonald", "subway", "doordash", "grubhub",
    ],
    "Travel & Transportation": [
        "flight", "airfare", "airline ticket", "hotel stay", "hotel booking",
        "airbnb", "uber ride", "lyft ride", "taxi", "car rental", "vehicle rental",
        "gas station", "fuel", "mileage", "parking fee", "toll", "train ticket",
        "transit pass", "travel expense", "accommodation", "lodging",
    ],
    "Software & Subscriptions": [
        "software", "subscription", "saas", "license", "app subscription",
        "tool subscription", "platform fee", "annual plan", "monthly plan",
        "slack", "zoom", "dropbox", "notion", "figma", "github", "gitlab",
        "jira", "asana", "hubspot", "salesforce", "adobe", "microsoft 365",
        "google workspace", "canva", "hootsuite", "mailchimp", "klaviyo",
        "ahrefs", "semrush", "datadog", "new relic", "hotjar", "buffer",
    ],
    "Cloud & Hosting": [
        "aws", "amazon web services", "azure", "google cloud", "gcp", "heroku",
        "digitalocean", "linode", "vultr", "cloudflare", "web hosting",
        "server hosting", "compute instance", "gpu compute", "cloud storage",
        "cdn", "bandwidth", "ec2", "s3 storage", "rds", "docker hub",
    ],
    "Advertising & Marketing": [
        "google ads", "facebook ads", "meta ads", "linkedin ads", "yelp ads",
        "twitter ads", "ppc campaign", "ad campaign", "ad spend",
        "advertising spend", "sponsored post", "influencer", "seo service",
        "marketing agency",
    ],
    "Office Supplies & Equipment": [
        "office supplies", "stationery", "printer paper", "toner cartridge",
        "office equipment", "computer equipment", "laptop purchase",
        "keyboard", "headset", "office furniture", "staples", "office depot",
    ],
    "Utilities": [
        "electricity bill", "electric bill", "gas bill", "water bill",
        "internet bill", "broadband", "phone bill", "telephone bill",
        "mobile bill", "cell phone", "utility payment", "utility service",
    ],
    "Legal & Professional Fees": [
        "legal fee", "attorney fee", "lawyer", "law firm", "legal services",
        "bookkeeping", "bookkeeper", "accounting fee", "cpa fee", "audit fee",
        "tax preparation", "consulting fee", "professional services",
    ],
    "Insurance": [
        "insurance premium", "insurance payment", "liability insurance",
        "workers compensation", "health insurance", "auto insurance",
        "business insurance", "policy payment",
    ],
    "Rent & Facilities": [
        "office rent", "rent payment", "lease payment", "coworking space",
        "storage unit rental", "warehouse rent", "facility maintenance",
        "janitorial", "cleaning service",
    ],
    "Payroll & Contractors": [
        "payroll", "direct deposit", "salary payment", "contractor payment",
        "freelancer payment", "subcontractor", "staffing agency",
    ],
    "Materials & Inventory": [
        "materials", "inventory", "raw materials", "supplies purchase",
        "parts", "components", "merchandise", "product purchase",
        "lumber", "hardware purchase", "tools purchase",
    ],
    "Repairs & Maintenance": [
        "repair service", "maintenance service", "equipment repair",
        "building repair", "vehicle repair", "hvac", "it support",
    ],
}

VENDOR_CATEGORY_MAP = {
    "at&t": "Utilities", "verizon": "Utilities", "comcast": "Utilities",
    "spectrum": "Utilities", "pg&e": "Utilities", "pacific gas": "Utilities",
    "amazon web services": "Cloud & Hosting", "aws": "Cloud & Hosting",
    "google cloud": "Cloud & Hosting", "microsoft azure": "Cloud & Hosting",
    "digitalocean": "Cloud & Hosting", "heroku": "Cloud & Hosting",
    "cloudflare": "Cloud & Hosting",
    "google ads": "Advertising & Marketing", "facebook ads": "Advertising & Marketing",
    "meta ads": "Advertising & Marketing", "yelp": "Advertising & Marketing",
    "slack": "Software & Subscriptions", "zoom": "Software & Subscriptions",
    "adobe": "Software & Subscriptions", "github": "Software & Subscriptions",
    "figma": "Software & Subscriptions", "asana": "Software & Subscriptions",
    "notion": "Software & Subscriptions", "quickbooks": "Software & Subscriptions",
    "hubspot": "Software & Subscriptions", "dropbox": "Software & Subscriptions",
    "datadog": "Software & Subscriptions",
    "stripe": "Bank & Finance Charges", "paypal": "Bank & Finance Charges",
    "state farm": "Insurance", "brosnahan insurance": "Insurance",
    "allstate": "Insurance", "progressive": "Insurance",
    "home depot": "Materials & Inventory", "lowes": "Materials & Inventory",
    "staples": "Office Supplies & Equipment",
    "marriott": "Travel & Transportation", "hilton": "Travel & Transportation",
    "airbnb": "Travel & Transportation", "united airlines": "Travel & Transportation",
    "delta airlines": "Travel & Transportation", "southwest airlines": "Travel & Transportation",
    "uber": "Travel & Transportation", "lyft": "Travel & Transportation",
    "hertz": "Travel & Transportation",
    "starbucks": "Meals & Entertainment", "chipotle": "Meals & Entertainment",
}

MEMO_OVERRIDE_PATTERNS = [
    (["foreign exchange", "fx fee", "forex", "rate adjustment",
       "exchange rate", "foreign transaction", "currency conversion",
       "wire fee", "wire transfer fee"], "Bank & Finance Charges"),
    (["bank fee", "bank charge", "service charge", "finance charge",
       "overdraft", "nsf", "returned item"], "Bank & Finance Charges"),
    (["payroll", "direct deposit", "ach transfer salary"], "Payroll & Contractors"),
    (["insurance premium", "policy payment", "workers comp"], "Insurance"),
    (["rent payment", "lease payment", "office rent"], "Rent & Facilities"),
]


def _canon(s: str) -> str:
    return s.lower().replace(" and ", " & ").replace("  ", " ").strip()


def _strip_location(name: str) -> str:
    return re.sub(r'\s*\([^)]{2,30}\)\s*$', '', name).strip()


def _infer_from_name(vendor: str) -> str:
    v = vendor.lower()
    has_city = bool(re.search(r'\([A-Z][a-z]+\)$', vendor))
    if any(s in v for s in ["grill", "bbq", "burger", "pizza", "sushi", "café",
                             "cafe", "bistro", "kitchen", "diner", "eatery",
                             "restaurant", "tavern", "steakhouse", "taqueria",
                             "noodle", "seafood", "bakery", "brewery", "pub "]):
        return "restaurant"
    if any(s in v for s in ["hotel", " inn", "suites", "resort", "lodge", "motel"]):
        return "hotel"
    if any(s in v for s in ["bank", "credit union", "capital one",
                             "chase", "wells fargo", "citibank"]):
        return "bank"
    if any(s in v for s in ["shell", "chevron", "exxon", "mobil", "arco", "valero"]):
        return "gas_station"
    if has_city:
        return "local_business"
    return ""


TYPE_TO_CATEGORY = {
    "restaurant": "Meals & Entertainment",
    "hotel":      "Travel & Transportation",
    "bank":       "Bank & Finance Charges",
    "gas_station":"Travel & Transportation",
}


def _rule_classify(memo: str, vendor: str, assigned_cat: str) -> dict:
    memo_lower   = (memo or "").lower().strip()
    vendor_lower = (vendor or "").lower().strip()
    assigned_standard = _normalise_category(assigned_cat)

    # 1. Memo override
    for patterns, cat in MEMO_OVERRIDE_PATTERNS:
        if any(p in memo_lower for p in patterns):
            match = _canon(cat) == _canon(assigned_standard)
            return {"suggested_category": cat, "match": match, "confidence": "high",
                    "reason": f"Memo pattern matches '{cat}'" if match
                              else f"Memo indicates '{cat}' but assigned '{assigned_standard}'",
                    "source": "rule-based"}

    # 2. Vendor map
    for vendor_key, cat in VENDOR_CATEGORY_MAP.items():
        if vendor_key in vendor_lower:
            match = _canon(cat) == _canon(assigned_standard)
            return {"suggested_category": cat, "match": match, "confidence": "high",
                    "reason": f"Known vendor '{vendor}' → {cat}" if match
                              else f"Vendor '{vendor}' → {cat} but assigned '{assigned_standard}'",
                    "source": "rule-based"}

    # 3. Keyword scoring
    text = f"{memo_lower} {vendor_lower}"
    best_cat, best_score = "Miscellaneous", 0
    for cat, keywords in CATEGORY_RULES.items():
        score = sum(2 for kw in keywords if len(kw) > 6 and kw in text)
        score += sum(1 for kw in keywords if 3 < len(kw) <= 6 and kw in text)
        if score > best_score:
            best_score, best_cat = score, cat

    suggested  = best_cat if best_score > 0 else assigned_standard
    confidence = "high" if best_score >= 4 else "medium" if best_score >= 2 else "low"
    if not memo or memo in ("—", "nan", ""):
        confidence = "low"

    match = _canon(suggested) == _canon(assigned_standard)
    return {"suggested_category": suggested, "match": match, "confidence": confidence,
            "reason": f"Keywords match '{suggested}'" if match and best_score > 0
                      else f"Expected '{suggested}' but assigned '{assigned_standard}'" if not match
                      else f"No strong match — keeping '{assigned_standard}'",
            "source": "rule-based"}


# ── Endpoints ─────────────────────────────────────────────────────────────────
@app.get("/api/health")
def api_health():
    return {"status": "ok"}


@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    if not file.filename.endswith((".csv", ".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Only CSV or Excel files are supported.")
    contents = await file.read()
    is_csv   = file.filename.endswith(".csv")
    is_xlsx  = file.filename.endswith((".xlsx", ".xls"))

    try:
        if is_xlsx and _detect_quickbooks_vendor_xlsx(contents):
            df  = _parse_quickbooks_vendor_xlsx(contents)
            fmt = "quickbooks-vendor"
        elif is_csv and _detect_quickbooks_vendor_csv(contents):
            df  = _parse_quickbooks_vendor_csv(contents)
            fmt = "quickbooks-vendor"
        else:
            df_raw = pd.read_csv(io.BytesIO(contents)) if is_csv else pd.read_excel(io.BytesIO(contents))
            df     = _parse_standard(df_raw)
            fmt    = "standard"
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not parse file: {str(e)}")

    # Compute everything now — no server state needed
    computed = _compute_all(df)

    return {
        "file_format":    fmt,
        "rows":           len(df),
        "vendor_count":   int(df["Vendor"].nunique()),
        "total_spend":    round(float(df["Amount"].sum()), 2),
        "date_range":     {"min": df["Date"].min().strftime("%Y-%m-%d"),
                           "max": df["Date"].max().strftime("%Y-%m-%d")},
        "vendor_list":    sorted(df["Vendor"].unique().tolist()),
        "category_list":  sorted(df["Category"].unique().tolist()),
        **computed,
    }


@app.post("/api/reconcile")
async def reconcile(payload: dict):
    combos = payload.get("combos", [])
    if not combos:
        return {"results": [], "summary": {"total": 0, "match": 0, "mismatch": 0, "uncertain": 0}}

    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if api_key:
        results = await _ai_reconcile(combos, api_key)
    else:
        results = await _ddg_reconcile(combos)

    match_count    = sum(1 for r in results if r["match"] and r["confidence"] != "low")
    mismatch_count = sum(1 for r in results if not r["match"])
    uncertain      = sum(1 for r in results if r["confidence"] == "low")
    total          = len(results)
    accuracy       = round(match_count / max(total - uncertain, 1) * 100, 1)

    return {
        "results": results,
        "summary": {
            "total":    total, "match": match_count,
            "mismatch": mismatch_count, "uncertain": uncertain,
            "accuracy": accuracy,
            "source":   "claude+web" if api_key else "duckduckgo+rules",
        },
    }


async def _ddg_reconcile(combos: list) -> list:
    import httpx
    results = []
    vendor_context: dict = {}

    async def _ddg_lookup(hc, query: str) -> str:
        try:
            resp = await hc.get(
                f"https://api.duckduckgo.com/?q={quote_plus(query)}&format=json&no_html=1&skip_disambig=1",
                headers={"User-Agent": "Mozilla/5.0"}, timeout=6.0)
            data = resp.json()
            return (data.get("AbstractText", "") or data.get("Answer", "") or
                    " ".join(t.get("Text", "") for t in data.get("RelatedTopics", [])[:3]
                             if isinstance(t, dict)))[:500]
        except Exception:
            return ""

    async with httpx.AsyncClient(timeout=10.0) as hc:
        for c in combos:
            vendor = c["Vendor"]
            if vendor in vendor_context:
                continue
            clean = _strip_location(vendor)
            ctx = ""
            for query in [f"{clean} restaurant food", f"{clean} business", vendor]:
                ctx = await _ddg_lookup(hc, query)
                if ctx and len(ctx) > 30:
                    break
            vendor_context[vendor] = (ctx, _infer_from_name(vendor))

        for c in combos:
            vendor   = c["Vendor"]
            memo     = c["Memo"] or ""
            category = c["Category"]
            ctx, inferred = vendor_context.get(vendor, ("", ""))
            enriched = f"{memo} {ctx}".strip() if ctx else memo
            rule = _rule_classify(enriched, vendor, category)

            if rule["confidence"] == "low" and inferred:
                cat = TYPE_TO_CATEGORY.get(inferred,
                      "Meals & Entertainment" if inferred == "local_business" else None)
                if cat:
                    assigned_std = _normalise_category(category)
                    match = _canon(cat) == _canon(assigned_std)
                    rule = {"suggested_category": cat, "match": match, "confidence": "medium",
                            "reason": f"Vendor name suggests '{cat}'" + (" (web-verified)" if ctx else ""),
                            "source": "name-heuristic"}

            source = "duckduckgo+rules" if ctx else ("name-heuristic" if inferred else "rule-based")
            if ctx and rule.get("confidence") != "low":
                if "(web-verified)" not in rule.get("reason", ""):
                    rule["reason"] += " (web-verified)"

            results.append({
                "vendor": vendor, "memo": memo or "—",
                "assigned_category":  category,
                "suggested_category": rule["suggested_category"],
                "match":              rule["match"],
                "confidence":         rule["confidence"],
                "reason":             rule["reason"],
                "source":             source,
            })
    return results


async def _ai_reconcile(combos: list, api_key: str) -> list:
    import httpx
    lines = "\n".join(
        f"{i+1}. Vendor: \"{c['Vendor']}\" | Memo: \"{c['Memo'] or '—'}\" | Assigned: \"{c['Category']}\""
        for i, c in enumerate(combos)
    )
    prompt = f"""You are an accounting reconciliation assistant. For each vendor transaction:
1. Use vendor name and memo to identify what the expense is (search web if needed)
2. Determine the correct accounting category
3. Check if assigned category is correct

Transactions:
{lines}

Respond ONLY as a JSON array:
[{{"vendor":"...","memo":"...","assigned_category":"...","suggested_category":"...","match":true/false,"confidence":"high/medium/low","reason":"one sentence"}}]"""
    try:
        async with httpx.AsyncClient() as hc:
            resp = await hc.post("https://api.anthropic.com/v1/messages",
                headers={"x-api-key": api_key, "anthropic-version": "2023-06-01",
                         "content-type": "application/json"},
                json={"model": "claude-sonnet-4-20250514", "max_tokens": 4096,
                      "tools": [{"type": "web_search_20250305", "name": "web_search"}],
                      "messages": [{"role": "user", "content": prompt}]},
                timeout=60.0)
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
