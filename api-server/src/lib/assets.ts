export interface AssetMeta {
  file: string; // 相对 public 的路径
  name: string;
  desc: string;
  width: number;
  height: number;
  bytes: number;
  type: string;
  usedIn: string;
}

export const ASSETS: AssetMeta[] = [
  {
    file: "/logo.png",
    name: "平台 Logo",
    desc: "金色 V + 黑桃徽标，含 V-poker 字样",
    width: 256,
    height: 256,
    bytes: 34288,
    type: "image/png",
    usedIn: "登录页 · 大厅头部 · 管理后台",
  },
  {
    file: "/art/lobby-bg.jpg",
    name: "大厅背景",
    desc: "蓝丝绒帷幕 + 赌桌 + 金色光斑，中央留空给 UI",
    width: 1600,
    height: 900,
    bytes: 160305,
    type: "image/jpeg",
    usedIn: "全站背景 .stage",
  },
  {
    file: "/art/felt.jpg",
    name: "牌桌毛毡",
    desc: "深绿丝绒台面纹理，含金色弧线与聚光",
    width: 1200,
    height: 900,
    bytes: 75660,
    type: "image/jpeg",
    usedIn: "椭圆牌桌台面 .table-felt",
  },
  {
    file: "/art/texas.jpg",
    name: "德州扑克 · 游戏图标",
    desc: "黑西装男荷官手持两张 A，赌场内景",
    width: 600,
    height: 750,
    bytes: 72012,
    type: "image/jpeg",
    usedIn: "大厅游戏卡片 · 游戏入口头图",
  },
  {
    file: "/art/jinhua.jpg",
    name: "赢三张（金花）· 游戏图标",
    desc: "红裙女郎手持三张扇形牌，紫金背景",
    width: 600,
    height: 750,
    bytes: 71622,
    type: "image/jpeg",
    usedIn: "大厅游戏卡片 · 游戏入口头图",
  },
  {
    file: "/art/sangong.jpg",
    name: "三公 · 游戏图标",
    desc: "卡通国王戴金冠持牌，宫殿王座背景",
    width: 600,
    height: 750,
    bytes: 84079,
    type: "image/jpeg",
    usedIn: "大厅游戏卡片 · 游戏入口头图",
  },
  {
    file: "/art/niuniu.jpg",
    name: "抢庄斗牛 · 游戏图标",
    desc: "卡通金角公牛戴冠持牌，红金喜庆背景",
    width: 600,
    height: 750,
    bytes: 73100,
    type: "image/jpeg",
    usedIn: "大厅游戏卡片 · 游戏入口头图",
  },
  {
    file: "/art/banner.jpg",
    name: "活动横幅",
    desc: "金色扑克筹码飞舞横幅，用于大厅顶部",
    width: 1400,
    height: 438,
    bytes: 98399,
    type: "image/jpeg",
    usedIn: "大厅活动横幅",
  },
  {
    file: "/art/felt-texas.jpg",
    name: "德州牌桌毛毡（经典绿）",
    desc: "德州扑克专属绿色台面",
    width: 1200,
    height: 900,
    bytes: 19576,
    type: "image/jpeg",
    usedIn: "德州房间牌桌",
  },
  {
    file: "/art/felt-jinhua.jpg",
    name: "金花牌桌毛毡（酒红）",
    desc: "赢三张专属酒红台面",
    width: 1200,
    height: 900,
    bytes: 22519,
    type: "image/jpeg",
    usedIn: "赢三张房间牌桌",
  },
  {
    file: "/art/felt-sangong.jpg",
    name: "三公牌桌毛毡（皇家紫）",
    desc: "三公专属紫色台面",
    width: 1200,
    height: 900,
    bytes: 16221,
    type: "image/jpeg",
    usedIn: "三公房间牌桌",
  },
  {
    file: "/art/felt-niuniu.jpg",
    name: "斗牛牌桌毛毡（金棕）",
    desc: "斗牛专属金棕台面",
    width: 1200,
    height: 900,
    bytes: 30011,
    type: "image/jpeg",
    usedIn: "斗牛房间牌桌",
  },
  {
    file: "/apple-touch-icon.png",
    name: "网站图标 · Apple Touch",
    desc: "iOS 添加到主屏图标 180×180",
    width: 180,
    height: 180,
    bytes: 63281,
    type: "image/png",
    usedIn: "iOS 主屏图标 / PWA",
  },
  {
    file: "/icon-192.png",
    name: "网站图标 192",
    desc: "PWA / Android 图标",
    width: 192,
    height: 192,
    bytes: 71755,
    type: "image/png",
    usedIn: "PWA manifest",
  },
  {
    file: "/icon-512.png",
    name: "网站图标 512",
    desc: "PWA / 启动图标",
    width: 512,
    height: 512,
    bytes: 78000,
    type: "image/png",
    usedIn: "PWA manifest",
  },
  {
    file: "/avatars/1.png",
    name: "头像 1 · 蓝衣绅士",
    desc: "圆形玩家头像",
    width: 256,
    height: 256,
    bytes: 113823,
    type: "image/png",
    usedIn: "玩家头像可选项",
  },
  {
    file: "/avatars/2.png",
    name: "头像 2 · 红裙女郎",
    desc: "圆形玩家头像",
    width: 256,
    height: 256,
    bytes: 115900,
    type: "image/png",
    usedIn: "玩家头像可选项",
  },
  {
    file: "/avatars/3.png",
    name: "头像 3 · 牛仔",
    desc: "圆形玩家头像",
    width: 256,
    height: 256,
    bytes: 127832,
    type: "image/png",
    usedIn: "玩家头像可选项",
  },
  {
    file: "/avatars/4.png",
    name: "头像 4 · 国王",
    desc: "圆形玩家头像",
    width: 256,
    height: 256,
    bytes: 139393,
    type: "image/png",
    usedIn: "玩家头像可选项",
  },
  {
    file: "/avatars/5.png",
    name: "头像 5 · 公牛",
    desc: "圆形玩家头像",
    width: 256,
    height: 256,
    bytes: 133165,
    type: "image/png",
    usedIn: "玩家头像可选项",
  },
  {
    file: "/avatars/6.png",
    name: "头像 6 · 礼帽绅士",
    desc: "圆形玩家头像",
    width: 256,
    height: 256,
    bytes: 114265,
    type: "image/png",
    usedIn: "玩家头像可选项",
  },
  {
    file: "/avatars/7.png",
    name: "头像 7 · 狐狸",
    desc: "圆形玩家头像",
    width: 256,
    height: 256,
    bytes: 140203,
    type: "image/png",
    usedIn: "玩家头像可选项",
  },
  {
    file: "/avatars/8.png",
    name: "头像 8 · 熊猫",
    desc: "圆形玩家头像",
    width: 256,
    height: 256,
    bytes: 120000,
    type: "image/png",
    usedIn: "玩家头像可选项",
  },
  {
    file: "/art/table-bg.jpg",
    name: "赌桌实景（备用）",
    desc: "俯视写实赌桌，桃花心木围栏 + 筹码",
    width: 1400,
    height: 1000,
    bytes: 129148,
    type: "image/jpeg",
    usedIn: "备用素材（当前未引用）",
  },
];

export const ZIP_FILE = "/download/vpoker-assets.zip";
export const APP_FILE = "/download/vpoker-hbuilder-app.zip";

/** 依据请求推导出对外可访问的 https 站点根地址 */
export function siteOrigin(req: { headers: Record<string, string | string[] | undefined> }): string {
  const h = req.headers;
  const xfProto = h["x-forwarded-proto"];
  const xfHost = h["x-forwarded-host"];
  const host = String(xfHost || h["host"] || "localhost:3000");
  const isLocal = /^(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/.test(host);
  const proto = String(xfProto || (isLocal ? "http" : "https"));
  return `${proto}://${host}`;
}

export function humanSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}
