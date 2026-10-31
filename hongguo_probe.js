
/**
 * Coconut - Hongguo Compatibility Probe
 * Version: 0.0.1
 * Purpose: Test Coconut JS module loading.
 * Not a working video source.
 */

const plugin = {
  id: "hongguo-test",
  name: "红果短剧（测试）",
  version: "0.0.1",
  description: "Coconut JavaScript 模块兼容性测试",

  async getCategories() {
    return [
      { id: "test", name: "测试分类" }
    ];
  },

  async getVideos(categoryId, page = 1) {
    return {
      list: [
        {
          id: "test-video",
          title: "红果模块测试",
          cover: "",
          description: "仅用于验证模块加载"
        }
      ],
      page,
      hasMore: false
    };
  },

  async search(keyword, page = 1) {
    return { list: [], page, hasMore: false };
  },

  async getDetail(videoId) {
    return {
      id: videoId,
      title: "红果模块测试",
      episodes: []
    };
  },

  async getPlayUrl(videoId, episodeId) {
    return { url: "" };
  }
};

if (typeof module !== "undefined") {
  module.exports = plugin;
}
