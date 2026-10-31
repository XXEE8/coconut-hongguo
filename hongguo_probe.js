
/*
 * Coconut Probe v0.1.3
 * Test direct-array home response
 */

var home = async function () {
  return [
    {
      id: "test001",
      title: "Coconut 首页测试",
      name: "Coconut 首页测试",
      cover: "",
      description: "测试首页直接返回数组"
    }
  ];
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
