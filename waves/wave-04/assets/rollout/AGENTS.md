# rollout/
> L2 | 父级: ../AGENTS.md

成员清单
APP_CONV_MOF_EVG_STIL_THEC_THEWED_ANYO_V04.png: The First Dance, Again 变体的 1:1 应用内提示卡，以居中修复婚礼照和“Restore a photo”短文案适配圆形裁切。
IG_CONV_MOF_EVG_STIL_THEC_THEWED_ANYO_V04.png: The First Dance, Again 变体的 1:1 Instagram 自拍式静态图，一位女性在自家厨房对镜微笑，将同一张修复婚礼照举在脸旁展示，暖色自然光，读作本人自己发的帖而非摆拍广告图，无文字与品牌元素。旧版（厨房桌边手持照片特写）备份为 IG_CONV_MOF_EVG_STIL_THEC_THEWED_ANYO_V04.old.png（已 gitignore）。
IG_ENGT_BOF_LOOP_STIL_COUP_THEWED_COUP_V04.png: The Recreation 变体的 1:1 Instagram 手机抓拍静态图，保留参考情侣、厨房举抱重现与右下角微型 “credit” 标签。
recreation-france-v1.png: The Recreation 的 1080×1920 巴黎旅行衍生静态图，保留参考情侣身份与举抱姿势，以金色时刻埃菲尔铁塔背景呈现目的地订婚摄影质感，无文字与品牌元素。
endcard-firstdance.png: The First Dance, Again 视频的 1080×1920 品牌收尾卡，纸白底 + OpenAI 结mark + 主行 "Bring yours back." + 副行 "Made with ChatGPT"，由 scripts/end-card.mjs 渲染，仅作视频末帧合成用，不单独投放。
endcard-recreation.png: The Recreation 视频的 1080×1920 品牌收尾卡，同一渲染器与排版，主行 "Your turn."，副行 "Made with ChatGPT"，仅作视频末帧合成用，不单独投放。
TT_CONV_MOF_EVG_MOTN_THEC_THEWED_ANYO_V04.mp4: The First Dance, Again 的 9:16 TikTok 成片（7.9s）：原 5.9s 内容 → 0.4s crossfade → endcard-firstdance 停留 2s；无音轨。
TT_ENGT_BOF_LOOP_MOTN_COUP_THEWED_COUP_V04.mp4: The Recreation 的 9:16 TikTok 成片（10.25s）：原 6s 厨房内容 → 0.65s crossfade → recreation-france-v1 停留 1.8s → 0.4s crossfade → endcard-recreation 停留 2s；无音轨。
TT_CONV_MOF_EVG_STIL_THEC_THEWED_ANYO_V04.png: The First Dance, Again 变体的 9:16 TikTok 纯摄影封面帧，以老年双手在下方三分之二区域展示同一对新人的褪色原照与暖色修复婚照，上方保留无文字负空间。
TT_ENGT_BOF_LOOP_STIL_COUP_THEWED_COUP_V04.png: The Recreation 变体的 9:16 TikTok 纯摄影封面帧，以上方婚礼剪影和下方同一情侣的厨房举抱复刻建立姿势呼应，仅保留右下角微型 “credit” 标签。
XTW_CONV_MOF_EVG_STIL_THEC_THEWED_ANYO_V04.png: The First Dance, Again 变体的 16:9 X/Twitter quote card，黑底上以大号衬线体呈现钩子文案 “They danced to this once. Watch it again.”，右下角仅保留一小块新人交握双手与婚纱蕾丝的裁切图块，文字先行、非整场景照片。旧版（与 WEB 概念图同暗房两手持照片构图, 仅裁 16:9 加字）备份为 XTW_CONV_MOF_EVG_STIL_THEC_THEWED_ANYO_V04.old.png（已 gitignore）。
XTW_ENGT_BOF_LOOP_STIL_COUP_THEWED_COUP_V04.png: The Recreation 变体的 16:9 X/Twitter quote card，纸白底上以大号黑色衬线体呈现钩子文案 “The pose everyone is talking about. Your kitchen works fine.”，右下角仅保留一小块情侣厨房复刻拥抱的特写图块（肩部以上裁切、图块内无文字），文字先行、非整场景照片。旧版（与 WEB 概念图同构图的剪影+厨房并置, 文案直接压在照片上）备份为 XTW_ENGT_BOF_LOOP_STIL_COUP_THEWED_COUP_V04.old.png（已 gitignore）。

资产契约：渠道成品使用 PNG；APP 提示卡使用 1:1 且关键信息集中于安全圆内；Instagram 纪实静态图使用 1:1 与自然手机摄影质感，仅成员条目明确登记时允许微型 credit 标签；TikTok 封面与纵向旅行衍生图使用 1080×1920，仅成员条目明确登记时允许标题且必须逐字一致；X/Twitter 静帧使用 16:9，标题必须与成员条目逐字一致；保留各自源图的人物与姿势身份锚点，环境以成员条目登记为准；不得含品牌标识、水印或平台 UI；二进制文件不承载 L3 头部，其视觉职责在此登记。

变更日志：2026-07-12 建立 rollout 资产地图并登记婚礼照片修复提示卡；登记两张 TikTok 9:16 封面帧；登记两张 X/Twitter 16:9 静帧；登记两张 Instagram 1:1 厨房纪实静态图；将 TT_CONV 与 TT_ENGT 封面更新为无文案纯摄影版本。2026-07-13 登记巴黎金色时刻举抱衍生图；登记两张品牌收尾卡与两条重拼成片（品牌收尾卡系统 + Recreation 法国转场），旧成片备份为 .old.mp4。渠道 cut 母语化重生成：IG_CONV 换为自拍式手持照片、XTW_CONV 换为黑底 quote card，两者判决理由是原图与 WEB 概念静态图构图重复、读作"同图换尺寸"而非渠道母语再表达；APP_CONV 保留不变。旧图备份为 .old.png（已加入 .gitignore）。同日补齐 v3 Recreation 支线自己的 X cut：XTW_ENGT 换为纸白衬线 quote card（channelCopy 原文入排印 + 右下角厨房拥抱特写图块），判决理由同上——原图是 WEB 概念并置图直接压字，读作"同图换尺寸"；与已过审的黑底 XTW_CONV 同家族不同色，兄弟不双胞。旧图备份为 .old.png；theater 按指令未重录，待巴黎动图任务一并处理。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
