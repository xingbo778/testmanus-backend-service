// L1/L2/L3 category taxonomy for storyboard classification
export const CATEGORY_SEED = {
  l1: [
    { id: "narrative", name: "叙事剧情", nameEn: "Narrative Drama", description: "有完整故事线的短视频", sortOrder: 1 },
    { id: "commercial", name: "商业内容", nameEn: "Commercial", description: "产品推广、品牌广告", sortOrder: 2 },
    { id: "lifestyle", name: "生活方式", nameEn: "Lifestyle", description: "美食、旅行、日常vlog", sortOrder: 3 },
    { id: "documentary", name: "纪录纪实", nameEn: "Documentary", description: "纪实、科普、人物访谈", sortOrder: 4 },
    { id: "music_perf", name: "音乐表演", nameEn: "Music & Performance", description: "MV、舞蹈、乐器演奏", sortOrder: 5 },
    { id: "scifi_fantasy", name: "科幻奇幻", nameEn: "Sci-Fi & Fantasy", description: "科幻、奇幻、超自然", sortOrder: 6 },
    { id: "technique", name: "叙事技法", nameEn: "Narrative Technique", description: "蒙太奇、倒叙、平行剪辑", sortOrder: 7 },
    { id: "sports", name: "体育竞技", nameEn: "Sports", description: "运动、竞技、极限挑战", sortOrder: 8 },
    { id: "special", name: "特殊风格", nameEn: "Special Style", description: "定格、一镜到底、分屏", sortOrder: 9 },
  ],
  l2: [
    // Narrative Drama L2
    { id: "narrative.chase", l1Id: "narrative", name: "追逐场景", nameEn: "Chase Scene", description: "角色间的追逐", sortOrder: 1 },
    { id: "narrative.dialogue", l1Id: "narrative", name: "对话场景", nameEn: "Dialogue Scene", description: "两人或多人对话", sortOrder: 2 },
    { id: "narrative.action", l1Id: "narrative", name: "动作场景", nameEn: "Action Scene", description: "打斗、武术、动作戏", sortOrder: 3 },
    { id: "narrative.suspense", l1Id: "narrative", name: "悬疑惊悚", nameEn: "Suspense/Thriller", description: "悬疑、恐怖、惊悚", sortOrder: 4 },
    { id: "narrative.romance", l1Id: "narrative", name: "浪漫情感", nameEn: "Romance", description: "爱情、亲情、友情", sortOrder: 5 },
    { id: "narrative.comedy", l1Id: "narrative", name: "喜剧幽默", nameEn: "Comedy", description: "搞笑、反转、讽刺", sortOrder: 6 },
    { id: "narrative.historical", l1Id: "narrative", name: "古装历史", nameEn: "Historical/Period", description: "古装、武侠、历史题材", sortOrder: 7 },
    // Commercial L2
    { id: "commercial.product", l1Id: "commercial", name: "产品展示", nameEn: "Product Showcase", description: "产品特写、功能展示", sortOrder: 1 },
    { id: "commercial.food", l1Id: "commercial", name: "食物饮品", nameEn: "Food & Beverage", description: "美食制作、饮品展示", sortOrder: 2 },
    { id: "commercial.fashion", l1Id: "commercial", name: "时尚美妆", nameEn: "Fashion & Beauty", description: "服装、化妆品、配饰", sortOrder: 3 },
    { id: "commercial.tech", l1Id: "commercial", name: "科技数码", nameEn: "Tech & Digital", description: "电子产品、App展示", sortOrder: 4 },
    // Lifestyle L2
    { id: "lifestyle.vlog", l1Id: "lifestyle", name: "日常Vlog", nameEn: "Daily Vlog", description: "日常生活记录", sortOrder: 1 },
    { id: "lifestyle.travel", l1Id: "lifestyle", name: "旅行探索", nameEn: "Travel", description: "旅行、景点、文化", sortOrder: 2 },
    { id: "lifestyle.cooking", l1Id: "lifestyle", name: "美食制作", nameEn: "Cooking", description: "烹饪过程、食谱", sortOrder: 3 },
    { id: "lifestyle.fitness", l1Id: "lifestyle", name: "健身运动", nameEn: "Fitness", description: "健身教程、运动日常", sortOrder: 4 },
    // Documentary L2
    { id: "documentary.nature", l1Id: "documentary", name: "自然风光", nameEn: "Nature", description: "自然景观、动物", sortOrder: 1 },
    { id: "documentary.interview", l1Id: "documentary", name: "人物访谈", nameEn: "Interview", description: "人物采访、口述", sortOrder: 2 },
    { id: "documentary.science", l1Id: "documentary", name: "科普知识", nameEn: "Science", description: "科学知识、技术解析", sortOrder: 3 },
    // Music & Performance L2
    { id: "music_perf.mv", l1Id: "music_perf", name: "音乐MV", nameEn: "Music Video", description: "音乐视频", sortOrder: 1 },
    { id: "music_perf.dance", l1Id: "music_perf", name: "舞蹈表演", nameEn: "Dance", description: "舞蹈编排、表演", sortOrder: 2 },
    { id: "music_perf.instrument", l1Id: "music_perf", name: "乐器演奏", nameEn: "Instrument", description: "乐器演奏表演", sortOrder: 3 },
    // Sci-Fi & Fantasy L2
    { id: "scifi_fantasy.scifi", l1Id: "scifi_fantasy", name: "科幻场景", nameEn: "Sci-Fi", description: "未来科技、太空", sortOrder: 1 },
    { id: "scifi_fantasy.fantasy", l1Id: "scifi_fantasy", name: "奇幻魔法", nameEn: "Fantasy", description: "魔法、神话、超自然", sortOrder: 2 },
    { id: "scifi_fantasy.horror", l1Id: "scifi_fantasy", name: "恐怖超自然", nameEn: "Horror/Supernatural", description: "恐怖、灵异", sortOrder: 3 },
    // Technique L2
    { id: "technique.montage", l1Id: "technique", name: "蒙太奇", nameEn: "Montage", description: "蒙太奇剪辑手法", sortOrder: 1 },
    { id: "technique.flashback", l1Id: "technique", name: "倒叙闪回", nameEn: "Flashback", description: "倒叙、闪回叙事", sortOrder: 2 },
    { id: "technique.parallel", l1Id: "technique", name: "平行剪辑", nameEn: "Parallel Editing", description: "交叉剪辑、平行叙事", sortOrder: 3 },
    // Sports L2
    { id: "sports.competition", l1Id: "sports", name: "竞技比赛", nameEn: "Competition", description: "比赛、对抗", sortOrder: 1 },
    { id: "sports.extreme", l1Id: "sports", name: "极限运动", nameEn: "Extreme Sports", description: "极限挑战、冒险", sortOrder: 2 },
    { id: "sports.training", l1Id: "sports", name: "训练日常", nameEn: "Training", description: "训练过程、技巧", sortOrder: 3 },
    // Special Style L2
    { id: "special.stopmotion", l1Id: "special", name: "定格动画", nameEn: "Stop Motion", description: "逐帧拍摄动画", sortOrder: 1 },
    { id: "special.oneshot", l1Id: "special", name: "一镜到底", nameEn: "One-Shot", description: "长镜头、无剪辑", sortOrder: 2 },
    { id: "special.splitscreen", l1Id: "special", name: "分屏叙事", nameEn: "Split Screen", description: "多画面并列", sortOrder: 3 },
    { id: "special.group", l1Id: "special", name: "群戏多人", nameEn: "Ensemble/Group", description: "多角色群戏", sortOrder: 4 },
  ],
  l3: [
    // Chase L3
    { id: "narrative.chase.urban", l1Id: "narrative", l2Id: "narrative.chase", name: "城市街道追逐", nameEn: "Urban Street Chase", templateRef: "template_02", sortOrder: 1 },
    { id: "narrative.chase.jungle", l1Id: "narrative", l2Id: "narrative.chase", name: "丛林追逐", nameEn: "Jungle Chase", sortOrder: 2 },
    { id: "narrative.chase.car", l1Id: "narrative", l2Id: "narrative.chase", name: "车辆追逐", nameEn: "Car Chase", sortOrder: 3 },
    { id: "narrative.chase.indoor", l1Id: "narrative", l2Id: "narrative.chase", name: "室内追逐", nameEn: "Indoor Chase", sortOrder: 4 },
    // Dialogue L3 - 对话场景细分
    // 按场景空间分
    { id: "narrative.dialogue.cafe", l1Id: "narrative", l2Id: "narrative.dialogue", name: "咖啡馆/餐厅对话", nameEn: "Cafe/Restaurant Dialogue", description: "安静环境下的面对面交谈，适合情感铺垫、秘密分享", templateRef: "template_03", sortOrder: 1 },
    { id: "narrative.dialogue.office", l1Id: "narrative", l2Id: "narrative.dialogue", name: "办公室/职场对话", nameEn: "Office Dialogue", description: "职场环境下的正式或半正式对话，适合权力关系、职场冲突", sortOrder: 2 },
    { id: "narrative.dialogue.outdoor", l1Id: "narrative", l2Id: "narrative.dialogue", name: "户外/街头对话", nameEn: "Outdoor/Street Dialogue", description: "开放空间的对话，适合偶遇、告别、追赶后的对峙", sortOrder: 3 },
    { id: "narrative.dialogue.car", l1Id: "narrative", l2Id: "narrative.dialogue", name: "车内对话", nameEn: "Car Dialogue", description: "封闭车厢内的对话，适合紧张氛围、私密交谈、公路片", sortOrder: 4 },
    { id: "narrative.dialogue.home", l1Id: "narrative", l2Id: "narrative.dialogue", name: "家庭/客厅对话", nameEn: "Home Dialogue", description: "家庭环境下的对话，适合亲情、家庭矛盾、日常温馨", sortOrder: 5 },
    // 按情绪/功能分
    { id: "narrative.dialogue.confrontation", l1Id: "narrative", l2Id: "narrative.dialogue", name: "对峙/冲突对话", nameEn: "Confrontation", description: "高张力的正面冲突对话，适合争吵、质问、摊牌", sortOrder: 6 },
    { id: "narrative.dialogue.interrogation", l1Id: "narrative", l2Id: "narrative.dialogue", name: "审讯/盘问", nameEn: "Interrogation", description: "一方主导的压迫性对话，适合警匪、悬疑、权力不对等", sortOrder: 7 },
    { id: "narrative.dialogue.confession", l1Id: "narrative", l2Id: "narrative.dialogue", name: "告白/表白", nameEn: "Confession", description: "情感表达的关键对话，适合爱情告白、友情坦白、秘密揭露", sortOrder: 8 },
    { id: "narrative.dialogue.phone", l1Id: "narrative", l2Id: "narrative.dialogue", name: "电话/视频通话", nameEn: "Phone/Video Call", description: "远程对话，适合分隔两地、紧急通知、悬疑线索", sortOrder: 9 },
    { id: "narrative.dialogue.whisper", l1Id: "narrative", l2Id: "narrative.dialogue", name: "密谋/窃窃私语", nameEn: "Whisper/Conspiracy", description: "低声密谈，适合阴谋、秘密计划、不想被第三方听到", sortOrder: 10 },
    { id: "narrative.dialogue.group", l1Id: "narrative", l2Id: "narrative.dialogue", name: "多人群聊/聚会", nameEn: "Group Chat/Gathering", description: "三人及以上的对话场景，适合聚会、会议、家庭聚餐", sortOrder: 11 },
    { id: "narrative.dialogue.farewell", l1Id: "narrative", l2Id: "narrative.dialogue", name: "告别/离别对话", nameEn: "Farewell Dialogue", description: "分别时刻的对话，适合离别、分手、送行、临终遗言", sortOrder: 12 },
    // Action L3
    { id: "narrative.action.martial", l1Id: "narrative", l2Id: "narrative.action", name: "武术格斗", nameEn: "Martial Arts", templateRef: "template_04", sortOrder: 1 },
    { id: "narrative.action.gunfight", l1Id: "narrative", l2Id: "narrative.action", name: "枪战", nameEn: "Gunfight", sortOrder: 2 },
    { id: "narrative.action.escape", l1Id: "narrative", l2Id: "narrative.action", name: "逃脱场景", nameEn: "Escape Scene", sortOrder: 3 },
    { id: "narrative.action.disaster", l1Id: "narrative", l2Id: "narrative.action", name: "灾难场景", nameEn: "Disaster Scene", description: "地震、火灾、洪水、爆炸等灾难场景，强调紧迫感和生存本能", sortOrder: 4 },
    { id: "narrative.action.explosion", l1Id: "narrative", l2Id: "narrative.action", name: "爆炸/火灾逃生", nameEn: "Explosion/Fire Escape", description: "爆炸、火灾中的逃生场景，强调视觉冲击和紧张感", sortOrder: 5 },
    // Suspense L3
    { id: "narrative.suspense.mystery", l1Id: "narrative", l2Id: "narrative.suspense", name: "悬疑推理", nameEn: "Mystery", templateRef: "template_05", sortOrder: 1 },
    { id: "narrative.suspense.horror", l1Id: "narrative", l2Id: "narrative.suspense", name: "恐怖惊悚", nameEn: "Horror", sortOrder: 2 },
    { id: "narrative.suspense.reveal", l1Id: "narrative", l2Id: "narrative.suspense", name: "真相揭露", nameEn: "Reveal", sortOrder: 3 },
    { id: "narrative.suspense.locked_room", l1Id: "narrative", l2Id: "narrative.suspense", name: "密室逃脱", nameEn: "Locked Room", description: "封闭空间内的解谜或逃脱，强调幽闭恐惧和智力博弈", sortOrder: 4 },
    { id: "narrative.suspense.psych", l1Id: "narrative", l2Id: "narrative.suspense", name: "心理博弈", nameEn: "Psychological Game", description: "心理战、心理操控、心理博弈场景", sortOrder: 5 },
    // Romance L3
    { id: "narrative.romance.firstmeet", l1Id: "narrative", l2Id: "narrative.romance", name: "初次相遇", nameEn: "First Meeting", templateRef: "template_06", sortOrder: 1 },
    { id: "narrative.romance.farewell", l1Id: "narrative", l2Id: "narrative.romance", name: "离别场景", nameEn: "Farewell", sortOrder: 2 },
    { id: "narrative.romance.reunion", l1Id: "narrative", l2Id: "narrative.romance", name: "重逢场景", nameEn: "Reunion", sortOrder: 3 },
    { id: "narrative.romance.wedding", l1Id: "narrative", l2Id: "narrative.romance", name: "婚礼场景", nameEn: "Wedding", description: "婚礼仪式、求婚、婚礼等浪漫场景", sortOrder: 4 },
    { id: "narrative.romance.date", l1Id: "narrative", l2Id: "narrative.romance", name: "约会场景", nameEn: "Date", description: "约会、约饭、看电影等浪漫约会场景", sortOrder: 5 },
    // Comedy L3
    { id: "narrative.comedy.slapstick", l1Id: "narrative", l2Id: "narrative.comedy", name: "闹剧", nameEn: "Slapstick", templateRef: "template_07", sortOrder: 1 },
    { id: "narrative.comedy.twist", l1Id: "narrative", l2Id: "narrative.comedy", name: "反转喜剧", nameEn: "Twist Comedy", sortOrder: 2 },
    { id: "narrative.comedy.satire", l1Id: "narrative", l2Id: "narrative.comedy", name: "讽刺幽默", nameEn: "Satire", sortOrder: 3 },
    { id: "narrative.comedy.misunderstanding", l1Id: "narrative", l2Id: "narrative.comedy", name: "误会喜剧", nameEn: "Misunderstanding Comedy", description: "因误会引发的搅笑场景", sortOrder: 4 },
    { id: "narrative.comedy.prank", l1Id: "narrative", l2Id: "narrative.comedy", name: "恶作剧", nameEn: "Prank", description: "恶作剧、整蛊、搞怪场景", sortOrder: 5 },
    // Historical L3
    { id: "narrative.historical.wuxia", l1Id: "narrative", l2Id: "narrative.historical", name: "武侠对决", nameEn: "Wuxia Duel", templateRef: "template_08", sortOrder: 1 },
    { id: "narrative.historical.court", l1Id: "narrative", l2Id: "narrative.historical", name: "宫廷戏", nameEn: "Court Drama", sortOrder: 2 },
    { id: "narrative.historical.war", l1Id: "narrative", l2Id: "narrative.historical", name: "古代战争", nameEn: "Ancient War", sortOrder: 3 },
    { id: "narrative.historical.market", l1Id: "narrative", l2Id: "narrative.historical", name: "古代市集", nameEn: "Ancient Market", description: "古代街市、集市、庙会等生活场景", sortOrder: 4 },
    { id: "narrative.historical.academy", l1Id: "narrative", l2Id: "narrative.historical", name: "书院/学堂", nameEn: "Academy", description: "古代书院、私塾、学堂场景", sortOrder: 5 },
    // Product L3
    { id: "commercial.product.unboxing", l1Id: "commercial", l2Id: "commercial.product", name: "开箱展示", nameEn: "Unboxing", templateRef: "template_09", sortOrder: 1 },
    { id: "commercial.product.comparison", l1Id: "commercial", l2Id: "commercial.product", name: "产品对比", nameEn: "Comparison", sortOrder: 2 },
    { id: "commercial.product.lifestyle", l1Id: "commercial", l2Id: "commercial.product", name: "场景化展示", nameEn: "Lifestyle Showcase", sortOrder: 3 },
    // Food L3
    { id: "commercial.food.recipe", l1Id: "commercial", l2Id: "commercial.food", name: "食谱教程", nameEn: "Recipe Tutorial", templateRef: "template_10", sortOrder: 1 },
    { id: "commercial.food.asmr", l1Id: "commercial", l2Id: "commercial.food", name: "美食ASMR", nameEn: "Food ASMR", sortOrder: 2 },
    { id: "commercial.food.review", l1Id: "commercial", l2Id: "commercial.food", name: "美食测评", nameEn: "Food Review", sortOrder: 3 },
    // Fashion L3
    { id: "commercial.fashion.lookbook", l1Id: "commercial", l2Id: "commercial.fashion", name: "穿搭展示", nameEn: "Lookbook", templateRef: "template_11", sortOrder: 1 },
    { id: "commercial.fashion.makeup", l1Id: "commercial", l2Id: "commercial.fashion", name: "化妆教程", nameEn: "Makeup Tutorial", sortOrder: 2 },
    { id: "commercial.fashion.hairstyle", l1Id: "commercial", l2Id: "commercial.fashion", name: "发型教程", nameEn: "Hairstyle Tutorial", description: "发型设计、编发、染发教程", sortOrder: 3 },
    // Tech L3
    { id: "commercial.tech.review", l1Id: "commercial", l2Id: "commercial.tech", name: "科技评测", nameEn: "Tech Review", templateRef: "template_12", sortOrder: 1 },
    { id: "commercial.tech.tutorial", l1Id: "commercial", l2Id: "commercial.tech", name: "使用教程", nameEn: "Tutorial", sortOrder: 2 },
    { id: "commercial.tech.software", l1Id: "commercial", l2Id: "commercial.tech", name: "软件演示", nameEn: "Software Demo", description: "App、软件功能演示和操作教程", sortOrder: 3 },
    // Vlog L3
    { id: "lifestyle.vlog.daily", l1Id: "lifestyle", l2Id: "lifestyle.vlog", name: "日常记录", nameEn: "Daily Record", templateRef: "template_01", sortOrder: 1 },
    { id: "lifestyle.vlog.event", l1Id: "lifestyle", l2Id: "lifestyle.vlog", name: "事件记录", nameEn: "Event Record", sortOrder: 2 },
    { id: "lifestyle.vlog.pet", l1Id: "lifestyle", l2Id: "lifestyle.vlog", name: "宠物日常", nameEn: "Pet Daily", description: "宠物日常生活、趣事记录", sortOrder: 3 },
    // Travel L3
    { id: "lifestyle.travel.city", l1Id: "lifestyle", l2Id: "lifestyle.travel", name: "城市探索", nameEn: "City Exploration", templateRef: "template_13", sortOrder: 1 },
    { id: "lifestyle.travel.nature", l1Id: "lifestyle", l2Id: "lifestyle.travel", name: "自然风光", nameEn: "Nature Scenery", sortOrder: 2 },
    { id: "lifestyle.travel.food", l1Id: "lifestyle", l2Id: "lifestyle.travel", name: "美食探店", nameEn: "Food Exploration", description: "探访特色餐厅、街头小吃、美食地图", sortOrder: 3 },
    // Cooking L3
    { id: "lifestyle.cooking.home", l1Id: "lifestyle", l2Id: "lifestyle.cooking", name: "家常菜", nameEn: "Home Cooking", sortOrder: 1 },
    { id: "lifestyle.cooking.baking", l1Id: "lifestyle", l2Id: "lifestyle.cooking", name: "烘焙甜点", nameEn: "Baking", sortOrder: 2 },
    // Fitness L3
    { id: "lifestyle.fitness.workout", l1Id: "lifestyle", l2Id: "lifestyle.fitness", name: "健身教程", nameEn: "Workout Tutorial", sortOrder: 1 },
    { id: "lifestyle.fitness.yoga", l1Id: "lifestyle", l2Id: "lifestyle.fitness", name: "瑷伽冥想", nameEn: "Yoga & Meditation", sortOrder: 2 },
    { id: "lifestyle.fitness.running", l1Id: "lifestyle", l2Id: "lifestyle.fitness", name: "户外跑步", nameEn: "Outdoor Running", description: "户外跑步、越野跑、马拉松训练", sortOrder: 3 },
    // Nature L3
    { id: "documentary.nature.landscape", l1Id: "documentary", l2Id: "documentary.nature", name: "风景延时", nameEn: "Landscape Timelapse", templateRef: "template_14", sortOrder: 1 },
    { id: "documentary.nature.wildlife", l1Id: "documentary", l2Id: "documentary.nature", name: "野生动物", nameEn: "Wildlife", sortOrder: 2 },
    { id: "documentary.nature.ocean", l1Id: "documentary", l2Id: "documentary.nature", name: "海洋生态", nameEn: "Ocean Ecology", description: "海洋生物、深海探索、珊瑩礁生态", sortOrder: 3 },
    { id: "documentary.nature.polar", l1Id: "documentary", l2Id: "documentary.nature", name: "极地探险", nameEn: "Polar Exploration", description: "南极、北极、冰川、极光等极地场景", sortOrder: 4 },
    // Interview L3
    { id: "documentary.interview.portrait", l1Id: "documentary", l2Id: "documentary.interview", name: "人物特写", nameEn: "Portrait", sortOrder: 1 },
    { id: "documentary.interview.panel", l1Id: "documentary", l2Id: "documentary.interview", name: "圆桌讨论", nameEn: "Panel Discussion", sortOrder: 2 },
    // Science L3
    { id: "documentary.science.explainer", l1Id: "documentary", l2Id: "documentary.science", name: "科普讲解", nameEn: "Explainer", sortOrder: 1 },
    { id: "documentary.science.history", l1Id: "documentary", l2Id: "documentary.science", name: "历史科普", nameEn: "History Explainer", description: "历史事件、历史人物、文明发展科普", sortOrder: 2 },
    { id: "documentary.science.space", l1Id: "documentary", l2Id: "documentary.science", name: "太空科普", nameEn: "Space Explainer", description: "宇宙、星球、航天科技科普", sortOrder: 3 },
    // MV L3
    { id: "music_perf.mv.narrative", l1Id: "music_perf", l2Id: "music_perf.mv", name: "叙事MV", nameEn: "Narrative MV", templateRef: "template_15", sortOrder: 1 },
    { id: "music_perf.mv.performance", l1Id: "music_perf", l2Id: "music_perf.mv", name: "表演MV", nameEn: "Performance MV", sortOrder: 2 },
    // Dance L3
    { id: "music_perf.dance.solo", l1Id: "music_perf", l2Id: "music_perf.dance", name: "独舞", nameEn: "Solo Dance", sortOrder: 1 },
    { id: "music_perf.dance.group", l1Id: "music_perf", l2Id: "music_perf.dance", name: "群舞", nameEn: "Group Dance", sortOrder: 2 },
    // Instrument L3
    { id: "music_perf.instrument.piano", l1Id: "music_perf", l2Id: "music_perf.instrument", name: "钢琴演奏", nameEn: "Piano Performance", description: "钢琴独奏、四手联弹", sortOrder: 1 },
    { id: "music_perf.instrument.guitar", l1Id: "music_perf", l2Id: "music_perf.instrument", name: "吉他弹唱", nameEn: "Guitar Performance", description: "吉他独奏、弹唱表演", sortOrder: 2 },
    { id: "music_perf.instrument.band", l1Id: "music_perf", l2Id: "music_perf.instrument", name: "乐队演出", nameEn: "Band Performance", description: "乐队现场演出、排练", sortOrder: 3 },
    // Sci-Fi L3
    { id: "scifi_fantasy.scifi.space", l1Id: "scifi_fantasy", l2Id: "scifi_fantasy.scifi", name: "太空探索", nameEn: "Space Exploration", templateRef: "template_16", sortOrder: 1 },
    { id: "scifi_fantasy.scifi.cyberpunk", l1Id: "scifi_fantasy", l2Id: "scifi_fantasy.scifi", name: "赛博朋克", nameEn: "Cyberpunk", sortOrder: 2 },
    // Fantasy L3
    { id: "scifi_fantasy.fantasy.magic", l1Id: "scifi_fantasy", l2Id: "scifi_fantasy.fantasy", name: "魔法对决", nameEn: "Magic Duel", sortOrder: 1 },
    { id: "scifi_fantasy.fantasy.myth", l1Id: "scifi_fantasy", l2Id: "scifi_fantasy.fantasy", name: "神话传说", nameEn: "Mythology", sortOrder: 2 },
    // Horror/Supernatural L3
    { id: "scifi_fantasy.horror.haunted", l1Id: "scifi_fantasy", l2Id: "scifi_fantasy.horror", name: "鬼屋探险", nameEn: "Haunted House", description: "闹鬼的房子、废弃建筑探险", sortOrder: 1 },
    { id: "scifi_fantasy.horror.paranormal", l1Id: "scifi_fantasy", l2Id: "scifi_fantasy.horror", name: "灵异事件", nameEn: "Paranormal Event", description: "超自然现象、灵异事件、都市传说", sortOrder: 2 },
    { id: "scifi_fantasy.horror.zombie", l1Id: "scifi_fantasy", l2Id: "scifi_fantasy.horror", name: "丧尸末日", nameEn: "Zombie Apocalypse", description: "丧尸、末日生存、感染场景", sortOrder: 3 },
    // Montage L3
    { id: "technique.montage.rhythmic", l1Id: "technique", l2Id: "technique.montage", name: "节奏蒙太奇", nameEn: "Rhythmic Montage", sortOrder: 1 },
    { id: "technique.montage.contrast", l1Id: "technique", l2Id: "technique.montage", name: "对比蒙太奇", nameEn: "Contrast Montage", sortOrder: 2 },
    { id: "technique.montage.intellectual", l1Id: "technique", l2Id: "technique.montage", name: "理性蒙太奇", nameEn: "Intellectual Montage", description: "通过并置不相关画面产生新含义", sortOrder: 3 },
    // Flashback L3
    { id: "technique.flashback.memory", l1Id: "technique", l2Id: "technique.flashback", name: "回忆闪回", nameEn: "Memory Flashback", description: "角色回忆过去的场景，常用色调变化表示", sortOrder: 1 },
    { id: "technique.flashback.timejump", l1Id: "technique", l2Id: "technique.flashback", name: "时间跳跃", nameEn: "Time Jump", description: "时间线跳跃、倒叙、非线性叙事", sortOrder: 2 },
    // Parallel L3
    { id: "technique.parallel.dual", l1Id: "technique", l2Id: "technique.parallel", name: "双线叙事", nameEn: "Dual Narrative", sortOrder: 1 },
    { id: "technique.parallel.crosscut", l1Id: "technique", l2Id: "technique.parallel", name: "交叉剪辑", nameEn: "Cross Cutting", description: "两个场景交替剪辑，制造紧张感", sortOrder: 2 },
    // Sports L3
    { id: "sports.competition.match", l1Id: "sports", l2Id: "sports.competition", name: "比赛实况", nameEn: "Match Highlight", sortOrder: 1 },
    { id: "sports.competition.ceremony", l1Id: "sports", l2Id: "sports.competition", name: "领奖/庆祝", nameEn: "Award Ceremony", description: "领奖台、胜利庆祝、团队欢呼", sortOrder: 2 },
    { id: "sports.extreme.parkour", l1Id: "sports", l2Id: "sports.extreme", name: "跑酷", nameEn: "Parkour", sortOrder: 1 },
    { id: "sports.extreme.surfing", l1Id: "sports", l2Id: "sports.extreme", name: "冲浪", nameEn: "Surfing", sortOrder: 2 },
    { id: "sports.extreme.climbing", l1Id: "sports", l2Id: "sports.extreme", name: "攀岩", nameEn: "Rock Climbing", description: "室内/室外攀岩、抱石", sortOrder: 3 },
    { id: "sports.extreme.paragliding", l1Id: "sports", l2Id: "sports.extreme", name: "滑翔伞", nameEn: "Paragliding", description: "滑翔伞、跳伞、翡翠飞行", sortOrder: 4 },
    // Training L3
    { id: "sports.training.boxing", l1Id: "sports", l2Id: "sports.training", name: "拳击训练", nameEn: "Boxing Training", description: "拳击、格斗训练日常", sortOrder: 1 },
    { id: "sports.training.basketball", l1Id: "sports", l2Id: "sports.training", name: "篮球训练", nameEn: "Basketball Training", description: "篮球技巧训练、实战练习", sortOrder: 2 },
    { id: "sports.training.gym", l1Id: "sports", l2Id: "sports.training", name: "健身房训练", nameEn: "Gym Training", description: "力量训练、器械训练日常", sortOrder: 3 },
    // Special L3
    { id: "special.stopmotion.clay", l1Id: "special", l2Id: "special.stopmotion", name: "粘土动画", nameEn: "Clay Animation", sortOrder: 1 },
    { id: "special.stopmotion.paper", l1Id: "special", l2Id: "special.stopmotion", name: "纸艺动画", nameEn: "Paper Animation", description: "纸艺、剪纸、折纸定格动画", sortOrder: 2 },
    { id: "special.oneshot.continuous", l1Id: "special", l2Id: "special.oneshot", name: "连续长镜头", nameEn: "Continuous Shot", sortOrder: 1 },
    { id: "special.oneshot.walkthrough", l1Id: "special", l2Id: "special.oneshot", name: "穿越长镜头", nameEn: "Walk-through Shot", description: "穿越多个空间的一镜到底", sortOrder: 2 },
    { id: "special.splitscreen.dual", l1Id: "special", l2Id: "special.splitscreen", name: "双画面分屏", nameEn: "Dual Split Screen", sortOrder: 1 },
    { id: "special.splitscreen.multi", l1Id: "special", l2Id: "special.splitscreen", name: "多画面分屏", nameEn: "Multi Split Screen", description: "三个及以上画面同时展示", sortOrder: 2 },
    { id: "special.group.ensemble", l1Id: "special", l2Id: "special.group", name: "群像叙事", nameEn: "Ensemble Narrative", sortOrder: 1 },
    { id: "special.group.crowd", l1Id: "special", l2Id: "special.group", name: "人群场景", nameEn: "Crowd Scene", description: "大规模人群、游行、集会场景", sortOrder: 2 },
  ],
};
