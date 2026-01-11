/**
 * ===================================================================================
 *  ** 开局配置指南 (CONTRIBUTION GUIDE) **
 * ===================================================================================
 *  此配置用于定义“开局导航器”中的每一个开局卡片。
 *  角色卡贡献者应修改下方的 `STARTUP_SCENARIOS` 数组来增加或调整开局。
 *
 *  **[如何添加新开局]**
 *  1. 在 `STARTUP_SCENARIOS` 数组中添加一个新的对象 `{ ... }`。
 *  2. 确保 `swipeId` 是唯一的，并且对应酒馆消息编辑器中的 Swipe 序号（从1开始）。
 *  3. 填写 `title` (显示标题) 和世界书控制逻辑 (`linkedWorldInfo`, `disabledWorldInfo`)。
 *
 *  **[字段说明]**
 *  - `swipeId`: (number) 必填。对应第一条消息的 Swipe ID。
 *  - `title`: (string) 必填。显示在 UI 卡片上的文字。
 *  - `linkedWorldInfo`: (string[]) 选填。点击该开局时，需要**强制开启**的世界书条目名称列表。
 *  - `disabledWorldInfo`: (string[]) 选填。点击该开局时，需要**强制关闭**的世界书条目名称列表。
 *
 *  **[示例]**
 *  {
 *    "swipeId": 99,
 *    "title": "测试开局：关闭阿米娅",
 *    "linkedWorldInfo": ["罗德岛", "凯尔希"],  // 将会开启“罗德岛”和“凯尔希”
 *    "disabledWorldInfo": ["阿米娅"]           // 将会关闭“阿米娅”
 *  }
 * ===================================================================================
 */

export interface Scenario {
  swipeId: number;
  title: string;
  linkedWorldInfo: string[];
  disabledWorldInfo?: string[];
}

