from fastapi import FastAPI, UploadFile, File, HTTPException
import pandas as pd
import numpy as np
import io, os, json, re
from datetime import datetime
from typing import Optional

app = FastAPI()
_processed_data: Optional[pd.DataFrame] = None


REVENUE_TX_TYPES = {"invoice", "payment", "sales receipt", "deposit", "credit memo", "refund"}
EXPENSE_TX_TYPES = {"cash expense", "credit card expense", "bill", "check", "expense",
                    "journal entry", "bill payment", "bill payment (check)",
                    "bill payment (credit card)", "purchase order", "paycheck", "liability payment"}


def _clean_amount(series: pd.Series) -> pd.Series:
    """Strip currency symbols, remove parentheses (accounting negatives), parse to float."""
    s = series.astype(str).str.replace(r"[,$₹€£\s]", "", regex=True)
    # Accounting format: (123.45) → -123.45
    s = s.str.replace(r"^\((.+)\)$", r"-\1", regex=True)
    return pd.to_numeric(s, errors="coerce").fillna(0)


def _detect_quickbooks_vendor_xlsx(raw_bytes: bytes) -> bool:
    """Check if an XLSX file is a QuickBooks Transaction List by Vendor report."""
    try:
        df = pd.read_excel(io.BytesIO(raw_bytes), header=None, nrows=5)
        cell = str(df.iloc[0, 0]).strip().lower()
        return "transaction list by vendor" in cell
    except Exception:
        return False


def _parse_quickbooks_vendor_xlsx(raw_bytes: bytes) -> pd.DataFrame:
    """
    Parse a QuickBooks 'Transaction List by Vendor' XLSX file.

    Layout (0-indexed rows):
      0: "Transaction List by Vendor"
      1: Company name
      2: Date range
      3: blank
      4: Column headers — col0=blank, col1=Date, col2=Transaction type,
                          col3=Num, col4=Posting, col5=Memo,
                          col6=Account full name, col7=Amount, col8=Split
      5+: Vendor header rows (col0=vendor name, col1–8 NaN)
          Data rows       (col0=NaN, col1=date, ..., col7=amount, col8=split)
          Total rows      (col0 starts with "Total for" or col1=="TOTAL")
    """
    df_raw = pd.read_excel(io.BytesIO(raw_bytes), header=None, dtype=str)
    df_raw = df_raw.fillna("")

    # Find header row: the one where col1 == "Date" (case-insensitive)
    header_row_idx = None
    for i, row in df_raw.iterrows():
        if str(row.iloc[1]).strip().lower() == "date":
            header_row_idx = i
            break
    if header_row_idx is None:
        raise ValueError("Could not find column header row in QuickBooks XLSX export.")

    # Map column positions from header row
    header = [str(c).strip().lower() for c in df_raw.iloc[header_row_idx]]
    # col positions
    col_date   = next((i for i, h in enumerate(header) if h == "date"), 1)
    col_txtype = next((i for i, h in enumerate(header) if "transaction type" in h), 2)
    col_memo   = next((i for i, h in enumerate(header) if "memo" in h), 5)
    col_acct   = next((i for i, h in enumerate(header) if "account" in h), 6)
    col_amount = next((i for i, h in enumerate(header) if h == "amount"), 7)
    col_split  = next((i for i, h in enumerate(header) if "split" in h), 8)
    col_vendor = 0   # vendor name always in column 0

    rows = []
    current_vendor = "Unknown"

    for i, row in df_raw.iloc[header_row_idx + 1:].iterrows():
        vendor_cell = str(row.iloc[col_vendor]).strip()
        date_cell   = str(row.iloc[col_date]).strip()
        amount_cell = str(row.iloc[col_amount]).strip()

        # Skip empty rows and grand total / footer rows
        if not vendor_cell and not date_cell:
            continue
        if date_cell.upper() == "TOTAL":
            continue
        if vendor_cell.lower().startswith("total for") or vendor_cell.lower() == "total":
            continue
        # Skip timestamp footer (e.g. "Monday, April 27 ...")
        if re.match(r"^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)", vendor_cell.lower()):
            continue

        # Vendor header row: col0 has text, date cell is empty
        if vendor_cell and not date_cell:
            current_vendor = re.sub(r"\s*\(\d+\)\s*$", "", vendor_cell).strip()
            continue

        # Data row: date cell has a value
        if not date_cell:
            continue

        memo   = str(row.iloc[col_memo]).strip()
        acct   = str(row.iloc[col_acct]).strip()
        txtype = str(row.iloc[col_txtype]).strip()
        split  = str(row.iloc[col_split]).strip()

        # Description: prefer Memo, fall back to Account
        description = memo if memo and memo not in ("-", "nan", "") else acct

        # Category: use Split column; fall back to Account if Split is an account ref
        category = split if split and split not in ("", "nan") else acct
        # If category looks like an internal account (Accounts Payable, Checking, etc.) use Account name
        internal_accounts = {"accounts payable (a/p)", "accounts receivable (a/r)",
                             "checking", "mastercard", "savings", "credit card"}
        if category.lower() in internal_accounts:
            category = acct if acct.lower() not in internal_accounts else txtype

        rows.append({
            "Date":        date_cell,
            "Client_Name": current_vendor,
            "Description": description or "—",
            "Amount":      amount_cell,
            "Category":    category or txtype,
            "TxType":      txtype,
        })

    if not rows:
        raise ValueError("No transaction rows found in QuickBooks XLSX export.")

    df = pd.DataFrame(rows)
    df["Date"]   = pd.to_datetime(df["Date"], errors="coerce")
    df = df.dropna(subset=["Date"])
    df["Amount"] = _clean_amount(df["Amount"]).abs()
    df["Category"]    = df["Category"].astype(str).str.strip()
    df["Client_Name"] = df["Client_Name"].astype(str).str.strip()

    revenue_kw = ["revenue", "income", "sales", "payment", "receipt", "invoice"]

    def classify(row_s):
        tx = str(row_s.get("TxType", "")).strip().lower()
        if tx in EXPENSE_TX_TYPES:  return "Expense"
        if tx in REVENUE_TX_TYPES:  return "Revenue"
        cat = str(row_s.get("Category", "")).lower()
        if any(k in cat for k in revenue_kw): return "Revenue"
        return "Expense"

    df["Type"]  = df.apply(classify, axis=1)
    df["Month"] = df["Date"].dt.to_period("M").astype(str)
    return df[["Date", "Client_Name", "Description", "Amount", "Category", "Type", "Month"]]




