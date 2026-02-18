#!/usr/bin/env python3
"""
Parse the full rulebook markdown and import all chapters/rules directly to MySQL.
"""
import re
import json
import sys

RULEBOOK_PATH = "/home/ubuntu/upload/分镜设计终极规则手册_LLM精校版.md"

# Railway MySQL TCP proxy
MYSQL_HOST = "junction.proxy.rlwy.net"
MYSQL_PORT = 47874
MYSQL_USER = "root"
MYSQL_PASS = "rqxNPkfTkMCVKnMWqLDMYWJUfnXrwJkR"
MYSQL_DB = "railway"

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

# L2 scene mapping: chapter number -> applicable L2 IDs (null = universal/all)
CHAPTER_L2_MAPPING = {
    1: None,  # universal
    2: ["dialogue-daily", "dialogue-interrogation", "dialogue-confession", "dialogue-argument"],
    3: ["action-melee", "action-gunfight", "action-weapon", "action-brawl"],
    4: ["chase-urban", "chase-offroad", "chase-indoor", "chase-multi"],
    5: ["horror-room", "horror-haunted", "horror-killer", "horror-supernatural"],
    6: ["romance-meet", "romance-date", "romance-reunion", "romance-wedding"],
    7: ["comedy-misunderstanding", "comedy-exaggeration", "comedy-reversal", "comedy-slapstick"],
    8: None,  # universal
    9: None,  # universal
    10: None, # universal
    11: ["commercial-food", "commercial-unboxing", "commercial-comparison", "commercial-macro"],
    12: ["lifestyle-urban", "lifestyle-nature", "lifestyle-culture", "lifestyle-extreme"],
    13: ["music-narrative", "music-performance", "music-concept"],
    14: ["ad-product", "ad-brand", "ad-charity", "ad-event"],
    15: ["group-teamwork", "group-party", "group-battle", "group-sports"],
    16: ["flashback-childhood", "flashback-trauma", "flashback-dream", "flashback-parallel"],
    17: None, # technical - universal
    18: None, # technical - universal
    19: None, # technical - universal
    20: None, # technical - universal
    21: None, # technical - universal
    22: None, # technical - universal
    23: None, # ai_prompt - universal
    24: None, # technical - universal
    25: None, # technical - universal
}


def parse_rulebook(filepath):
    """Parse the markdown rulebook into chapters and rules."""
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    chapters = []
    # Match any ## heading that starts with Chinese numerals followed by 、
    chapter_pattern = re.compile(r'^## ([一二三四五六七八九十]+)、(.+)$', re.MULTILINE)
    
    matches = list(chapter_pattern.finditer(content))
    
    for i, match in enumerate(matches):
        chapter_num = i + 1
        chapter_name = match.group(2).strip()
        
        # Get chapter content
        start = match.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(content)
        chapter_content = content[start:end]
        
        # Extract rules
        rules = []
        rule_pattern = re.compile(r'^\d+\.\s+\*\*\[(Do|Don\'t)\]\*\*\s+(.+?)(?=\n\d+\.|\n---|\n##|\Z)', re.MULTILINE | re.DOTALL)
        
        for rule_match in rule_pattern.finditer(chapter_content):
            rule_type = "do" if rule_match.group(1) == "Do" else "dont"
            rule_text = rule_match.group(2).strip()
            rule_text = re.sub(r'\n\s+', ' ', rule_text)
            rule_text = rule_text.rstrip('-').strip()
            
            # Determine severity
            if rule_type == "dont":
                severity = "critical"
            elif any(kw in rule_text for kw in ["必须", "务必", "严禁", "不得"]):
                severity = "warning"
            else:
                severity = "info"
            
            rules.append({
                "type": rule_type,
                "text": rule_text,
                "severity": severity
            })
        
        chapters.append({
            "number": chapter_num,
            "name": chapter_name,
            "rules": rules,
            "category": CHAPTER_CATEGORIES.get(chapter_num, "universal"),
            "l2_ids": CHAPTER_L2_MAPPING.get(chapter_num),
        })
    
    return chapters


def import_to_mysql(chapters):
    """Import chapters and rules directly to MySQL."""
    import mysql.connector
    
    conn = mysql.connector.connect(
        host=MYSQL_HOST,
        port=MYSQL_PORT,
        user=MYSQL_USER,
        password=MYSQL_PASS,
        database=MYSQL_DB,
        charset='utf8mb4',
    )
    cursor = conn.cursor()
    
    # First, clear existing rule chapters
    cursor.execute("DELETE FROM rule_chapters")
    conn.commit()
    print("Cleared existing rule chapters.")
    
    total_rules = 0
    for ch in chapters:
        rules_json = json.dumps(ch["rules"], ensure_ascii=False)
        l2_ids_json = json.dumps(ch["l2_ids"], ensure_ascii=False) if ch["l2_ids"] else None
        
        cursor.execute("""
            INSERT INTO rule_chapters (chapterNumber, title, category, applicableL2Ids, rules, ruleCount, createdAt)
            VALUES (%s, %s, %s, %s, %s, %s, NOW())
        """, (
            ch["number"],
            ch["name"],
            ch["category"],
            l2_ids_json,
            rules_json,
            len(ch["rules"]),
        ))
        
        total_rules += len(ch["rules"])
        print(f"  ✅ Chapter {ch['number']:2d}: {ch['name']} ({len(ch['rules'])} rules)")
    
    conn.commit()
    cursor.close()
    conn.close()
    
    print(f"\n{'='*60}")
    print(f"Total: {len(chapters)} chapters, {total_rules} rules imported to MySQL")


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
    
    print("\nImporting to MySQL...")
    import_to_mysql(chapters)


if __name__ == "__main__":
    main()
