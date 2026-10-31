
/*
 * Coconut Compatibility Probe v0.0.3
 * Test global function registration
 */

const testItem = {
  id: "test001",
  title: "红果短剧接口测试",
  name: "红果短剧接口测试",
  cover: "",
  description: "Coconut 全局函数测试"
};

async function home() {
  return {
    list: [testItem],
    items: [testItem],
    sections: [],
    categories: []
  };
}

async function getHome() {
  return await home();
}

async function detail(id) {
  return {
    id: id,
    title: testItem.title,
    episodes: []
  };
}

async function getDetail(id) {
  return await detail(id);
}

async function play(id) {
  return { url: "" };
}

async function getPlayUrl(id) {
  return await play(id);
}

async function search(keyword) {
  return {
    list: [],
    items: []
  };
}

async function category() {
  return [];
}

async function getCategories() {
  return [];
}
