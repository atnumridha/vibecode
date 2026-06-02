# ChatGPT Backend API Notes

This README documents how to call the Codex backend used by the local Codex Desktop/CLI install on this machine. These are internal ChatGPT Codex backend routes, not the same thing as the public OpenAI Platform API. They can change without notice.

## Files Used

- Auth file: `/Users/<OS Username>/.codex/auth.json`
- Installation id: `/Users/<OS Username>/.codex/installation_id`
- Model cache: `/Users/<OS Username>/.codex/models_cache.json`
- Current Codex client version in cache: `0.136.0`

## Token Guide

Use `.tokens.access_token` for Codex backend calls:

```bash
TOKEN="$(jq -r '.tokens.access_token' /Users/<OS Username>/.codex/auth.json)"
```

Do not use `.tokens.refresh_token` as the bearer token for API calls. It is used by Codex to obtain a new access token when the current access token expires. Treat it like a password.

Do not use `.tokens.id_token` for the `/backend-api/codex/*` calls. It is part of the login/token-exchange flow, not the API bearer token.

Use `OPENAI_API_KEY` only for the public OpenAI API at `https://api.openai.com/v1/*`. It is separate from the ChatGPT/Codex auth in `auth.json`.

## Setup Variables

```bash
CODEX_HOME="$HOME/.codex"
AUTH_JSON="$CODEX_HOME/auth.json"
TOKEN="$(jq -r '.tokens.access_token' "$AUTH_JSON")"
INSTALL_ID="$(cat "$CODEX_HOME/installation_id")"
CLIENT_VERSION="$(jq -r '.client_version' "$CODEX_HOME/models_cache.json")"
```

Optional sanity checks:

```bash
jq -r '.auth_mode' "$AUTH_JSON"
jq -r '.tokens.access_token | if . then "access token exists" else "missing" end' "$AUTH_JSON"
jq -r '.tokens.refresh_token | if . then "refresh token exists" else "missing" end' "$AUTH_JSON"
```

## Available APIs

| API | Method | URL | Token | Status |
| --- | --- | --- | --- | --- |
| Codex responses | `POST` | `https://chatgpt.com/backend-api/codex/responses` | `auth.json` access token | Verified |
| Codex models | `GET` | `https://chatgpt.com/backend-api/codex/models?client_version=$CLIENT_VERSION` | `auth.json` access token | Verified shape |
| Public OpenAI responses | `POST` | `https://api.openai.com/v1/responses` | `OPENAI_API_KEY` | Public API equivalent |
| Public OpenAI models | `GET` | `https://api.openai.com/v1/models` | `OPENAI_API_KEY` | Public API |

Observed but not fully tested internal routes/base URLs:

| Route | Notes |
| --- | --- |
| `https://chatgpt.com/backend-api/` | ChatGPT backend base used by Codex auth/remote-control logs. |
| `https://chatgpt.com/backend-api/codex` | Codex backend base. |
| `https://chatgpt.com/backend-api/plugins/export/curated` | Plugin marketplace/export route observed in local client strings. |

## List Codex Models

```bash
curl -sS "https://chatgpt.com/backend-api/codex/models?client_version=$CLIENT_VERSION" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-codex-installation-id: $INSTALL_ID" \
  | jq -r '.models[] | [.display_name, .slug] | @tsv'
```

Locally cached API-supported models at the time this README was written:

```text
Display name         Slug                 supported_in_api
GPT-5.5              gpt-5.5              true
GPT-5.4              gpt-5.4              true
GPT-5.4-Mini         gpt-5.4-mini         true
Codex Auto Review    codex-auto-review    true
```

## Call Codex Responses

The Codex backend requires:

- `instructions`
- `input` as a list
- `store: false`
- `stream: true`

Minimal working request:

```bash
curl -N -i "https://chatgpt.com/backend-api/codex/responses" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "x-codex-installation-id: $INSTALL_ID" \
  -d '{
    "model": "gpt-5.5",
    "store": false,
    "stream": true,
    "instructions": "You are a concise assistant. Follow the user request exactly.",
