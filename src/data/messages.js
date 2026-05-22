const seedMessages = [
  {
    id: 1,
    type: '系统公告',
    title: '版本更新通知',
    content: 'v2.3.0 已发布，新增夜间模式与消息置顶功能，建议尽快升级体验。',
    time: '今天 10:20',
    read: false,
  },
  {
    id: 2,
    type: '活动消息',
    title: '春季签到活动开启',
    content: '连续签到 7 天可领取专属头像框，活动时间截至本周日 24:00。',
    time: '今天 08:35',
    read: false,
  },
  {
    id: 3,
    type: '账号提醒',
    title: '异地登录提醒',
    content: '你的账号于昨天 22:17 在新设备登录，如非本人操作请立即修改密码。',
    time: '昨天 22:17',
    read: true,
  },
  {
    id: 4,
    type: '安全中心',
    title: '安全建议',
    content: '开启二次验证可进一步保护账号安全，前往设置 > 安全中心开启。',
    time: '04-10 16:02',
    read: true,
  },
];

module.exports = { seedMessages };
