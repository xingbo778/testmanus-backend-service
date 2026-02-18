#!/usr/bin/env python3
"""
Parse the full rulebook markdown and import all chapters/rules via tRPC API.
Usage:
  python3 scripts/import_full_rules.py --dry-run     # Parse only
  python3 scripts/import_full_rules.py                # Import to Railway
  python3 scripts/import_full_rules.py --local        # Import to local dev
"""
import re
import json
import sys
import requests
import time

RULEBOOK_PATH = "/home/ubuntu/upload/分镜设计终极规则手册_LLM精校版.md"

# API endpoints
RAILWAY_URL = "https://web-production-01d28.up.railway.app"
LOCAL_URL = "http://localhost:3000"
API_KEY = "storyboard-admin-2024"

# Chapter category classification
CHAPTER_CATEGORIES = {
    1: "universal",      # 通用分镜基础法则
    2: "scene_specific", # 对话场景
    3: "scene_specific", # 动作/打斗场景
    4: "scene_specific", # 追逐/追车场景
    5: "scene_specific", # 悬疑/恐怖场景
    6: "scene_specific", # 浪漫/情感场景
    7: "scene_specific", # 喜剧场景
    8: "universal",      # 开场/建立镜头
    9: "universal",      # 结尾/收场镜头
    10: "universal",     # 场景转换与转场
    11: "scene_specific",# 食物/产品展示
    12: "scene_specific",# 旅行/风景/纪录片
    13: "scene_specific",# 音乐MV
    14: "scene_specific",# 广告/宣传片
    15: "scene_specific",# 群戏/多人场景
    16: "scene_specific",# 闪回/回忆/梦境
    17: "technical",     # 构图与画面美学
    18: "technical",     # 运镜与摄影机运动
    19: "technical",     # 剪辑节奏与蒙太奇
    20: "technical",     # 光线、色彩与氛围
    21: "technical",     # 景别选择与心理效应
    22: "technical",     # 角色调度与场面调度
    23: "ai_prompt",     # AI视频生成提示词
    24: "technical",     # 短视频/竖屏结构
    25: "technical",     # 声音设计与音画配合
}

# L2 scene mapping
CHAPTER_L2_MAPPING = {
    1: None,
    2: ["dialogue-daily", "dialogue-interrogation", "dialogue-confession", "dialogue-argument"],
    3: ["action-melee", "action-gunfight", "action-weapon", "action-brawl"],
    4: ["chase-urban", "chase-offroad", "chase-indoor", "chase-multi"],
    5: ["horror-room", "horror-haunted", "horror-killer", "horror-supernatural"],
    6: ["romance-meet", "romance-date", "romance-reunion", "romance-wedding"],
    7: ["comedy-misunderstanding", "comedy-exaggeration", "comedy-reversal", "comedy-slapstick"],
    8: None, 9: None, 10: None,
    11: ["commercial-food", "commercial-unboxing", "commercial-comparison", "commercial-macro"],
    12: ["lifestyle-urban", "lifestyle-nature", "lifestyle-culture", "lifestyle-extreme"],
    13: ["music-narrative", "music-performance", "music-concept"],
    14: ["ad-product", "ad-brand", "ad-charity", "ad-event"],
    15: ["group-teamwork", "group-party", "group-battle", "group-sports"],
    16: ["flashback-childhood", "flashback-trauma", "flashback-dream", "flashback-parallel"],
    17: None, 18: None, 19: None, 20: None, 21: None, 22: None, 23: None, 24: None, 25: None,
}


def parse_rulebook(filepath):
    """Parse the markdown rulebook into chapters and rules."""
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    chapters = []
    chapter_pattern = re.compile(r'^## ([一二三四五六七八九十]+)、(.+)$', re.MULTILINE)
    matches = list(chapter_pattern.finditer(content))

    for i, match in enumerate(matches):
        chapter_num = i + 1
        chapter_name = match.group(2).strip()
        start = match.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(content)
        chapter_content = content[start:end]

        rules = []
        rule_pattern = re.compile(r'^\d+\.\s+\*\*\[(Do|Don\'t)\]\*\*\s+(.+?)(?=\n\d+\.|\n---|\n##|\Z)', re.MULTILINE | re.DOTALL)
        for rule_match in rule_pattern.finditer(chapter_content):
            rule_type = "do" if rule_match.group(1) == "Do" else "dont"
            rule_text = rule_match.group(2).strip()
            rule_text = re.sub(r'\n\s+', ' ', rule_text)
            rule_text = rule_text.rstrip('-').strip()
            severity = "critical" if rule_type == "dont" else ("warning" if any(kw in rule_text for kw in ["必须", "务必", "严禁", "不得"]) else "info")
            rules.append({"type": rule_type, "text": rule_text, "severity": severity})

        chapters.append({
            "number": chapter_num,
            "name": chapter_name,
            "rules": rules,
            "category": CHAPTER_CATEGORIES.get(chapter_num, "universal"),
            "l2_ids": CHAPTER_L2_MAPPING.get(chapter_num),
        })

    return chapters


def trpc_call(base_url, procedure, input_data):
    """Call a tRPC mutation via HTTP POST."""
    url = f"{base_url}/api/trpc/{procedure}"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {API_KEY}",
    }
    payload = {"json": input_data}
    resp = requests.post(url, headers=headers, json=payload, timeout=30)
    if resp.status_code != 200:
        raise Exception(f"HTTP {resp.status_code}: {resp.text[:200]}")
    data = resp.json()
    if "error" in data.get("result", {}).get("data", {}):
        raise Exception(f"tRPC error: {data}")
    return data


def import_via_api(chapters, base_url):
    """Import chapters via tRPC API."""
    print(f"\nTarget: {base_url}")

    # Step 1: Clear existing
    print("Clearing existing rule chapters...")
    try:
        trpc_call(base_url, "rule.clearAll", {})
        print("  ✅ Cleared")
    except Exception as e:
        print(f"  ⚠️ Clear failed (may be empty): {e}")

    # Step 2: Import each chapter
    total_rules = 0
    for ch in chapters:
        input_data = {
            "chapterNumber": ch["number"],
            "title": ch["name"],
            "category": ch["category"],
            "applicableL2Ids": ch["l2_ids"],
            "rules": ch["rules"],
        }
        try:
            result = trpc_call(base_url, "rule.importChapter", input_data)
            total_rules += len(ch["rules"])
            print(f"  ✅ Ch {ch['number']:2d}: {ch['name']} ({len(ch['rules'])} rules)")
        except Exception as e:
            print(f"  ❌ Ch {ch['number']:2d}: {ch['name']} - FAILED: {e}")
        time.sleep(0.1)  # small delay

    print(f"\n{'='*60}")
    print(f"Total: {len(chapters)} chapters, {total_rules} rules imported")


def main():
    print("Parsing rulebook...")
    chapters = parse_rulebook(RULEBOOK_PATH)

    print(f"\nFound {len(chapters)} chapters:")
    total = 0
    for ch in chapters:
        count = len(ch["rules"])
        total += count
        do_count = sum(1 for r in ch["rules"] if r["type"] == "do")
        dont_count = sum(1 for r in ch["rules"] if r["type"] == "dont")
        print(f"  {ch['number']:2d}. {ch['name']} - {count} rules (Do: {do_count}, Don't: {dont_count}) [{ch['category']}]")
    print(f"  Total: {total} rules")

    if "--dry-run" in sys.argv:
        print("\n[Dry run] No data imported.")
        return

    base_url = LOCAL_URL if "--local" in sys.argv else RAILWAY_URL
    import_via_api(chapters, base_url)


if __name__ == "__main__":
    main()