def _detect_quickbooks_vendor_csv(raw_bytes: bytes) -> bool:
    """Return True if a CSV looks like a QuickBooks Transaction List by Vendor."""
    try:
        text = raw_bytes.decode("utf-8", errors="ignore")
    except Exception:
        return False
    first = text[:500].lower()
    return "transaction list by vendor" in first or (
        "split" in first and ("transaction type" in first or "posting" in first)
    )


    """
    Parse a QuickBooks 'Transaction List by Vendor' CSV/export.

    Format:
      Row 0+: report title lines (skip until we hit the column header row)
      Vendor section header: single non-empty cell with vendor name (and optional " (N)")
      Data rows: Date, Transaction type, Num, Posting, Memo, Account full name, Amount, Split
      Summary row: starts with "Total for ..." → skip
    """
    import csv

    text = raw_bytes.decode("utf-8", errors="ignore")
    reader = list(csv.reader(io.StringIO(text)))

    # Find the column header row — the one that contains "date" and "amount"
    header_idx = None
    for i, row in enumerate(reader):
        low = [c.strip().lower() for c in row]
        if "date" in low and "amount" in low:
            header_idx = i
            break

    if header_idx is None:
        raise ValueError("Could not find column header row in QuickBooks export.")

    headers = [c.strip() for c in reader[header_idx]]

    # Map QuickBooks columns to our standard names
    col_idx = {}
    for i, h in enumerate(headers):
        hl = h.lower()
        if hl == "date":                          col_idx["Date"] = i
        elif "transaction type" in hl:            col_idx["TxType"] = i
        elif "memo" in hl or "description" in hl: col_idx["Description"] = i
        elif "account" in hl:                     col_idx["Account"] = i
        elif hl == "amount":                      col_idx["Amount"] = i
        elif "split" in hl:                       col_idx["Category"] = i
        elif "num" in hl:                         col_idx["Num"] = i

    required = ["Date", "Amount", "Category"]
    missing = [r for r in required if r not in col_idx]
    if missing:
        raise ValueError(f"QuickBooks export missing columns: {missing}. Found: {headers}")

    rows = []
    current_vendor = "Unknown"

    for row in reader[header_idx + 1:]:
        # Skip blank rows
        non_empty = [c.strip() for c in row if c.strip()]
        if not non_empty:
            continue

        # Detect "Total for ..." summary rows → skip
        first = non_empty[0].lower()
        if first.startswith("total for") or first.startswith("total"):
            continue

        # Detect vendor section header:
        # It's a row where the first cell has text but has no valid date in the Date column
        date_val = row[col_idx["Date"]].strip() if col_idx.get("Date") is not None and len(row) > col_idx["Date"] else ""
        try:
            pd.to_datetime(date_val, errors="raise")
            is_data_row = True
        except Exception:
            is_data_row = False

        if not is_data_row:
            # Vendor header — strip trailing " (N)" like "Bob's Burger Joint (3)"
            raw_vendor = non_empty[0].strip()
            current_vendor = re.sub(r"\s*\(\d+\)\s*$", "", raw_vendor).strip()
            continue

        # Data row — extract fields safely
        def get(key, default=""):
            idx = col_idx.get(key)
            if idx is None or idx >= len(row):
                return default
            return row[idx].strip()

        rows.append({
            "Date":        get("Date"),
            "Client_Name": current_vendor,
            "Description": get("Description") or get("Account") or get("Num") or "—",
            "Amount":      get("Amount"),
            "Category":    get("Category"),
            "TxType":      get("TxType"),
        })

    if not rows:
        raise ValueError("No transaction rows found in QuickBooks export.")

    df = pd.DataFrame(rows)
    df["Date"] = pd.to_datetime(df["Date"], errors="coerce")
    df = df.dropna(subset=["Date"])
    df["Amount"] = _clean_amount(df["Amount"])
    df["Amount"] = df["Amount"].abs()   # store absolute; Type determines sign direction
    df["Category"] = df["Category"].astype(str).str.strip()
    df["Client_Name"] = df["Client_Name"].astype(str).str.strip()

    # Determine Revenue vs Expense
    # Priority: Transaction type field → then category keywords → then sign of original amount
    revenue_kw = ["revenue", "income", "sales", "payment", "receipt", "invoice"]

    def classify(row_s):
        tx = row_s.get("TxType", "").strip().lower()
        if tx in EXPENSE_TX_TYPES:
            return "Expense"
        if tx in REVENUE_TX_TYPES:
            return "Revenue"
        cat = row_s.get("Category", "").lower()
        if any(k in cat for k in revenue_kw):
            return "Revenue"
        return "Expense"

    df["Type"] = df.apply(classify, axis=1)
    df["Month"] = df["Date"].dt.to_period("M").astype(str)
    return df[["Date", "Client_Name", "Description", "Amount", "Category", "Type", "Month"]]


