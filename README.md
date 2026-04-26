# 📊 Client Profitability Dashboard

A full-stack web app that turns a financial CSV or Excel file into a rich, interactive profitability dashboard — broken down per client.

## Features

- **Upload** a CSV or Excel file (or download a sample from the landing page)
- **KPI summary** — total revenue, expenses, net profit, and profit margin
- **Per-client breakdown** — revenue, expenses, profit, margin, health score, MoM trend, sparkline, and invoice aging
- **Charts** — profit bar chart, expense pie chart, monthly revenue/expense/profit line chart
- **Invoice alerts** — flags clients that haven't had a revenue entry in 30, 60, or 90+ days
- **Export** — download the full dashboard as an Excel workbook (4 sheets) or a PDF snapshot
- **Filters** — date range and per-client filtering

## CSV / Excel format

| Column | Example |
|--------|---------|
| Date | 2024-01-15 |
| Client Name | Acme Corp |
| Description | Website Design |
| Amount | 15000 |
| Category | Revenue or Expenses |

Column names are flexible — the app matches on keywords (e.g. "client", "name", "amount", "value"). Category values that contain "revenue", "income", "sales", "payment", "receipt", or "invoice" are treated as revenue; everything else is an expense.

## Sample files

Two download buttons are available on the landing page:

- **Download Sample CSV** — 20 rows across 5 clients, ready to upload and explore
- **Blank Template** — a minimal 3-row CSV showing the expected structure

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Recharts, Tailwind CSS |
| Backend | FastAPI (Python 3.11) |
| Data | pandas, numpy, openpyxl |
| Export | jsPDF, html2canvas, SheetJS (xlsx) |

## Local development

**Backend** (Python 3.11):

```bash
pip install -r requirements.txt
uvicorn api.index:app --reload --port 8000
```

**Frontend** (in a second terminal):

```bash
npm install
npm start
```

For local dev, update `src/config.js` to point at `http://localhost:8000/api`.

## Project structure

```
├── api/
│   └── index.py          # FastAPI app — upload, processing, dashboard endpoint
├── src/
│   ├── components/
│   │   ├── UploadPage.js      # Landing page with drag-and-drop + sample downloads
│   │   ├── Dashboard.js       # Main dashboard shell + filters
│   │   ├── SummaryCards.js    # KPI cards
│   │   ├── ClientTable.js     # Sortable per-client table
│   │   ├── ProfitBarChart.js  # Bar chart — profit per client
│   │   ├── ExpensePieChart.js # Donut chart — expenses by category
│   │   ├── MonthlyLineChart.js# Line chart — monthly trend
│   │   ├── InvoiceAlerts.js   # Collapsible invoice aging alerts
│   │   ├── ExportButtons.js   # PDF + Excel export
│   │   ├── Sparkline.js       # SVG mini-chart for table rows
│   │   └── AppNav.js          # Top nav bar
│   ├── config.js         # API base URL
│   └── index.css         # Tailwind + custom styles
├── sample_data.csv       # Example data file
└── vercel.json           # Deployment config
```

## Health score

Each client is graded A–D based on three factors:

| Factor | Weight |
|--------|--------|
| Profit margin | 40 pts |
| Month-over-month revenue trend | 35 pts |
| Days since last invoice | 25 pts |

- **A (75+)** Excellent
- **B (50–74)** Good
- **C (28–49)** Fair
- **D (<28)** At Risk
