
/**
 * Coconut Module Probe v0.0.4
 * ES Module export compatibility test
 */

export const id = "hongguo-probe";
export const name = "红果模块测试";
export const version = "0.0.4";

export async function home() {
  return {
    list: [],
    items: [],
    sections: [],
    categories: []
  };
}

export async function detail(id) {
  return {
    id: id,
    title: "测试视频",
    episodes: []
  };
}

export async function play(id) {
  return {
    url: ""
  };
}

export async function search(keyword) {
  return {
    list: []
  };
}

export async function getHome() {
  return home();
}

export async function getDetail(id) {
  return detail(id);
}

export async function getPlayUrl(id) {
  return play(id);
}
