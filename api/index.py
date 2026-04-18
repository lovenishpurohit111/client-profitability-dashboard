from fastapi import FastAPI, UploadFile, File, HTTPException
import pandas as pd
import numpy as np
import io
from datetime import datetime
from typing import Optional

app = FastAPI()
_processed_data: Optional[pd.DataFrame] = None


def process_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    # Normalize column NAMES only (not values)
    df.columns = [c.strip().title().replace(" ", "_") for c in df.columns]

    col_map = {}
    for col in df.columns:
        low = col.lower()
        if "date" in low:                        col_map["Date"] = col
        elif "client" in low or "name" in low:   col_map["Client_Name"] = col
        elif "desc" in low:                      col_map["Description"] = col
        elif "amount" in low or "value" in low:  col_map["Amount"] = col
        elif "cat" in low or "type" in low:      col_map["Category"] = col

    missing = [r for r in ["Date", "Client_Name", "Amount", "Category"] if r not in col_map]
    if missing:
        raise ValueError(f"Missing required columns: {missing}. Found: {list(df.columns)}")

    df = df.rename(columns={v: k for k, v in col_map.items()})
    df["Date"] = pd.to_datetime(df["Date"], infer_datetime_format=True, errors="coerce")
    df = df.dropna(subset=["Date"])

    if df["Amount"].dtype == object:
        df["Amount"] = df["Amount"].astype(str).str.replace(r"[,$₹€£]", "", regex=True).str.strip()
    df["Amount"] = pd.to_numeric(df["Amount"], errors="coerce").fillna(0)

    # Keep original category casing for display — only strip leading/trailing whitespace
    df["Category"] = df["Category"].astype(str).str.strip()

    # Classify Revenue vs Expense using lowercase comparison of category value
    revenue_keywords = ["revenue", "income", "sales", "payment", "receipt", "invoice"]
    df["Type"] = df["Category"].apply(
        lambda c: "Revenue" if any(k in c.lower() for k in revenue_keywords) else "Expense"
    )

    df["Month"] = df["Date"].dt.to_period("M").astype(str)
    df["Client_Name"] = df["Client_Name"].astype(str).str.strip()
    return df


def health_score(margin: float, trend_pct: float, days_since: int) -> dict:
    pts = 0
    if margin >= 40:   pts += 40
    elif margin >= 25: pts += 30
    elif margin >= 10: pts += 20
    elif margin >= 0:  pts += 10

    if trend_pct > 15:    pts += 35
    elif trend_pct > 5:   pts += 28
    elif trend_pct > 0:   pts += 20
    elif trend_pct > -10: pts += 10

    if days_since <= 30:   pts += 25
    elif days_since <= 60: pts += 15
    elif days_since <= 90: pts += 5

    if pts >= 75:   grade, label, color = "A", "Excellent", "#34d399"
    elif pts >= 50: grade, label, color = "B", "Good",      "#22d3ee"
    elif pts >= 28: grade, label, color = "C", "Fair",      "#fbbf24"
    else:           grade, label, color = "D", "At Risk",   "#fb7185"

    return {"grade": grade, "label": label, "color": color, "score": pts}


@app.get("/api/health")
def api_health():
    return {"status": "ok"}


