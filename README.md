# 📊 Client Profitability Dashboard

React + FastAPI — deployed as one project on **Vercel** (free, no card required).

## How it works on Vercel

- `src/` + `public/` → React frontend (built by Vercel automatically)
- `api/index.py` → FastAPI backend (runs as a Vercel serverless function)
- Same domain → no CORS needed, no env vars needed

## Deploy to Vercel (free, no card)

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → sign up with GitHub (free)
3. Click **"Add New Project"** → import this repo
4. Leave all settings as default → click **Deploy**
5. Done — your app is live in ~2 minutes ✅

## Local development

**Backend:**
```bash
pip install -r requirements.txt
uvicorn api.index:app --reload --port 8000
```

**Frontend** (in another terminal):
```bash
npm install
npm start
```

For local dev, update `src/config.js` to `http://localhost:8000/api`.

## CSV format

| Column | Example |
|--------|---------|
| Date | 2024-01-15 |
| Client Name | Acme Corp |
| Description | Website Design |
| Amount | 15000 |
| Category | Revenue or Expenses |
