
/*
 * Coconut Hongguo Probe v0.1.5
 * Home + Details + HLS Playback Test
 *
 * This is a compatibility test.
 * It does not access Hongguo video content.
 */

var testItem = {
  id: "test001",
  title: "Coconut 视频播放测试",
  name: "Coconut 视频播放测试",
  cover: "",
  description: "测试 Coconut 的首页、详情和视频播放功能"
};

var testSection = {
  id: "test",
  title: "测试推荐",
  name: "测试推荐",
  list: [testItem],
  items: [testItem],
  videos: [testItem]
};

// 1. Home
var home = async function () {
  return {
    list: [testItem],
    items: [testItem],
    videos: [testItem],
    sections: [testSection],
    categories: [testSection],
    data: [testItem]
  };
};

// 2. Details
var extractDetails = async function (item) {
  return {
    id: "test001",
    title: "Coconut 视频播放测试",
    name: "Coconut 视频播放测试",
    cover: "",
    description: "公开 HLS 测试视频，验证播放器兼容性",
    episodes: [
      {
        id: "episode001",
        title: "第1集",
        name: "第1集"
      }
    ]
  };
};

// 3. Playback URL
var extractStreamUrl = async function (episode) {
  return {
    url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    headers: {}
  };
};
