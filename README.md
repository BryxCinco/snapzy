<div align="center">

<img src="snapzy/public/brand/snapzy-logo.png" alt="Snapzy app icon" width="140" />

# Snapzy

**An AI-powered screenshot sorter and picture organizer.**

[Live demo](https://snapzy-tau.vercel.app) · [Full documentation](snapzy/README.md) · [Database setup](snapzy/supabase)

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs)
![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-v4-38bdf8?logo=tailwindcss&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20Auth%20%2B%20Storage-3ecf8e?logo=supabase&logoColor=white)
![Gemini](https://img.shields.io/badge/Google-Gemini-8e6fc4?logo=googlegemini&logoColor=white)

</div>

---

Drop in screenshots and photos, press **Sort**, and AI reads every image, writes a caption, files it in the right album and pulls out the details you care about: receipts, payments, WiFi passwords, QR codes and more.

## Highlights

- **Manual AI sorting** with a Cancel button and a live time estimate (10 photos per press)
- **Smart cards** for payments, receipts, WiFi, flights, logins, contacts and QR codes
- **Password masking** with an eye toggle
- **Custom albums** that the AI uses, shown as stacks of prints
- **Ranked full-text search** inside your images
- **Album ZIP download**, English and Tagalog, light and dark mode, installable on phones

## Quick start

The app lives in the [`snapzy/`](snapzy) folder.

```bash
git clone https://github.com/BryxCinco/snapzy.git
cd snapzy/snapzy
npm install
cp .env.example .env.local   # then fill in your own values
npm run dev
```

You need a free [Supabase](https://supabase.com) project and a free [Gemini API key](https://aistudio.google.com/apikey). Run `supabase/schema.sql` and then `supabase/migrations/002` to `009` in the Supabase SQL Editor.

**Everything else** (features, how it works, environment variables, database setup, project structure, security, limitations and roadmap) is in the **[full README](snapzy/README.md)**.

## Author

**Brian Paul Francisco**, [@BryxCinco](https://github.com/BryxCinco)
