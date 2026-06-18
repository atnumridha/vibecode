# ChatGPT Backend API Notes

This document records the curl shape that worked against the ChatGPT Codex backend used by the local Codex Desktop/CLI install on this machine.

These are internal ChatGPT Codex backend routes. They are not the same thing as the public OpenAI Platform API at `https://api.openai.com/v1/*`, and they can change without notice.

## Files Used

- Auth file: `$HOME/.codex/auth.json`
- Installation id: `$HOME/.codex/installation_id`
- Model cache: `$HOME/.codex/models_cache.json`
- Codex client version: read from `.client_version` in `models_cache.json`

## Token Guide

Use `.tokens.access_token` for `https://chatgpt.com/backend-api/codex/*` calls:

```bash
TOKEN="$(jq -r '.tokens.access_token' "$HOME/.codex/auth.json")"
```

Do not use `.tokens.refresh_token` as the bearer token for API calls. It is used by Codex to obtain a new access token when the current access token expires. Treat it like a password.

Do not use `.tokens.id_token` for `/backend-api/codex/*` calls. It is part of the login/token-exchange flow, not the API bearer token.

Use `OPENAI_API_KEY` only for the public OpenAI Platform API at `https://api.openai.com/v1/*`. It is separate from the ChatGPT/Codex auth in `auth.json`.

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

Expected auth mode for ChatGPT-backed Codex auth:

```text
chatgpt
access token exists
refresh token exists
```

## Available APIs

| API | Method | URL | Token | Status |
| --- | --- | --- | --- | --- |
| Codex responses | `POST` | `https://chatgpt.com/backend-api/codex/responses` | `auth.json` access token | Verified |
| Codex models | `GET` | `https://chatgpt.com/backend-api/codex/models?client_version=$CLIENT_VERSION` | `auth.json` access token | Verified |
| Public OpenAI responses | `POST` | `https://api.openai.com/v1/responses` | `OPENAI_API_KEY` | Public API |
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

Observed output on 2026-06-18:

```text
GPT-5.5            gpt-5.5
GPT-5.4            gpt-5.4
GPT-5.4-Mini       gpt-5.4-mini
Codex Auto Review  codex-auto-review
```

## Call Codex Responses

The Codex backend request that was verified on 2026-06-18 used:

- `instructions`
- `input` as a list
- `store: false`
- `stream: true`
- `x-codex-installation-id`

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
    "input": [
      {
        "role": "user",
        "content": [
          {
            "type": "input_text",
            "text": "Hello"
          }
        ]
      }
    ]
  }'
```

Verified response:

- HTTP status: `HTTP/2 200`
- Stream events included `response.created`, `response.in_progress`, `response.output_text.delta`, `response.output_text.done`, and `response.completed`
- Final streamed text:

```text
Hello! How can I help you today?
```

## Common Errors

### Shell shows `quote>`

This is a local shell quoting problem, not an API response. It happens when the single-quoted JSON body after `-d '` is not closed.

Cancel with `Ctrl+C`, then rerun with a complete JSON body.

### `{"detail":"Input must be a list"}`

The Codex backend rejected a string input:

```json
"input": "Hello"
```

Use the list form instead:

```json
"input": [
  {
    "role": "user",
    "content": [
      {
        "type": "input_text",
        "text": "Hello"
      }
    ]
  }
]
```

### Public API returns `Incorrect API key provided: ''`

This means `$OPENAI_API_KEY` is empty in the shell:

```text
Incorrect API key provided: ''
```

That is separate from ChatGPT/Codex auth. The token from `$HOME/.codex/auth.json` is for `chatgpt.com/backend-api/codex/*`, not `api.openai.com/v1/*`.

## Reading Streamed Output

For `stream: true`, read text from these server-sent events:

- `response.output_text.delta` for incremental text
- `response.output_text.done` for the completed text block
- `response.completed` for completion status and token usage

In the verified Codex backend run, the final `response.completed` object had `"output":[]`, while the text was present in `response.output_text.delta` and `response.output_text.done`. Do not depend on `response.completed.response.output` for streamed text from this endpoint.

The stream can include `obfuscation` fields on delta events. They are transport metadata and should not be displayed as model output.

## Public OpenAI Responses API

Use this only with a real OpenAI Platform API key:

```bash
curl -N -i "https://api.openai.com/v1/responses" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-5.4",
    "store": false,
    "stream": true,
    "instructions": "You are a concise assistant. Follow the user request exactly.",
    "input": "Hello"
  }'
```

Notes:

- `api.openai.com` requires `OPENAI_API_KEY`.
- `chatgpt.com/backend-api/codex/*` requires the ChatGPT/Codex access token from `auth.json`.
- The public Responses API accepts string input for basic text requests. The observed ChatGPT Codex backend request required `input` to be a list.
