
/*
 * Coconut Probe v0.1.2
 * Top-level function registration test
 */

var home = async function () {
  return {
    list: [
      {
        id: "test001",
        title: "顶层函数测试",
        name: "顶层函数测试",
        cover: "",
        description: "测试 Coconut 是否识别顶层函数"
      }
    ]
  };
};

var extractDetails = async function () {
  return {
    id: "test001",
    title: "顶层函数测试",
    description: "详情接口测试",
    episodes: [
      {
        id: "ep001",
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
