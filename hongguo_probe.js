
/*
 * Coconut Hongguo Probe v0.1.1
 * Home / Details / Stream URL compatibility
 */

var testItem = {
  id: "test001",
  title: "Coconut 接口测试",
  name: "Coconut 接口测试",
  cover: "",
  description: "红果模块兼容性测试"
};

var testEpisode = {
  id: "episode001",
  title: "第1集",
  name: "第1集"
};

var api = {

  home: async function () {
    return {
      list: [testItem],
      items: [testItem]
    };
  },

  extractDetails: async function (item) {
    return {
      id: "test001",
      title: "Coconut 接口测试",
      name: "Coconut 接口测试",
      cover: "",
      description: "详情接口测试",
      episodes: [testEpisode]
    };
  },

  extractStreamUrl: async function (episode) {
    return {
      url: "",
      headers: {}
    };
  },

  search: async function (keyword) {
    return {
      list: [testItem],
      items: [testItem]
    };
  }

};

// Compatibility aliases
api.detail = api.extractDetails;
api.play = api.extractStreamUrl;
api.getHome = api.home;
api.getDetail = api.extractDetails;
api.getPlayUrl = api.extractStreamUrl;

// Register global functions
globalThis.home = api.home;
globalThis.extractDetails = api.extractDetails;
globalThis.extractStreamUrl = api.extractStreamUrl;
globalThis.search = api.search;

globalThis.detail = api.detail;
globalThis.play = api.play;
globalThis.getHome = api.getHome;
globalThis.getDetail = api.getDetail;
globalThis.getPlayUrl = api.getPlayUrl;

// Register API objects
globalThis.plugin = api;
globalThis.moduleApi = api;
globalThis.coconut = api;
