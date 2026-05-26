# Navabharath Technologies — Website Backend

Node.js/Express backend for the Navabharath Technologies website.

## Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/send-email` | Contact form — sends email via Resend |
| POST | `/send-career-email` | Job application — sends email with resume attachment |
| GET | `/` | Health check |

## Setup

```bash
npm install
```

Create a `.env` file with:
```
RESEND_API_KEY=your_resend_api_key_here
```

## Run locally

```bash
npm run dev
```

## Deploy

Deployed on [Render](https://render.com). Set `RESEND_API_KEY` as an environment variable in the Render dashboard.
