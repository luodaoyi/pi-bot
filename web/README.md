# Pi-Bot Web GUI

Web interface for pi-bot, a multi-bot collaboration platform based on Pi coding agent.

This is a port of the DeepSeek-Bot web UI adapted for pi-bot, featuring:
- Bot roster management and chat interface
- Group chat with @mentions and turn-taking
- Global Respire memory viewer (search, list, edit, forget)
- Scheduled tasks management
- Secrets management with masked input
- Usage statistics and cost tracking
- Settings panel
- Chinese and English i18n (default: zh-CN)

## Development

### Prerequisites

- Node.js >= 18
- npm or pnpm

### Install Dependencies

```bash
npm install
```

### Run Development Server

```bash
npm run dev
```

The app will start at http://localhost:3000 with mock API by default.

### Build for Production

```bash
npm run build
```

Output will be in `dist/` directory.

### Testing

```bash
npm test
```

## Configuration

Environment variables (create `.env.local`):

```env
# Use real API instead of mock
VITE_USE_MOCK_API=false

# API base URL (default: http://127.0.0.1:8787)
VITE_API_BASE_URL=http://localhost:8787
```

## API Integration

The web UI communicates with the pi-bot daemon via HTTP REST and Server-Sent Events (SSE).

See `API_ASSUMPTIONS.md` for the complete API specification that the UI expects.

### API Client

The app uses a typed API client with two implementations:

- **MockApiClient**: In-memory mock for development without daemon
- **HttpApiClient**: Real HTTP client for connecting to daemon

Switch between them using `VITE_USE_MOCK_API` environment variable.

## Architecture

```
src/
├── api/          # API client layer
│   ├── client.ts   # Interface and types
│   ├── mock.ts     # Mock implementation
│   ├── http.ts     # HTTP implementation
│   └── index.ts    # Factory
├── components/   # Reusable components
├── views/        # Page views
├── stores/       # Zustand state management
├── i18n/         # Translations (zh-CN, en-US)
├── types/        # TypeScript types
└── utils/        # Utility functions
```

## Features Implementation Status

- ✅ Bot roster and management
- ✅ Chat interface with streaming
- ✅ Memory search and management (Respire)
- ✅ Scheduled tasks viewer
- ✅ Secrets management
- ✅ Usage statistics
- ✅ Settings panel
- ✅ i18n (Chinese/English)
- ⚠️ Group chat (UI complete, needs daemon integration)
- ⚠️ Bot creation/editing modals (needs implementation)
- ⚠️ Memory write/update forms (needs implementation)

## Attribution

UI design and UX patterns adapted from DeepSeek-Bot (Apache-2.0):
https://github.com/FeiZhuLulu/DeepSeek-Bot

See NOTICE file for complete attribution.

## License

Apache-2.0
