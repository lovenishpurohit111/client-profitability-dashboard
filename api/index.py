from fastapi import FastAPI, UploadFile, File, HTTPException
import pandas as pd
import numpy as np
import io
from typing import Optional

# No CORS needed — same domain as frontend on Vercel
app = FastAPI()

# In-memory store (shared across warm Lambda instances)
_processed_data: Optional[pd.DataFrame] = None


def process_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    df.columns = [c.strip().title().replace(" ", "_") for c in df.columns]

    col_map = {}
    for col in df.columns:
        low = col.lower()
        if "date" in low:
            col_map["Date"] = col
        elif "client" in low or "name" in low:
            col_map["Client_Name"] = col
        elif "desc" in low:
            col_map["Description"] = col
        elif "amount" in low or "value" in low:
            col_map["Amount"] = col
        elif "cat" in low or "type" in low:
            col_map["Category"] = col

    required = ["Date", "Client_Name", "Amount", "Category"]
    missing = [r for r in required if r not in col_map]
    if missing:
        raise ValueError(f"Missing required columns: {missing}. Found: {list(df.columns)}")

    df = df.rename(columns={v: k for k, v in col_map.items()})
    df["Date"] = pd.to_datetime(df["Date"], infer_datetime_format=True, errors="coerce")
    df = df.dropna(subset=["Date"])

    if df["Amount"].dtype == object:
        df["Amount"] = df["Amount"].astype(str).str.replace(r"[,$₹€£]", "", regex=True).str.strip()
    df["Amount"] = pd.to_numeric(df["Amount"], errors="coerce").fillna(0)

    df["Category"] = df["Category"].astype(str).str.strip().str.title()
    revenue_keywords = ["revenue", "income", "sales", "payment", "receipt", "invoice"]
    df["Type"] = df["Category"].apply(
        lambda c: "Revenue" if any(k in c.lower() for k in revenue_keywords) else "Expense"
    )
    df["Month"] = df["Date"].dt.to_period("M").astype(str)
    df["Client_Name"] = df["Client_Name"].astype(str).str.strip()
    return df


# ── Routes are prefixed /api/ so Vercel routes them to this function ────────

@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    global _processed_data

    if not file.filename.endswith((".csv", ".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Only CSV or Excel files are supported.")

    contents = await file.read()

    try:
        if file.filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(contents))
        else:
            df = pd.read_excel(io.BytesIO(contents))
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

    df = _processed_data.copy()

    if start_date:
        df = df[df["Date"] >= pd.to_datetime(start_date)]
    if end_date:
        df = df[df["Date"] <= pd.to_datetime(end_date)]
    if client and client != "All":
        df = df[df["Client_Name"] == client]

    if df.empty:
        return {
            "summary": {"total_revenue": 0, "total_expenses": 0, "net_profit": 0, "profit_margin": 0},
            "clients": [], "monthly_trend": [], "expense_breakdown": [],
        }

    revenue_df = df[df["Type"] == "Revenue"]
    expense_df = df[df["Type"] == "Expense"]

    total_revenue = float(revenue_df["Amount"].sum())
    total_expenses = float(expense_df["Amount"].sum())
    net_profit = total_revenue - total_expenses
    profit_margin = (net_profit / total_revenue * 100) if total_revenue > 0 else 0

    client_revenue = revenue_df.groupby("Client_Name")["Amount"].sum()
    client_expenses = expense_df.groupby("Client_Name")["Amount"].sum()

    clients = []
    for c in df["Client_Name"].unique():
        rev = float(client_revenue.get(c, 0))
        exp = float(client_expenses.get(c, 0))
        profit = rev - exp
        margin = (profit / rev * 100) if rev > 0 else 0
        clients.append({
            "client": c,
            "revenue": round(rev, 2),
            "expenses": round(exp, 2),
            "profit": round(profit, 2),
            "margin": round(margin, 2),
        })
    clients.sort(key=lambda x: x["profit"], reverse=True)

    monthly = df.groupby(["Month", "Type"])["Amount"].sum().unstack(fill_value=0).reset_index()
    monthly_trend = []
    for _, row in monthly.iterrows():
        rev = float(row.get("Revenue", 0))
        exp = float(row.get("Expense", 0))
        monthly_trend.append({
            "month": str(row["Month"]),
            "revenue": round(rev, 2),
            "expenses": round(exp, 2),
            "profit": round(rev - exp, 2),
        })
    monthly_trend.sort(key=lambda x: x["month"])

    expense_cats = expense_df.groupby("Category")["Amount"].sum().reset_index()
    expense_breakdown = [
        {"category": str(r["Category"]), "amount": round(float(r["Amount"]), 2)}
        for _, r in expense_cats.iterrows()
    ]
    expense_breakdown.sort(key=lambda x: x["amount"], reverse=True)

    return {
        "summary": {
            "total_revenue": round(total_revenue, 2),
            "total_expenses": round(total_expenses, 2),
            "net_profit": round(net_profit, 2),
            "profit_margin": round(profit_margin, 2),
        },
        "clients": clients,
        "monthly_trend": monthly_trend,
        "expense_breakdown": expense_breakdown,
    }