export const STARTUP_SCENARIOS: Scenario[] = [
  { "swipeId": 1, "title": "“作为博士被正常唤醒”", "linkedWorldInfo": ["阿米娅（本格，与幼年、医疗、炉芯终曲选一开）","罗德岛"], disabledWorldInfo: ["Mon3tr","Mon3tr锚定","博士","user锚定"]},
  { "swipeId": 2, "title": "“依旧博士，但唤醒你的是W？”", "linkedWorldInfo": ["W（本格，与维什戴尔选一开）","萨卡兹","巴别塔"], disabledWorldInfo: ["Mon3tr","Mon3tr锚定","博士","user锚定"]},
  { "swipeId": 3, "title": "“关于我莫名其妙的来到泰拉并成为了两只幼龙的监护人这件事”", "linkedWorldInfo": ["维多利亚","爱布拉娜·都柏林（幼龙，与本格选一开）","拉芙希妮·都柏林（幼龙，与本格、异格选一开）"]},
  { "swipeId": 4, "title": "“企鹅物流，我是来面试的，你们要干什么？！”", "linkedWorldInfo": ["企鹅物流","能天使（本格，与幼年、异格选一开）","德克萨斯（本格，与幼狼、异格选一开）","空","可颂"]},
  { "swipeId": 5, "title": "“企鹅物流，每天都被请去喝茶的同事们真的太逊了”", "linkedWorldInfo": ["大帝","伊斯","企鹅物流"]},
  { "swipeId": 6, "title": "“燎原”", "linkedWorldInfo": ["塔露拉（斗士，与黑蛇选一开）","阿丽娜","乌萨斯"] },
  { "swipeId": 7, "title": "“穿越了，但穿的是迷迭香”", "linkedWorldInfo": ["迷迭香","凯尔希（本格，与Ama-10、巴别塔、预见末日的贤人选一开）","罗德岛"] },
  { "swipeId": 8, "title": "“终末地”", "linkedWorldInfo": ["佩丽卡","管理员","终末地（非游玩时请关闭）"] },
  { "swipeId": 9, "title": "“海嗣灭世”", "linkedWorldInfo": ["浊心斯卡蒂（异格，与本格选一开）","海嗣","海嗣灭世（非游玩时请关闭）"], disabledWorldInfo: ["斯卡蒂（本格，与异格选一开）"]},
  { "swipeId": 10, "title": "“你与她的终末”", "linkedWorldInfo": ["海嗣","你与她的终末（非游玩时请关闭）","浊心斯卡蒂（异格，与本格选一开）"], disabledWorldInfo: ["斯卡蒂（本格，与异格选一开）"]},
  { "swipeId": 11, "title": "“罗德岛学院，18岁，事学生”", "linkedWorldInfo": ["罗德岛学院（非游玩时请关闭）"] },
  { "swipeId": 12, "title": "“罗德岛学院，24岁，事教师”", "linkedWorldInfo": ["罗德岛学院（非游玩时请关闭）"] },
  { "swipeId": 13, "title": "“加油啊，制作人”", "linkedWorldInfo": ["塞壬唱片MSR","尤里卡","阮薇薇","遥"] },
  { "swipeId": 14, "title": "“898年卡兹戴尔新任魔王，欸？我打凯尔希+三国联军？真的假的？”", "linkedWorldInfo": ["卡兹戴尔","萨卡兹","预见末日的贤人"], disabledWorldInfo: ["凯尔希（本格，与Ama-10、巴别塔、预见末日的贤人选一开）","Mon3tr","Mon3tr锚定","特蕾西娅（本格，与898年、巴别塔、魔王选一开）","特雷西斯（本格，与898年、内战选一开）","菈玛莲（本格，与898年选一开）","食腐者之王（本格，与898年选一开）","弗莱蒙特（本格，与898年选一开）","爱国者（本格，与博卓卡斯替选一开）","巴别塔","罗德岛"]},
  { "swipeId": 15, "title": "“罗德岛新晋，无名小卒还是名扬天下？”", "linkedWorldInfo": ["罗德岛"] },
  { "swipeId": 16, "title": "“反常光谱”", "linkedWorldInfo": ["Mantra","极境"] },
  { "swipeId": 17, "title": "“巴别塔的恶灵”", "linkedWorldInfo": ["卡兹戴尔","巴别塔","特蕾西娅（巴别塔，与本格、898年、魔王选一开）","凯尔希（巴别塔，与Ama-10、本格、预见末日的贤人选一开）","阿米娅（幼年，与本格、医疗、炉芯终曲选一开）"], disabledWorldInfo: ["Mon3tr","Mon3tr锚定","博士","user锚定","特蕾西娅（本格，与898年、巴别塔、魔王选一开）","特雷西斯（内战，与本格、898年选一开）"]},
  { "swipeId": 18, "title": "“谢邀，人在13000年前，二人一猫星间漂流”", "linkedWorldInfo": ["普瑞赛斯","Ama-10（与凯尔希、巴别塔、预见末日的贤人选一开）"], disabledWorldInfo: ["Mon3tr","Mon3tr锚定","博士","user锚定"]},
  { "swipeId": 19, "title": "“你们这里谁最会构史？”", "linkedWorldInfo": ["妮芙","锡人"] },
  { "swipeId": 20, "title": "“卡西米尔一般路过游客（并非）”", "linkedWorldInfo": ["卡西米尔"] },
  { "swipeId": 21, "title": "“我的幼驯染天使”", "linkedWorldInfo": ["拉特兰","蕾缪乐（幼年，与本格、异格选一开）"], disabledWorldInfo: ["能天使（本格，与幼年、异格选一开）","蕾缪安（本格，与少女选一开）","莫斯提马（本格，与少女选一开）","菲亚梅塔（本格，与少女选一开）","塑心（本格，与幼年选一开）","圣约送葬人（异格，与幼年、本格选一开）"]},
  { "swipeId": 22, "title": "“莱茵生命纪实”", "linkedWorldInfo": ["克丽斯腾","塞雷娅","莱茵生命"] },
  { "swipeId": 23, "title": "“岁岁今朝”", "linkedWorldInfo": ["炎","朔（早年，与本格重岳选一开）","颉（整合了现有信息的先行版，非游玩时请关闭）"], disabledWorldInfo: ["年（本格，与早年选一开）","夕（本格，与早年选一开）","令（本格，与早年选一开）","黍（本格，与早年选一开）","重岳（本格，与朔选一开）","余（本格，与早年选一开）","绩（本格，与早年选一开）","易（本格，与早年选一开）","望（本格，与早年选一开）"]},
  { "swipeId": 24, "title": "“泰拉万事屋”", "linkedWorldInfo": ["荒芜拉普兰德（无序的谦卑，与幼狼、本格、异格选一开）"], disabledWorldInfo: ["拉普兰德（本格，与幼狼、异格、无序的谦卑选一开）"]},
  { "swipeId": 25, "title": "“摸鱼侦探事务所”", "linkedWorldInfo": ["鲤氏侦探事务所","老鲤","槐琥","吽","阿"] },
  { "swipeId": 26, "title": "“博士救出作战第一号”", "linkedWorldInfo": ["阿米娅（本格，与幼年、医疗、炉芯终曲选一开）","Ace","Scout"] },
  { "swipeId": 27, "title": "“当佣兵何尝不算是一种搜打撤”", "linkedWorldInfo": ["卡兹戴尔","W（本格，与维什戴尔选一开）","伊内丝","赫德雷"] },
  { "swipeId": 28, "title": "“虽然引导并未破碎，但也请您成为真龙”", "linkedWorldInfo": ["炎","太傅","太尉"] },
  { "swipeId": 29, "title": "“企鹅物流保姆这一块”", "linkedWorldInfo": ["能天使（本格，与幼年、异格选一开）","德克萨斯（本格，与幼狼、异格选一开）","空","可颂","企鹅物流"] },
  { "swipeId": 30, "title": "“博士的日常”", "linkedWorldInfo": ["罗德岛"], disabledWorldInfo: ["Mon3tr","Mon3tr锚定","博士","user锚定"]},
  { "swipeId": 31, "title": "“开门，社区送温暖！”", "linkedWorldInfo": ["龙门"] },
  { "swipeId": 32, "title": "“我补药当超级烂片大王口牙”", "linkedWorldInfo": ["炎","年（本格，与早年选一开）"] },
  { "swipeId": 33, "title": "“兄啊，你要老婆不要”", "linkedWorldInfo": ["老鲤"], disabledWorldInfo: ["Mon3tr","Mon3tr锚定","博士","user锚定"]},
  { "swipeId": 34, "title": "“修道院往事”", "linkedWorldInfo": ["拉特兰","聆音","埃莉丝","空弦","塑心（本格，与幼年选一开）"] },
  { "swipeId": 35, "title": "“双狼记”", "linkedWorldInfo": ["叙拉古","切利尼娜·德克萨斯（幼狼，与本格、异格选一开）","拉普兰德·萨卢佐（幼狼，与本格、异格、无序的谦卑选一开）"], disabledWorldInfo: ["德克萨斯（本格，与幼狼、异格选一开）","拉普兰德（本格，与幼狼、异格、无序的谦卑选一开）"]},
  { "swipeId": 36, "title": "“漆黑钢铁的琶音”", "linkedWorldInfo": ["黑钢","芙兰卡","雷蛇","杰西卡"] },
  { "swipeId": 37, "title": "“You！”", "linkedWorldInfo": ["维多利亚","澄闪"] },
  { "swipeId": 38, "title": "“夏日、阳光、海滩！”", "linkedWorldInfo": ["汐斯塔","Mon3tr","特蕾西娅（本格，与898年、巴别塔、魔王选一开）","凯尔希（本格，与Ama-10、巴别塔、预见末日的贤人选一开）","阿米娅（本格，与幼年、医疗、炉芯终曲选一开）"], disabledWorldInfo: ["博士","user锚定"]},
  { "swipeId": 39, "title": "“往日种种，你当真不记得了？”", "linkedWorldInfo": ["普瑞赛斯","博士","凯尔希（本格，与Ama-10、巴别塔、预见末日的贤人选一开）","Mon3tr"], disabledWorldInfo: ["Mon3tr","Mon3tr锚定","博士","user锚定"]},
  { "swipeId": 40, "title": "“什么叫构史成真了？”", "linkedWorldInfo": ["罗德岛","泰拉大陆调查团","能天使（本格，与幼年、异格选一开）","新约能天使（异格，与幼年、本格选一开）","德克萨斯（本格，与幼狼、异格选一开）","缄默德克萨斯（异格，与少女、本格选一开）","斯卡蒂（本格，与异格选一开）","浊心斯卡蒂（异格，与本格选一开）","妮芙","构史成真（非游玩时请关闭喵）"] },
  { "swipeId": 41, "title": "“深海猎人，血脉相连”", "linkedWorldInfo": ["阿戈尔","斯卡蒂（本格，与异格选一开）","幽灵鲨（本格，与异格选一开）","歌蕾蒂娅","乌尔比安"], disabledWorldInfo: ["归溟幽灵鲨（异格，与本格选一开）"]},
  { "swipeId": 42, "title": "“匡 扶 深 池”", "linkedWorldInfo": ["维多利亚","深池","蔓德拉","苇草（本格，与幼龙、异格选一开）","死芒（本格，与幼龙选一开）"], disabledWorldInfo: ["拉芙希妮·都柏林（幼龙，与本格、异格选一开）","爱布拉娜·都柏林（幼龙，与本格选一开）"]},
  { "swipeId": 43, "title": "“释放你的想象力，在这里开启属于你的故事吧！”", "linkedWorldInfo": [] },
  { "swipeId": 44, "title": "“狐の言（作者的话）”", "linkedWorldInfo": [] }
];
