
/*
 * Coconut Probe v0.1.4
 * Test grouped home response
 */

var testItem = {
  id: "test001",
  title: "Coconut 首页测试",
  name: "Coconut 首页测试",
  cover: "",
  description: "首页数据结构测试"
};

var testSection = {
  id: "test",
  title: "测试推荐",
  name: "测试推荐",
  list: [testItem],
  items: [testItem],
  videos: [testItem]
};

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

var extractDetails = async function () {
  return {
    id: "test001",
    title: "Coconut 首页测试",
    episodes: [
      {
        id: "episode001",
        title: "第1集"
      }
    ]
  };
};

var extractStreamUrl = async function () {
  return {
    url: ""
  };
};
