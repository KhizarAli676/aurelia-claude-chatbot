# Aurelia — Luxury Executive AI Chatbot (React + Claude API + Supabase)

**Aurelia** is a complete, executive-grade AI Chatbot built with **React**, **Vite**, **Tailwind CSS**, **Anthropic Claude Messages API**, and **Supabase PostgreSQL**.

---

## Complete Project Structure

```text
aurelia-claude-chatbot-complete/
├── index.html               # Entry HTML with Cormorant Garamond & Plus Jakarta Sans fonts
├── package.json             # React, Lucide Icons, Supabase JS & Vite/Tailwind dependencies
├── tailwind.config.js       # Obsidian & Champagne-Gold luxury palette
├── postcss.config.js        # PostCSS config
├── vite.config.js           # Vite dev/build config
├── .env                     # Pre-filled with your Supabase URL & Publishable Key
├── .env.example             # Environment variable template
├── .gitignore               # Protects .env & node_modules from Git commits
├── README.md                # Full setup & deployment guide
├── supabase/
│   └── schema.sql           # Complete PostgreSQL tables, indexes, trigger & RLS policies
└── src/
    ├── main.jsx             # React root entry point
    ├── index.css            # Tailwind directives & luxury scrollbar styling
    ├── lib/
    │   └── supabase.js      # Supabase client initialization
    └── App.jsx              # Full chatbot UI, Claude API integration & Supabase history
```

---

## Step 1: Run the Supabase SQL Schema

1. Open your [Supabase Dashboard](https://supabase.com/dashboard) and select your project (`fbvtbuolutkltepzwekm`).
2. Navigate to **SQL Editor** → **New query**.
3. Copy the entire contents of **`supabase/schema.sql`** and click **Run**.

---

## Step 2: Install & Launch Locally

```bash
npm install
npm run dev
```

1. Open `.env` and add your Anthropic API key (`VITE_ANTHROPIC_API_KEY=sk-ant-...`), or paste it directly into the **Anthropic API Vault** inside the app's sidebar.
2. Open the local URL shown in your terminal (e.g., `http://localhost:5173`).