def process_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """Standard CSV format: flat table with named columns."""
    df.columns = [c.strip().title().replace(" ", "_") for c in df.columns]
    col_map = {}
    for col in df.columns:
        low = col.lower()
        if "date" in low:                        col_map["Date"] = col
        elif "client" in low or "name" in low:   col_map["Client_Name"] = col
        elif "desc" in low or "memo" in low:     col_map["Description"] = col
        elif "amount" in low or "value" in low:  col_map["Amount"] = col
        elif "split" in low:                     col_map["Category"] = col   # QuickBooks flat export
        elif "cat" in low:                       col_map["Category"] = col
        elif "type" in low and "Category" not in col_map:
            col_map["Category"] = col
    missing = [r for r in ["Date", "Client_Name", "Amount", "Category"] if r not in col_map]
    if missing:
        raise ValueError(f"Missing required columns: {missing}. Found: {list(df.columns)}")
    df = df.rename(columns={v: k for k, v in col_map.items()})
    df["Date"] = pd.to_datetime(df["Date"], errors="coerce")
    df = df.dropna(subset=["Date"])
    df["Amount"] = _clean_amount(df["Amount"]).abs()
    df["Category"] = df["Category"].astype(str).str.strip()
    revenue_kw = ["revenue", "income", "sales", "payment", "receipt", "invoice"]
    # Check for a Transaction_Type column for QuickBooks flat exports
    tx_col = next((c for c in df.columns if "transaction" in c.lower() and "type" in c.lower()), None)
    if tx_col:
        def classify_flat(row_s):
            tx = str(row_s.get(tx_col, "")).strip().lower()
            if tx in EXPENSE_TX_TYPES: return "Expense"
            if tx in REVENUE_TX_TYPES: return "Revenue"
            return "Revenue" if any(k in str(row_s.get("Category","")).lower() for k in revenue_kw) else "Expense"
        df["Type"] = df.apply(classify_flat, axis=1)
    else:
        df["Type"] = df["Category"].apply(
            lambda c: "Revenue" if any(k in c.lower() for k in revenue_kw) else "Expense"
        )
    df["Month"] = df["Date"].dt.to_period("M").astype(str)
    df["Client_Name"] = df["Client_Name"].astype(str).str.strip()
    return df


def health_score(margin, trend_pct, days_since):
    pts = 0
    if margin >= 40: pts += 40
    elif margin >= 25: pts += 30
    elif margin >= 10: pts += 20
    elif margin >= 0: pts += 10
    if trend_pct > 15: pts += 35
    elif trend_pct > 5: pts += 28
    elif trend_pct > 0: pts += 20
    elif trend_pct > -10: pts += 10
    if days_since <= 30: pts += 25
    elif days_since <= 60: pts += 15
    elif days_since <= 90: pts += 5
    if pts >= 75: grade, label, color = "A", "Excellent", "#34d399"
    elif pts >= 50: grade, label, color = "B", "Good", "#22d3ee"
    elif pts >= 28: grade, label, color = "C", "Fair", "#fbbf24"
    else: grade, label, color = "D", "At Risk", "#fb7185"
    return {"grade": grade, "label": label, "color": color, "score": pts}


def linear_forecast(values, n=3):
    k = len(values)
    if k < 2:
        return [float(values[-1]) if values else 0.0] * n
    x = list(range(k))
    xm = sum(x) / k
    ym = sum(values) / k
    denom = sum((xi - xm) ** 2 for xi in x) or 1
    slope = sum((xi - xm) * (yi - ym) for xi, yi in zip(x, values)) / denom
    intercept = ym - slope * xm
    return [max(0.0, round(intercept + slope * (k + i), 2)) for i in range(n)]


