
/*
 * Coconut Probe v0.0.5
 * Explicit global registration test
 */

var probeHome = async function () {
  return {
    list: [],
    items: [],
    sections: [],
    categories: []
  };
};

var probeDetail = async function (id) {
  return {
    id: id,
    title: "测试视频",
    episodes: []
  };
};

var probePlay = async function (id) {
  return { url: "" };
};

globalThis.home = probeHome;
globalThis.getHome = probeHome;
globalThis.detail = probeDetail;
globalThis.getDetail = probeDetail;
globalThis.play = probePlay;
globalThis.getPlayUrl = probePlay;

globalThis.search = async function () {
  return { list: [] };
};

globalThis.getCategories = async function () {
  return [];
};
