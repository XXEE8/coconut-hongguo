
/*
 * Coconut Probe v0.0.7
 * Global object registration test
 */

var testItem = {
  id: "test001",
  title: "Coconut 接口测试",
  name: "Coconut 接口测试",
  cover: "",
  description: "测试模块接口"
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
      id: id,
      title: testItem.title,
      episodes: []
    };
  },

  play: async function () {
    return { url: "" };
  },

  search: async function () {
    return { list: [] };
  }
};

globalThis.home = api.home;
globalThis.detail = api.detail;
globalThis.play = api.play;
globalThis.search = api.search;

globalThis.plugin = api;
globalThis.moduleApi = api;
globalThis.coconut = api;