def rule_based_insights(summary, clients, alerts):
    margin = summary.get("profit_margin", 0)
    net = summary.get("net_profit", 0)
    total_rev = summary.get("total_revenue", 0)
    n = len(clients)
    wins, risks, actions = [], [], []

    if margin >= 30:
        wins.append(f"Exceptional profit margin of {margin:.1f}% — well above the healthy 20% benchmark")
    elif margin >= 15:
        wins.append(f"Solid profit margin of {margin:.1f}% — above the service-business average")
    up = [c for c in clients if c.get("trend_dir") == "up"]
    if up:
        best = max(up, key=lambda c: c.get("trend_pct", 0))
        wins.append(f"{best['client']} is your fastest-growing client at {best['trend_pct']:+.1f}% MoM")
    if clients:
        top = clients[0]
        wins.append(f"{top['client']} leads with ${top['profit']:,.0f} net profit and {top['margin']:.1f}% margin")
    hi = [c for c in clients if c.get("margin", 0) >= 40]
    if hi:
        wins.append(f"{len(hi)} client(s) deliver 40%+ margins — premium relationships worth protecting")

    if alerts:
        risks.append(f"{len(alerts)} client(s) have gone quiet — aging invoices may signal churn risk")
    at_risk = [c for c in clients if c.get("health", {}).get("grade") == "D"]
    if at_risk:
        risks.append(f"{at_risk[0]['client']} is rated At Risk — immediate action needed")
    if clients and total_rev > 0:
        top_pct = clients[0]["revenue"] / total_rev * 100
        if top_pct > 40:
            risks.append(f"{clients[0]['client']} is {top_pct:.0f}% of revenue — dangerous concentration")
    low_margin = [c for c in clients if 0 < c.get("margin", 0) < 15]
    if low_margin:
        c = low_margin[0]
        risks.append(f"{c['client']} has a thin {c['margin']:.1f}% margin — likely under-priced")
    down = [c for c in clients if c.get("trend_dir") == "down"]
    if down:
        worst = min(down, key=lambda c: c.get("trend_pct", 0))
        risks.append(f"{worst['client']} revenue fell {abs(worst['trend_pct']):.1f}% MoM — investigate the cause")

    if alerts:
        a = alerts[0]
        actions.append(f"Reconnect with {a['client']} — {a['days_since_invoice']} days since last invoice. A quick call can reopen the relationship")
    if low_margin:
        c = low_margin[0]
        gain = c["revenue"] * 0.10
        actions.append(f"Renegotiate {c['client']}'s contract — a 10% rate increase adds ${gain:,.0f} directly to profit")
    if up:
        best = max(up, key=lambda c: c.get("trend_pct", 0))
        actions.append(f"Expand scope with {best['client']} while momentum is high — propose a retainer or add-on services")
    if n <= 3:
        actions.append("Diversify urgently — fewer than 4 clients is high-risk. Aim for 6–8 active clients")
    if not actions:
        actions.append("Schedule quarterly business reviews with all clients to surface upsell opportunities")

    key = (
        f"Profit margin is {margin:.1f}% — target is 25%+. Raise rates or cut your top expense category to close the gap"
        if margin < 25 else
        f"Net profit at ${net:,.0f} is strong. Protect it by diversifying revenue across more clients"
    )
    return {
        "executive_summary": (
            f"Your business generated ${total_rev:,.0f} in revenue with a {margin:.1f}% profit margin across {n} client(s). "
            + ("Financial health looks strong — focus on scaling." if margin >= 25
               else "Margins have room to grow — pricing and client mix are the key levers.")
        ),
        "wins": wins[:3] or ["Revenue is flowing — a solid foundation to build on"],
        "risks": risks[:3] or ["Monitor client concentration and invoice aging proactively"],
        "actions": actions[:3] or ["Review pricing annually and benchmark against market rates"],
        "key_metric": key,
        "source": "rule-based",
    }


@app.get("/api/health")
def api_health():
    return {"status": "ok"}


