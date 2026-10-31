
/*
 * Coconut Probe v0.0.6
 * Home data format test
 */

var testVideo = {
  id: "test001",
  title: "红果短剧测试",
  name: "红果短剧测试",
  cover: "",
  poster: "",
  description: "用于测试 Coconut 首页接口"
};

globalThis.home = async function () {
  return {
    list: [testVideo],
    items: [testVideo],
    sections: [{
      id: "test",
      title: "测试分类",
      name: "测试分类",
      list: [testVideo],
      items: [testVideo]
    }]
  };
};

globalThis.detail = async function (id) {
  return {
    id: id,
    title: testVideo.title,
    episodes: [{
      id: "ep001",
      title: "第1集"
    }]
  };
};

globalThis.play = async function () {
  return { url: "" };
};

globalThis.search = async function () {
  return { list: [testVideo] };
};
