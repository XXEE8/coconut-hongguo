const item = {
  id: "probe-episode",
  title: "Coconut home 测试 v0.0.2",
  name: "Coconut home 测试 v0.0.2",
  cover: "",
  description: "测试模块，不提供播放"
};

const section = {
  id: "probe",
  name: "测试分类",
  title: "测试分类",
  list: [item],
  items: [item]
};

const plugin = {
  id: "hongguo-test",
  name: "红果短剧（测试 v2）",
  version: "0.0.2",

  async home() {
    return {
      list: [item],
      items: [item],
      sections: [section],
      categories: [section]
    };
  },

  async getHome() {
    return this.home();
  },

  async getCategories() {
    return [{ id: "probe", name: "测试分类" }];
  },

  async getVideos(categoryId, page = 1) {
    return { list: [item], page, hasMore: false };
  },

  async search(keyword, page = 1) {
    return { list: [], page, hasMore: false };
  },

  async getDetail(videoId) {
    return { id: videoId, title: item.title, episodes: [] };
  },

  async getPlayUrl() {
    return { url: "" };
  }
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = plugin;
}