@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    global _processed_data
    if not file.filename.endswith((".csv", ".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Only CSV or Excel files are supported.")
    contents = await file.read()

    # ── Detect QuickBooks format (CSV or XLSX) ──────────────────────────────
    is_csv  = file.filename.endswith(".csv")
    is_xlsx = file.filename.endswith((".xlsx", ".xls"))
    is_qb_csv  = is_csv  and _detect_quickbooks_vendor_csv(contents)
    is_qb_xlsx = is_xlsx and _detect_quickbooks_vendor_xlsx(contents)

    if is_qb_csv:
        try:
            df = _parse_quickbooks_vendor(contents)
            file_format = "quickbooks-vendor"
        except Exception as e:
            raise HTTPException(status_code=422, detail=f"QuickBooks CSV parse error: {str(e)}")
    elif is_qb_xlsx:
        try:
            df = _parse_quickbooks_vendor_xlsx(contents)
            file_format = "quickbooks-vendor"
        except Exception as e:
            raise HTTPException(status_code=422, detail=f"QuickBooks XLSX parse error: {str(e)}")
    else:
        try:
            df_raw = pd.read_csv(io.BytesIO(contents)) if is_csv \
                     else pd.read_excel(io.BytesIO(contents))
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Could not read file: {str(e)}")
        try:
            df = process_dataframe(df_raw)
            file_format = "standard"
        except ValueError as e:
            raise HTTPException(status_code=422, detail=str(e))

    _processed_data = df
    return {
        "message": "File processed successfully",
        "file_format": file_format,
        "rows": len(df),
        "clients": df["Client_Name"].nunique(),
        "date_range": {
            "min": df["Date"].min().strftime("%Y-%m-%d"),
            "max": df["Date"].max().strftime("%Y-%m-%d"),
        },
        "clients_list": sorted(df["Client_Name"].unique().tolist()),
    }


@app.get("/api/dashboard")
def get_dashboard(start_date: Optional[str] = None, end_date: Optional[str] = None, client: Optional[str] = None):
    global _processed_data
    if _processed_data is None:
        raise HTTPException(status_code=404, detail="No data uploaded yet.")
    full_df = _processed_data.copy()
    df = full_df.copy()
    if start_date: df = df[df["Date"] >= pd.to_datetime(start_date)]
    if end_date:   df = df[df["Date"] <= pd.to_datetime(end_date)]
    if client and client != "All": df = df[df["Client_Name"] == client]
    if df.empty:
        return {"summary": {"total_revenue": 0, "total_expenses": 0, "net_profit": 0, "profit_margin": 0},
                "clients": [], "monthly_trend": [], "forecast": [], "expense_breakdown": [],
                "invoice_alerts": [], "heatmap": {"months": [], "clients": [], "data": {}}, "concentration_risk": None}

    revenue_df = df[df["Type"] == "Revenue"]
    expense_df = df[df["Type"] == "Expense"]
    total_revenue  = float(revenue_df["Amount"].sum())
    total_expenses = float(expense_df["Amount"].sum())
    net_profit     = total_revenue - total_expenses
    profit_margin  = (net_profit / total_revenue * 100) if total_revenue > 0 else 0

    client_revenue  = revenue_df.groupby("Client_Name")["Amount"].sum()
    client_expenses = expense_df.groupby("Client_Name")["Amount"].sum()
    rev_monthly = revenue_df.groupby(["Client_Name", "Month"])["Amount"].sum().reset_index().sort_values("Month")
    exp_monthly = expense_df.groupby(["Client_Name", "Month"])["Amount"].sum().reset_index().sort_values("Month")
    last_invoice = full_df[full_df["Type"] == "Revenue"].groupby("Client_Name")["Date"].max()
    today = pd.Timestamp(datetime.utcnow().date())

    clients_out = []
    for c in df["Client_Name"].unique():
        rev = float(client_revenue.get(c, 0))
        exp = float(client_expenses.get(c, 0))
        profit = rev - exp
        margin = (profit / rev * 100) if rev > 0 else 0
        c_rev_m = rev_monthly[rev_monthly["Client_Name"] == c].tail(6)
        sparkline = [round(float(v), 2) for v in c_rev_m["Amount"].tolist()]
        trend_pct, trend_dir = 0.0, "flat"
        if len(c_rev_m) >= 2:
            last_v = float(c_rev_m.iloc[-1]["Amount"])
            prev_v = float(c_rev_m.iloc[-2]["Amount"])
            if prev_v > 0:
                trend_pct = round((last_v - prev_v) / prev_v * 100, 1)
                trend_dir = "up" if trend_pct > 1 else "down" if trend_pct < -1 else "flat"
        last_inv_ts = last_invoice.get(c)
        if last_inv_ts is not None:
            days_since = int((today - pd.Timestamp(last_inv_ts)).days)
            last_inv_str = pd.Timestamp(last_inv_ts).strftime("%Y-%m-%d")
        else:
            days_since, last_inv_str = 9999, "Never"
        inv_status = "active" if days_since <= 30 else "warning" if days_since <= 60 else "overdue" if days_since <= 90 else "inactive"
        all_client_months = sorted(set(
            rev_monthly[rev_monthly["Client_Name"] == c]["Month"].tolist() +
            exp_monthly[exp_monthly["Client_Name"] == c]["Month"].tolist()
        ))
        monthly_breakdown = []
        for m in all_client_months:
            r = float(rev_monthly[(rev_monthly["Client_Name"] == c) & (rev_monthly["Month"] == m)]["Amount"].sum())
            e = float(exp_monthly[(exp_monthly["Client_Name"] == c) & (exp_monthly["Month"] == m)]["Amount"].sum())
            monthly_breakdown.append({"month": m, "revenue": round(r, 2), "expenses": round(e, 2), "profit": round(r - e, 2)})
        clients_out.append({
            "client": c, "revenue": round(rev, 2), "expenses": round(exp, 2),
            "profit": round(profit, 2), "margin": round(margin, 2),
            "health": health_score(margin, trend_pct, days_since),
            "trend_pct": trend_pct, "trend_dir": trend_dir, "sparkline": sparkline,
            "days_since_invoice": days_since, "last_invoice_date": last_inv_str,
            "invoice_status": inv_status, "monthly_breakdown": monthly_breakdown,
        })
    clients_out.sort(key=lambda x: x["profit"], reverse=True)

    monthly = df.groupby(["Month", "Type"])["Amount"].sum().unstack(fill_value=0).reset_index()
    monthly_trend = sorted([
        {"month": str(row["Month"]), "revenue": round(float(row.get("Revenue", 0)), 2),
         "expenses": round(float(row.get("Expense", 0)), 2),
         "profit": round(float(row.get("Revenue", 0)) - float(row.get("Expense", 0)), 2)}
        for _, row in monthly.iterrows()
    ], key=lambda x: x["month"])

    forecast = []
    if len(monthly_trend) >= 3:
        rv = [m["revenue"] for m in monthly_trend]
        ev = [m["expenses"] for m in monthly_trend]
        rp = linear_forecast(rv, 3)
        ep = linear_forecast(ev, 3)
        last_p = pd.Period(monthly_trend[-1]["month"], freq="M")
        for i in range(3):
            p = last_p + (i + 1)
            forecast.append({"month": str(p), "revenue": rp[i], "expenses": ep[i],
                             "profit": round(rp[i] - ep[i], 2), "is_forecast": True})

    cat_totals = {}
    for _, erow in expense_df.iterrows():
        raw = str(erow.get("Category", "Other")).strip()
        cat = raw if raw and raw.lower() not in ("nan", "none", "") else "Other"
        key = cat.lower()
        if key not in cat_totals: cat_totals[key] = {"category": cat, "amount": 0.0}
        cat_totals[key]["amount"] += float(erow["Amount"])
    expense_breakdown = sorted(
        [{"category": v["category"], "amount": round(v["amount"], 2)} for v in cat_totals.values() if v["amount"] > 0],
        key=lambda x: x["amount"], reverse=True)

    invoice_alerts = sorted(
        [{"client": c["client"], "days_since_invoice": c["days_since_invoice"],
          "last_invoice_date": c["last_invoice_date"], "status": c["invoice_status"], "revenue": c["revenue"]}
         for c in clients_out if c["invoice_status"] in ("warning", "overdue", "inactive")],
        key=lambda x: x["days_since_invoice"], reverse=True)

    all_months = sorted(df["Month"].unique().tolist())
    heatmap_data = {
        c: {m: round(float(revenue_df[(revenue_df["Client_Name"] == c) & (revenue_df["Month"] == m)]["Amount"].sum()) -
                     float(expense_df[(expense_df["Client_Name"] == c) & (expense_df["Month"] == m)]["Amount"].sum()), 2)
            for m in all_months}
        for c in df["Client_Name"].unique()
    }

    concentration_risk = None
    if clients_out and total_revenue > 0:
        top = clients_out[0]
        pct = round(top["revenue"] / total_revenue * 100, 1)
        if pct > 35:
            concentration_risk = {"client": top["client"], "revenue": top["revenue"], "pct": pct}

    return {
        "summary": {"total_revenue": round(total_revenue, 2), "total_expenses": round(total_expenses, 2),
                    "net_profit": round(net_profit, 2), "profit_margin": round(profit_margin, 2)},
        "clients": clients_out, "monthly_trend": monthly_trend, "forecast": forecast,
        "expense_breakdown": expense_breakdown, "invoice_alerts": invoice_alerts,
        "heatmap": {"months": all_months, "clients": list(heatmap_data.keys()), "data": heatmap_data},
        "concentration_risk": concentration_risk,
    }


@app.get("/api/client-transactions")
def get_client_transactions(client: str):
    global _processed_data
    if _processed_data is None:
        raise HTTPException(status_code=404, detail="No data uploaded yet.")
    df = _processed_data[_processed_data["Client_Name"] == client].copy()
    if df.empty:
        raise HTTPException(status_code=404, detail=f"No transactions found for: {client}")
    df = df.sort_values("Date", ascending=False)
    return {"client": client, "transactions": [
        {"date": row["Date"].strftime("%Y-%m-%d"), "description": str(row.get("Description", "—")),
         "category": str(row["Category"]), "type": str(row["Type"]), "amount": float(row["Amount"])}
        for _, row in df.iterrows()
    ]}


@app.post("/api/ai-insights")
async def get_ai_insights(payload: dict):
    summary = payload.get("summary", {})
    clients = payload.get("clients", [])
    alerts  = payload.get("invoice_alerts", [])
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        return rule_based_insights(summary, clients, alerts)
    top = clients[:8]
    client_text = "\n".join([
        f"- {c['client']}: Rev ${c['revenue']:,.0f} | Exp ${c['expenses']:,.0f} | Profit ${c['profit']:,.0f} | "
        f"Margin {c['margin']:.1f}% | Health {c['health']['label']} | MoM {c['trend_pct']:+.1f}% | Invoice: {c['invoice_status']}"
        for c in top
    ])
    prompt = f"""You are a sharp financial analyst reviewing a service-business profitability dashboard.
Give specific, data-driven insights — no generic advice.

SUMMARY: Revenue ${summary.get('total_revenue',0):,.0f} | Expenses ${summary.get('total_expenses',0):,.0f} | Net ${summary.get('net_profit',0):,.0f} | Margin {summary.get('profit_margin',0):.1f}% | {len(clients)} clients
CLIENTS:\n{client_text}
INVOICE ALERTS: {len(alerts)} clients

Respond ONLY in this JSON (no markdown):
{{"executive_summary":"2-3 sentences with specific numbers","wins":["win1","win2","win3"],"risks":["risk1","risk2","risk3"],"actions":["action1","action2","action3"],"key_metric":"most important metric and why"}}"""
    try:
        import httpx
        async with httpx.AsyncClient() as hc:
            resp = await hc.post("https://api.anthropic.com/v1/messages",
                headers={"x-api-key": api_key, "anthropic-version": "2023-06-01", "content-type": "application/json"},
                json={"model": "claude-sonnet-4-20250514", "max_tokens": 1024,
                      "messages": [{"role": "user", "content": prompt}]}, timeout=30.0)
        if resp.status_code != 200:
            return rule_based_insights(summary, clients, alerts)
        text = resp.json()["content"][0]["text"]
        try:
            ins = json.loads(text)
        except Exception:
            m = re.search(r"\{.*\}", text, re.DOTALL)
            ins = json.loads(m.group()) if m else None
        if not ins:
            return rule_based_insights(summary, clients, alerts)
        ins["source"] = "claude"
        return ins
    except Exception:
        return rule_based_insights(summary, clients, alerts)


# ── Category taxonomy ─────────────────────────────────────────────────────────

CATEGORY_RULES = {
    "Cloud & Hosting": [
        "server", "hosting", "cloud", "aws", "azure", "gcp", "compute", "gpu",
        "cdn", "infrastructure", "devops", "ci/cd", "pipeline", "container",
        "docker", "kubernetes", "heroku", "digitalocean", "linode", "vultr",
        "database", "storage", "bandwidth", "domain",
    ],
    "Software & Tools": [
        "software", "license", "saas", "platform", "tool", "plugin", "extension",
        "subscription", "crm", "erp", "api", "sdk", "ide", "analytics platform",
        "profiling", "monitoring", "logging", "dashboard software", "reporting software",
        "scheduling", "project management", "jira", "slack", "notion", "figma",
        "adobe", "github", "gitlab", "bitbucket", "linear",
    ],
    "Marketing & Advertising": [
        "marketing", "advertising", "ads", "ad spend", "ppc", "seo", "sem",
        "social media", "campaign", "email marketing", "email platform", "newsletter",
        "content", "creative", "brand", "pr", "influencer", "affiliate",
        "google ads", "facebook ads", "meta ads", "linkedin ads",
    ],
    "Design & Creative": [
        "design", "creative tools", "figma", "sketch", "illustrator", "photoshop",
        "canva", "invision", "zeplin", "animation", "video", "graphic",
        "ui", "ux", "wireframe", "prototype",
    ],
    "Data & AI": [
        "data", "dataset", "machine learning", "ai", "deep learning", "nlp",
        "computer vision", "model", "training", "inference", "gpu compute",
        "research compute", "annotation", "labeling", "kaggle", "hugging face",
        "openai", "anthropic", "cohere",
    ],
    "Payment Processing": [
        "payment gateway", "stripe", "paypal", "square", "braintree", "transaction fee",
        "merchant", "checkout", "billing", "invoicing",
    ],
    "Security": [
        "security", "ssl", "certificate", "firewall", "vpn", "antivirus",
        "penetration", "audit", "compliance", "2fa", "auth", "identity",
        "sso", "okta", "cloudflare",
    ],
    "Communication": [
        "communication", "email", "chat", "video call", "zoom", "teams",
        "meet", "webinar", "phone", "sms", "twilio", "sendgrid", "mailgun",
    ],
    "Professional Services": [
        "consulting", "legal", "accounting", "audit", "tax", "payroll",
        "hr", "recruitment", "training", "coaching", "advisory",
    ],
    "Office & Operations": [
        "office", "rent", "utilities", "supplies", "equipment", "hardware",
        "laptop", "desk", "furniture", "travel", "accommodation", "meals",
        "insurance", "bank fee", "wire transfer",
    ],
    "Revenue – Web Development": [
        "website", "web design", "web development", "frontend", "backend",
        "cms", "wordpress", "shopify", "e-commerce", "responsive", "ui redesign",
        "landing page", "portal",
    ],
    "Revenue – Mobile": [
        "mobile", "app development", "ios", "android", "react native", "flutter",
        "mobile app",
    ],
    "Revenue – Consulting / Strategy": [
        "consulting", "strategy", "advisory", "workshop", "discovery",
        "audit", "review", "assessment",
    ],
    "Revenue – Marketing Services": [
        "seo campaign", "ppc campaign", "social media management", "content marketing",
        "brand refresh", "email marketing", "marketing services",
    ],
    "Revenue – Data / AI": [
        "ai integration", "machine learning", "deep learning", "nlp implementation",
        "computer vision", "recommendation engine", "data analytics", "data migration",
        "data pipeline",
    ],
    "Revenue – SaaS / Product": [
        "saas", "product", "subscription", "license", "platform access",
    ],
}


def rule_categorize(description: str, assigned_category: str) -> dict:
    desc_lower = description.lower()
    acat_lower = assigned_category.lower()

    best_cat, best_score = None, 0
    for cat, keywords in CATEGORY_RULES.items():
        score = sum(1 for kw in keywords if kw in desc_lower)
        if score > best_score:
            best_score, best_cat = score, cat

    # Determine Revenue vs Expense for the suggested category
    revenue_kw = ["revenue", "income", "sales", "payment", "receipt", "invoice"]
    assigned_type = "Revenue" if any(k in acat_lower for k in revenue_kw) else "Expense"

    if best_cat is None or best_score == 0:
        return {
            "suggested_category": assigned_category,
            "suggested_type": assigned_type,
            "confidence": "low",
            "match": True,
            "reason": "No strong keyword match found — keeping original category.",
        }

    suggested_type = "Revenue" if best_cat.startswith("Revenue") else "Expense"
    type_match = assigned_type == suggested_type
    name_match = best_cat.lower() in acat_lower or acat_lower in best_cat.lower()
    match = type_match and (name_match or best_score >= 3)

    return {
        "suggested_category": best_cat,
        "suggested_type": suggested_type,
        "confidence": "high" if best_score >= 3 else "medium",
        "match": match,
        "reason": (
            f"Description contains keywords matching '{best_cat}' "
            f"({'matches' if match else 'conflicts with'} assigned '{assigned_category}')."
        ),
    }


@app.post("/api/categorize")
async def categorize_transactions(payload: dict):
    global _processed_data
    if _processed_data is None:
        raise HTTPException(status_code=404, detail="No data uploaded yet.")

    client_filter = payload.get("client")  # optional
    df = _processed_data.copy()
    if client_filter and client_filter != "All":
        df = df[df["Client_Name"] == client_filter]

    if df.empty:
        return {"results": [], "summary": {"total": 0, "match": 0, "mismatch": 0, "uncertain": 0}}

    # Deduplicate: one entry per (description, category) pair
    desc_col = "Description" if "Description" in df.columns else None
    if desc_col is None:
        # Fall back to Category only
        df["Description"] = df["Category"]
        desc_col = "Description"

    df["Description"] = df["Description"].astype(str).str.strip()
    pairs = df[["Description", "Category", "Type"]].drop_duplicates().to_dict("records")

    api_key = os.environ.get("ANTHROPIC_API_KEY", "")

    if api_key:
        results = await _ai_categorize(pairs, api_key)
    else:
        results = [
            {
                "description": p["Description"],
                "assigned_category": p["Category"],
                "assigned_type": p["Type"],
                **rule_categorize(p["Description"], p["Category"]),
            }
            for p in pairs
        ]

    match_count    = sum(1 for r in results if r["match"] and r["confidence"] != "low")
    mismatch_count = sum(1 for r in results if not r["match"])
    uncertain      = sum(1 for r in results if r["confidence"] == "low")

    return {
        "results": results,
        "summary": {
            "total":     len(results),
            "match":     match_count,
            "mismatch":  mismatch_count,
            "uncertain": uncertain,
            "source":    "claude+web" if api_key else "rule-based",
        },
    }


async def _ai_categorize(pairs: list, api_key: str) -> list:
    """Use Claude with web_search tool to verify each transaction category."""
    import httpx

    # Build a compact list for Claude
    lines = "\n".join(
        f"{i+1}. Description: \"{p['Description']}\" | Assigned category: \"{p['Category']}\" | Type: {p['Type']}"
        for i, p in enumerate(pairs)
    )

    prompt = f"""You are a financial transaction categorization auditor for a service business.

For each transaction below, use your knowledge (and web search if helpful) to determine:
1. What is the most accurate business category for this transaction?
2. Does it match the assigned category?
3. Is the Revenue/Expense classification correct?

Transactions:
{lines}

Respond ONLY with a JSON array (no markdown, no preamble), one object per transaction, in order:
[
  {{
    "description": "exact description from input",
    "assigned_category": "exact assigned category from input",
    "assigned_type": "Revenue or Expense",
    "suggested_category": "your suggested category name",
    "suggested_type": "Revenue or Expense",
    "confidence": "high | medium | low",
    "match": true or false,
    "reason": "one sentence explanation"
  }},
  ...
]"""

    try:
        async with httpx.AsyncClient() as hc:
            resp = await hc.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": "claude-sonnet-4-20250514",
                    "max_tokens": 4096,
                    "tools": [{"type": "web_search_20250305", "name": "web_search"}],
                    "messages": [{"role": "user", "content": prompt}],
                },
                timeout=60.0,
            )

        if resp.status_code != 200:
            raise Exception(f"API error {resp.status_code}")

        # Extract text from response (may contain tool_use blocks)
        content = resp.json().get("content", [])
        text = " ".join(b.get("text", "") for b in content if b.get("type") == "text")

        # Parse JSON array from text
        m = re.search(r"\[.*\]", text, re.DOTALL)
        if not m:
            raise Exception("No JSON array in response")
        ai_results = json.loads(m.group())

        # Ensure all pairs are covered (fill missing with rule-based)
        desc_map = {r["description"]: r for r in ai_results}
        final = []
        for p in pairs:
            if p["Description"] in desc_map:
                final.append(desc_map[p["Description"]])
            else:
                final.append({
                    "description": p["Description"],
                    "assigned_category": p["Category"],
                    "assigned_type": p["Type"],
                    **rule_categorize(p["Description"], p["Category"]),
                })
        return final

    except Exception as e:
        # Full fallback
        return [
            {
                "description": p["Description"],
                "assigned_category": p["Category"],
                "assigned_type": p["Type"],
                **rule_categorize(p["Description"], p["Category"]),
            }
            for p in pairs
        ]