@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    global _processed_data
    if not file.filename.endswith((".csv", ".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Only CSV or Excel files are supported.")
    contents = await file.read()
    try:
        df = pd.read_csv(io.BytesIO(contents)) if file.filename.endswith(".csv") \
             else pd.read_excel(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not read file: {str(e)}")
    try:
        df = process_dataframe(df)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    _processed_data = df
    return {
        "message": "File processed successfully",
        "rows": len(df),
        "clients": df["Client_Name"].nunique(),
        "date_range": {
            "min": df["Date"].min().strftime("%Y-%m-%d"),
            "max": df["Date"].max().strftime("%Y-%m-%d"),
        },
        "clients_list": sorted(df["Client_Name"].unique().tolist()),
    }


@app.get("/api/dashboard")
def get_dashboard(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    client: Optional[str] = None,
):
    global _processed_data
    if _processed_data is None:
        raise HTTPException(status_code=404, detail="No data uploaded yet.")

    full_df = _processed_data.copy()
    df = full_df.copy()

    if start_date: df = df[df["Date"] >= pd.to_datetime(start_date)]
    if end_date:   df = df[df["Date"] <= pd.to_datetime(end_date)]
    if client and client != "All":
        df = df[df["Client_Name"] == client]

    if df.empty:
        return {
            "summary": {"total_revenue": 0, "total_expenses": 0, "net_profit": 0, "profit_margin": 0},
            "clients": [], "monthly_trend": [], "expense_breakdown": [], "invoice_alerts": [],
        }

    revenue_df = df[df["Type"] == "Revenue"]
    expense_df = df[df["Type"] == "Expense"]

    total_revenue  = float(revenue_df["Amount"].sum())
    total_expenses = float(expense_df["Amount"].sum())
    net_profit     = total_revenue - total_expenses
    profit_margin  = (net_profit / total_revenue * 100) if total_revenue > 0 else 0

    client_revenue  = revenue_df.groupby("Client_Name")["Amount"].sum()
    client_expenses = expense_df.groupby("Client_Name")["Amount"].sum()

    rev_monthly = (
        revenue_df.groupby(["Client_Name", "Month"])["Amount"]
        .sum().reset_index().sort_values("Month")
    )

    last_invoice = (
        full_df[full_df["Type"] == "Revenue"]
        .groupby("Client_Name")["Date"].max()
    )

    today = pd.Timestamp(datetime.utcnow().date())

    clients_out = []
    for c in df["Client_Name"].unique():
        rev = float(client_revenue.get(c, 0))
        exp = float(client_expenses.get(c, 0))
        profit = rev - exp
        margin = (profit / rev * 100) if rev > 0 else 0

        c_monthly = rev_monthly[rev_monthly["Client_Name"] == c].tail(6)
        sparkline = [round(float(v), 2) for v in c_monthly["Amount"].tolist()]

        trend_pct = 0.0
        trend_dir = "flat"
        if len(c_monthly) >= 2:
            last_v = float(c_monthly.iloc[-1]["Amount"])
            prev_v = float(c_monthly.iloc[-2]["Amount"])
            if prev_v > 0:
                trend_pct = round((last_v - prev_v) / prev_v * 100, 1)
                trend_dir = "up" if trend_pct > 1 else "down" if trend_pct < -1 else "flat"

        last_inv_ts = last_invoice.get(c)
        if last_inv_ts is not None:
            days_since   = int((today - pd.Timestamp(last_inv_ts)).days)
            last_inv_str = pd.Timestamp(last_inv_ts).strftime("%Y-%m-%d")
        else:
            days_since   = 9999
            last_inv_str = "Never"

        if days_since <= 30:   inv_status = "active"
        elif days_since <= 60: inv_status = "warning"
        elif days_since <= 90: inv_status = "overdue"
        else:                  inv_status = "inactive"

        hs = health_score(margin, trend_pct, days_since)

        clients_out.append({
            "client":             c,
            "revenue":            round(rev, 2),
            "expenses":           round(exp, 2),
            "profit":             round(profit, 2),
            "margin":             round(margin, 2),
            "health":             hs,
            "trend_pct":          trend_pct,
            "trend_dir":          trend_dir,
            "sparkline":          sparkline,
            "days_since_invoice": days_since,
            "last_invoice_date":  last_inv_str,
            "invoice_status":     inv_status,
        })

    clients_out.sort(key=lambda x: x["profit"], reverse=True)

    # ── Monthly overall trend ────────────────────────────────────────────────
    monthly = df.groupby(["Month", "Type"])["Amount"].sum().unstack(fill_value=0).reset_index()
    monthly_trend = []
    for _, row in monthly.iterrows():
        rev = float(row.get("Revenue", 0))
        exp = float(row.get("Expense", 0))
        monthly_trend.append({
            "month":    str(row["Month"]),
            "revenue":  round(rev, 2),
            "expenses": round(exp, 2),
            "profit":   round(rev - exp, 2),
        })
    monthly_trend.sort(key=lambda x: x["month"])

    # ── Expense breakdown — group by original Category, preserve all categories ──
    # Use case-insensitive grouping key but display original name
    expense_df = expense_df.copy()
    expense_df["Category_Key"] = expense_df["Category"].str.strip().str.lower()

    # Get display name (most common casing for each key)
    cat_display = (
        expense_df.groupby("Category_Key")["Category"]
        .agg(lambda x: x.mode()[0] if len(x) > 0 else x.iloc[0])
    )
    cat_amounts = expense_df.groupby("Category_Key")["Amount"].sum()

    expense_breakdown = []
    for key in cat_amounts.index:
        amt = float(cat_amounts[key])
        if amt > 0:  # only include positive expense amounts
            expense_breakdown.append({
                "category": str(cat_display[key]),
                "amount":   round(amt, 2),
            })
    expense_breakdown.sort(key=lambda x: x["amount"], reverse=True)

    # ── Invoice alerts ───────────────────────────────────────────────────────
    invoice_alerts = [
        {
            "client":             c["client"],
            "days_since_invoice": c["days_since_invoice"],
            "last_invoice_date":  c["last_invoice_date"],
            "status":             c["invoice_status"],
            "revenue":            c["revenue"],
        }
        for c in clients_out
        if c["invoice_status"] in ("warning", "overdue", "inactive")
    ]
    invoice_alerts.sort(key=lambda x: x["days_since_invoice"], reverse=True)

    return {
        "summary": {
            "total_revenue":  round(total_revenue, 2),
            "total_expenses": round(total_expenses, 2),
            "net_profit":     round(net_profit, 2),
            "profit_margin":  round(profit_margin, 2),
        },
        "clients":           clients_out,
        "monthly_trend":     monthly_trend,
        "expense_breakdown": expense_breakdown,
        "invoice_alerts":    invoice_alerts,
    }
