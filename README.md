# Ava Supernova — Companion

> ## ⚠️ The source has moved
>
> **The companion now lives on the main site at [avasupernova.com/companion](https://avasupernova.com/companion).**
>
> Its source moved into the platform repo on 2026-08-03 — `packages/web/src/companion/`
> — and this repository no longer carries a copy. That is deliberate: two copies
> of 122 files is a drift risk, and holding both meant changes landing in one and
> not the other.
>
> **Nothing was lost.** Every file is in this repository's git history, and the
> version now shipping is strictly newer.
>
> ### Why the move
>
> The extension and IDE are for people who write software. The companion had
> everything else — chat, tasks, journal, memory, the health planning — and the
> only way to get it was installing an app. The website sold four products and
> delivered none of them. `/companion` closes that.
>
> ### What this repository is for now
>
> The build scaffolding stays because this is where the **native mobile app**
> starts when that work begins. At that point the shared views get extracted
> back out as a package both surfaces consume — a boundary worth drawing when
> there are genuinely two consumers, and not before.
>
> ### If you are looking for the code
>
> `packages/web/src/companion/{components,lib,locales,onboarding}` in the
> platform repo.

---

Your AI partner, everywhere you go.

The companion app for Ava Supernova. Same memory, same context, same brain — on any device. Chat with Ava on the bus. Check your tasks. Review your journal. Design her personality. All synced with the VS Code extension.

## Features

- **Chat** — Streaming conversation with Ava. Voice input. Offline message queueing. Chat history with conversations.
- **Tasks** — Create, complete, prioritise. Due dates, categories. Overdue detection. Syncs with the extension.
- **Memory** — Browse, search, and delete memories. Everything Ava knows about you, in one place.
- **Journal** — Dual journal (yours + Ava's). Mood tracking. Date navigation. Delete entries.
- **Settings** — Model selector, BYOK provider keys, theme, text size, language (20 languages).
- **Ava's Style** — Choose tone, energy, communication style. Same brain, your personality.
- **Token Usage Bar** — Visual token balance below the chat header with real-time deduction.
- **Live Chat Support** — Chat with Ava and the team. 10-second polling. No tickets, no forms.
- **Cloud Sync** — Local-first. Push to cloud when you choose. Sync conversations, personality, and settings.
- **Release Notes** — See what's new directly in the app.
- **Notifications** — Browser notifications for tasks due today.

## Models

- **Free for everyone** — 300 Ava Credits per month on every model. No card, no trial.
- **Platform plans** — Pro / Ultra / Enterprise scale credit allowances and rate limits, never gate features. All models on every tier.
- **BYOK** — Kimi K2.6, Anthropic / Claude, DeepSeek V4, Zhipu / GLM-5.2, Mistral, plus Qwen and MiniMax. Add your own API keys; calls go straight to the provider.
- **Local + offline** — Point at any OpenAI-compatible endpoint (Ollama, LM Studio, vLLM). Full Companion, $0 ongoing, nothing leaves your device.

## Navigation

**Desktop** — Centered header nav
**Mobile** — Bottom thumb nav with 15% larger chat button centered

5 tabs: Chat, Tasks, Memory, Journal, Settings

## Tech Stack

- Next.js 15 + React 19
- Tailwind CSS
- Supabase (auth + data)
- PWA-ready
- Capacitor-ready for native iOS/Android

## Development

```bash
npm install
npm run dev
```

Opens on http://localhost:3001

## Links

- **Extension** — [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=augmentedvalueacceleration.ava-supernova)
- **Website** — [avasupernova.com](https://avasupernova.com)
- **GitHub** — [AugmentedValueAcceleration](https://github.com/AugmentedValueAcceleration)
- **YouTube** — [youtube.com/@SyntaxSauce](https://youtube.com/@SyntaxSauce)

## License

Apache 2.0
