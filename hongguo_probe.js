
/*
 * Coconut Hongguo Probe v0.0.9
 * Test home, extractDetails and play interfaces
 * This is a compatibility test, not a video source.
 */

var testItem = {
  id: "test001",
  title: "Coconut 接口测试",
  name: "Coconut 接口测试",
  cover: "",
  description: "红果模块兼容性测试"
};

var api = {
  home: async function () {
    return {
      list: [testItem],
      items: [testItem]
    };
  },

  detail: async function (id) {
    return {
      id: "test001",
      title: "Coconut 接口测试",
      name: "Coconut 接口测试",
      cover: "",
      description: "测试详情接口",
      episodes: [
        {
          id: "episode001",
          title: "第1集",
          name: "第1集"
        }
      ]
    };
  },

  play: async function () {
    return {
      url: ""
    };
  },

  search: async function () {
    return {
      list: [testItem],
      items: [testItem]
    };
  }
};

// Detail interface required by Coconut
api.extractDetails = async function (item) {
  return await api.detail(item);
};

// Register global functions
globalThis.home = api.home;
globalThis.detail = api.detail;
globalThis.extractDetails = api.extractDetails;
globalThis.play = api.play;
globalThis.search = api.search;

// Register global API objects
globalThis.plugin = api;
globalThis.moduleApi = api;
globalThis.coconut = api;

// Additional compatibility aliases
globalThis.getHome = api.home;
globalThis.getDetail = api.detail;
globalThis.getPlayUrl = api.play;
globalThis.getCategories = async function () {
  return [];
};
