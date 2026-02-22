#!/usr/bin/env python3
"""Sync web/src/locales/zh-CN.json from en.json.

- Reuses existing zh translations when source English text is unchanged.
- Auto-translates missing/changed entries via Google Translate web endpoint.
- Persists source snapshot in .zh-sync-meta.json for incremental updates.
"""

from __future__ import annotations

import json
import time
import urllib.parse
import urllib.request
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
LOCALES_DIR = BASE_DIR.parent / "src" / "locales"
EN_PATH = LOCALES_DIR / "en.json"
ZH_PATH = LOCALES_DIR / "zh-CN.json"
META_PATH = LOCALES_DIR / ".zh-sync-meta.json"

KEY_OVERRIDES = {
    "auth.pair_button": "配对",
    "common.actions": "操作",
    "common.name": "名称",
    "common.save": "保存",
    "common.status": "状态",
    "cost.request_count": "请求数",
    "cost.requests": "请求数",
    "cron.enable": "启用",
    "dashboard.status": "状态",
    "health.component": "组件",
    "health.status": "状态",
    "integrations.active": "已启用",
    "integrations.available": "可用",
    "integrations.status": "状态",
    "memory.key": "键",
    "nav.agent": "助手",
    "nav.doctor": "诊断",
    "nav.memory": "记忆库",
    "tools.name": "名称",
}


def load_json(path: Path, fallback):
    if not path.exists():
        return fallback
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return fallback


def google_translate_en_to_zh(text: str) -> str:
    if not text.strip():
        return text

    params = urllib.parse.urlencode(
        {
            "client": "gtx",
            "sl": "en",
            "tl": "zh-CN",
            "dt": "t",
            "q": text,
        }
    )
    url = f"https://translate.googleapis.com/translate_a/single?{params}"

    for attempt in range(3):
        try:
            with urllib.request.urlopen(url, timeout=15) as response:
                payload = json.loads(response.read().decode("utf-8"))
            if isinstance(payload, list) and payload and isinstance(payload[0], list):
                translated = "".join(
                    part[0]
                    for part in payload[0]
                    if isinstance(part, list)
                    and part
                    and isinstance(part[0], str)
                ).strip()
                if translated:
                    return translated
        except Exception as error:
            if attempt == 2:
                print(f'warn: translation failed for "{text}": {error}')
            time.sleep(0.2 * (attempt + 1))

    return text


def main() -> None:
    en = load_json(EN_PATH, {})
    zh_existing = load_json(ZH_PATH, {})
    meta_existing = load_json(META_PATH, {})

    zh_next = {}
    meta_next = {}

    translated_count = 0
    reused_count = 0

    for key in sorted(en.keys()):
        en_value = en[key]
        if key in KEY_OVERRIDES:
            zh_next[key] = KEY_OVERRIDES[key]
            meta_next[key] = en_value
            reused_count += 1
            continue

        current_zh = zh_existing.get(key)
        previous_source = meta_existing.get(key)

        if isinstance(current_zh, str) and current_zh.strip() and previous_source == en_value:
            zh_next[key] = current_zh
            meta_next[key] = en_value
            reused_count += 1
            continue

        translated = google_translate_en_to_zh(en_value)
        zh_next[key] = translated or en_value
        meta_next[key] = en_value
        translated_count += 1
        time.sleep(0.06)

    ZH_PATH.write_text(json.dumps(zh_next, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    META_PATH.write_text(
        json.dumps(meta_next, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    print(
        f"zh sync complete: {reused_count} reused, {translated_count} translated, {len(en)} total."
    )


if __name__ == "__main__":
    main()
