from fastapi import FastAPI, UploadFile, File, HTTPException
import pandas as pd
import numpy as np
import io, os, json, re
from datetime import datetime
from typing import Optional

app = FastAPI()
_processed_data: Optional[pd.DataFrame] = None


def process_dataframe(df: pd.DataFrame) -> pd.DataFrame:
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
        df["Amount"] = df["Amount"].astype(str).str.replace(r"[,$\u20b9\u20ac\xa3]", "", regex=True).str.strip()
    df["Amount"] = pd.to_numeric(df["Amount"], errors="coerce").fillna(0)
    df["Category"] = df["Category"].astype(str).str.strip()
    revenue_kw = ["revenue", "income", "sales", "payment", "receipt", "invoice"]
    df["Type"] = df["Category"].apply(lambda c: "Revenue" if any(k in c.lower() for k in revenue_kw) else "Expense")
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
    try:
        df = pd.read_csv(io.BytesIO(contents)) if file.filename.endswith(".csv") else pd.read_excel(io.BytesIO(contents))
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
        "date_range": {"min": df["Date"].min().strftime("%Y-%m-%d"), "max": df["Date"].max().strftime("%Y-%m-%d")},
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
